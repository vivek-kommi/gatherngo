(() => {
  const form = document.getElementById('fareForm');
  if (!form) return; // this page has no fleet estimator

  const grid = document.getElementById('fleetGrid');
  const statusEl = document.getElementById('fareStatus');
  const summaryEl = document.getElementById('fareSummary');
  const submitBtn = document.getElementById('fareSubmit');
  const submitLabel = submitBtn.querySelector('.fare-submit-label');

  // 2026 England & Wales bank holidays. A short, honest list rather than a
  // full calendar library — good enough for a live estimate, and the small
  // print already says a driver confirms the final price.
  const BANK_HOLIDAYS_2026 = ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28'];

  const PERSON_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="7" r="3.4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  const CASE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke-linecap="round"/></svg>';
  const BAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><rect x="5" y="9" width="14" height="11" rx="2"/><path d="M8 9V7a4 4 0 0 1 8 0v2" stroke-linecap="round"/></svg>';

  // Mileage/time/airport/extras are identical for every vehicle — only the
  // large-vehicle surcharge and minimum fare differ, per the brief.
  const VEHICLES = [
    { id: 'standard', name: 'Standard Car', tag: 'Saloon', passengers: 4, largeVehicle: false, minimumFare: 25,
      luggage: [{ cases: 2, bags: 1 }, { cases: 1, bags: 2 }], maxItems: 3 },
    { id: 'estate', name: 'Estate', tag: 'Estate car', passengers: 4, largeVehicle: false, minimumFare: 27,
      luggage: [{ cases: 2, bags: 2 }, { cases: 3, bags: 1 }, { cases: 1, bags: 3 }], maxItems: 4 },
    { id: 'five', name: '5 Seater', tag: 'MPV', passengers: 5, largeVehicle: false, minimumFare: 32,
      luggage: [{ cases: 2, bags: 2 }], maxItems: 4 },
    { id: 'eight', name: '8 Seater', tag: 'Minibus', passengers: 8, largeVehicle: true, minimumFare: 45,
      luggage: [{ cases: 8, bags: 0 }, { cases: 6, bags: 2 }, { cases: 5, bags: 3 }], maxItems: 8 },
    { id: 'nine', name: '9 Seater', tag: 'Minibus', passengers: 9, largeVehicle: true, minimumFare: 48,
      luggage: [{ cases: 9, bags: 0 }, { cases: 7, bags: 2 }, { cases: 6, bags: 3 }], maxItems: 9 },
  ];

  const money = (n) => `£${n.toFixed(0)}`;

  const findAirport = (address) => {
    const airports = window.GNG_AIRPORTS || [];
    const norm = address.trim().toLowerCase();
    return airports.find(a => norm === a.value.toLowerCase())
      || airports.find(a => norm.startsWith(a.label.toLowerCase()))
      || null;
  };

  const extractPostcode = (address) => {
    const m = address.match(/[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\s?[0-9][A-Za-z]{2}$/);
    return m ? m[0] : null;
  };

  // Resolves an address to {lat, lon, charge, label}. Airports resolve
  // instantly from the shared dataset; everything else is geocoded from its
  // postcode via postcodes.io, which is exact (no ambiguous free-text match).
  const geocode = async (address) => {
    const airport = findAirport(address);
    if (airport) {
      return { lat: airport.lat, lon: airport.lon, charge: airport.charge, label: airport.name, isAirport: true };
    }
    const postcode = extractPostcode(address);
    if (!postcode) throw new Error(`Couldn't find a postcode in "${address}".`);
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const data = await res.json();
    if (!data || !data.result) throw new Error(`"${postcode}" doesn't look like a real postcode.`);
    return { lat: data.result.latitude, lon: data.result.longitude, charge: 0, label: postcode, isAirport: false };
  };

  // Free public OSRM demo router — real driving distance/time, no API key.
  const route = async (from, to) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data && data.routes && data.routes[0];
    if (!r) throw new Error('No driving route found between those two points.');
    return { miles: r.distance / 1609.344, minutes: r.duration / 60 };
  };

  const isNight = (timeStr) => {
    if (!timeStr) return false;
    const hour = parseInt(timeStr.split(':')[0], 10);
    return hour >= 22 || hour < 6;
  };

  const isWeekendOrHoliday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T12:00:00`);
    const day = d.getDay();
    return day === 0 || day === 6 || BANK_HOLIDAYS_2026.includes(dateStr);
  };

  // The shared trip cost before any vehicle-specific surcharge or the
  // night/weekend multipliers — see the "Algorithm" section of the brief.
  const baseFare = ({ miles, minutes, airportCharge, extraLuggage, meetAndGreet }) => {
    let fare = 5.0; // base fare
    if (miles <= 10) fare += miles * 2.2;
    else fare += 10 * 2.2 + (miles - 10) * 1.8;
    fare += minutes * 0.3;
    fare += airportCharge;
    if (extraLuggage) fare += 5;
    if (meetAndGreet) fare += 15;
    return fare;
  };

  const finalizeFare = (base, { largeVehicle, night, weekend, minimumFare }) => {
    let fare = base;
    if (largeVehicle) fare += 20;
    if (night) fare *= 1.15;
    if (weekend) fare *= 1.1;
    fare = Math.max(fare, minimumFare);
    return Math.ceil(fare);
  };

  const luggageLine = (opt) => {
    const parts = [];
    if (opt.cases) parts.push(`${CASE_ICON}<span>× ${opt.cases}</span>`);
    if (opt.bags) parts.push(`${BAG_ICON}<span>× ${opt.bags}</span>`);
    return `<span class="cap-combo">${parts.join('')}</span>`;
  };

  const renderFleet = () => {
    grid.innerHTML = VEHICLES.map(v => `
      <article class="fleet-card" data-vehicle="${v.id}">
        <div class="fleet-card-head">
          <h3>${v.name}</h3>
          <span class="fleet-tag">${v.tag}</span>
        </div>
        <div class="fleet-capacity">
          <span class="cap-people">${PERSON_ICON}<span>× ${v.passengers}</span></span>
          <div class="cap-luggage">${v.luggage.map(luggageLine).join('<span class="cap-or">or</span>')}</div>
          <span class="cap-max">Max ${v.maxItems} items</span>
        </div>
        <p class="fleet-fit-note" data-fit-note hidden></p>
        <div class="fleet-fare">
          <div class="fare-row"><span>One way</span><strong class="fare-value" data-fare="oneway">Enter trip details</strong></div>
          <div class="fare-row"><span>Return</span><strong class="fare-value" data-fare="return">—</strong></div>
        </div>
        <button type="button" class="btn btn-primary btn-block fleet-book" data-book disabled>Book this vehicle</button>
      </article>
    `).join('');
  };

  const setStatus = (msg, tone) => {
    statusEl.textContent = msg || '';
    statusEl.className = 'fare-status' + (tone ? ` is-${tone}` : '');
  };

  const tripState = { ready: false };

  const updateFleetUI = () => {
    const cards = grid.querySelectorAll('.fleet-card');

    // The smallest vehicle that still seats everyone — not just "close to"
    // the passenger count, since e.g. 6 passengers best fits an 8 seater,
    // not a car, even though the gap is more than one seat.
    let bestFitId = null;
    if (tripState.ready) {
      const fitting = VEHICLES.filter(v => v.passengers >= tripState.passengers);
      if (fitting.length) {
        bestFitId = fitting.reduce((a, b) => (b.passengers < a.passengers ? b : a)).id;
      }
    }

    cards.forEach(card => {
      const id = card.dataset.vehicle;
      const vehicle = VEHICLES.find(v => v.id === id);
      const oneWayEl = card.querySelector('[data-fare="oneway"]');
      const returnEl = card.querySelector('[data-fare="return"]');
      const bookBtn = card.querySelector('[data-book]');
      const fitNote = card.querySelector('[data-fit-note]');

      if (!tripState.ready) {
        oneWayEl.textContent = 'Enter trip details';
        returnEl.textContent = '—';
        bookBtn.disabled = true;
        fitNote.hidden = true;
        card.classList.remove('is-undersized', 'is-best-fit');
        return;
      }

      const oneWay = finalizeFare(tripState.base, { largeVehicle: vehicle.largeVehicle, night: tripState.night, weekend: tripState.weekend, minimumFare: vehicle.minimumFare });
      const ret = oneWay * 2;
      oneWayEl.textContent = money(oneWay);
      returnEl.textContent = money(ret);
      bookBtn.disabled = false;

      const undersized = vehicle.passengers < tripState.passengers;
      card.classList.toggle('is-undersized', undersized);
      fitNote.hidden = !undersized;
      if (undersized) fitNote.textContent = `Seats fewer than your ${tripState.passengers} passengers`;
      card.classList.toggle('is-best-fit', vehicle.id === bestFitId);
    });
  };

  const buildWhatsAppUrl = (vehicle, oneWay, ret) => {
    const fd = new FormData(form);
    const lines = ['Hi Gather & Go, I\'d like to book based on this fare estimate:'];
    lines.push(`Vehicle: ${vehicle.name}`);
    lines.push(`Pickup: ${fd.get('pickup')}`);
    lines.push(`Drop-off: ${fd.get('dropoff')}`);
    lines.push(`Date: ${fd.get('date')}`);
    lines.push(`Time: ${fd.get('time')}`);
    lines.push(`Passengers: ${fd.get('passengers')}`);
    if (document.getElementById('fareExtraLuggage').checked) lines.push('Extra luggage: yes');
    if (document.getElementById('fareMeetGreet').checked) lines.push('Meet & greet: yes');
    lines.push(`Estimated one way: ${money(oneWay)}`);
    lines.push(`Estimated return: ${money(ret)}`);
    return `https://wa.me/447359270309?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-book]');
    if (!btn || btn.disabled) return;
    const card = btn.closest('.fleet-card');
    const vehicle = VEHICLES.find(v => v.id === card.dataset.vehicle);
    const oneWay = parseInt(card.querySelector('[data-fare="oneway"]').textContent.replace('£', ''), 10);
    const ret = parseInt(card.querySelector('[data-fare="return"]').textContent.replace('£', ''), 10);
    window.open(buildWhatsAppUrl(vehicle, oneWay, ret), '_blank', 'noopener');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fd = new FormData(form);
    const pickup = fd.get('pickup');
    const dropoff = fd.get('dropoff');
    const date = fd.get('date');
    const time = fd.get('time');
    const passengers = parseInt(fd.get('passengers'), 10);
    const extraLuggage = document.getElementById('fareExtraLuggage').checked;
    const meetAndGreet = document.getElementById('fareMeetGreet').checked;

    submitBtn.disabled = true;
    submitLabel.textContent = 'Calculating…';
    setStatus('Looking up your route…');
    summaryEl.hidden = true;
    tripState.ready = false;
    updateFleetUI();

    try {
      const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);
      setStatus('Working out live driving distance…');
      const { miles, minutes } = await route(from, to);

      const airportCharge = (from.charge || 0) + (to.charge || 0);
      const night = isNight(time);
      const weekend = isWeekendOrHoliday(date);
      const base = baseFare({ miles, minutes, airportCharge, extraLuggage, meetAndGreet });

      tripState.ready = true;
      tripState.base = base;
      tripState.night = night;
      tripState.weekend = weekend;
      tripState.passengers = passengers;

      const badges = [];
      if (from.isAirport || to.isAirport) badges.push('Airport fee included');
      if (night) badges.push('Night rate (22:00–06:00)');
      if (weekend) badges.push('Weekend / bank holiday rate');
      if (extraLuggage) badges.push('Extra luggage');
      if (meetAndGreet) badges.push('Meet & greet');

      summaryEl.hidden = false;
      summaryEl.innerHTML = `
        <span class="fare-summary-trip">≈ ${miles.toFixed(1)} miles · ≈ ${Math.round(minutes)} min drive</span>
        ${badges.map(b => `<span class="fare-badge">${b}</span>`).join('')}
      `;

      setStatus('');
      updateFleetUI();
    } catch (err) {
      tripState.ready = false;
      updateFleetUI();
      setStatus(`${err.message || 'Something went wrong getting live pricing.'} You can still message us directly for a manual quote.`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Get instant estimate';
    }
  });

  renderFleet();
})();
