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

  // quote forms -> WhatsApp deep link
  const WHATSAPP_NUMBER = '447967572694';
  const buildMessage = (data) => {
    const lines = ['Hi Gather & Go, I\'d like to request a quote:'];
    if (data.name) lines.push(`Name: ${data.name}`);
    if (data.pickup) lines.push(`Pickup: ${data.pickup}`);
    if (data.dropoff) lines.push(`Drop-off: ${data.dropoff}`);
    if (data.date) lines.push(`Date: ${data.date}`);
    if (data.time) lines.push(`Time: ${data.time}`);
    if (data.passengers) lines.push(`Passengers: ${data.passengers}`);
    if (data.estimate) lines.push(data.estimate);
    return lines.join('\n');
  };
  const wireQuoteForm = (form) => {
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      const message = buildMessage(data);
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener');
    });
  };
  wireQuoteForm(document.getElementById('quoteForm2'));
})();
