(() => {
  const grid = document.getElementById('galleryGrid');
  const tabs = document.querySelectorAll('.filter-tab');
  const items = grid ? Array.from(grid.querySelectorAll('.gallery-item')) : [];

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const filter = tab.dataset.filter;
      items.forEach(item => {
        const match = filter === 'all' || item.dataset.cat === filter;
        item.hidden = !match;
      });
    });
  });

  // lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCap = document.getElementById('lightboxCap');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  let currentIndex = 0;

  const visibleItems = () => items.filter(item => !item.hidden);

  const openLightbox = (item) => {
    const list = visibleItems();
    currentIndex = list.indexOf(item);
    showCurrent();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const showCurrent = () => {
    const list = visibleItems();
    if (!list.length) return;
    const item = list[(currentIndex + list.length) % list.length];
    const img = item.querySelector('img');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCap.textContent = item.dataset.caption || '';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  items.forEach(item => {
    item.addEventListener('click', () => openLightbox(item));
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => { currentIndex--; showCurrent(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentIndex++; showCurrent(); });

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') { currentIndex--; showCurrent(); }
    if (e.key === 'ArrowRight') { currentIndex++; showCurrent(); }
  });

  // quote form -> WhatsApp deep link
  const WHATSAPP_NUMBER = '447967572694';
  const decorForm = document.getElementById('decorForm');
  if (decorForm) {
    decorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(decorForm);
      const data = Object.fromEntries(fd.entries());
      const lines = ['Hi Gather & Go, I\'d like a decor quote:'];
      if (data.name) lines.push(`Name: ${data.name}`);
      if (data.eventType) lines.push(`Event type: ${data.eventType}`);
      if (data.date) lines.push(`Date: ${data.date}`);
      if (data.venue) lines.push(`Venue: ${data.venue}`);
      if (data.message) lines.push(`Vision: ${data.message}`);
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank', 'noopener');
    });
  }
})();
