(() => {
  // Major UK airports we actually send transfers to/from, with real terminals
  // and postcodes so a selected suggestion always reads as a full address.
  // lat/lon are airport-level (not per-terminal) — plenty precise for a
  // mileage estimate. charge is the airport pickup/drop-off fee used by the
  // fare estimator; the four named in the brief plus sensible defaults for
  // the rest ("other airports = configurable").
  const AIRPORTS = [
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 2', postcode: 'TW6 1EW', lat: 51.4700, lon: -0.4543, charge: 8 },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 3', postcode: 'TW6 2ER', lat: 51.4700, lon: -0.4543, charge: 8 },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 4', postcode: 'TW6 3XA', lat: 51.4700, lon: -0.4543, charge: 8 },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 5', postcode: 'TW6 2GA', lat: 51.4700, lon: -0.4543, charge: 8 },
    { code: 'LGW', name: 'London Gatwick Airport', terminal: 'North Terminal', postcode: 'RH6 0PJ', lat: 51.1537, lon: -0.1821, charge: 10 },
    { code: 'LGW', name: 'London Gatwick Airport', terminal: 'South Terminal', postcode: 'RH6 0NP', lat: 51.1537, lon: -0.1821, charge: 10 },
    { code: 'STN', name: 'London Stansted Airport', terminal: null, postcode: 'CM24 1QW', lat: 51.8860, lon: 0.2389, charge: 7 },
    { code: 'LTN', name: 'London Luton Airport', terminal: null, postcode: 'LU2 9LY', lat: 51.8747, lon: -0.3683, charge: 7 },
    { code: 'LCY', name: 'London City Airport', terminal: null, postcode: 'E16 2PX', lat: 51.5048, lon: 0.0495, charge: 6 },
    { code: 'CBG', name: 'Cambridge Airport', terminal: null, postcode: 'CB5 8RX', lat: 52.2050, lon: 0.1750, charge: 5 },
    { code: 'BHX', name: 'Birmingham Airport', terminal: null, postcode: 'B26 3QJ', lat: 52.4539, lon: -1.7480, charge: 6 },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 1', postcode: 'M90 1QX', lat: 53.3537, lon: -2.2750, charge: 7 },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 2', postcode: 'M90 1QX', lat: 53.3537, lon: -2.2750, charge: 7 },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 3', postcode: 'M90 4EF', lat: 53.3537, lon: -2.2750, charge: 7 },
    { code: 'SEN', name: 'Southend Airport', terminal: null, postcode: 'SS2 6YF', lat: 51.5714, lon: 0.6956, charge: 6 },
    { code: 'EMA', name: 'East Midlands Airport', terminal: null, postcode: 'DE74 2SA', lat: 52.8311, lon: -1.3281, charge: 6 },
    { code: 'BRS', name: 'Bristol Airport', terminal: null, postcode: 'BS48 3DY', lat: 51.3827, lon: -2.7191, charge: 6 },
    { code: 'NWI', name: 'Norwich Airport', terminal: null, postcode: 'NR6 6JA', lat: 52.6758, lon: 1.2828, charge: 6 },
  ].map(a => ({
    ...a,
    label: a.terminal ? `${a.name}, ${a.terminal}` : a.name,
    value: a.terminal ? `${a.name}, ${a.terminal}, ${a.postcode}` : `${a.name}, ${a.postcode}`,
  }));

  // Shared with the fare estimator (assets/js/fleet-estimate.js) so both
  // scripts work off one airport dataset.
  window.GNG_AIRPORTS = AIRPORTS;

  const PLANE_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10.5 20.5l1.5-4 1.5 4M2 12l20-7-7 20-2.5-8L2 12z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PIN_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.7"/></svg>';
  const HOME_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12M4 20h16M9 20v-6h6v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const matchAirports = (query) => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return AIRPORTS.filter(a => {
      const hay = `${a.name} ${a.terminal || ''} ${a.code}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 5);
  };

  // The bit of the value that looks like the start of a postcode, i.e.
  // whatever follows the last comma (or the whole value if there's none).
  const postcodeCandidate = (value) => {
    const last = value.split(',').pop().trim();
    if (/^[A-Za-z]{1,2}[0-9][A-Za-z0-9]?(\s?[0-9][A-Za-z]{0,2})?$/.test(last) && last.length >= 2) {
      return last;
    }
    return null;
  };

  const replaceTrailingToken = (value, replacement) => {
    const trimmed = value.replace(/\s+$/, '');
    const idx = trimmed.search(/[^,]*$/);
    const prefix = trimmed.slice(0, idx).replace(/[,\s]+$/, '');
    return prefix ? `${prefix}, ${replacement}` : replacement;
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Builds a clean "<street>, <town>, <POSTCODE>" line out of a Nominatim
  // result. Results with no postcode are dropped — we only ever want to
  // hand back something that satisfies the full-address pattern.
  const formatNominatimResult = (item) => {
    const a = item.address || {};
    if (!a.postcode) return null;
    const line1 = a.house_number && a.road ? `${a.house_number} ${a.road}`
      : a.road || a.pedestrian || a.name || a.suburb;
    if (!line1) return null;
    const locality = a.village || a.town || a.city || a.suburb || a.city_district || a.county;
    const parts = [line1];
    if (locality && locality !== line1) parts.push(locality);
    parts.push(a.postcode);
    return { main: parts.join(', '), sub: [a.county, 'UK'].filter(Boolean).join(', ') };
  };

  const fetchStreetMatches = (query, signal) => {
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'gb', limit: '8',
    });
    return fetch(url, { signal, headers: { 'Accept-Language': 'en-GB' } })
      .then(res => res.json())
      .then(list => {
        const seen = new Set();
        const out = [];
        (list || []).forEach(item => {
          const formatted = formatNominatimResult(item);
          if (formatted && !seen.has(formatted.main)) {
            seen.add(formatted.main);
            out.push(formatted);
          }
        });
        return out.slice(0, 5);
      });
  };

  function initLocationField(input) {
    const list = input.closest('.location-field').querySelector('.location-suggestions');
    let items = []; // flat list of { type, data } currently rendered, in DOM order
    let activeIndex = -1;
    let debounceTimer = null;
    let postcodeController = null;
    let streetController = null;
    let requestToken = 0;
    let lastFilled = null; // value we just set via a suggestion — don't re-search it

    const close = () => {
      // Invalidate the current request so any fetch still in flight (e.g. the
      // street/postcode lookup for what was typed before this selection) is
      // ignored when it resolves, instead of silently reopening the list.
      requestToken++;
      if (postcodeController) postcodeController.abort();
      if (streetController) streetController.abort();
      list.classList.remove('is-open');
      list.innerHTML = '';
      items = [];
      activeIndex = -1;
      input.setAttribute('aria-expanded', 'false');
    };

    const setActive = (i) => {
      const options = list.querySelectorAll('.loc-option');
      options.forEach(o => o.classList.remove('is-active'));
      activeIndex = i;
      if (i >= 0 && options[i]) {
        options[i].classList.add('is-active');
        options[i].scrollIntoView({ block: 'nearest' });
      }
    };

    const fillValue = (value) => {
      input.value = value;
      lastFilled = value;
      close();
      if (document.activeElement !== input) input.focus();
    };

    const chooseAirport = (airport) => fillValue(airport.value);
    const chooseAddress = (addr) => fillValue(addr.main);
    const choosePostcode = (postcode) => fillValue(replaceTrailingToken(input.value, postcode));

    const selectItem = (item) => {
      if (item.type === 'airport') chooseAirport(item.data);
      else if (item.type === 'address') chooseAddress(item.data);
      else choosePostcode(item.data);
    };

    const render = (airportMatches, streetMatches, postcodeMatches, loading) => {
      items = [];
      let html = '';

      if (airportMatches.length) {
        html += '<li class="loc-group-label" role="presentation">UK airport terminals</li>';
        airportMatches.forEach(a => {
          items.push({ type: 'airport', data: a });
          html += `<li class="loc-option" role="option" tabindex="-1">${PLANE_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(a.label)}</span><span class="loc-sub">${escapeHtml(a.postcode)}</span></span></li>`;
        });
      }

      if (streetMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Addresses</li>';
        streetMatches.forEach(addr => {
          items.push({ type: 'address', data: addr });
          html += `<li class="loc-option" role="option" tabindex="-1">${HOME_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(addr.main)}</span>${addr.sub ? `<span class="loc-sub">${escapeHtml(addr.sub)}</span>` : ''}</span></li>`;
        });
      }

      if (postcodeMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Matching postcodes</li>';
        postcodeMatches.forEach(pc => {
          items.push({ type: 'postcode', data: pc });
          html += `<li class="loc-option" role="option" tabindex="-1">${PIN_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(pc)}</span></span></li>`;
        });
      }

      if (!items.length) {
        html = loading
          ? '<li class="loc-empty">Searching…</li>'
          : '<li class="loc-empty">No matches yet — keep typing the address or postcode.</li>';
      }

      list.innerHTML = html;
      list.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
      activeIndex = -1;

      list.querySelectorAll('.loc-option').forEach((el, i) => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectItem(items[i]);
        });
      });
    };

    const runSearch = () => {
      const value = input.value;
      const trimmed = value.trim();
      const airportMatches = matchAirports(value);
      const candidate = postcodeCandidate(value);
      const wantsStreetSearch = trimmed.length >= 4;

      if (postcodeController) postcodeController.abort();
      if (streetController) streetController.abort();

      if (!candidate && !wantsStreetSearch) {
        if (!airportMatches.length && trimmed.length < 2) { close(); return; }
        render(airportMatches, [], [], false);
        return;
      }

      const myToken = ++requestToken;
      let streetMatches = [];
      let postcodeMatches = [];
      let pending = 0;
      const isCurrent = () => myToken === requestToken;

      render(airportMatches, [], [], true);

      if (candidate) {
        pending++;
        postcodeController = new AbortController();
        fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(candidate)}/autocomplete?limit=5`, { signal: postcodeController.signal })
          .then(res => res.json())
          .then(data => {
            if (!isCurrent()) return;
            postcodeMatches = (data && data.result) || [];
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (isCurrent()) render(airportMatches, streetMatches, postcodeMatches, pending > 0);
          });
      }

      if (wantsStreetSearch) {
        pending++;
        streetController = new AbortController();
        fetchStreetMatches(value, streetController.signal)
          .then(matches => {
            if (!isCurrent()) return;
            streetMatches = matches;
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (isCurrent()) render(airportMatches, streetMatches, postcodeMatches, pending > 0);
          });
      }
    };

    input.addEventListener('input', () => {
      if (input.value === lastFilled) { lastFilled = null; return; }
      lastFilled = null;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 380);
    });

    input.addEventListener('focus', () => {
      if (input.value === lastFilled) return;
      if (input.value.trim().length >= 2) runSearch();
    });

    input.addEventListener('keydown', (e) => {
      if (!list.classList.contains('is-open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          selectItem(items[activeIndex]);
        } else {
          close();
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!input.closest('.location-field').contains(e.target)) close();
    });
  }

  document.querySelectorAll('.location-input').forEach(initLocationField);
})();
