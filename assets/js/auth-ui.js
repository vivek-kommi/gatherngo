(() => {
  const auth = window.GNGAuth;
  const modal = document.getElementById('authModal');
  if (!auth || !modal) return; // firebase-init.js didn't run, or this page has no auth modal

  const backdrop = document.getElementById('authModalBackdrop');
  const closeBtn = document.getElementById('authModalClose');
  const tabs = Array.from(modal.querySelectorAll('[data-auth-tab]'));
  const nameField = modal.querySelector('[data-auth-field="name"]');
  const nameInput = document.getElementById('authName');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const passwordToggle = document.getElementById('authPasswordToggle');
  const form = document.getElementById('authForm');
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');
  const forgotBtn = document.getElementById('authForgotBtn');
  const googleBtn = document.getElementById('authGoogleBtn');

  let mode = 'signin';
  let lastFocused = null;

  const ERROR_MESSAGES = {
    'auth/email-already-in-use': 'That email already has an account — try signing in instead.',
    'auth/invalid-email': "That doesn't look like a valid email address.",
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
    'auth/popup-closed-by-user': null,
    'auth/cancelled-popup-request': null,
  };

  const friendlyError = (err) => {
    if (!err) return 'Something went wrong — please try again.';
    if (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, err.code)) return ERROR_MESSAGES[err.code];
    return (err.message || '').replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/.*\)\.?$/, '') || 'Something went wrong — please try again.';
  };

  const showError = (msg) => {
    if (!msg) { errorEl.hidden = true; errorEl.textContent = ''; return; }
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };

  const setMode = (next) => {
    mode = next;
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.authTab === mode));
    nameField.hidden = mode !== 'signup';
    nameInput.required = mode === 'signup';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    forgotBtn.hidden = mode !== 'signin';
    showError(null);
  };

  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.authTab)));

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  const trapFocus = (e) => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const openModal = (initialMode) => {
    lastFocused = document.activeElement;
    setMode(initialMode || 'signin');
    form.reset();
    showError(null);
    modal.hidden = false;
    void modal.offsetHeight; // force a reflow so the opacity/transform transition actually plays
    modal.classList.add('is-open');
    emailInput.focus();
    document.addEventListener('keydown', trapFocus);
    document.body.style.overflow = 'hidden';
  };
  window.__gngCloseAuthModal = null;

  const closeModal = () => {
    modal.classList.remove('is-open');
    document.removeEventListener('keydown', trapFocus);
    document.body.style.overflow = '';
    setTimeout(() => { modal.hidden = true; }, 200);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  document.querySelectorAll('[data-auth-open]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.authOpen || 'signin'));
  });
  window.addEventListener('gng:open-auth', () => openModal('signin'));
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  const setLoading = (loading) => {
    submitBtn.disabled = loading;
    googleBtn.disabled = loading;
    if (loading) submitBtn.textContent = 'Please wait…';
    else submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  };

  const requireConfigured = () => {
    if (window.GNG_FIREBASE_CONFIGURED) return true;
    showError("Sign-in isn't finished being set up yet — please check back soon.");
    return false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(null);
    if (!requireConfigured()) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (nameInput.value.trim()) await cred.user.updateProfile({ displayName: nameInput.value.trim() });
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
      closeModal();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg) showError(msg);
    } finally {
      setLoading(false);
    }
  });

  googleBtn.addEventListener('click', async () => {
    showError(null);
    if (!requireConfigured()) return;
    setLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      closeModal();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg) showError(msg);
    } finally {
      setLoading(false);
    }
  });

  forgotBtn.addEventListener('click', async () => {
    if (!requireConfigured()) return;
    const email = emailInput.value.trim();
    if (!email) { showError('Enter your email above first, then tap "Forgot password?" again.'); emailInput.focus(); return; }
    showError(null);
    try {
      await auth.sendPasswordResetEmail(email);
      forgotBtn.textContent = 'Reset email sent — check your inbox';
      setTimeout(() => { forgotBtn.textContent = 'Forgot password?'; }, 4000);
    } catch (err) {
      showError(friendlyError(err));
    }
  });

  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.textContent = isPassword ? 'Hide' : 'Show';
    });
  }

  document.querySelectorAll('[data-auth-signout]').forEach(btn => {
    btn.addEventListener('click', () => auth.signOut());
  });

  // ---- header auth state (sign-in button <-> account chip) ----
  const initials = (user) => {
    const src = (user.displayName || user.email || '?').trim();
    return src.charAt(0).toUpperCase();
  };

  auth.onAuthStateChanged((user) => {
    document.querySelectorAll('[data-auth-header]').forEach(area => {
      const signInBtn = area.querySelector('[data-auth-open]');
      const chip = area.querySelector('[data-account-chip]');
      if (signInBtn) signInBtn.hidden = !!user;
      if (chip) chip.hidden = !user;
      if (user && chip) {
        const nameEl = chip.querySelector('[data-account-name]');
        const avatarEl = chip.querySelector('[data-account-avatar]');
        if (nameEl) nameEl.textContent = user.displayName || user.email;
        if (avatarEl) avatarEl.textContent = initials(user);
      }
    });
  });

  // account dropdown menu toggle
  document.querySelectorAll('[data-account-chip]').forEach(chip => {
    const btn = chip.querySelector('.account-chip-btn');
    const menu = chip.querySelector('.account-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.account-menu.is-open').forEach(m => m.classList.remove('is-open'));
  });
})();
