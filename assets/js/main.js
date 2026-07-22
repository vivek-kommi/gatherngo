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

  // scroll reveal — cards/headers fade (and slide, where it won't fight a
  // hover transform) in as they enter view, staggered within their group
  const revealSlide = document.querySelectorAll('.section-head, .pass, .process-step, .hero-copy, .decor-hero-copy, .testimonial .wrap > *');
  const revealFade = document.querySelectorAll('.service-card, .package-card, .gallery-item');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealSlide.forEach(el => el.classList.add('is-visible'));
    revealFade.forEach(el => el.classList.add('is-visible'));
  } else {
    const stagger = new Map();
    const prime = (els, className) => els.forEach(el => {
      const i = stagger.get(el.parentElement) || 0;
      stagger.set(el.parentElement, i + 1);
      el.classList.add(className);
      el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 70}ms`);
    });
    prime(revealSlide, 'reveal');
    prime(revealFade, 'reveal-fade');
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    [...revealSlide, ...revealFade].forEach(el => revealIO.observe(el));
  }

  // scroll-spy — highlight the nav link for whichever section is in view
  const navLinks = Array.from(document.querySelectorAll('.main-nav a[href^="#"]'));
  const spyTargets = navLinks
    .map(link => ({ link, el: document.getElementById(link.getAttribute('href').slice(1)) }))
    .filter(t => t.el);
  if (spyTargets.length) {
    const updateSpy = () => {
      const ref = 140; // roughly the fixed header's height
      let current = spyTargets[0];
      spyTargets.forEach(t => { if (t.el.getBoundingClientRect().top - ref <= 0) current = t; });
      navLinks.forEach(a => a.classList.toggle('is-current', a === current.link));
    };
    updateSpy();
    window.addEventListener('scroll', updateSpy, { passive: true });
  }

  // floating WhatsApp button — appears once you've scrolled past the hero
  const quickWhatsapp = document.getElementById('quickWhatsapp');
  if (quickWhatsapp) {
    const toggleQuick = () => quickWhatsapp.classList.toggle('is-visible', window.scrollY > 480);
    toggleQuick();
    window.addEventListener('scroll', toggleQuick, { passive: true });
  }
})();
