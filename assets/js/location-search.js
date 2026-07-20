(() => {
  // Major UK airports we actually send transfers to/from, with real terminals
  // and postcodes so a selected suggestion always reads as a full address.
  const AIRPORTS = [
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 2', postcode: 'TW6 1EW' },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 3', postcode: 'TW6 2ER' },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 4', postcode: 'TW6 3XA' },
    { code: 'LHR', name: 'London Heathrow Airport', terminal: 'Terminal 5', postcode: 'TW6 2GA' },
    { code: 'LGW', name: 'London Gatwick Airport', terminal: 'North Terminal', postcode: 'RH6 0PJ' },
    { code: 'LGW', name: 'London Gatwick Airport', terminal: 'South Terminal', postcode: 'RH6 0NP' },
    { code: 'STN', name: 'London Stansted Airport', terminal: null, postcode: 'CM24 1QW' },
    { code: 'LTN', name: 'London Luton Airport', terminal: null, postcode: 'LU2 9LY' },
    { code: 'LCY', name: 'London City Airport', terminal: null, postcode: 'E16 2PX' },
    { code: 'CBG', name: 'Cambridge Airport', terminal: null, postcode: 'CB5 8RX' },
    { code: 'BHX', name: 'Birmingham Airport', terminal: null, postcode: 'B26 3QJ' },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 1', postcode: 'M90 1QX' },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 2', postcode: 'M90 1QX' },
    { code: 'MAN', name: 'Manchester Airport', terminal: 'Terminal 3', postcode: 'M90 4EF' },
    { code: 'SEN', name: 'Southend Airport', terminal: null, postcode: 'SS2 6YF' },
    { code: 'EMA', name: 'East Midlands Airport', terminal: null, postcode: 'DE74 2SA' },
    { code: 'BRS', name: 'Bristol Airport', terminal: null, postcode: 'BS48 3DY' },
    { code: 'NWI', name: 'Norwich Airport', terminal: null, postcode: 'NR6 6JA' },
  ].map(a => ({
    ...a,
    label: a.terminal ? `${a.name}, ${a.terminal}` : a.name,
    value: a.terminal ? `${a.name}, ${a.terminal}, ${a.postcode}` : `${a.name}, ${a.postcode}`,
  }));

  const PLANE_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10.5 20.5l1.5-4 1.5 4M2 12l20-7-7 20-2.5-8L2 12z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PIN_ICON = '<svg class="loc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.7"/></svg>';

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

  function initLocationField(input) {
    const list = input.closest('.location-field').querySelector('.location-suggestions');
    let items = []; // flat list of { type, ...data } currently rendered, in DOM order
    let activeIndex = -1;
    let debounceTimer = null;
    let fetchController = null;

    const close = () => {
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

    const chooseAirport = (airport) => {
      input.value = airport.value;
      close();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };

    const choosePostcode = (postcode) => {
      input.value = replaceTrailingToken(input.value, postcode);
      close();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };

    const render = (airportMatches, postcodeMatches, loading) => {
      items = [];
      let html = '';

      if (airportMatches.length) {
        html += '<li class="loc-group-label" role="presentation">UK airport terminals</li>';
        airportMatches.forEach(a => {
          items.push({ type: 'airport', data: a });
          html += `<li class="loc-option" role="option" tabindex="-1">${PLANE_ICON}<span class="loc-text"><span class="loc-main">${escapeHtml(a.label)}</span><span class="loc-sub">${escapeHtml(a.postcode)}</span></span></li>`;
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
          const item = items[i];
          if (item.type === 'airport') chooseAirport(item.data);
          else choosePostcode(item.data);
        });
      });
    };

    const runSearch = () => {
      const value = input.value;
      const airportMatches = matchAirports(value);
      const candidate = postcodeCandidate(value);

      if (fetchController) fetchController.abort();

      if (!candidate) {
        if (!airportMatches.length && value.trim().length < 2) { close(); return; }
        render(airportMatches, [], false);
        return;
      }

      render(airportMatches, [], true);
      fetchController = new AbortController();
      fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(candidate)}/autocomplete?limit=5`, { signal: fetchController.signal })
        .then(res => res.json())
        .then(data => {
          const postcodeMatches = (data && data.result) || [];
          render(airportMatches, postcodeMatches, false);
        })
        .catch(() => {
          render(airportMatches, [], false);
        });
    };

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 220);
    });

    input.addEventListener('focus', () => {
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
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          const item = items[activeIndex];
          if (item.type === 'airport') chooseAirport(item.data);
          else choosePostcode(item.data);
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
