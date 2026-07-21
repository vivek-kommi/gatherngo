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

  const persist = (key, value) => {
    if (!value) return;
    saved[key] = value;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ }
  };

  PAIRS.forEach(([idA, idB]) => {
    const a = document.getElementById(idA);
    const b = document.getElementById(idB);
    if (!a && !b) return;

    // Restore whichever was last entered this session, into both fields.
    const rememberedValue = saved[idA];
    if (rememberedValue) {
      if (a) a.value = rememberedValue;
      if (b) b.value = rememberedValue;
    }

    const syncFrom = (source, target) => {
      if (target && target.value !== source.value) target.value = source.value;
      persist(idA, source.value);
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
