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
  const ROAD_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20 9 4h6l5 16M9.5 14h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

  // Tracks whether a field's value came from picking an airport terminal or
  // a real house-numbered address, vs. free-typed text, a bare postcode, or
  // a street with no number. This is informational only — it doesn't block
  // submission — since even a rough place name ("Cambourne", "Caxton") should
  // still get a fare estimate (fare-engine.js falls back to a rough
  // place-level geocode when there's no postcode to go on).
  const applyVerified = (input, ok) => {
    input.dataset.verified = ok ? 'true' : 'false';
    input.setCustomValidity('');
  };

  // Builds a clean "<street>, <town>, <POSTCODE>" line out of a Nominatim
  // result. Results with no postcode are dropped entirely — hasNumber flags
  // whether it's a genuine house-numbered address (verified-eligible) or
  // just a named street/place (needs a house number added before it counts).
  const formatNominatimResult = (item) => {
    const a = item.address || {};
    if (!a.postcode) return null;
    const hasNumber = !!(a.house_number && a.road);
    const line1 = hasNumber ? `${a.house_number} ${a.road}` : (a.road || a.pedestrian || a.name || a.suburb);
    if (!line1) return null;
    const locality = a.village || a.town || a.city || a.suburb || a.city_district || a.county;
    const parts = [line1];
    if (locality && locality !== line1) parts.push(locality);
    parts.push(a.postcode);
    return { main: parts.join(', '), sub: [a.county, 'UK'].filter(Boolean).join(', '), hasNumber };
  };

  // When a query is just a place/area name ("Uxbridge") Nominatim mostly
  // returns the town/suburb boundary itself, which formatNominatimResult
  // rejects (no street). Rather than telling the user their input won't
  // work, offer the area itself as a usable rough pickup point — its own
  // name is plenty for fare-engine.js's rough-geocode fallback to place a
  // pin at the town/city centre and compute a live (if imprecise) quote.
  const AREA_TYPES = ['town', 'village', 'city', 'suburb', 'city_district', 'county', 'hamlet'];
  const extractArea = (list) => {
    for (const item of (list || [])) {
      if (AREA_TYPES.includes(item.addresstype)) {
        const name = item.name || (item.display_name || '').split(',')[0] || null;
        if (!name) continue;
        return { main: name, sub: 'Use the town/city centre as a rough pickup point' };
      }
    }
    return null;
  };

  const fetchStreetMatches = (query, signal) => {
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'gb', limit: '15',
    });
    return fetch(url, { signal, headers: { 'Accept-Language': 'en-GB' } })
      .then(res => res.json())
      .then(list => {
        const seen = new Set();
        const addresses = [];
        const streets = [];
        (list || []).forEach(item => {
          const formatted = formatNominatimResult(item);
          if (formatted && !seen.has(formatted.main)) {
            seen.add(formatted.main);
            (formatted.hasNumber ? addresses : streets).push(formatted);
          }
        });
        return {
          addresses: addresses.slice(0, 10),
          streets: streets.slice(0, 10),
          area: (addresses.length || streets.length) ? null : extractArea(list),
        };
      });
  };

  // A *complete* UK postcode (as opposed to postcodeCandidate's looser
  // "start of a postcode" match, which also fires on partial prefixes like
  // "CB2 1"). Once someone's finished typing a real postcode we can look up
  // exactly where it is and search around that point, instead of just
  // offering to complete the postcode text itself.
  const FULL_POSTCODE_RE = /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\s?[0-9][A-Za-z]{2}$/;

  // There's no complete, exhaustive free UK address database (that's
  // Royal Mail/OS-licensed and every provider of the full thing is paid),
  // but OpenStreetMap does have real house-numbered addresses for a great
  // many buildings — community-tagged addr:housenumber/addr:street/
  // addr:postcode, especially thorough in town and city centres. Overpass
  // (OSM's free query API, no key) can pull those points near a postcode,
  // plus the named streets themselves as a fallback where house-level
  // tagging is thin. Combined with postcodes.io confirming the postcode is
  // genuine and giving its coordinates, this gets real full addresses where
  // OSM has them, and a real street name to build on where it doesn't.
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Overpass's shared public instance is frequently overloaded (~1 in 2
  // requests fails with a "server busy" response under normal load, by
  // direct measurement) — one retry after a short pause turns that into a
  // much more reliable feature instead of frequently falling back for no
  // real reason.
  const fetchOverpass = async (query, signal, attempt = 0) => {
    let res;
    try {
      res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      res = null;
    }
    if (res && res.ok) {
      try { return await res.json(); } catch (e) { /* fall through to retry */ }
    }
    if (attempt === 0) {
      await sleep(600);
      return fetchOverpass(query, signal, attempt + 1);
    }
    return null;
  };

  const fetchNearbyAddressData = async (lat, lon, signal) => {
    const query = `[out:json][timeout:8];(node(around:550,${lat},${lon})["addr:housenumber"]["addr:street"];way(around:550,${lat},${lon})["addr:housenumber"]["addr:street"];way(around:900,${lat},${lon})[highway][name];);out tags center;`;
    const data = await fetchOverpass(query, signal);
    if (!data) return { houses: [], streets: [] }; // Overpass had a bad day even after a retry — degrade quietly, Nominatim search still runs alongside this

    const dist = (el) => {
      const c = el.center || el; // nodes carry lat/lon directly, ways carry a center
      return Math.hypot(c.lat - lat, c.lon - lon);
    };

    const houseByKey = new Map(); // "number|street" -> { number, street, postcode, dist }
    const streetByName = new Map(); // name -> dist

    (data.elements || []).forEach(el => {
      const t = el.tags;
      if (!t) return;
      if (t['addr:housenumber'] && t['addr:street']) {
        const key = `${t['addr:housenumber']}|${t['addr:street']}`;
        const d = dist(el);
        const existing = houseByKey.get(key);
        if (!existing || d < existing.dist) {
          houseByKey.set(key, { number: t['addr:housenumber'], street: t['addr:street'], postcode: t['addr:postcode'] || null, dist: d });
        }
      } else if (t.highway && t.name && el.center) {
        const d = dist(el);
        if (!streetByName.has(t.name) || d < streetByName.get(t.name)) streetByName.set(t.name, d);
      }
    });

    const houses = [...houseByKey.values()].sort((a, b) => a.dist - b.dist);
    const streets = [...streetByName.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
    return { houses, streets };
  };

  // Confirms a complete postcode is real (postcodes.io is the authoritative
  // free UK postcode dataset) and, if so, fetches nearby house-numbered
  // addresses (preferred) and street names (fallback) for it.
  const fetchNearbyAddresses = async (postcode, signal) => {
    let pc;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal });
      const data = await res.json();
      if (data.status !== 200 || !data.result) return { addresses: [], locality: null, invalid: true, postcode };
      pc = data.result;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return { addresses: [], locality: null, invalid: false, postcode };
    }

    const locality = pc.admin_ward && pc.admin_district && pc.admin_ward !== pc.admin_district
      ? `${pc.admin_ward}, ${pc.admin_district}` : (pc.admin_district || pc.parish || null);

    const { houses, streets } = await fetchNearbyAddressData(pc.latitude, pc.longitude, signal);

    // A house-numbered result carries its own tagged postcode where OSM has
    // one — that's the real postcode for that specific building, which can
    // genuinely differ from the one typed (UK postcodes cover a handful of
    // addresses each). Fall back to the searched postcode only when the
    // building itself isn't tagged with one.
    const houseAddresses = houses.slice(0, 12).map(h => {
      const parts = [`${h.number} ${h.street}`];
      if (locality) parts.push(pc.admin_district || locality);
      parts.push(h.postcode || pc.postcode);
      return { main: parts.join(', '), sub: [locality, 'UK'].filter(Boolean).join(', ') };
    });

    // Street names with no house-number data of their own — real streets,
    // just not a complete address on their own, so kept as a separate group.
    const streetAddresses = streets
      .filter(name => !houses.some(h => h.street === name))
      .slice(0, 12)
      .map(name => {
        const parts = [name];
        if (locality) parts.push(pc.admin_district || locality);
        parts.push(pc.postcode);
        return { main: parts.join(', '), sub: [locality, 'UK'].filter(Boolean).join(', ') };
      });

    return { addresses: houseAddresses, streets: streetAddresses, locality, invalid: false, postcode: pc.postcode };
  };

  function initLocationField(input) {
    const list = input.closest('.location-field').querySelector('.location-suggestions');
    let items = []; // flat list of { type, data } currently rendered, in DOM order
    let activeIndex = -1;
    let debounceTimer = null;
    let postcodeController = null;
    let streetController = null;
    let nearbyController = null;
    let requestToken = 0;
    let lastFilled = null; // value we just set via a suggestion — don't re-search it

    if (input.dataset.verified === undefined) applyVerified(input, false);

    const close = () => {
      // Invalidate the current request so any fetch still in flight (e.g. the
      // street/postcode lookup for what was typed before this selection) is
      // ignored when it resolves, instead of silently reopening the list.
      requestToken++;
      if (postcodeController) postcodeController.abort();
      if (streetController) streetController.abort();
      if (nearbyController) nearbyController.abort();
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

    const fillValue = (value, verified) => {
      input.value = value;
      lastFilled = value;
      applyVerified(input, verified);
      close();
      if (document.activeElement !== input) input.focus();
    };

    // Airport terminals and house-numbered addresses are complete, real,
    // deliverable places. Completing just the postcode, or picking a street
    // with no house number attached, gives a rougher (but still usable —
    // see fare-engine.js) result.
    const chooseAirport = (airport) => fillValue(airport.value, true);
    const chooseAddress = (addr) => fillValue(addr.main, true);
    const choosePostcode = (postcode) => fillValue(replaceTrailingToken(input.value, postcode), false);
    const chooseStreet = (addr) => {
      fillValue(addr.main, false);
      // Cursor at the very start — adding the number is a one-step edit,
      // not a find-the-right-spot-and-retype.
      input.setSelectionRange(0, 0);
    };
    const chooseArea = (area) => fillValue(area.main, false);

    const selectItem = (item) => {
      if (item.type === 'airport') chooseAirport(item.data);
      else if (item.type === 'address') chooseAddress(item.data);
      else if (item.type === 'street') chooseStreet(item.data);
      else if (item.type === 'area') chooseArea(item.data);
      else choosePostcode(item.data);
    };

    const render = (airportMatches, addressMatches, streetMatches, postcodeMatches, area, loading, notice) => {
      items = [];
      let html = '';

      if (airportMatches.length) {
        html += '<li class="loc-group-label" role="presentation">UK airport terminals</li>';
        airportMatches.forEach(a => {
          items.push({ type: 'airport', data: a });
          html += `<li class="loc-option" role="option" tabindex="-1">${PLANE_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(a.label)}</span><span class="loc-sub">${escapeHtml(a.postcode)}</span></span></li>`;
        });
      }

      if (addressMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Addresses</li>';
        addressMatches.forEach(addr => {
          items.push({ type: 'address', data: addr });
          html += `<li class="loc-option" role="option" tabindex="-1">${HOME_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(addr.main)}</span>${addr.sub ? `<span class="loc-sub">${escapeHtml(addr.sub)}</span>` : ''}</span></li>`;
        });
      }

      if (streetMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Streets — add your house number</li>';
        streetMatches.forEach(addr => {
          items.push({ type: 'street', data: addr });
          html += `<li class="loc-option" role="option" tabindex="-1">${ROAD_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(addr.main)}</span>${addr.sub ? `<span class="loc-sub">${escapeHtml(addr.sub)}</span>` : ''}</span></li>`;
        });
      }

      if (postcodeMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Matching postcodes</li>';
        postcodeMatches.forEach(pc => {
          items.push({ type: 'postcode', data: pc });
          html += `<li class="loc-option" role="option" tabindex="-1">${PIN_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(pc)}</span></span></li>`;
        });
      }

      // A place name with no specific street match ("Wolverhampton") still
      // gets a usable pin — its own centre — rather than being told to type
      // more. Only offered when nothing more specific turned up.
      if (area && !addressMatches.length && !streetMatches.length) {
        html += '<li class="loc-group-label" role="presentation">Rough pickup point</li>';
        items.push({ type: 'area', data: area });
        html += `<li class="loc-option" role="option" tabindex="-1">${PIN_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(area.main)}</span><span class="loc-sub">${escapeHtml(area.sub)}</span></span></li>`;
      }

      if (!items.length) {
        if (loading) {
          html = '<li class="loc-empty">Searching…</li>';
        } else if (notice) {
          html = `<li class="loc-empty loc-hint">${notice}</li>`;
        } else {
          html = '<li class="loc-empty">No matches yet — keep typing the full address or postcode.</li>';
        }
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
      const isFullPostcode = candidate && FULL_POSTCODE_RE.test(candidate);
      const wantsStreetSearch = trimmed.length >= 4;

      if (postcodeController) postcodeController.abort();
      if (streetController) streetController.abort();
      if (nearbyController) nearbyController.abort();

      if (!candidate && !wantsStreetSearch) {
        if (!airportMatches.length && trimmed.length < 2) { close(); return; }
        render(airportMatches, [], [], [], null, false);
        return;
      }

      const myToken = ++requestToken;
      let nominatimAddresses = [];
      let nominatimStreets = [];
      let nearbyAddresses = [];
      let nearbyStreets = [];
      let postcodeMatches = [];
      let area = null;
      let postcodeResult = null; // { invalid, postcode, locality } once the full-postcode lookup resolves
      let pending = 0;
      const isCurrent = () => myToken === requestToken;

      // Nominatim and Overpass often surface the same street from different
      // angles (a named POI vs. the road network) — merge and dedupe by the
      // final address line rather than showing near-duplicates. Nominatim
      // results are text-matched against what was actually typed (so rank
      // first); Overpass's nearby list is a generic "what's around this
      // postcode" supplement, shown after.
      const dedupe = (a, b) => {
        const seen = new Set();
        const merged = [];
        [...a, ...b].forEach(addr => {
          if (!seen.has(addr.main)) { seen.add(addr.main); merged.push(addr); }
        });
        return merged.slice(0, 10);
      };
      const mergedAddresses = () => dedupe(nominatimAddresses, nearbyAddresses);
      const mergedStreets = () => dedupe(nominatimStreets, nearbyStreets);

      // A notice only ever appears when there's truly nothing to offer —
      // not even a rough area pin — since typing a bare place name is
      // handled by the "Rough pickup point" option in render() instead.
      const buildNotice = () => {
        if (mergedAddresses().length || mergedStreets().length || area) return null;
        if (postcodeResult && postcodeResult.invalid) {
          return `We don't recognise "${escapeHtml(candidate)}" as a postcode — check it's typed correctly.`;
        }
        if (postcodeResult && !postcodeResult.invalid) {
          const where = postcodeResult.locality ? ` (${escapeHtml(postcodeResult.locality)})` : '';
          return `${escapeHtml(postcodeResult.postcode)}${where} is a real postcode — you can still get a quote using just the postcode, or type a house number and street name for a precise one.`;
        }
        return null;
      };

      const rerender = (loading) => render(airportMatches, mergedAddresses(), mergedStreets(), postcodeMatches, area, loading, buildNotice());

      render(airportMatches, [], [], [], null, true);

      if (isFullPostcode) {
        // A complete, real postcode — confirm it and look for streets
        // genuinely near it, rather than just offering to complete the
        // postcode text (there's nothing left to complete).
        pending++;
        nearbyController = new AbortController();
        fetchNearbyAddresses(candidate, nearbyController.signal)
          .then(result => {
            if (!isCurrent()) return;
            nearbyAddresses = result.addresses;
            nearbyStreets = result.streets;
            postcodeResult = { invalid: result.invalid, postcode: result.postcode, locality: result.locality };
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (isCurrent()) rerender(pending > 0);
          });
      } else if (candidate) {
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
            if (isCurrent()) rerender(pending > 0);
          });
      }

      if (wantsStreetSearch) {
        pending++;
        streetController = new AbortController();
        fetchStreetMatches(value, streetController.signal)
          .then(result => {
            if (!isCurrent()) return;
            nominatimAddresses = result.addresses;
            nominatimStreets = result.streets;
            area = result.area;
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (isCurrent()) rerender(pending > 0);
          });
      }
    };

    input.addEventListener('input', () => {
      if (input.value === lastFilled) { lastFilled = null; return; }
      lastFilled = null;
      applyVerified(input, false);
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
