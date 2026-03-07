/* Art_By_Tofa — Portfolio.js
   Handles: nav/footer injection, active nav state, lightbox, scroll animations, back-to-top */

(function () {
  'use strict';

  /* ── Inject shared components ───────────────────────────── */
  async function inject(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const r = await fetch(file);
      if (!r.ok) throw new Error(r.status);
      el.innerHTML = await r.text();
      if (id === 'nav-placeholder') afterNavInjected();
    } catch (e) {
      console.warn('Component load failed:', file, e);
    }
  }

  /* ── Post-nav setup ─────────────────────────────────────── */
  function afterNavInjected() {
    highlightNav();
    initNavScroll();
    initMobileNav();
  }

  function highlightNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#nav .nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        a.closest('li')?.classList.add('active');
      }
    });
    document.querySelectorAll('#nav .nav-mobile a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  function initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const drawer = document.getElementById('nav-mobile');
    if (!toggle || !drawer) return;

    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('open');
      drawer.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    drawer.addEventListener('click', e => {
      if (e.target.tagName === 'A') {
        toggle.classList.remove('open');
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Lightbox ───────────────────────────────────────────── */
  let images = [];
  let idx = 0;

  function buildLightbox() {
    if (document.getElementById('lightbox')) return;
    const lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = `
      <button id="lb-close" aria-label="Close viewer">&times;</button>
      <button class="lb-arrow" id="lb-prev" aria-label="Previous image">
        <i class="fas fa-chevron-left"></i>
      </button>
      <button class="lb-arrow" id="lb-next" aria-label="Next image">
        <i class="fas fa-chevron-right"></i>
      </button>
      <div id="lb-content"><img id="lb-img" src="" alt="Gallery image" /></div>
      <div id="lb-counter"></div>`;
    document.body.appendChild(lb);

    document.getElementById('lb-close').addEventListener('click', closeLB);
    document.getElementById('lb-prev').addEventListener('click', prevImg);
    document.getElementById('lb-next').addEventListener('click', nextImg);
    lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
    document.addEventListener('keydown', onKey);

    // Touch swipe
    let sx = 0;
    lb.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) dx < 0 ? nextImg() : prevImg();
    });
  }

  function openLB(i) {
    idx = i;
    const img = document.getElementById('lb-img');
    img.src = images[idx];
    document.getElementById('lb-counter').textContent = `${idx + 1} / ${images.length}`;
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLB() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { document.getElementById('lb-img').src = ''; }, 380);
  }

  function setImg(i) {
    const img = document.getElementById('lb-img');
    img.style.opacity = '0';
    setTimeout(() => {
      idx = (i + images.length) % images.length;
      img.src = images[idx];
      document.getElementById('lb-counter').textContent = `${idx + 1} / ${images.length}`;
      img.style.opacity = '1';
    }, 140);
  }
  function prevImg() { setImg(idx - 1); }
  function nextImg() { setImg(idx + 1); }

  function onKey(e) {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLB();
    if (e.key === 'ArrowLeft')  prevImg();
    if (e.key === 'ArrowRight') nextImg();
  }

  function initGallery() {
    buildLightbox();

    // Standard gallery items
    const items = document.querySelectorAll('.g-item');
    if (items.length) {
      images = Array.from(items).map(el => el.dataset.src || el.querySelector('img')?.src || '').filter(Boolean);
      items.forEach((el, i) => {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `View image ${i + 1}`);
        el.addEventListener('click', () => openLB(i));
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLB(i); } });
      });
    }

    // Comic pages (own image set, opens in same lightbox)
    const comics = document.querySelectorAll('.comic-page');
    if (comics.length) {
      const comicImgs = Array.from(comics).map(el => el.dataset.src || el.querySelector('img')?.src || '').filter(Boolean);
      comics.forEach((el, i) => {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `View page ${i + 1}`);
        el.addEventListener('click', () => { images = comicImgs; openLB(i); });
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); images = comicImgs; openLB(i); } });
      });
    }
  }

  /* ── Scroll reveal animations ───────────────────────────── */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length || !window.IntersectionObserver) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(el => obs.observe(el));
  }

  /* ── Back to top ────────────────────────────────────────── */
  function initBackTop() {
    const btn = document.createElement('button');
    btn.id = 'back-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 500), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ── Lazy image loading polish ──────────────────────────── */
  function initLazyImages() {
    if (!('loading' in HTMLImageElement.prototype)) return; // browser handles natively
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.addEventListener('load', () => img.classList.add('loaded'));
    });
  }

  /* ── Init ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    inject('nav-placeholder', 'nav.html');
    inject('footer-placeholder', 'footer.html');
    initGallery();
    initReveal();
    initBackTop();
    initLazyImages();
  });
})();
