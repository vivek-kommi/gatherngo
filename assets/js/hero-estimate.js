(() => {
  const btn = document.getElementById('heroEstimateBtn');
  if (!btn) return; // this page has no hero quote card

  const Fare = window.GNGFare;
  const resultEl = document.getElementById('heroEstimateResult');
  const hiddenField = document.getElementById('heroEstimateField');
  const btnLabel = btn.querySelector('.hero-estimate-btn-label');

  const pickupEl = document.getElementById('pickup');
  const dropoffEl = document.getElementById('dropoff');
  const dateEl = document.getElementById('date');
  const timeEl = document.getElementById('time');

  const standard = Fare.VEHICLES.find(v => v.id === 'standard');

  const show = (html, tone) => {
    resultEl.innerHTML = html;
    resultEl.hidden = false;
    resultEl.className = 'hero-estimate-result' + (tone ? ` is-${tone}` : '');
  };

  btn.addEventListener('click', async () => {
    // Reuse the fields' own required/pattern rules rather than duplicating
    // validation — just surface the browser's native prompt on whichever
    // one isn't filled in yet.
    for (const el of [pickupEl, dropoffEl, dateEl, timeEl]) {
      if (!el.checkValidity()) {
        el.reportValidity();
        el.focus();
        return;
      }
    }

    hiddenField.value = '';
    btn.disabled = true;
    btnLabel.textContent = 'Calculating…';
    show('Looking up your route…', 'loading');

    try {
      const { miles, minutes, night, weekend, base, from, to } = await Fare.estimateTrip({
        pickup: pickupEl.value, dropoff: dropoffEl.value, date: dateEl.value, time: timeEl.value,
        extraLuggage: false, meetAndGreet: false,
      });
      const oneWay = Fare.finalizeFare(base, { largeVehicle: standard.largeVehicle, night, weekend, minimumFare: standard.minimumFare });
      const ret = oneWay * 2;

      const notes = [];
      if (from.isAirport || to.isAirport) notes.push('airport fee included');
      if (night) notes.push('night rate');
      if (weekend) notes.push('weekend/holiday rate');

      show(`
        <div class="hero-estimate-price">
          <span>Standard Car, estimated</span>
          <strong>${Fare.money(oneWay)} <small>one way</small></strong>
        </div>
        <div class="hero-estimate-meta">
          ≈ ${miles.toFixed(1)} mi · ≈ ${Math.round(minutes)} min${notes.length ? ' · ' + notes.join(', ') : ''}
          <a href="#fleet">Compare all vehicles →</a>
        </div>
      `, 'ready');

      hiddenField.value = `Estimated fare (Standard Car): ${Fare.money(oneWay)} one way / ${Fare.money(ret)} return`;
    } catch (err) {
      show(err.message || "Couldn't calculate a live fare for that route — we'll quote you directly.", 'error');
    } finally {
      btn.disabled = false;
      btnLabel.textContent = 'See estimated fare';
    }
  });
})();
