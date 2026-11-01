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
  const revealEls = $$('.section > .kicker, .section > .title, .section__sub, .faq details, .pg > div, .public__inner, .join__mark, .waitlist');
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

  // ----- Playground -----
  const SIZE = 6;
  const GOAL = { x: 4, y: 1 };
  const START = { x: 1, y: 4, dir: 0 }; // dir: 0=up 1=right 2=down 3=left
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const LABELS = {
    forward: ['forward', 'block--motion', 'robot.forward()'],
    left: ['turn left', 'block--motion', 'robot.turn_left()'],
    right: ['turn right', 'block--motion', 'robot.turn_right()'],
    led: ['toggle LED', 'block--light', 'led.toggle()'],
  };
  const MAX_BLOCKS = 16;
  const HINT = 'Reach the ★ and turn your LED on.';

  const programEl = $('#program');
  const pythonEl = $('#python');
  const bot = $('#bot');
  const botLed = $('#botLed');
  const goal = $('#goal');
  const status = $('#status');
  const runBtn = $('#run');

  let program = [];   // items: {cmd} or {cmd:'repeat', body:{cmd}}
  let state = { ...START, led: false };
  let running = false;

  const setStatus = (text, win = false) => { status.textContent = text; status.classList.toggle('win', win); };
  const place = (el, x, y) => { el.style.left = `${(x / SIZE) * 100}%`; el.style.top = `${(y / SIZE) * 100}%`; };
  const drawBot = () => {
    place(bot, state.x, state.y);
    bot.style.transform = `rotate(${state.dir * 90}deg)`;
    botLed.classList.toggle('on', state.led);
  };
  place(goal, GOAL.x, GOAL.y);

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function render() {
    programEl.innerHTML = program.length ? '' : '<li class="empty">Tap blocks to add them…</li>';
    program.forEach((item, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const base = item.cmd === 'repeat' ? item.body.cmd : item.cmd;
      b.className = `block ${item.cmd === 'repeat' ? 'block--loop' : LABELS[base][1]}`;
      b.textContent = item.cmd === 'repeat' ? `repeat 2 × ${LABELS[base][0]}` : LABELS[base][0];
      b.setAttribute('aria-label', `Remove ${b.textContent}`);
      b.addEventListener('click', () => { if (running) return; program.splice(i, 1); render(); });
      li.appendChild(b);
      programEl.appendChild(li);
    });

    const lines = ['from circuitcraft import robot, led', '', '# when ▶ clicked'];
    if (!program.length) lines.push('pass');
    program.forEach(item => {
      if (item.cmd === 'repeat') lines.push('for _ in range(2):', `    ${LABELS[item.body.cmd][2]}`);
      else lines.push(LABELS[item.cmd][2]);
    });
    pythonEl.innerHTML = esc(lines.join('\n'))
      .replace(/\b(from|import|for|in)\b/g, '<span class="c-key">$1</span>')
      .replace(/(#.*)/g, '<span class="c-com">$1</span>')
      .replace(/\b(range|2)\b/g, '<span class="c-val">$1</span>');
  }

  $$('.pg__palette [data-cmd]').forEach(btn => btn.addEventListener('click', () => {
    if (running) return;
    if (program.length >= MAX_BLOCKS) { setStatus(`Max ${MAX_BLOCKS} blocks. Remove one first.`); return; }
    const cmd = btn.dataset.cmd;
    if (cmd === 'repeat') {
      const last = program[program.length - 1];
      if (!last || last.cmd === 'repeat') { setStatus('Add a block first, then wrap it in a repeat.'); return; }
      program[program.length - 1] = { cmd: 'repeat', body: last };
    } else {
      program.push({ cmd });
    }
    setStatus(HINT);
    render();
  }));

  $$('.pg__tabs button').forEach(tab => tab.addEventListener('click', () => {
    $$('.pg__tabs button').forEach(t => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.view; });
  }));

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function step(cmd) {
    if (cmd === 'left') state.dir = (state.dir + 3) % 4;
    else if (cmd === 'right') state.dir = (state.dir + 1) % 4;
    else if (cmd === 'led') state.led = !state.led;
    else if (cmd === 'forward') {
      const [dx, dy] = DIRS[state.dir];
      const nx = state.x + dx, ny = state.y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return 'bump';
      state.x = nx; state.y = ny;
    }
    drawBot();
    return 'ok';
  }

  async function run() {
    if (running) return;
    if (!program.length) { setStatus('Your program is empty. Add some blocks first.'); return; }
    running = true; runBtn.disabled = true;
    state = { ...START, led: false };
    bot.style.transition = 'none'; drawBot(); void bot.offsetWidth; bot.style.transition = '';
    setStatus('Running…');
    await sleep(250);
    const lis = $$('li', programEl);
    let bumped = false;
    outer: for (let i = 0; i < program.length; i++) {
      lis[i]?.classList.add('is-running');
      const item = program[i];
      const cmds = item.cmd === 'repeat' ? [item.body.cmd, item.body.cmd] : [item.cmd];
      for (const c of cmds) {
        if (step(c) === 'bump') { bumped = true; lis[i]?.classList.remove('is-running'); break outer; }
        await sleep(420);
      }
      lis[i]?.classList.remove('is-running');
    }
    const atGoal = state.x === GOAL.x && state.y === GOAL.y;
    if (bumped) setStatus('Bonk! The robot hit the wall. Try a turn first.');
    else if (atGoal && state.led) setStatus('🎉 You did it! Goal reached with the LED on.', true);
    else if (atGoal) setStatus('You made it! Now add "toggle LED" at the end.');
    else setStatus('Not quite there yet. Tweak your blocks and run again.');
    running = false; runBtn.disabled = false;
  }

  runBtn.addEventListener('click', run);
  $('#clear').addEventListener('click', () => {
    if (running) return;
    program = []; state = { ...START, led: false }; drawBot(); render(); setStatus(HINT);
  });
  $('#example').addEventListener('click', () => {
    if (running) return;
    program = [
      { cmd: 'repeat', body: { cmd: 'forward' } },
      { cmd: 'forward' },
      { cmd: 'right' },
      { cmd: 'repeat', body: { cmd: 'forward' } },
      { cmd: 'forward' },
      { cmd: 'led' },
    ];
    render(); setStatus('Example loaded. Press ▶ Run!');
  });
  drawBot();
  render();

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
