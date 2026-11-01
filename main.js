(() => {
  // ----- Nav -----
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  nav.querySelectorAll('.nav__links a').forEach(a =>
    a.addEventListener('click', () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', false); })
  );
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('year').textContent = new Date().getFullYear();

  // ----- Reveal on scroll -----
  const revealEls = document.querySelectorAll('.step, .kit, .tile, .features li, .edu-list li, .faq details, .section__head');
  revealEls.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-in'));
  }

  // ----- Playground -----
  const SIZE = 6;
  const GOAL = { x: 4, y: 1 };
  const START = { x: 1, y: 4, dir: 0 }; // dir: 0=up 1=right 2=down 3=left
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const LABELS = {
    forward: ['move forward', 'block--motion', 'robot.forward()'],
    left: ['turn left', 'block--motion', 'robot.turn_left()'],
    right: ['turn right', 'block--motion', 'robot.turn_right()'],
    led: ['toggle LED', 'block--light', 'led.toggle()'],
  };
  const MAX_BLOCKS = 16;

  const programEl = document.getElementById('program');
  const pythonEl = document.getElementById('python');
  const bot = document.getElementById('bot');
  const botLed = document.getElementById('botLed');
  const goal = document.getElementById('goal');
  const status = document.getElementById('status');
  const runBtn = document.getElementById('run');

  let program = [];   // items: {cmd} or {cmd:'repeat', body:{cmd}}
  let state = { ...START, led: false };
  let running = false;

  const place = (el, x, y) => { el.style.left = `${(x / SIZE) * 100}%`; el.style.top = `${(y / SIZE) * 100}%`; };
  const drawBot = () => {
    place(bot, state.x, state.y);
    bot.style.transform = `rotate(${state.dir * 90}deg)`;
    botLed.classList.toggle('on', state.led);
  };
  place(goal, GOAL.x, GOAL.y);

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function render() {
    programEl.innerHTML = '';
    if (!program.length) {
      programEl.innerHTML = '<li class="empty">Add blocks from the left…</li>';
    }
    program.forEach((item, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      if (item.cmd === 'repeat') {
        b.className = 'block block--loop';
        b.textContent = `repeat 2 × ${LABELS[item.body.cmd][0]}`;
      } else {
        b.className = `block ${LABELS[item.cmd][1]}`;
        b.textContent = LABELS[item.cmd][0];
      }
      b.title = 'Click to remove';
      b.addEventListener('click', () => { if (running) return; program.splice(i, 1); render(); });
      li.appendChild(b);
      programEl.appendChild(li);
    });

    const lines = ['from circuitcraft import robot, led', '', '# when ▶ clicked'];
    if (!program.length) lines.push('pass');
    program.forEach(item => {
      if (item.cmd === 'repeat') {
        lines.push('for _ in range(2):', `    ${LABELS[item.body.cmd][2]}`);
      } else {
        lines.push(LABELS[item.cmd][2]);
      }
    });
    pythonEl.innerHTML = esc(lines.join('\n'))
      .replace(/\b(from|import|for|in)\b/g, '<span class="c-key">$1</span>')
      .replace(/(#.*)/g, '<span class="c-com">$1</span>')
      .replace(/\b(range|2)\b/g, '<span class="c-val">$1</span>');
  }

  document.querySelectorAll('.pg__palette [data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (running) return;
      if (program.length >= MAX_BLOCKS) { status.textContent = `Max ${MAX_BLOCKS} blocks. Remove one first.`; return; }
      const cmd = btn.dataset.cmd;
      if (cmd === 'repeat') {
        const last = program[program.length - 1];
        if (!last || last.cmd === 'repeat') { status.textContent = 'Add a movement or LED block first, then wrap it in a repeat.'; return; }
        program[program.length - 1] = { cmd: 'repeat', body: last };
      } else {
        program.push({ cmd });
      }
      status.classList.remove('win');
      status.textContent = 'Reach the ★ and turn your LED on.';
      render();
    });
  });

  document.querySelectorAll('.pg__tabs button').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pg__tabs button').forEach(t => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
      document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.view; });
    });
  });

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
    if (!program.length) { status.textContent = 'Your program is empty. Add some blocks first.'; return; }
    running = true; runBtn.disabled = true;
    status.classList.remove('win');
    state = { ...START, led: false };
    // disable transitions for instant reset
    bot.style.transition = 'none'; drawBot(); void bot.offsetWidth; bot.style.transition = '';
    status.textContent = 'Running…';
    await sleep(250);
    const lis = programEl.querySelectorAll('li');
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
    if (bumped) status.textContent = 'Bonk! The robot hit the wall. Try a turn first.';
    else if (atGoal && state.led) { status.textContent = '🎉 You did it! Robot reached the goal with its LED on.'; status.classList.add('win'); }
    else if (atGoal) status.textContent = 'You made it! Now add "toggle LED" at the end.';
    else status.textContent = 'Not quite there yet. Tweak your blocks and run again.';
    running = false; runBtn.disabled = false;
  }

  runBtn.addEventListener('click', run);
  document.getElementById('clear').addEventListener('click', () => {
    if (running) return;
    program = []; state = { ...START, led: false }; drawBot(); render();
    status.classList.remove('win'); status.textContent = 'Reach the ★ and turn your LED on.';
  });
  document.getElementById('example').addEventListener('click', () => {
    if (running) return;
    program = [
      { cmd: 'repeat', body: { cmd: 'forward' } },
      { cmd: 'forward' },
      { cmd: 'right' },
      { cmd: 'repeat', body: { cmd: 'forward' } },
      { cmd: 'forward' },
      { cmd: 'led' },
    ];
    render();
    status.classList.remove('win'); status.textContent = 'Example loaded. Press ▶ Run!';
  });

  drawBot();
  render();

  // ----- Signup (front-end only until a backend is connected) -----
  const form = document.getElementById('signup');
  const msg = document.getElementById('signupMsg');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = 'Please enter a valid email address.'; msg.classList.add('err'); return;
    }
    msg.classList.remove('err');
    msg.textContent = "You're on the list! We'll be in touch soon. 🚀";
    form.reset();
  });
})();
