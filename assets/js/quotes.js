(() => {
  const db = window.GNGDb;
  const auth = window.GNGAuth;
  if (!db || !auth) return; // firebase-init.js didn't run

  let currentUser = null;
  let pendingQuote = null; // captured while signed out, saved the moment sign-in succeeds

  const quotesRef = (uid) => db.collection('users').doc(uid).collection('quotes');

  const saveQuote = (quote, uid) => quotesRef(uid).add({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...quote,
  });

  // ---- guest -> signed-in save prompt (shown on the homepage fare card) ----
  const promptEl = document.getElementById('quoteSavePrompt');
  const promptTextEl = document.getElementById('quoteSavePromptText');
  const promptActionEl = document.getElementById('quoteSavePromptAction');

  const showPrompt = (mode) => {
    if (!promptEl) return;
    promptEl.hidden = false;
    promptEl.classList.toggle('is-saved', mode === 'saved');
    if (promptTextEl) {
      promptTextEl.textContent = mode === 'saved'
        ? 'Saved — find it anytime under "My quotes".'
        : 'Sign in to save this quote and find it anytime.';
    }
  };

  window.addEventListener('gng:quote', async (e) => {
    if (currentUser) {
      try {
        await saveQuote(e.detail, currentUser.uid);
        showPrompt('saved');
      } catch (err) {
        console.error('Could not save quote', err);
      }
    } else if (window.GNG_FIREBASE_CONFIGURED) {
      pendingQuote = e.detail;
      showPrompt('prompt');
    }
  });

  if (promptActionEl) {
    promptActionEl.addEventListener('click', () => window.dispatchEvent(new CustomEvent('gng:open-auth')));
  }

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user && pendingQuote) {
      const quote = pendingQuote;
      pendingQuote = null;
      try {
        await saveQuote(quote, user.uid);
        showPrompt('saved');
      } catch (err) {
        console.error('Could not save pending quote', err);
      }
    }
  });

  // ---- account.html: quote history list ----
  const historyEl = document.getElementById('quoteHistory');
  if (!historyEl) return;

  const gateEl = document.getElementById('quoteHistoryGate');
  const emptyEl = document.getElementById('quoteHistoryEmpty');
  const loadingEl = document.getElementById('quoteHistoryLoading');

  const ROUTE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const money = (n) => `£${n}`;

  const formatWhen = (d) => {
    if (!d.date) return '';
    const dt = new Date(`${d.date}T${d.time || '00:00'}:00`);
    if (Number.isNaN(dt.getTime())) return d.date;
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      + (d.time ? ` at ${d.time}` : '');
  };

  const formatSavedAt = (ts) => {
    if (!ts || !ts.toDate) return '';
    return `Quoted ${ts.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };

  const quoteCardHtml = (doc) => {
    const d = doc.data();
    const vehicles = d.vehicles || [];
    return `
      <article class="quote-history-card" data-quote-id="${doc.id}">
        <button type="button" class="quote-history-delete" data-delete-quote aria-label="Remove this quote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="quote-history-route">
          <span>${d.pickup || '—'}</span>${ROUTE_ICON}<span>${d.dropoff || '—'}</span>
        </div>
        <div class="quote-history-meta">${formatWhen(d)} · ${d.passengers || '—'} passenger${d.passengers === 1 ? '' : 's'} · ${formatSavedAt(d.createdAt)}</div>
        <div class="quote-history-fares">
          ${vehicles.map(v => `
            <div class="quote-history-fare-item">
              <span class="label">${v.name}</span>
              <span class="value">${money(v.oneWay)} <span style="font-weight:400; color:var(--ink-soft); font-size:.8rem;">one way</span></span>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  };

  const renderHistory = (docs) => {
    loadingEl.hidden = true;
    if (!docs.length) {
      emptyEl.hidden = false;
      historyEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    historyEl.hidden = false;
    historyEl.innerHTML = docs.map(quoteCardHtml).join('');
  };

  let historyUid = null;

  const loadHistory = async (uid) => {
    loadingEl.hidden = false;
    emptyEl.hidden = true;
    historyEl.hidden = true;
    try {
      const snap = await quotesRef(uid).orderBy('createdAt', 'desc').get();
      renderHistory(snap.docs);
    } catch (err) {
      console.error('Could not load quote history', err);
      loadingEl.hidden = true;
      emptyEl.hidden = false;
      emptyEl.querySelector('h2').textContent = "Couldn't load your quotes";
      emptyEl.querySelector('p').textContent = 'Please refresh the page to try again.';
    }
  };

  auth.onAuthStateChanged((user) => {
    historyUid = user ? user.uid : null;
    if (user) {
      gateEl.hidden = true;
      loadHistory(user.uid);
    } else {
      gateEl.hidden = false;
      historyEl.hidden = true;
      emptyEl.hidden = true;
      loadingEl.hidden = true;
    }
  });

  historyEl.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-delete-quote]');
    if (!delBtn || !historyUid) return;
    const card = delBtn.closest('.quote-history-card');
    delBtn.disabled = true;
    try {
      await quotesRef(historyUid).doc(card.dataset.quoteId).delete();
      card.remove();
      if (!historyEl.children.length) { emptyEl.hidden = false; historyEl.hidden = true; }
    } catch (err) {
      console.error('Could not delete quote', err);
      delBtn.disabled = false;
    }
  });
})();
