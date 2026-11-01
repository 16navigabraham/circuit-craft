(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- Header: scroll state, theme toggle, menu -----
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const root = document.documentElement;
  const themeBtn = $('#themeToggle');
  const syncThemeLabel = () => themeBtn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  syncThemeLabel();
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('cc-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
    syncThemeLabel();
  });

  const menu = $('#menu');
  const menuBtn = $('#menuToggle');
  const setMenu = open => {
    menu.hidden = !open;
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  $('#year').textContent = new Date().getFullYear();

  // ----- Reveal on scroll -----
  const revealEls = $$('.section > .kicker, .section > .title, .section__sub, .faq details, .public__inner, .join__mark, .waitlist');
  revealEls.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-in'));
  }

  // ----- Videos -----
  const heroVideo = $('#heroVideo');
  const filmBtn = $('#videoToggle');
  const setPaused = paused => {
    filmBtn.classList.toggle('is-paused', paused);
    filmBtn.setAttribute('aria-label', paused ? 'Play prototype film' : 'Pause prototype film');
  };
  if (reduceMotion) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); setPaused(true); }
  filmBtn.addEventListener('click', () => {
    if (heroVideo.paused) { heroVideo.play().catch(() => {}); setPaused(false); } else { heroVideo.pause(); setPaused(true); }
  });
  // Play the "building in public" video only while it is on screen.
  const publicVideo = $('.public__video');
  if (publicVideo && 'IntersectionObserver' in window && !reduceMotion) {
    publicVideo.currentTime = 8;
    new IntersectionObserver(([e]) => { e.isIntersecting ? publicVideo.play().catch(() => {}) : publicVideo.pause(); }, { threshold: 0.25 }).observe(publicVideo);
  }

  // ----- Carousels -----
  $$('[data-carousel]').forEach(car => {
    const track = $('.carousel__track', car);
    const slides = [...track.children];
    const dotsEl = $('.dots', car);
    let active = 0;
    let timer = null;

    const dots = dotsEl ? slides.map((_, i) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Slide ${i + 1}`);
      b.addEventListener('click', () => { go(i); stop(); });
      dotsEl.appendChild(b);
      return b;
    }) : [];

    const go = i => {
      i = (i + slides.length) % slides.length;
      const s = slides[i];
      track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    const mark = i => {
      active = i;
      slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
      dots.forEach((d, j) => { d.classList.toggle('is-active', j === i); d.setAttribute('aria-selected', j === i); });
    };
    const nearest = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - center); if (d < bestD) { bestD = d; best = i; } });
      return best;
    };
    let raf;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => mark(nearest())); }, { passive: true });

    $('[data-prev]', car)?.addEventListener('click', () => { go(active - 1); stop(); });
    $('[data-next]', car)?.addEventListener('click', () => { go(active + 1); stop(); });

    const delay = Number(car.dataset.autoplay);
    const stop = () => { clearInterval(timer); timer = null; };
    if (delay && !reduceMotion) {
      const start = () => { if (!timer) timer = setInterval(() => go(active + 1), delay); };
      // Only autoplay while visible; stop for good once the user interacts.
      new IntersectionObserver(([e]) => { e.isIntersecting ? start() : stop(); }, { threshold: 0.5 }).observe(car);
      ['pointerdown', 'wheel', 'touchstart'].forEach(ev => track.addEventListener(ev, () => { stop(); car.dataset.autoplay = ''; }, { passive: true }));
    }
    mark(0);
  });

  // ----- Waitlist -----
  // To collect real signups, set this to a form endpoint (e.g. a Formspree URL).
  // Leave empty to keep the form front-end only.
  const WAITLIST_ENDPOINT = '';
  // Set to your Instagram (or other) profile URL for the "Follow the build" button.
  const FOLLOW_URL = '';
  const follow = $('#followLink');
  if (FOLLOW_URL) follow.href = FOLLOW_URL; else { follow.removeAttribute('target'); follow.href = '#join'; }

  $$('form.waitlist').forEach(form => {
    const msg = $('.waitlist__msg', form);
    const btn = $('button[type=submit]', form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = 'Please enter a valid email address.'; msg.classList.add('err'); form.email.focus(); return;
      }
      msg.classList.remove('err');
      btn.disabled = true;
      try {
        if (WAITLIST_ENDPOINT) {
          const role = form.querySelector('input[name=role]:checked')?.value || 'unspecified';
          const res = await fetch(WAITLIST_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email, role }),
          });
          if (!res.ok) throw new Error(String(res.status));
        }
        msg.textContent = "You're on the list. We'll be in touch soon.";
        form.reset();
      } catch {
        msg.textContent = 'Something went wrong. Please try again.'; msg.classList.add('err');
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
