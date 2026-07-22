(() => {
  const header = document.getElementById('siteHeader');
  const reviewBanner = document.getElementById('reviewBanner');
  const nav = document.getElementById('mainNav');
  const navToggle = document.getElementById('navToggle');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // header shrink on scroll; the review banner above it tucks away at the
  // same moment so the header can reclaim that space.
  const onScroll = () => {
    const scrolled = window.scrollY > 20;
    header.classList.toggle('is-scrolled', scrolled);
    if (reviewBanner) reviewBanner.classList.toggle('is-hidden', scrolled);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // mobile nav
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        // The header's bottom edge moves depending on whether the review
        // banner above it is currently visible — read it fresh each time
        // rather than assuming a fixed offset.
        nav.style.top = `${header.getBoundingClientRect().bottom}px`;
      }
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // split-flap trust strip
  const flapChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ★.· '.split('');
  const flapEls = document.querySelectorAll('[data-flap]');
  const scrambleFlap = (el) => {
    const finalText = el.dataset.flap;
    if (reduceMotion) { el.textContent = finalText; return; }
    const frames = 10;
    let frame = 0;
    const timer = setInterval(() => {
      frame++;
      if (frame >= frames) {
        el.textContent = finalText;
        clearInterval(timer);
        return;
      }
      el.textContent = finalText
        .split('')
        .map((ch, i) => (i < (finalText.length * frame) / frames ? ch : flapChars[Math.floor(Math.random() * flapChars.length)]))
        .join('');
    }, 60);
  };
  if ('IntersectionObserver' in window) {
    const flapIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          scrambleFlap(entry.target);
          flapIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    flapEls.forEach(el => flapIO.observe(el));
  } else {
    flapEls.forEach(el => { el.textContent = el.dataset.flap; });
  }
})();
