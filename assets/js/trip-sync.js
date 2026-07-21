// Keeps the hero quote card and the #fleet estimate form showing the same
// trip — fill in either one and the other carries the values when you
// scroll to it, so nothing has to be re-typed. Also remembers the trip for
// the length of the browsing session, in case the page gets reloaded.
(() => {
  const PAIRS = [
    ['pickup', 'farePickup'],
    ['dropoff', 'fareDropoff'],
    ['date', 'fareDate'],
    ['time', 'fareTime'],
    ['passengers', 'farePassengers'],
  ];
  const STORAGE_KEY = 'gng_trip_v1';

  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { /* private browsing etc. */ }

  // A location field's "verified" flag (set by location-search.js only when
  // a real address/airport was picked, not just typed) has to travel with
  // its value here too — otherwise a confirmed pickup entered in one form
  // would land in the other still marked unverified and block submission.
  const isLocationField = (el) => el && el.classList.contains('location-input');

  const persist = (key, value, verified) => {
    if (!value) return;
    saved[key] = { value, verified: !!verified };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ }
  };

  PAIRS.forEach(([idA, idB]) => {
    const a = document.getElementById(idA);
    const b = document.getElementById(idB);
    if (!a && !b) return;

    // Restore whichever was last entered this session, into both fields.
    const remembered = saved[idA];
    if (remembered) {
      [a, b].forEach(el => {
        if (!el) return;
        el.value = remembered.value;
        if (isLocationField(el) && window.GNGSetLocationVerified) {
          window.GNGSetLocationVerified(el, remembered.verified);
        }
      });
    }

    const syncFrom = (source, target) => {
      if (target && target.value !== source.value) {
        target.value = source.value;
        if (isLocationField(target) && window.GNGSetLocationVerified) {
          window.GNGSetLocationVerified(target, source.dataset.verified === 'true');
        }
      }
      persist(idA, source.value, source.dataset && source.dataset.verified === 'true');
    };

    // 'input'/'change' cover typing and native pickers; 'locationsync' is a
    // custom event location-search.js fires when a suggestion is picked
    // (selecting one doesn't dispatch a real 'input' event, on purpose).
    ['input', 'change', 'locationsync'].forEach((evt) => {
      if (a) a.addEventListener(evt, () => syncFrom(a, b));
      if (b) b.addEventListener(evt, () => syncFrom(b, a));
    });
  });
})();
