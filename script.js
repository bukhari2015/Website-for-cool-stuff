/* ══════════════════════════════════════════════════════════
   NEXUS OS — MAIN SCRIPT
   One connected universe. Modular. Defensive. No backend.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ---------- Utility ---------- */
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

/* ---------- Global State ---------- */
const State = {
  booted: false,
  chaos: false,
  secretUnlocked: false,
  logoClicks: 0,
  windows: [],
  zIndex: 100,
  fps: 60,
  uptime: 0,
  settings: {
    graphics: 'HIGH',
    animations: 'FULL',
    sound: true,
    theme: 'cyber',
    perfMode: false
  }
};

/* ══════════════════════════════════════════════════════════
   SETTINGS PERSISTENCE
   ══════════════════════════════════════════════════════════ */
const Settings = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('nexus.settings') || '{}');
      Object.assign(State.settings, saved);
    } catch (e) {}
    this.apply();
  },
  save() {
    try { localStorage.setItem('nexus.settings', JSON.stringify(State.settings)); } catch (e) {}
  },
  apply() {
    const s = State.settings;
    document.body.classList.remove('theme-dark','theme-cyber','theme-space','theme-minimal');
    document.body.classList.add('theme-' + s.theme);
    document.body.classList.toggle('perf-mode', !!s.perfMode);
    if (s.perfMode && typeof BG !== 'undefined') BG.setQuality('LOW');
    else if (typeof BG !== 'undefined') BG.setQuality(s.graphics);
    if (typeof Audio2 !== 'undefined') Audio2.enabled = s.sound;
    $('#soundToggle').classList.toggle('muted', !s.sound);
    $('#soundToggle').textContent = s.sound ? '🔊' : '🔇';
    const animScale = s.animations === 'OFF' ? 0 : s.animations === 'REDUCED' ? 0.5 : 1;
    document.documentElement.style.setProperty('--anim-scale', animScale);
  },
  set(key, val) {
    State.settings[key] = val;
    this.save();
    this.apply();
  }
};

/* ══════════════════════════════════════════════════════════
   AUDIO (Web Audio synth — no external files needed)
   ══════════════════════════════════════════════════════════ */
const Audio2 = {
  ctx: null,
  enabled: true,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.enabled = false; }
  },
  tone(freq, dur, type = 'sine', gain = 0.06, slideTo = null) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  },
  click()   { this.tone(880, 0.05, 'square', 0.04); },
  hover()   { this.tone(1400, 0.03, 'sine', 0.02); },
  boot()    { this.tone(80, 1.2, 'sawtooth', 0.05, 300); },
  notify()  { this.tone(660, 0.15, 'sine', 0.05, 880); },
  error()   { this.tone(180, 0.2, 'square', 0.05, 90); },
  type()    { this.tone(2000 + Math.random() * 400, 0.015, 'square', 0.015); },
  engine()  {
    // short engine rev
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(60, t);
      o.frequency.linearRampToValueAtTime(180, t + 0.6);
      o.frequency.exponentialRampToValueAtTime(50, t + 2);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.3);
    } catch (e) {}
  }
};

/* ══════════════════════════════════════════════════════════
   TOASTS
   ══════════════════════════════════════════════════════════ */
function toast(msg, type = 'info', ms = 3600) {
  const t = el('div', 'toast ' + type, msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ══════════════════════════════════════════════════════════
   THREE.JS BACKGROUND
   ══════════════════════════════════════════════════════════ */
const BG = {
  scene: null, camera: null, renderer: null,
  stars: null, particles: null, wire: null,
  mouse: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  quality: 'HIGH',
  running: false,
  init() {
    if (typeof THREE === 'undefined') { toast('Three.js unavailable — background disabled', 'warn'); return; }
    const canvas = $('#gl');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      this.renderer.setClearColor(0x000000, 0);
    } catch (e) {
      toast('WebGL unavailable', 'warn'); return;
    }
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04050a, 0.018);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 0, 22);

    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const count = 1400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = rnd(-90, 90);
      pos[i*3+1] = rnd(-60, 60);
      pos[i*3+2] = rnd(-90, 20);
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0x88ddff, size: 0.28, transparent: true, opacity: 0.9 }));
    this.scene.add(this.stars);

    // Floating particles (localized)
    const pGeo = new THREE.BufferGeometry();
    const pCount = 240;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i*3]   = rnd(-22, 22);
      pPos[i*3+1] = rnd(-14, 14);
      pPos[i*3+2] = rnd(-20, 8);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x33e6ff, size: 0.09, transparent: true, opacity: 0.7 }));
    this.scene.add(this.particles);

    // Wireframe icosahedron
    const wg = new THREE.IcosahedronGeometry(5, 1);
    const wm = new THREE.MeshBasicMaterial({ color: 0x33e6ff, wireframe: true, transparent: true, opacity: 0.14 });
    this.wire = new THREE.Mesh(wg, wm);
    this.scene.add(this.wire);

    // Inner core sphere
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.6, 2),
      new THREE.MeshBasicMaterial({ color: 0xa05cff, wireframe: true, transparent: true, opacity: 0.5 })
    );
    this.scene.add(core);
    this.core = core;

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    this.running = true;
    this.animate();
  },
  onResize() {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
  setQuality(q) {
    this.quality = q;
    if (!this.renderer) return;
    const map = { LOW: 0.6, MEDIUM: 1.0, HIGH: Math.min(window.devicePixelRatio, 1.6) };
    this.renderer.setPixelRatio(map[q] || 1.2);
    if (this.particles) this.particles.visible = q !== 'LOW';
    if (this.wire) this.wire.visible = q !== 'LOW';
  },
  animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this.animate());
    const t = now() * 0.001;
    this.target.x += (this.mouse.x - this.target.x) * 0.05;
    this.target.y += (this.mouse.y - this.target.y) * 0.05;
    if (this.stars) this.stars.rotation.y = t * 0.02;
    if (this.particles) {
      this.particles.rotation.y = t * 0.05;
      this.particles.rotation.x = Math.sin(t * 0.3) * 0.1;
    }
    if (this.wire) {
      this.wire.rotation.x = t * 0.08 + this.target.y * 0.4;
      this.wire.rotation.y = t * 0.12 + this.target.x * 0.4;
    }
    if (this.core) {
      this.core.rotation.x = -t * 0.15;
      this.core.rotation.z = t * 0.2;
    }
    if (this.camera) {
      this.camera.position.x = this.target.x * 2;
      this.camera.position.y = this.target.y * 2;
      this.camera.lookAt(0, 0, 0);
    }
    try { this.renderer.render(this.scene, this.camera); } catch (e) { this.running = false; }
  }
};

/* ══════════════════════════════════════════════════════════
   BOOT SEQUENCE
   ══════════════════════════════════════════════════════════ */
function runBoot() {
  const lines = $('#bootLines');
  const bar = $('#bootBar');
  const pct = $('#bootPct');
  const ready = $('#bootReady');
  const hint = document.querySelector('.boot-hint');

  const bootLines = [
    ['SYS',  'INITIALIZING SYSTEM...', ''],
    ['CPU',  'Neural Processor Gen-9 @ 5.2GHz', 'ok'],
    ['MEM',  'LPDDR6 64GB · 9200 MT/s', 'ok'],
    ['GPU',  'PHOTON X-9 QUANTUM · 24GB VRAM', 'ok'],
    ['NET',  'Neural Link established', 'ok'],
    ['AI',   'Cognitive Layer v4.2 online', 'ok'],
    ['SEC',  'Quantum encryption active', 'ok'],
    ['RENDER', 'WebGL + Neural Ray-Tracing', 'ok'],
    ['CORE', 'Loading NEXUS kernel modules...', 'warn'],
    ['HUB',  'Spawning 8 dimensional gateways', 'ok'],
    ['SYS',  'SYSTEM READY', 'ok']
  ];

  let i = 0;
  const step = () => {
    if (i >= bootLines.length) {
      setTimeout(() => {
        ready.classList.add('show');
        hint.classList.add('show');
        Audio2.boot();
        window.addEventListener('keydown', enterOS, { once: true });
        document.addEventListener('click', enterOS, { once: true });
      }, 500);
      return;
    }
    const [tag, msg, cls] = bootLines[i];
    const line = el('div', 'line ' + (cls || ''), `<span class="tag">[${tag}]</span>${msg}`);
    lines.appendChild(line);
    lines.scrollTop = lines.scrollHeight;

    const p = Math.round(((i + 1) / bootLines.length) * 100);
    bar.style.width = p + '%';
    pct.textContent = p;

    if (i % 2 === 0) Audio2.tone(600 + i * 40, 0.04, 'square', 0.02);

    i++;
    setTimeout(step, i < 3 ? 220 : 130);
  };
  step();
}

function enterOS() {
  window.removeEventListener('keydown', enterOS);
  document.removeEventListener('click', enterOS);
  const boot = $('#boot');
  boot.classList.add('fade-out');
  setTimeout(() => { boot.style.display = 'none'; }, 900);
  $('#os').classList.add('ready');
  State.booted = true;
  Audio2.notify();
  toast('Welcome to NEXUS OS', 'ok');
  buildHub();
  startClock();
  startUptime();
  startFPS();
  console.log('%cNEXUS OS v4.2 online', 'color:#33e6ff;font-family:monospace;font-size:14px');
}

/* ══════════════════════════════════════════════════════════
   HUB (holo core + cards)
   ══════════════════════════════════════════════════════════ */
const HUB_SECTIONS = [
  { id: 'games',   icon: '🎮', label: 'GAMES',       sub: 'VAULT' },
  { id: 'laptop',  icon: '💻', label: 'LAPTOP LAB',  sub: 'BUILD' },
  { id: 'car',     icon: '🏎️', label: 'HYPERCARS',   sub: 'CONFIG' },
  { id: 'science', icon: '🧪', label: 'SCIENCE LAB', sub: 'EXP' },
  { id: 'space',   icon: '🛰️', label: 'UNIVERSE',    sub: 'ORBIT' },
  { id: 'arcade',  icon: '🕹️', label: 'ARCADE',      sub: 'PLAY' },
  { id: 'tech',    icon: '🌌', label: 'TECH DB',     sub: 'DATA' },
  { id: 'system',  icon: '🖥️', label: 'SYSTEM',      sub: 'CORE' }
];

function buildHub() {
  const ring = $('#hubRing');
  if (!ring) return;
  ring.innerHTML = '';
  // Central core
  const core = el('div', 'hub-core', '<div class="hub-core-glyph">◈</div>');
  ring.appendChild(core);

  // Cards around
  const N = HUB_SECTIONS.length;
  const radius = 42; // % of ring size
  HUB_SECTIONS.forEach((s, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const cx = 50 + Math.cos(angle) * radius;
    const cy = 50 + Math.sin(angle) * radius;
    const card = el('div', 'hub-card', `
      <div class="hc-icon">${s.icon}</div>
      <div class="hc-label">${s.label}</div>
      <div class="hc-sub">${s.sub}</div>
    `);
    card.style.left = cx + '%';
    card.style.top  = cy + '%';
    card.dataset.section = s.id;

    // 3D tilt with mouse
    card.addEventListener('mousemove', (e) => {
      if (State.settings.perfMode || State.settings.animations === 'OFF') return;
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      card.style.transform = `translateZ(30px) rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
    card.addEventListener('mouseenter', () => Audio2.hover());
    card.addEventListener('click', () => {
      Audio2.click();
      openApp(s.id);
    });

    ring.appendChild(card);
  });

  // Core click → back to hub
  core.addEventListener('click', () => { Audio2.click(); closeAllWindows(); });
}

/* ══════════════════════════════════════════════════════════
   CLOCK / UPTIME / FPS
   ══════════════════════════════════════════════════════════ */
function startClock() {
  const tick = () => {
    const d = new Date();
    $('#navClock').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(x => String(x).padStart(2, '0')).join(':');
  };
  tick(); setInterval(tick, 1000);
}
function startUptime() {
  const start = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const u = $('#uptime'); if (u) u.textContent = m + ':' + ss;
  }, 1000);
}
function startFPS() {
  let last = now(), frames = 0, acc = 0;
  const loop = () => {
    const t = now();
    frames++; acc += t - last; last = t;
    if (acc > 500) {
      const fps = Math.round((frames * 1000) / acc);
      State.fps = fps;
      const f = $('#fpsRead'); if (f) f.textContent = fps;
      frames = 0; acc = 0;
    }
    requestAnimationFrame(loop);
  };
  loop();
}

/* ══════════════════════════════════════════════════════════
   WINDOW MANAGER
   ══════════════════════════════════════════════════════════ */
const WM = {
  open(opts) {
    const { id, title, icon = '▣', width = 520, height = 380, render, onClose } = opts;
    // If exists, focus it
    const existing = State.windows.find(w => w.id === id);
    if (existing) { this.focus(existing); existing.el.classList.remove('minimized'); return existing; }

    const win = el('div', 'win');
    const w = Math.min(width, window.innerWidth - 24);
    const h = Math.min(height, window.innerHeight - 160);
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.style.left = Math.max(8, (window.innerWidth - w) / 2 + (State.windows.length % 5) * 20) + 'px';
    win.style.top  = Math.max(70, (window.innerHeight - h) / 2 + (State.windows.length % 5) * 20) + 'px';
    win.style.zIndex = ++State.zIndex;

    win.innerHTML = `
      <div class="win-bar">
        <span class="win-icon">${icon}</span>
        <span class="win-title">${title}</span>
        <div class="win-controls">
          <button class="win-min" title="Minimize">—</button>
          <button class="win-max" title="Maximize">▢</button>
          <button class="win-close" title="Close">✕</button>
        </div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize"></div>
    `;
    $('#windowLayer').appendChild(win);

    const record = { id, el: win, title, onClose };
    State.windows.push(record);

    // Fill body
    try {
      const body = win.querySelector('.win-body');
      const res = render(body, record);
      if (res && typeof res === 'function') record.cleanup = res;
    } catch (e) {
      console.error(e);
      win.querySelector('.win-body').innerHTML = '<p style="color:#ff4d6a">App failed to load: ' + e.message + '</p>';
    }

    // Wire controls
    win.querySelector('.win-close').addEventListener('click', () => this.close(record));
    win.querySelector('.win-min').addEventListener('click', () => { win.classList.add('minimized'); Audio2.click(); });
    win.querySelector('.win-max').addEventListener('click', () => {
      win.classList.toggle('maximized');
      Audio2.click();
    });

    // Focus on click
    win.addEventListener('mousedown', () => this.focus(record));

    // Drag
    this.makeDraggable(win, win.querySelector('.win-bar'));

    // Resize
    this.makeResizable(win, win.querySelector('.win-resize'));

    Audio2.click();
    return record;
  },

  close(record) {
    const idx = State.windows.indexOf(record);
    if (idx < 0) return;
    if (record.cleanup) { try { record.cleanup(); } catch (e) {} }
    record.el.classList.add('closing');
    setTimeout(() => record.el.remove(), 220);
    State.windows.splice(idx, 1);
    if (record.onClose) record.onClose();
    Audio2.click();
  },

  focus(record) {
    record.el.style.zIndex = ++State.zIndex;
  },

  makeDraggable(win, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    const down = (e) => {
      if (e.target.closest('.win-controls')) return;
      dragging = true;
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      ox = win.offsetLeft; oy = win.offsetTop;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', up);
    };
    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      if (e.cancelable) e.preventDefault();
      win.style.left = clamp(ox + p.clientX - sx, -40, window.innerWidth - 60) + 'px';
      win.style.top  = clamp(oy + p.clientY - sy, 56, window.innerHeight - 60) + 'px';
    };
    const up = () => {
      dragging = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    handle.addEventListener('mousedown', down);
    handle.addEventListener('touchstart', down, { passive: true });
  },

  makeResizable(win, grip) {
    let sx = 0, sy = 0, ow = 0, oh = 0, resizing = false;
    const down = (e) => {
      resizing = true;
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      ow = win.offsetWidth; oh = win.offsetHeight;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', up);
      e.stopPropagation();
    };
    const move = (e) => {
      if (!resizing) return;
      const p = e.touches ? e.touches[0] : e;
      if (e.cancelable) e.preventDefault();
      win.style.width = Math.max(280, ow + p.clientX - sx) + 'px';
      win.style.height = Math.max(160, oh + p.clientY - sy) + 'px';
    };
    const up = () => {
      resizing = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    grip.addEventListener('mousedown', down);
    grip.addEventListener('touchstart', down, { passive: true });
  }
};

function closeAllWindows() {
  [...State.windows].forEach(w => WM.close(w));
}

/* ══════════════════════════════════════════════════════════
   APP REGISTRY
   ══════════════════════════════════════════════════════════ */
const Apps = {};

/* ---- FILES ---- */
Apps.files = {
  title: 'FILES // NEXUS DRIVE',
  icon: '📁',
  render(root) {
    root.innerHTML = `
      <h2>NEXUS DRIVE</h2>
      <div class="file-list">
        <div class="file-row"><span class="file-ic">📁</span> /System<span class="file-size">—</span></div>
        <div class="file-row"><span class="file-ic">📁</span> /Projects<span class="file-size">—</span></div>
        <div class="file-row"><span class="file-ic">📁</span> /Media<span class="file-size">—</span></div>
        <div class="file-row"><span class="file-ic">📄</span> boot.log<span class="file-size">48 KB</span></div>
        <div class="file-row"><span class="file-ic">📄</span> nexus.config<span class="file-size">2 KB</span></div>
        <div class="file-row"><span class="file-ic">📄</span> user.profile<span class="file-size">1 KB</span></div>
        <div class="file-row"><span class="file-ic">📄</span> secrets.enc<span class="file-size">???</span></div>
        <div class="file-row"><span class="file-ic">🎵</span> ambient.nexus<span class="file-size">12 MB</span></div>
      </div>
    `;
    root.querySelectorAll('.file-row').forEach(r => r.addEventListener('click', () => {
      Audio2.click();
      const name = r.textContent.trim().split('  ')[0];
      if (name.includes('secrets')) toast('ACCESS DENIED — insufficient clearance', 'err');
      else toast('Opening: ' + name, 'info');
    }));
  }
};

/* ---- BROWSER ---- */
Apps.browser = {
  title: 'NEXUS NET // BROWSER',
  icon: '🌐',
  render(root) {
    root.innerHTML = `
      <div class="browser-frame">
        <div class="browser-bar">
          <button class="btn" id="brBack">◀</button>
          <input type="text" id="brUrl" value="nexus://hub" />
          <button class="btn primary" id="brGo">GO</button>
        </div>
        <div class="browser-content" id="brContent">
          <h2>NEXUS NET</h2>
          <p>Internal network hub. Try addresses:</p>
          <ul style="margin-left:16px;color:var(--text-dim)">
            <li>nexus://hub</li>
            <li>nexus://news</li>
            <li>nexus://files</li>
            <li>nexus://game</li>
          </ul>
        </div>
      </div>
    `;
    const content = root.querySelector('#brContent');
    const url = root.querySelector('#brUrl');
    const go = () => {
      Audio2.click();
      const v = url.value.trim().toLowerCase();
      const map = {
        'nexus://hub': '<h2>NEXUS HUB</h2><p>Central command node. All systems nominal.</p>',
        'nexus://news': '<h2>DAILY FEED</h2><p>· Photon X-9 GPU benchmarks leaked</p><p>· Quantum memory 30% faster</p><p>· Lunar relay station online</p>',
        'nexus://files': '<h2>SHARED FILES</h2><p>Public repository mounted.</p>',
        'nexus://game': '<h2>ARCADE PORTAL</h2><p>Launch mini-games from the dock.</p>'
      };
      content.innerHTML = map[v] || `<h2>404</h2><p>Route not found: ${v}</p>`;
    };
    root.querySelector('#brGo').addEventListener('click', go);
    url.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    root.querySelector('#brBack').addEventListener('click', () => { Audio2.click(); content.innerHTML = '<h2>NEXUS NET</h2><p>Back to root.</p>'; });
  }
};

/* ---- GAME VAULT ---- */
const VAULT_GAMES = [
  { cat: 'FPS',       title: 'TACTICAL OPS',    desc: 'Squad-based tactical shooter with destructible environments.' },
  { cat: 'FPS',       title: 'DEEP STRIKE',     desc: 'Military FPS with realistic ballistics and drone support.' },
  { cat: 'SCI-FI',    title: 'ORBITAL SIEGE',   desc: 'Low-gravity sci-fi combat aboard derelict stations.' },
  { cat: 'RACING',    title: 'VELOCITY X',      desc: 'Hyper-realistic racing sim with dynamic weather.' },
  { cat: 'SANDBOX',   title: 'OPEN WORLD ∞',    desc: 'Infinite procedural sandbox with full physics.' },
  { cat: 'HORROR',    title: 'SIGNAL LOST',     desc: 'Survival horror in an abandoned orbital relay.' },
  { cat: 'SPACE',     title: 'STELLAR VOYAGE',  desc: 'Open-universe space exploration and trade.' },
  { cat: 'RPG',       title: 'AETHER REALM',    desc: 'Fantasy RPG with deep skill trees and lore.' },
  { cat: 'ACTION',    title: 'NEON HUNTER',     desc: 'Fast-paced cyberpunk action with grapples.' },
  { cat: 'PUZZLE',    title: 'QUANTUM LINK',    desc: 'Mind-bending puzzle game with quantum mechanics.' },
  { cat: 'SPORTS',    title: 'ZERO-G LEAGUE',   desc: 'Futuristic sports in zero gravity arenas.' },
  { cat: 'BUILDER',   title: 'MEGA STRUCT',     desc: 'Build megastructures across a solar system.' }
];

Apps.games = {
  title: 'GAME VAULT',
  icon: '🎮',
  width: 720, height: 480,
  render(root) {
    const cats = ['ALL', 'FPS', 'RACING', 'HORROR', 'SCI-FI', 'RPG', 'SANDBOX', 'ACTION', 'PUZZLE', 'SPORTS'];
    root.innerHTML = `
      <h2>GAME VAULT</h2>
      <div class="chip-row" id="vaultCats"></div>
      <div class="vault-grid" id="vaultGrid"></div>
    `;
    const chipRow = root.querySelector('#vaultCats');
    cats.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), c);
      b.addEventListener('click', () => {
        chipRow.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        Audio2.click();
        renderGrid(c);
      });
      chipRow.appendChild(b);
    });
    const grid = root.querySelector('#vaultGrid');
    const renderGrid = (cat) => {
      grid.innerHTML = '';
      const list = cat === 'ALL' ? VAULT_GAMES : VAULT_GAMES.filter(g => g.cat === cat);
      list.forEach(g => {
        const card = el('div', 'vault-card', `
          <div class="vc-cat">${g.cat}</div>
          <div class="vc-title">${g.title}</div>
          <div class="vc-desc">${g.desc}</div>
        `);
        card.addEventListener('mouseenter', () => Audio2.hover());
        card.addEventListener('click', () => { Audio2.click(); toast('Launching ' + g.title + '... (demo)', 'info'); });
        grid.appendChild(card);
      });
    };
    renderGrid('ALL');
  }
};

/* ---- PERFORMANCE MONITOR ---- */
Apps.perf = {
  title: 'PERFORMANCE MONITOR',
  icon: '📊',
  width: 620, height: 480,
  render(root) {
    root.innerHTML = `
      <h2>SYSTEM PERFORMANCE</h2>
      <div class="chip-row" id="perfTabs">
        <button class="chip active" data-p="gpu">GPU</button>
        <button class="chip" data-p="cpu">CPU</button>
        <button class="chip" data-p="ram">RAM</button>
        <button class="chip" data-p="ssd">SSD</button>
        <button class="chip" data-p="net">NETWORK</button>
      </div>
      <div class="perf-grid">
        <div class="perf-card">
          <h4>USAGE</h4>
          <div class="perf-val" id="perfUsage">—</div>
          <div class="perf-bar"><i id="perfUsageBar" style="width:0%"></i></div>
        </div>
        <div class="perf-card">
          <h4>TEMPERATURE</h4>
          <div class="perf-val" id="perfTemp">—</div>
          <div class="perf-sub">°C</div>
        </div>
        <div class="perf-card">
          <h4>MEMORY</h4>
          <div class="perf-val" id="perfMem">—</div>
          <div class="perf-sub" id="perfMemSub">—</div>
        </div>
        <div class="perf-card">
          <h4>CLOCK / POWER</h4>
          <div class="perf-val" id="perfClock">—</div>
          <div class="perf-sub" id="perfPower">—</div>
        </div>
      </div>
      <canvas class="perf-graph" id="perfGraph"></canvas>
    `;
    const graph = root.querySelector('#perfGraph');
    const ctx = graph.getContext('2d');
    let cur = 'gpu';
    const hist = { gpu: [], cpu: [], ram: [], ssd: [], net: [] };
    const MAX = 60;

    const cfg = {
      gpu: { usage: () => 60 + Math.random() * 35, temp: () => 55 + Math.random() * 22, mem: () => (6 + Math.random() * 2).toFixed(1) + ' / 8 GB', clock: () => Math.round(2100 + Math.random() * 400) + ' MHz', power: () => Math.round(90 + Math.random() * 140) + ' W' },
      cpu: { usage: () => 40 + Math.random() * 45, temp: () => 48 + Math.random() * 25, mem: () => (10 + Math.random() * 6).toFixed(1) + ' / 32 GB', clock: () => Math.round(3600 + Math.random() * 1600) + ' MHz', power: () => Math.round(35 + Math.random() * 90) + ' W' },
      ram: { usage: () => 55 + Math.random() * 30, temp: () => 40 + Math.random() * 15, mem: () => (18 + Math.random() * 12).toFixed(1) + ' / 64 GB', clock: () => '9200 MT/s', power: () => Math.round(15 + Math.random() * 20) + ' W' },
      ssd: { usage: () => 20 + Math.random() * 60, temp: () => 35 + Math.random() * 20, mem: () => (380 + Math.random() * 40).toFixed(0) + ' / 1024 GB', clock: () => '7.4 GB/s', power: () => Math.round(3 + Math.random() * 6) + ' W' },
      net: { usage: () => Math.random() * 80, temp: () => 35 + Math.random() * 10, mem: () => (Math.random() * 400).toFixed(0) + ' MB/s', clock: () => '10 Gbps', power: () => '—' }
    };

    const drawGraph = () => {
      const w = graph.width = graph.clientWidth * (window.devicePixelRatio > 1 ? 1.5 : 1);
      const h = graph.height = 120 * (window.devicePixelRatio > 1 ? 1.5 : 1);
      const arr = hist[cur];
      ctx.clearRect(0, 0, w, h);
      // grid
      ctx.strokeStyle = 'rgba(51,230,255,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke();
      }
      // line
      ctx.beginPath();
      ctx.strokeStyle = '#33e6ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#33e6ff';
      ctx.shadowBlur = 8;
      arr.forEach((v, i) => {
        const x = (i / (MAX - 1)) * w;
        const y = h - (v / 100) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      const c = cfg[cur];
      const usage = c.usage();
      hist[cur].push(usage);
      if (hist[cur].length > MAX) hist[cur].shift();
      root.querySelector('#perfUsage').textContent = usage.toFixed(0) + '%';
      root.querySelector('#perfUsageBar').style.width = usage + '%';
      root.querySelector('#perfTemp').textContent = c.temp().toFixed(0);
      root.querySelector('#perfMem').textContent = c.mem();
      root.querySelector('#perfMemSub').textContent = cur.toUpperCase() + ' MEMORY';
      root.querySelector('#perfClock').textContent = c.clock();
      root.querySelector('#perfPower').textContent = c.power();
      drawGraph();
    };
    tick();
    const iv = setInterval(tick, 800);

    root.querySelector('#perfTabs').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      root.querySelectorAll('#perfTabs .chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      cur = b.dataset.p;
      Audio2.click();
    });

    return () => clearInterval(iv);
  }
};

/* ---- LAPTOP LAB ---- */
Apps.laptop = {
  title: 'LAPTOP LAB // NOVA X15',
  icon: '💻',
  width: 720, height: 540,
  render(root) {
    root.innerHTML = `
      <h2>NOVA X15 — BUILD STATION</h2>
      <div class="laptop-stage">
        <div class="laptop-3d laptop" id="laptop3d">
          <div class="laptop-lid">
            <div class="laptop-screen-glow"></div>
          </div>
          <div class="laptop-base">
            <div class="laptop-keyboard" id="kbLight"></div>
          </div>
        </div>
      </div>

      <div class="row">
        <button class="btn" id="lapRotate">⟲ ROTATE</button>
        <button class="btn" id="lapOpen">OPEN/CLOSE</button>
        <button class="btn primary" id="lapExplode">EXPLODED VIEW</button>
        <button class="btn" id="lapFans">FANS: OFF</button>
      </div>

      <h3>BODY COLOR</h3>
      <div class="chip-row" id="lapColors"></div>

      <h3>RGB LIGHTING</h3>
      <div class="chip-row" id="lapRGB"></div>

      <h3>KEYBOARD LIGHTING</h3>
      <div class="chip-row" id="lapKB"></div>

      <h3>SCREEN WALLPAPER</h3>
      <div class="chip-row" id="lapWall"></div>

      <h3>SPECIFICATIONS</h3>
      <div id="lapSpecs"></div>
      <div class="chip-row" id="lapSpecBtns"></div>
    `;

    const laptop = root.querySelector('#laptop3d');
    const kbLight = root.querySelector('#kbLight');
    const lidScreen = root.querySelector('.laptop-lid');
    const screenGlow = root.querySelector('.laptop-screen-glow');

    // Colors
    const colors = ['#0a0e1c', '#1a2238', '#2a1a3a', '#3a1a1a', '#1a3a2a', '#0f1a2a'];
    colors.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), '');
      b.style.background = c; b.style.width = '36px'; b.style.height = '24px'; b.style.padding = '0';
      b.addEventListener('click', () => {
        root.querySelectorAll('#lapColors .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        laptop.querySelector('.laptop-lid').style.background = `linear-gradient(160deg, ${c}, #05070d)`;
        laptop.querySelector('.laptop-base').style.background = `linear-gradient(160deg, ${c}, #05070d)`;
        Audio2.click();
      });
      root.querySelector('#lapColors').appendChild(b);
    });

    // RGB
    const rgbs = ['#33e6ff', '#a05cff', '#ff4dd2', '#3dff9e', '#ffc04d', '#ff4d6a'];
    rgbs.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), '');
      b.style.background = c; b.style.width = '36px'; b.style.height = '24px'; b.style.padding = '0';
      b.addEventListener('click', () => {
        root.querySelectorAll('#lapRGB .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        screenGlow.style.boxShadow = `inset 0 0 40px ${c}, inset 0 0 80px ${c}88`;
        Audio2.click();
      });
      root.querySelector('#lapRGB').appendChild(b);
    });

    // Keyboard lighting
    const kbColors = ['#ffffff', '#33e6ff', '#a05cff', '#ff4dd2', '#3dff9e'];
    kbColors.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), '');
      b.style.background = c; b.style.width = '36px'; b.style.height = '24px'; b.style.padding = '0';
      b.addEventListener('click', () => {
        root.querySelectorAll('#lapKB .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        kbLight.style.boxShadow = `inset 0 0 20px ${c}, inset 0 0 40px ${c}66`;
        Audio2.click();
      });
      root.querySelector('#lapKB').appendChild(b);
    });

    // Wallpapers
    const walls = [
      { name: 'AURORA', bg: 'linear-gradient(135deg, #0a1024, #101a3a, #1a0a3a)' },
      { name: 'NEON',   bg: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)' },
      { name: 'GRID',   bg: 'repeating-linear-gradient(0deg, #0a0e1c 0 4px, #16203a 4px 8px)' },
      { name: 'SOLAR',  bg: 'radial-gradient(circle, #ff8c00, #8b0000 60%, #000)' }
    ];
    walls.forEach((w, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), w.name);
      b.addEventListener('click', () => {
        root.querySelectorAll('#lapWall .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const after = lidScreen.querySelector('::after');
        // Apply directly to a pseudo we control via box-shadow + background on the lid
        lidScreen.style.setProperty('--wall', w.bg);
        // Simpler: overlay element
        let ov = lidScreen.querySelector('.wall-overlay');
        if (!ov) { ov = el('div', 'wall-overlay'); lidScreen.appendChild(ov); }
        ov.style.cssText = `position:absolute;inset:8px;border-radius:6px;background:${w.bg};opacity:0.85;pointer-events:none;`;
        Audio2.click();
      });
      root.querySelector('#lapWall').appendChild(b);
    });

    // Specs
    const specs = { CPU: 'Core Ultra 9', GPU: 'PHOTON X-9', RAM: '32 GB', SSD: '1 TB NVMe', DISPLAY: '15.6" OLED 240Hz' };
    const specOptions = {
      CPU: ['Core Ultra 7', 'Core Ultra 9', 'Quantum Q1'],
      GPU: ['PHOTON X-7', 'PHOTON X-9', 'PHOTON X-9 Ti'],
      RAM: ['16 GB', '32 GB', '64 GB'],
      SSD: ['512 GB', '1 TB', '2 TB', '4 TB']
    };
    const renderSpecs = () => {
      const box = root.querySelector('#lapSpecs');
      box.innerHTML = Object.entries(specs).map(([k, v]) => `<div class="stat-line"><span>${k}</span><span>${v}</span></div>`).join('');
    };
    renderSpecs();

    const btnBox = root.querySelector('#lapSpecBtns');
    Object.keys(specOptions).forEach(k => {
      const b = el('button', 'chip', '+ ' + k);
      b.addEventListener('click', () => {
        const arr = specOptions[k];
        const idx = (arr.indexOf(specs[k]) + 1) % arr.length;
        specs[k] = arr[idx];
        renderSpecs();
        Audio2.click();
        toast(k + ' → ' + specs[k], 'info', 1600);
      });
      btnBox.appendChild(b);
    });

    // Controls
    let rot = 0, opened = true, exploded = false, fans = false;
    root.querySelector('#lapRotate').addEventListener('click', () => {
      rot = (rot + 25) % 360;
      laptop.style.transform = `rotateY(${rot}deg)`;
      Audio2.click();
    });
    root.querySelector('#lapOpen').addEventListener('click', () => {
      opened = !opened;
      laptop.querySelector('.laptop-lid').style.transform = opened ? '' : 'rotateX(-100deg)';
      Audio2.click();
    });
    root.querySelector('#lapExplode').addEventListener('click', () => {
      exploded = !exploded;
      laptop.classList.toggle('exploded', exploded);
      Audio2.click();
      toast(exploded ? 'Exploded view: ON' : 'Exploded view: OFF', 'info', 1600);
    });
    root.querySelector('#lapFans').addEventListener('click', (e) => {
      fans = !fans;
      e.target.textContent = 'FANS: ' + (fans ? 'ON' : 'OFF');
      e.target.classList.toggle('active', fans);
      Audio2.tone(fans ? 400 : 200, 0.3, 'sawtooth', 0.03);
    });
  }
};

/* ---- HYPERCAR CONFIGURATOR ---- */
Apps.car = {
  title: 'HYPERCAR CONFIGURATOR',
  icon: '🏎️',
  width: 720, height: 540,
  render(root) {
    root.innerHTML = `
      <h2>APEX VELOCITY GT</h2>
      <div class="car-stage">
        <div class="car-body" id="carBody" style="--car-color:#d02040">
          <div class="car-chassis"></div>
          <div class="car-cabin"></div>
          <div class="car-window"></div>
          <div class="car-spoiler"></div>
          <div class="car-headlight left"></div>
          <div class="car-headlight right"></div>
          <div class="car-wheel left"></div>
          <div class="car-wheel right"></div>
          <div class="car-underglow"></div>
        </div>
      </div>

      <div class="row">
        <button class="btn danger" id="carStart">▶ START ENGINE</button>
        <button class="btn" id="carSpoiler">SPOILER</button>
        <button class="btn" id="carUnderglow">UNDERGLOW</button>
      </div>

      <h3>BODY COLOR</h3>
      <div class="chip-row" id="carColors"></div>

      <h3>WHEELS</h3>
      <div class="chip-row" id="carWheels"></div>

      <h3>HEADLIGHTS</h3>
      <div class="chip-row" id="carHead"></div>

      <h3>PERFORMANCE</h3>
      <div id="carPerf"></div>
    `;

    const carBody = root.querySelector('#carBody');
    const perf = { POWER: '1,240 hp', '0–100': '2.1 s', 'TOP SPEED': '412 km/h', WEIGHT: '1,320 kg', DOWNFORCE: '820 kg' };
    const renderPerf = () => {
      root.querySelector('#carPerf').innerHTML = Object.entries(perf)
        .map(([k, v]) => `<div class="stat-line"><span>${k}</span><span>${v}</span></div>`).join('');
    };
    renderPerf();

    // Body colors
    const bodyColors = ['#d02040', '#101820', '#f5f5f5', '#1a5cff', '#3dff9e', '#ffc04d', '#a05cff'];
    bodyColors.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), '');
      b.style.background = c; b.style.width = '36px'; b.style.height = '24px'; b.style.padding = '0';
      b.addEventListener('click', () => {
        root.querySelectorAll('#carColors .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        carBody.style.setProperty('--car-color', c);
        Audio2.click();
      });
      root.querySelector('#carColors').appendChild(b);
    });

    // Wheels
    const wheelColors = ['#666', '#c0c0c0', '#ffaa00', '#33e6ff', '#ff4dd2'];
    wheelColors.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), '');
      b.style.background = c; b.style.width = '36px'; b.style.height = '24px'; b.style.padding = '0';
      b.addEventListener('click', () => {
        root.querySelectorAll('#carWheels .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        carBody.style.setProperty('--wheel-color', c);
        Audio2.click();
      });
      root.querySelector('#carWheels').appendChild(b);
    });

    // Headlight toggles
    ['OFF', 'ON', 'STROBE'].forEach((mode, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), mode);
      b.addEventListener('click', () => {
        root.querySelectorAll('#carHead .chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        carBody.classList.toggle('lights-on', mode !== 'OFF');
        if (mode === 'STROBE') {
          let n = 0;
          const iv = setInterval(() => {
            carBody.classList.toggle('lights-on');
            if (++n > 6) { clearInterval(iv); carBody.classList.add('lights-on'); }
          }, 120);
        }
        Audio2.click();
      });
      root.querySelector('#carHead').appendChild(b);
    });

    // Spoiler
    let spoilerTall = false;
    root.querySelector('#carSpoiler').addEventListener('click', (e) => {
      spoilerTall = !spoilerTall;
      carBody.querySelector('.car-spoiler').classList.toggle('tall', spoilerTall);
      e.target.classList.toggle('active', spoilerTall);
      Audio2.click();
    });

    // Underglow
    let under = false;
    root.querySelector('#carUnderglow').addEventListener('click', (e) => {
      under = !under;
      carBody.classList.toggle('underglow-on', under);
      e.target.classList.toggle('active', under);
      carBody.style.setProperty('--underglow-color', '#ff4dd2');
      Audio2.click();
    });

    // Start Engine
    root.querySelector('#carStart').addEventListener('click', () => {
      Audio2.engine();
      // shake
      const os = $('#os');
      os.style.transition = 'transform 0.05s';
      let n = 0;
      const shake = setInterval(() => {
        os.style.transform = `translate(${rnd(-3, 3)}px, ${rnd(-3, 3)}px)`;
        if (++n > 20) { clearInterval(shake); os.style.transform = ''; }
      }, 40);
      carBody.classList.add('lights-on', 'underglow-on');
      carBody.querySelectorAll('.car-wheel').forEach(w => { w.style.animationPlayState = 'running'; });
      setTimeout(() => carBody.querySelectorAll('.car-wheel').forEach(w => { w.style.animationPlayState = 'paused'; }), 2500);
      toast('ENGINE STARTED — 1,240 HP READY', 'ok');
    });
  }
};

/* ---- ARCADE ---- */
Apps.arcade = {
  title: 'INTERNET ARCADE',
  icon: '🕹️',
  width: 760, height: 540,
  render(root) {
    root.innerHTML = `
      <h2>INTERNET ARCADE</h2>
      <div class="arcade-room" id="arcadeRoom"></div>
    `;
    const room = root.querySelector('#arcadeRoom');
    const machines = [
      { id: 'reaction', name: 'REACTION',  icon: '⚡' },
      { id: 'memory',   name: 'MEMORY',    icon: '🧠' },
      { id: 'racing',   name: 'RACING',    icon: '🏁' },
      { id: 'aim',      name: 'AIM TRAIN', icon: '🎯' },
      { id: 'numbers',  name: 'NUMBERS',   icon: '🔢' },
      { id: 'space',    name: 'SPACE',     icon: '🚀' }
    ];
    machines.forEach(m => {
      const card = el('div', 'arcade-machine', `
        <div class="arcade-screen"><div style="position:absolute;inset:0;display:grid;place-items:center;color:#33e6ff;font-size:22px;">${m.icon}</div></div>
        <div class="am-title">${m.name}</div>
      `);
      card.addEventListener('mouseenter', () => Audio2.hover());
      card.addEventListener('click', () => { Audio2.click(); openGame(m.id); });
      room.appendChild(card);
    });
  }
};

function openGame(id) {
  const titles = { reaction: 'REACTION TEST', memory: 'MEMORY GRID', racing: 'RACE LANE', aim: 'AIM TRAINER', numbers: 'NUMBER ORDER', space: 'SPACE DODGE' };
  WM.open({
    id: 'game-' + id,
    title: 'ARCADE // ' + (titles[id] || id.toUpperCase()),
    icon: '🎮',
    width: 560, height: 480,
    render(root) {
      root.innerHTML = `
        <div class="game-hud">
          <span id="gHudLeft">SCORE: 0</span>
          <span id="gHudRight">TIME: 0</span>
        </div>
        <div class="game-area" id="gArea"></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn primary" id="gStart">START</button>
          <button class="btn" id="gRestart">RESTART</button>
          <span id="gMsg" style="flex:1;font-size:11px;color:var(--text-dim);align-self:center;"></span>
        </div>
      `;
      const area = root.querySelector('#gArea');
      const startBtn = root.querySelector('#gStart');
      const restartBtn = root.querySelector('#gRestart');
      const msg = root.querySelector('#gMsg');

      let cleanup = () => {};
      const setMsg = (t) => msg.textContent = t;
      const start = () => {
        cleanup();
        area.innerHTML = '';
        if (id === 'reaction') cleanup = gameReaction(area, root);
        else if (id === 'memory') cleanup = gameMemory(area, root);
        else if (id === 'racing') cleanup = gameRacing(area, root);
        else if (id === 'aim') cleanup = gameAim(area, root);
        else if (id === 'numbers') cleanup = gameNumbers(area, root);
        else if (id === 'space') cleanup = gameSpace(area, root);
        setMsg('Playing...');
      };
      startBtn.addEventListener('click', start);
      restartBtn.addEventListener('click', start);
      return () => cleanup();
    }
  });
}

/* --- REACTION TEST --- */
function gameReaction(area, root) {
  let timeout, startTime, running = false;
  const box = el('div', '', '');
  box.style.cssText = 'width:100%;height:100%;display:grid;place-items:center;cursor:pointer;font-family:var(--font-display);font-size:24px;letter-spacing:0.2em;background:#0a0e1c;color:#33e6ff;';
  box.textContent = 'WAIT FOR GREEN...';
  area.appendChild(box);
  const schedule = () => {
    running = true;
    box.style.background = '#0a0e1c';
    box.style.color = '#33e6ff';
    box.textContent = 'WAIT...';
    const delay = 800 + Math.random() * 2200;
    timeout = setTimeout(() => {
      box.style.background = '#0d3a1a';
      box.style.color = '#3dff9e';
      box.textContent = 'CLICK NOW!';
      startTime = now();
    }, delay);
  };
  const click = () => {
    if (!running) return;
    if (!startTime) { clearTimeout(timeout); box.textContent = 'TOO EARLY!'; setTimeout(schedule, 800); return; }
    const t = Math.round(now() - startTime);
    box.style.background = '#0a0e1c';
    box.style.color = '#33e6ff';
    box.textContent = t + ' ms';
    root.querySelector('#gHudLeft').textContent = 'BEST: ' + t + ' ms';
    running = false; startTime = null;
    setTimeout(schedule, 1200);
  };
  box.addEventListener('click', click);
  schedule();
  return () => { clearTimeout(timeout); box.removeEventListener('click', click); };
}

/* --- MEMORY GRID --- */
function gameMemory(area, root) {
  const grid = el('div', '');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;height:100%;box-sizing:border-box;';
  area.appendChild(grid);
  const emojis = ['◆', '▲', '●', '■', '★', '♦', '✱', '❖'];
  const pairs = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  let first = null, matches = 0, tries = 0;
  pairs.forEach((e, i) => {
    const c = el('div', '', '');
    c.style.cssText = 'display:grid;place-items:center;background:#111a2e;border:1px solid #33e6ff33;border-radius:6px;font-size:22px;cursor:pointer;color:transparent;transition:all 0.2s;';
    c.dataset.v = e;
    c.addEventListener('click', () => {
      if (c.dataset.done) return;
      if (first === c) return;
      c.style.color = '#33e6ff';
      c.textContent = e;
      if (!first) { first = c; return; }
      tries++;
      if (first.dataset.v === c.dataset.v) {
        first.dataset.done = c.dataset.done = '1';
        first.style.background = '#0d3a1a';
        c.style.background = '#0d3a1a';
        matches++;
        first = null;
        root.querySelector('#gHudLeft').textContent = 'MATCHES: ' + matches + '/8';
        if (matches === 8) root.querySelector('#gMsg').textContent = 'COMPLETE in ' + tries + ' tries!';
      } else {
        const a = first, b = c; first = null;
        setTimeout(() => {
          a.style.color = 'transparent'; a.textContent = ''; a.style.background = '#111a2e';
          b.style.color = 'transparent'; b.textContent = ''; b.style.background = '#111a2e';
        }, 600);
      }
      root.querySelector('#gHudRight').textContent = 'TRIES: ' + tries;
    });
    grid.appendChild(c);
  });
  return () => {};
}

/* --- RACING (canvas) --- */
function gameRacing(area, root) {
  const canvas = el('canvas'); area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
  setTimeout(resize, 10);
  let x = canvas.width / 2, carX = x;
  let obstacles = [];
  let speed = 3, score = 0, alive = true;
  const keys = {};
  const kd = e => keys[e.key] = true;
  const ku = e => keys[e.key] = false;
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  let mouseX = carX;
  const mm = e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
  };
  canvas.addEventListener('mousemove', mm);
  canvas.addEventListener('touchmove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - r.left;
    e.preventDefault();
  }, { passive: false });

  let raf;
  const spawn = () => obstacles.push({ x: rnd(30, canvas.width - 30), y: -40, w: 30, h: 24 });
  let spawnTimer = 0;
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (canvas.width !== canvas.clientWidth) resize();
    // input
    if (keys.ArrowLeft || keys.a) carX -= 6;
    if (keys.ArrowRight || keys.d) carX += 6;
    if (mouseX) carX += (mouseX - carX) * 0.2;
    carX = clamp(carX, 20, canvas.width - 20);

    // road
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#33e6ff33'; ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    // scrolling lines
    ctx.strokeStyle = '#33e6ff88';
    for (let y = (now() * 0.2) % 40; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // spawn
    if (++spawnTimer > 25) { spawn(); spawnTimer = 0; }

    // update
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += speed;
      if (o.y > canvas.height) { obstacles.splice(i, 1); score++; root.querySelector('#gHudLeft').textContent = 'SCORE: ' + score; continue; }
      // collision
      if (Math.abs(o.x - carX) < 22 && Math.abs(o.y - (canvas.height - 30)) < 30) {
        alive = false;
        root.querySelector('#gMsg').textContent = 'CRASH! Score: ' + score;
        return;
      }
    }
    // draw obstacles
    obstacles.forEach(o => {
      ctx.fillStyle = '#ff4d6a';
      ctx.fillRect(o.x - o.w / 2, o.y, o.w, o.h);
      ctx.fillStyle = '#ff4d6a55';
      ctx.fillRect(o.x - o.w / 2 - 3, o.y + 4, o.w + 6, 2);
    });
    // draw car
    ctx.fillStyle = '#33e6ff';
    ctx.fillRect(carX - 12, canvas.height - 40, 24, 30);
    ctx.fillStyle = '#a05cff';
    ctx.fillRect(carX - 8, canvas.height - 44, 16, 6);
    speed = 3 + Math.min(score * 0.1, 4);
  };
  loop();
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); canvas.removeEventListener('mousemove', mm); };
}

/* --- AIM TRAINER --- */
function gameAim(area, root) {
  let score = 0, timeLeft = 20, iv, raf;
  const target = el('div', '', '✚');
  target.style.cssText = 'position:absolute;width:40px;height:40px;display:grid;place-items:center;background:radial-gradient(circle,#ff4d6a,#8b0000);border-radius:50%;color:#fff;font-size:20px;cursor:crosshair;box-shadow:0 0 20px #ff4d6a;transition:opacity 0.15s;';
  area.style.position = 'relative';
  area.appendChild(target);
  const moveTarget = () => {
    target.style.left = rnd(10, area.clientWidth - 50) + 'px';
    target.style.top  = rnd(10, area.clientHeight - 50) + 'px';
  };
  moveTarget();
  target.addEventListener('click', () => {
    score++;
    root.querySelector('#gHudLeft').textContent = 'SCORE: ' + score;
    Audio2.tone(880, 0.05, 'square', 0.04);
    moveTarget();
  });
  iv = setInterval(() => {
    timeLeft--;
    root.querySelector('#gHudRight').textContent = 'TIME: ' + timeLeft;
    if (timeLeft <= 0) {
      clearInterval(iv);
      target.style.display = 'none';
      root.querySelector('#gMsg').textContent = 'GAME OVER — Score: ' + score;
    }
  }, 1000);
  return () => { clearInterval(iv); };
}

/* --- NUMBER ORDER --- */
function gameNumbers(area, root) {
  const grid = el('div', '');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px;height:100%;box-sizing:border-box;';
  area.appendChild(grid);
  const nums = [];
  for (let i = 1; i <= 25; i++) nums.push(i);
  nums.sort(() => Math.random() - 0.5);
  let next = 1, t0 = now();
  nums.forEach(n => {
    const c = el('button', '', String(n));
    c.style.cssText = 'background:#111a2e;border:1px solid #33e6ff33;border-radius:6px;font-family:var(--font-display);font-weight:700;font-size:16px;color:#33e6ff;cursor:pointer;';
    c.addEventListener('click', () => {
      if (n === next) {
        c.style.background = '#0d3a1a';
        c.disabled = true;
        next++;
        root.querySelector('#gHudLeft').textContent = 'NEXT: ' + next;
        Audio2.tone(400 + next * 30, 0.05, 'square', 0.04);
        if (next > 25) {
          const t = ((now() - t0) / 1000).toFixed(2);
          root.querySelector('#gMsg').textContent = 'COMPLETE in ' + t + 's!';
        }
      } else {
        c.style.background = '#3a0d0d';
        setTimeout(() => c.style.background = '#111a2e', 200);
        Audio2.error();
      }
    });
    grid.appendChild(c);
  });
  root.querySelector('#gHudLeft').textContent = 'NEXT: 1';
  return () => {};
}

/* --- SPACE DODGE --- */
function gameSpace(area, root) {
  const canvas = el('canvas'); area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
  setTimeout(resize, 10);
  let ship = { x: canvas.width / 2, y: canvas.height - 40 };
  let asteroids = [];
  let stars = Array.from({ length: 40 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2 + 0.5 }));
  let alive = true, score = 0;
  const keys = {};
  const kd = e => keys[e.key] = true, ku = e => keys[e.key] = false;
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  let mouseX = null;
  const mm = e => { const r = canvas.getBoundingClientRect(); mouseX = e.clientX - r.left; };
  canvas.addEventListener('mousemove', mm);
  canvas.addEventListener('touchmove', e => { const r = canvas.getBoundingClientRect(); mouseX = e.touches[0].clientX - r.left; e.preventDefault(); }, { passive: false });

  let raf, spawn = 0;
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (canvas.width !== canvas.clientWidth) resize();
    // stars
    stars.forEach(s => { s.y += s.s; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; } });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    stars.forEach(s => { ctx.globalAlpha = s.s / 2.5; ctx.fillRect(s.x, s.y, s.s, s.s); });
    ctx.globalAlpha = 1;
    // input
    if (keys.ArrowLeft || keys.a) ship.x -= 6;
    if (keys.ArrowRight || keys.d) ship.x += 6;
    if (mouseX != null) ship.x += (mouseX - ship.x) * 0.15;
    ship.x = clamp(ship.x, 12, canvas.width - 12);
    // spawn
    if (++spawn > 20) { asteroids.push({ x: rnd(10, canvas.width - 10), y: -20, r: rnd(8, 16), s: rnd(2, 4) }); spawn = 0; }
    // update
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.y += a.s + Math.min(score * 0.05, 3);
      if (a.y > canvas.height + 30) { asteroids.splice(i, 1); score++; root.querySelector('#gHudLeft').textContent = 'SCORE: ' + score; continue; }
      if (Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + 10) {
        alive = false;
        root.querySelector('#gMsg').textContent = 'HIT! Score: ' + score;
        return;
      }
    }
    // draw asteroids
    ctx.fillStyle = '#a05cff';
    asteroids.forEach(a => { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill(); });
    // draw ship
    ctx.fillStyle = '#33e6ff';
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y - 12);
    ctx.lineTo(ship.x - 10, ship.y + 10);
    ctx.lineTo(ship.x + 10, ship.y + 10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a05cff';
    ctx.beginPath(); ctx.arc(ship.x, ship.y + 6, 3, 0, Math.PI * 2); ctx.fill();
  };
  loop();
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); canvas.removeEventListener('mousemove', mm); };
}

/* ---- SCIENCE LAB ---- */
Apps.science = {
  title: 'SCIENCE LAB',
  icon: '🧪',
  width: 720, height: 540,
  render(root) {
    root.innerHTML = `
      <h2>SCIENCE LABORATORY</h2>
      <div class="chip-row" id="sciTabs">
        <button class="chip active" data-s="accel">⚛️ PARTICLE ACCELERATOR</button>
        <button class="chip" data-s="micro">🔬 MICROSCOPE</button>
        <button class="chip" data-s="dna">🧬 DNA SCANNER</button>
        <button class="chip" data-s="planet">🪐 PLANET SIM</button>
        <button class="chip" data-s="weather">🌡️ WEATHER</button>
      </div>
      <div id="sciStage" style="position:relative;height:320px;background:#04070e;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
        <canvas id="sciCanvas" style="width:100%;height:100%;display:block;"></canvas>
        <div id="sciOverlay" style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font-family:var(--font-display);letter-spacing:0.2em;color:var(--cyan);font-size:14px;text-align:center;"></div>
      </div>
      <div id="sciInfo" style="margin-top:10px;"></div>
    `;
    const canvas = root.querySelector('#sciCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = root.querySelector('#sciOverlay');
    const info = root.querySelector('#sciInfo');

    let mode = 'accel';
    let raf, alive = true;
    const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
    setTimeout(resize, 20);

    // Particle system for accelerator
    const particles = [];
    const N = 120;
    for (let i = 0; i < N; i++) particles.push({ a: Math.random() * Math.PI * 2, r: 30 + Math.random() * 100, s: 0.02 + Math.random() * 0.05 });

    const render = () => {
      if (!alive) return;
      raf = requestAnimationFrame(render);
      if (canvas.width !== canvas.clientWidth) resize();
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = 'rgba(4,7,14,0.35)'; ctx.fillRect(0, 0, w, h);

      if (mode === 'accel') {
        const cx = w / 2, cy = h / 2;
        ctx.strokeStyle = '#33e6ff55'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 110, 0, Math.PI * 2); ctx.stroke();
        particles.forEach(p => {
          p.a += p.s;
          const x = cx + Math.cos(p.a) * p.r;
          const y = cy + Math.sin(p.a) * p.r;
          ctx.fillStyle = '#33e6ff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
      } else if (mode === 'micro') {
        const cx = w / 2, cy = h / 2;
        for (let i = 0; i < 40; i++) {
          const t = now() * 0.0004 + i;
          const x = cx + Math.cos(t + i) * (40 + (i % 5) * 20);
          const y = cy + Math.sin(t * 1.3 + i) * (40 + (i % 3) * 25);
          ctx.fillStyle = i % 2 ? '#3dff9e' : '#33e6ff';
          ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
        }
      } else if (mode === 'dna') {
        const cx = w / 2;
        for (let i = 0; i < 60; i++) {
          const t = now() * 0.002 + i * 0.4;
          const y = (i / 60) * h;
          const x1 = cx + Math.sin(t) * 60;
          const x2 = cx + Math.sin(t + Math.PI) * 60;
          ctx.strokeStyle = i % 2 ? '#33e6ff' : '#a05cff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
          ctx.fillStyle = '#33e6ff'; ctx.beginPath(); ctx.arc(x1, y, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#a05cff'; ctx.beginPath(); ctx.arc(x2, y, 3, 0, Math.PI * 2); ctx.fill();
        }
      } else if (mode === 'planet') {
        const cx = w / 2, cy = h / 2;
        const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 100);
        g.addColorStop(0, '#ff8c00'); g.addColorStop(0.6, '#8b0000'); g.addColorStop(1, '#000');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#33e6ff33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, 130, 30, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#33e6ff'; ctx.beginPath(); ctx.arc(cx + 130, cy, 4, 0, Math.PI * 2); ctx.fill();
      } else if (mode === 'weather') {
        const w2 = w / 2, h2 = h / 2;
        for (let i = 0; i < 90; i++) {
          const t = now() * 0.001 + i;
          const x = (Math.sin(t + i) * 0.5 + 0.5) * w;
          const y = ((t * 80 + i * 20) % h);
          ctx.strokeStyle = i % 3 ? '#33e6ff66' : '#a05cff99';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke();
        }
        // cloud
        ctx.fillStyle = '#33e6ff22';
        for (let i = 0; i < 6; i++) ctx.beginPath(), ctx.arc(w2 - 60 + i * 25, 60 + Math.sin(now() * 0.001 + i) * 6, 30, 0, Math.PI * 2), ctx.fill();
      }
    };
    render();

    root.querySelector('#sciTabs').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      root.querySelectorAll('#sciTabs .chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.s;
      Audio2.click();
      const messages = {
        accel: 'SYSTEM INITIALIZING...\n10%\n30%\n60%\n90%\n100%\nPARTICLES ONLINE',
        micro: 'MAGNIFICATION x50000\nBIOLOGICAL SAMPLE DETECTED',
        dna: 'GENOME SCAN COMPLETE\nSEQUENCE VERIFIED',
        planet: 'PLANETARY SIMULATION ACTIVE\nORBITAL MECHANICS ONLINE',
        weather: 'ATMOSPHERIC MODEL RUNNING'
      };
      // animated text
      overlay.textContent = '';
      let i = 0;
      const txt = messages[mode] || '';
      const iv = setInterval(() => {
        overlay.textContent = txt.slice(0, i);
        i += 3;
        if (i > txt.length) { clearInterval(iv); setTimeout(() => overlay.textContent = '', 1400); }
      }, 25);
      const descriptions = {
        accel: 'Particle accelerator: firing proton beams at 99.999% the speed of light.',
        micro: 'Microscope: observing cellular structures at sub-nanometer scale.',
        dna: 'DNA scanner: mapping the human genome in real time.',
        planet: 'Planet simulator: testing atmospheric and orbital dynamics.',
        weather: 'Weather machine: modeling global climate patterns.'
      };
      info.innerHTML = `<div class="stat-line"><span>STATUS</span><span>ONLINE</span></div>
                        <div class="stat-line"><span>MODE</span><span>${mode.toUpperCase()}</span></div>
                        <p style="margin-top:8px;color:var(--text-dim);font-size:11px;">${descriptions[mode] || ''}</p>`;
    });
    // Trigger default
    setTimeout(() => root.querySelector('#sciTabs .chip').click(), 50);

    return () => { alive = false; cancelAnimationFrame(raf); };
  }
};

/* ---- SOLAR SYSTEM (Three.js) ---- */
Apps.space = {
  title: 'UNIVERSE // SOLAR SYSTEM',
  icon: '🌌',
  width: 760, height: 560,
  render(root) {
    root.innerHTML = `
      <h2>SOLAR SYSTEM</h2>
      <canvas id="solarCanvas" class="solar-canvas"></canvas>
      <div class="planet-info" id="planetInfo">
        <div class="stat-line"><span>OBJECT</span><span>THE SUN</span></div>
        <div class="stat-line"><span>TYPE</span><span>G-TYPE STAR</span></div>
      </div>
      <div class="chip-row" id="solarBtns">
        <button class="chip active" data-p="sun">SUN</button>
        <button class="chip" data-p="earth">EARTH</button>
        <button class="chip" data-p="mars">MARS</button>
        <button class="chip" data-p="jupiter">JUPITER</button>
        <button class="chip" data-p="reset">RESET VIEW</button>
      </div>
    `;

    const canvas = root.querySelector('#solarCanvas');
    if (typeof THREE === 'undefined') {
      canvas.outerHTML = '<p style="color:#ff4d6a">Three.js not loaded.</p>';
      return;
    }
    let renderer, scene, camera, planets = [], raf, alive = true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    } catch (e) { canvas.outerHTML = '<p style="color:#ff4d6a">WebGL error.</p>'; return; }

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    camera.position.set(0, 20, 40);

    // Stars
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { sp[i*3]=rnd(-200,200); sp[i*3+1]=rnd(-200,200); sp[i*3+2]=rnd(-200,200); }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 })));

    // Sun
    const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    scene.add(sun);
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 24), new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.25 }));
    scene.add(sunGlow);

    const data = {
      sun:     { name: 'THE SUN', type: 'G-TYPE STAR', color: 0xffaa00, r: 3,  dist: 0,   speed: 0,    info: 'The star at the center of our solar system.' },
      earth:   { name: 'EARTH',   type: 'TERRESTRIAL', color: 0x2277ff, r: 0.9, dist: 10, speed: 0.4, info: 'Blue planet. Liquid water. Life.' },
      mars:    { name: 'MARS',    type: 'TERRESTRIAL', color: 0xff5522, r: 0.7, dist: 14, speed: 0.28, info: 'The red planet.' },
      jupiter: { name: 'JUPITER', type: 'GAS GIANT',   color: 0xddaa77, r: 1.7, dist: 22, speed: 0.14, info: 'Largest planet in the solar system.' },
      venus:   { name: 'VENUS',   type: 'TERRESTRIAL', color: 0xffdd88, r: 0.8, dist: 6.5, speed: 0.55, info: 'Hot and toxic.' },
      saturn:  { name: 'SATURN',  type: 'GAS GIANT',   color: 0xddcc99, r: 1.4, dist: 30, speed: 0.1, info: 'Ringed gas giant.' }
    };

    Object.entries(data).forEach(([key, d]) => {
      if (key === 'sun') return;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 20, 20),
        new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.35 })
      );
      scene.add(m);
      // orbit line
      const og = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * d.dist, 0, Math.sin(a) * d.dist));
      }
      og.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Line(og, new THREE.LineBasicMaterial({ color: 0x33e6ff, transparent: true, opacity: 0.2 })));
      planets.push({ mesh: m, d, angle: Math.random() * Math.PI * 2 });
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sunLight = new THREE.PointLight(0xffffff, 1.6, 200);
    scene.add(sunLight);

    let camTarget = new THREE.Vector3(0, 0, 0);
    let camDist = 40;
    let camAngle = 0, camElev = 0.4;
    let dragging = false, lastX = 0, lastY = 0;
    const updateCam = () => {
      camera.position.x = camTarget.x + Math.cos(camElev) * Math.cos(camAngle) * camDist;
      camera.position.y = camTarget.y + Math.sin(camElev) * camDist;
      camera.position.z = camTarget.z + Math.cos(camElev) * Math.sin(camAngle) * camDist;
      camera.lookAt(camTarget);
    };
    updateCam();

    canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      camAngle += (e.clientX - lastX) * 0.008;
      camElev = clamp(camElev + (e.clientY - lastY) * 0.006, -1.2, 1.2);
      lastX = e.clientX; lastY = e.clientY;
      updateCam();
    });
    let pinch = 0;
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      camDist = clamp(camDist + e.deltaY * 0.05, 6, 120);
      updateCam();
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      else if (e.touches.length === 1) { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        camDist = clamp(camDist + (pinch - d) * 0.15, 6, 120); pinch = d; updateCam();
      } else if (dragging && e.touches.length === 1) {
        camAngle += (e.touches[0].clientX - lastX) * 0.01;
        camElev = clamp(camElev + (e.touches[0].clientY - lastY) * 0.008, -1.2, 1.2);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        updateCam();
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { dragging = false; pinch = 0; });

    const info = root.querySelector('#planetInfo');
    const focus = (key) => {
      if (key === 'reset') { camTarget.set(0,0,0); camDist = 40; camAngle = 0; camElev = 0.4; updateCam(); return; }
      const d = data[key];
      if (!d) return;
      if (key === 'sun') { camTarget.set(0,0,0); camDist = 20; }
      else {
        const p = planets.find(x => x.d === d);
        if (p) { camTarget.copy(p.mesh.position); camDist = 8; }
      }
      updateCam();
      info.innerHTML = `
        <div class="stat-line"><span>OBJECT</span><span>${d.name}</span></div>
        <div class="stat-line"><span>TYPE</span><span>${d.type}</span></div>
        <div class="stat-line"><span>INFO</span><span>${d.info}</span></div>
      `;
    };

    root.querySelector('#solarBtns').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      root.querySelectorAll('#solarBtns .chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      focus(b.dataset.p);
      Audio2.click();
    });

    const animate = () => {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      const t = now() * 0.001;
      sun.rotation.y = t * 0.3;
      sunGlow.rotation.y = -t * 0.2;
      planets.forEach(p => {
        p.angle += p.d.speed * 0.004;
        p.mesh.position.x = Math.cos(p.angle) * p.d.dist;
        p.mesh.position.z = Math.sin(p.angle) * p.d.dist;
        p.mesh.rotation.y += 0.01;
      });
      // gentle auto-orbit if not dragging
      if (!dragging) { camAngle += 0.0008; updateCam(); }
      renderer.render(scene, camera);
    };
    resize();
    animate();
    const ri = setInterval(resize, 500);
    return () => { alive = false; cancelAnimationFrame(raf); clearInterval(ri); try { renderer.dispose(); } catch(e){} };
  }
};

/* ---- TECH DATABASE ---- */
const TECH_DB = {
  Computers: [
    { name: 'NEXUS RIG 9000', specs: { CPU: 'Core Ultra 9', GPU: 'PHOTON X-9', RAM: '128 GB', STORAGE: '8 TB NVMe' } },
    { name: 'QUANTUM DESK',  specs: { CPU: 'Q-Core 12', GPU: 'PHOTON X-9 Ti', RAM: '256 GB', STORAGE: '16 TB' } }
  ],
  CPUs: [
    { name: 'Core Ultra 9',    specs: { CORES: '24', CLOCK: '5.8 GHz', CACHE: '36 MB', TDP: '125 W' } },
    { name: 'Quantum Q1',      specs: { QUBITS: '512', COHERENCE: '1.2 ms', ERROR: '0.01%', TDP: '—' } }
  ],
  GPUs: [
    { name: 'PHOTON X-9',    specs: { VRAM: '24 GB', CLOCK: '2.6 GHz', TDP: '320 W', RT: 'GEN 4' } },
    { name: 'PHOTON X-9 Ti', specs: { VRAM: '32 GB', CLOCK: '2.9 GHz', TDP: '400 W', RT: 'GEN 4' } }
  ],
  Storage: [
    { name: 'NVMe V-900',    specs: { SIZE: '4 TB', READ: '14 GB/s', WRITE: '12 GB/s', TYPE: 'PCIe 6' } }
  ],
  Phones: [
    { name: 'NEXUS PHONE 12', specs: { SCREEN: '6.9" 8K', CHIP: 'Q1', BATTERY: '6000 mAh', CAM: '200 MP' } }
  ],
  Space: [
    { name: 'LUNAR RELAY',   specs: { ORBIT: 'Moon', BANDWIDTH: '100 Gbps', RANGE: '1.2M km', POWER: 'Solar' } },
    { name: 'DEEP PROBE X',  specs: { TARGET: 'Kuiper Belt', SPEED: '220 km/s', POWER: 'Fusion' } }
  ],
  Vehicles: [
    { name: 'APEX GT',       specs: { POWER: '1,240 hp', '0–100': '2.1 s', TOP: '412 km/h', WEIGHT: '1,320 kg' } }
  ],
  Robotics: [
    { name: 'SERVO-7',       specs: { AXES: '7', PAYLOAD: '120 kg', SPEED: '4 m/s', AI: 'Neural' } }
  ],
  Science: [
    { name: 'PARTICLE ACCEL', specs: { ENERGY: '14 TeV', LENGTH: '27 km', PARTICLES: 'Protons', MODE: 'Collision' } }
  ]
};

Apps.tech = {
  title: 'TECH DATABASE',
  icon: '🛰️',
  width: 720, height: 500,
  render(root) {
    root.innerHTML = `
      <h2>TECHNOLOGY DATABASE</h2>
      <div class="chip-row" id="techCats"></div>
      <div id="techList" class="tech-list"></div>
      <div id="techDetail" style="margin-top:12px;"></div>
    `;
    const cats = Object.keys(TECH_DB);
    const catRow = root.querySelector('#techCats');
    cats.forEach((c, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), c);
      b.addEventListener('click', () => {
        catRow.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderList(c);
        Audio2.click();
      });
      catRow.appendChild(b);
    });
    const list = root.querySelector('#techList');
    const detail = root.querySelector('#techDetail');
    const renderList = (cat) => {
      list.innerHTML = '';
      (TECH_DB[cat] || []).forEach(item => {
        const t = el('div', 'tech-item', item.name);
        t.addEventListener('click', () => {
          Audio2.click();
          detail.innerHTML = `
            <h3>${item.name}</h3>
            ${Object.entries(item.specs).map(([k,v]) => `<div class="stat-line"><span>${k}</span><span>${v}</span></div>`).join('')}
          `;
        });
        list.appendChild(t);
      });
      // Auto-select first
      if (list.firstChild) list.firstChild.click();
    };
    renderList(cats[0]);
  }
};

/* ---- MUSIC PLAYER ---- */
Apps.music = {
  title: 'MUSIC // NEXUS SYNTH',
  icon: '🎵',
  width: 520, height: 420,
  render(root) {
    root.innerHTML = `
      <h2>NEXUS SYNTH</h2>
      <canvas class="music-vis" id="musicVis"></canvas>
      <div class="music-controls">
        <button class="btn primary" id="mPlay">▶ PLAY</button>
        <button class="btn" id="mStop">■ STOP</button>
        <select id="mPattern" class="btn">
          <option value="0">AMBIENT</option>
          <option value="1">PULSE</option>
          <option value="2">ASTRAL</option>
          <option value="3">DRIFT</option>
        </select>
        <span id="mStatus" style="font-size:11px;color:var(--text-dim);">IDLE</span>
      </div>
    `;
    const canvas = root.querySelector('#musicVis');
    const ctx = canvas.getContext('2d');
    let raf, alive = true, playing = false, t0 = 0;
    const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
    setTimeout(resize, 20);

    const patterns = [
      [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63],
      [130.81, 130.81, 196, 196, 261.63, 261.63, 196, 196],
      [329.63, 415.30, 493.88, 659.25, 493.88, 415.30, 329.63, 246.94],
      [110, 164.81, 220, 293.66, 220, 164.81, 110, 82.41]
    ];
    let pattern = 0;

    const schedule = () => {
      if (!playing) return;
      const seq = patterns[pattern];
      let i = 0;
      const step = () => {
        if (!playing) return;
        const f = seq[i % seq.length];
        Audio2.tone(f, 0.5, 'triangle', 0.05);
        if (i % 4 === 0) Audio2.tone(f / 2, 0.9, 'sine', 0.03);
        i++;
        setTimeout(step, 280);
      };
      step();
    };

    const render = () => {
      if (!alive) return;
      raf = requestAnimationFrame(render);
      if (canvas.width !== canvas.clientWidth) resize();
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = 'rgba(4,7,14,0.3)'; ctx.fillRect(0, 0, w, h);
      if (!playing) return;
      const t = now() * 0.001;
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * w;
        const amp = Math.sin(t * 3 + i * 0.4) * 0.5 + 0.5;
        const barH = amp * h * 0.7 * (0.5 + Math.sin(t * 2 + i) * 0.5);
        ctx.fillStyle = `hsl(${190 + i * 4}, 100%, ${40 + amp * 30}%)`;
        ctx.fillRect(x, h - barH, w / 40 - 2, barH);
      }
    };
    render();

    root.querySelector('#mPlay').addEventListener('click', () => {
      Audio2.init();
      playing = true;
      root.querySelector('#mStatus').textContent = 'PLAYING';
      schedule();
      Audio2.click();
    });
    root.querySelector('#mStop').addEventListener('click', () => {
      playing = false;
      root.querySelector('#mStatus').textContent = 'IDLE';
      Audio2.click();
    });
    root.querySelector('#mPattern').addEventListener('change', e => {
      pattern = parseInt(e.target.value, 10);
      Audio2.click();
    });
    return () => { alive = false; playing = false; cancelAnimationFrame(raf); };
  }
};

/* ---- TERMINAL ---- */
Apps.terminal = {
  title: 'SYSTEM TERMINAL',
  icon: '▮',
  width: 620, height: 460,
  render(root) {
    root.innerHTML = `
      <div class="term" id="termOut"></div>
      <div class="term-input-wrap">
        <span class="term-prompt">nexus@core:~$</span>
        <input type="text" id="termIn" autocomplete="off" spellcheck="false" placeholder="type 'help'..."/>
      </div>
    `;
    const out = root.querySelector('#termOut');
    const input = root.querySelector('#termIn');
    const write = (text, cls = '') => {
      const d = el('div', 'term-line ' + cls, text);
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    };
    write('NEXUS OS TERMINAL v4.2', 'term-ok');
    write('Type "help" for available commands.');
    write('');

    const commands = {
      help() {
        write('Available commands:', 'term-ok');
        write('  help      — show this');
        write('  system    — system status');
        write('  games     — open Game Vault');
        write('  laptop    — open Laptop Lab');
        write('  car       — open Hypercar');
        write('  space     — open Solar System');
        write('  arcade    — open Arcade');
        write('  matrix    — toggle matrix rain');
        write('  chaos     — toggle Chaos Mode');
        write('  clear     — clear terminal');
        write('  42        — the answer');
        write('  dev       — developer room (if unlocked)');
      },
      system() {
        ['CPU ONLINE', 'GPU ONLINE', 'MEMORY ONLINE', 'NETWORK ONLINE', '3D ENGINE ONLINE'].forEach((l, i) => {
          setTimeout(() => write(l, 'term-ok'), i * 160);
        });
      },
      games()  { write('Launching Game Vault...', 'term-ok'); openApp('games'); },
      laptop() { write('Launching Laptop Lab...', 'term-ok'); openApp('laptop'); },
      car()    { write('Launching Hypercar Configurator...', 'term-ok'); openApp('car'); },
      space()  { write('Launching Solar System...', 'term-ok'); openApp('space'); },
      arcade() { write('Launching Arcade...', 'term-ok'); openApp('arcade'); },
      matrix() { write('Toggling matrix rain...', 'term-ok'); toggleMatrix(); },
      chaos()  { write('Chaos mode toggled.', 'term-warn'); toggleChaos(); },
      clear()  { out.innerHTML = ''; },
      '42'()   { write('> The answer to life, the universe, and everything.', 'term-warn'); Audio2.tone(880, 0.5, 'sine', 0.06); },
      dev() {
        if (State.secretUnlocked) { write('Access granted. Opening developer room...', 'term-ok'); $('#secretRoom').classList.add('show'); }
        else write('ACCESS DENIED. Hint: click the logo 5 times.', 'term-err');
      }
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim().toLowerCase();
        write('nexus@core:~$ ' + cmd, 'term-ok');
        if (commands[cmd]) commands[cmd]();
        else if (cmd) write('Unknown command: ' + cmd, 'term-err');
        input.value = '';
        Audio2.type();
      } else {
        Audio2.type();
      }
    });
    setTimeout(() => input.focus(), 100);
  }
};

/* ---- SETTINGS ---- */
Apps.settings = {
  title: 'SETTINGS',
  icon: '⚙️',
  width: 520, height: 480,
  render(root) {
    const s = State.settings;
    root.innerHTML = `
      <h2>SYSTEM SETTINGS</h2>
      <div class="settings-row"><label>Graphics</label>
        <div class="seg" data-key="graphics">
          ${['LOW','MEDIUM','HIGH'].map(v => `<button data-v="${v}" class="${s.graphics===v?'active':''}">${v}</button>`).join('')}
        </div>
      </div>
      <div class="settings-row"><label>Animations</label>
        <div class="seg" data-key="animations">
          ${['FULL','REDUCED','OFF'].map(v => `<button data-v="${v}" class="${s.animations===v?'active':''}">${v}</button>`).join('')}
        </div>
      </div>
      <div class="settings-row"><label>Sound</label>
        <div class="seg" data-key="sound">
          <button data-v="true"  class="${s.sound?'active':''}">ON</button>
          <button data-v="false" class="${!s.sound?'active':''}">OFF</button>
        </div>
      </div>
      <div class="settings-row"><label>Theme</label>
        <div class="seg" data-key="theme">
          ${['dark','cyber','space','minimal'].map(v => `<button data-v="${v}" class="${s.theme===v?'active':''}">${v.toUpperCase()}</button>`).join('')}
        </div>
      </div>
      <div class="settings-row"><label>Performance Mode</label>
        <div class="seg" data-key="perfMode">
          <button data-v="true"  class="${s.perfMode?'active':''}">ON</button>
          <button data-v="false" class="${!s.perfMode?'active':''}">OFF</button>
        </div>
      </div>
      <p style="margin-top:16px;font-size:11px;color:var(--text-mute)">Settings are saved to LocalStorage.</p>
    `;
    root.querySelectorAll('.seg').forEach(seg => {
      seg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const key = seg.dataset.key;
        let val = b.dataset.v;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        Settings.set(key, val);
        seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        Audio2.click();
        toast(key + ' → ' + val, 'ok', 1600);
      });
    });
  }
};

/* ---- SYSTEM ---- */
Apps.system = {
  title: 'SYSTEM // MAP',
  icon: '🖥️',
  width: 620, height: 460,
  render(root) {
    root.innerHTML = `
      <h2>SYSTEM MAP</h2>
      <div class="perf-grid">
        <div class="perf-card"><h4>CORE</h4><div class="perf-val">ONLINE</div><div class="perf-sub">NEXUS KERNEL v4.2</div></div>
        <div class="perf-card"><h4>GPU</h4><div class="perf-val">PHOTON X-9</div><div class="perf-sub">24 GB VRAM</div></div>
        <div class="perf-card"><h4>MEMORY</h4><div class="perf-val">64 GB</div><div class="perf-sub">LPDDR6</div></div>
        <div class="perf-card"><h4>NETWORK</h4><div class="perf-val">10 Gbps</div><div class="perf-sub">NEURAL LINK</div></div>
      </div>
      <h3>MODULES</h3>
      <div class="chip-row">
        <button class="chip" data-m="games">GAME VAULT</button>
        <button class="chip" data-m="laptop">LAPTOP LAB</button>
        <button class="chip" data-m="car">HYPERCAR</button>
        <button class="chip" data-m="science">SCIENCE</button>
        <button class="chip" data-m="space">UNIVERSE</button>
        <button class="chip" data-m="arcade">ARCADE</button>
        <button class="chip" data-m="tech">TECH DB</button>
      </div>
    `;
    root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { Audio2.click(); openApp(b.dataset.m); }));
  }
};

/* ══════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════ */
function openApp(id) {
  // Map nav ids → app registry ids
  const map = { hub: null, games: 'games', laptop: 'laptop', car: 'car', science: 'science', space: 'space', arcade: 'arcade', system: 'system', tech: 'tech' };
  const appId = map[id] || id;
  if (!appId) { closeAllWindows(); return; }
  const app = Apps[appId];
  if (!app) { toast('App not found: ' + appId, 'err'); return; }
  WM.open({ id: 'app-' + appId, title: app.title, icon: app.icon, width: app.width || 520, height: app.height || 400, render: app.render });
}

function setupNav() {
  $$('#navLinks button').forEach(b => {
    b.addEventListener('click', () => {
      Audio2.click();
      $$('#navLinks button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      openApp(b.dataset.nav);
    });
  });
}

function setupDock() {
  $$('.dock-btn').forEach(b => {
    b.addEventListener('mouseenter', () => Audio2.hover());
    b.addEventListener('click', () => {
      Audio2.click();
      const appId = b.dataset.app;
      const app = Apps[appId];
      if (!app) return;
      WM.open({ id: 'app-' + appId, title: app.title, icon: app.icon, width: app.width || 520, height: app.height || 400, render: app.render });
    });
  });
}

/* ══════════════════════════════════════════════════════════
   NAV CONTROLS (sound / chaos / logo)
   ══════════════════════════════════════════════════════════ */
function setupNavControls() {
  $('#soundToggle').addEventListener('click', () => {
    Settings.set('sound', !State.settings.sound);
    Audio2.click();
    toast('Sound ' + (State.settings.sound ? 'ON' : 'OFF'), 'info', 1600);
  });
  $('#chaosToggle').addEventListener('click', () => { Audio2.click(); toggleChaos(); });
  $('#chaosExit').addEventListener('click', () => { Audio2.click(); toggleChaos(false); });

  // Logo clicks = easter egg
  $('#navLogo').addEventListener('click', () => {
    Audio2.click();
    State.logoClicks++;
    if (State.logoClicks === 3) toast('Nice clicking. Keep going...', 'warn', 2200);
    if (State.logoClicks >= 5 && !State.secretUnlocked) {
      State.secretUnlocked = true;
      toast('DEVELOPER MODE UNLOCKED', 'ok');
      Audio2.notify();
      $('#secretRoom').classList.add('show');
      // Fill stats
      const stats = $('#secretStats');
      stats.innerHTML = `
        <div class="hud-chip">FPS <b>${State.fps}</b></div>
        <div class="hud-chip">WINDOWS <b>${State.windows.length}</b></div>
        <div class="hud-chip">UPTIME <b>${$('#uptime').textContent}</b></div>
      `;
    }
    if (State.logoClicks === 7) toast('You found the quiet path. Try "dev" in the terminal.', 'ok', 3200);
  });

  $('#secretClose').addEventListener('click', () => { Audio2.click(); $('#secretRoom').classList.remove('show'); });
}

/* ══════════════════════════════════════════════════════════
   CHAOS MODE
   ══════════════════════════════════════════════════════════ */
function toggleChaos(force) {
  const next = force === undefined ? !State.chaos : force;
  State.chaos = next;
  document.body.classList.toggle('chaos', next);
  $('#chaosExit').classList.toggle('show', next);
  toast(next ? '☢ CHAOS MODE ACTIVE' : 'Chaos mode disabled', next ? 'warn' : 'ok', 2400);
  if (next) Audio2.tone(120, 0.5, 'sawtooth', 0.08, 60);
}

/* ══════════════════════════════════════════════════════════
   MATRIX RAIN
   ══════════════════════════════════════════════════════════ */
let matrixCanvas = null, matrixRaf = null;
function toggleMatrix() {
  if (matrixCanvas) { stopMatrix(); return; }
  matrixCanvas = el('canvas', 'matrix-canvas');
  document.body.appendChild(matrixCanvas);
  const ctx = matrixCanvas.getContext('2d');
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  const cols = Math.floor(matrixCanvas.width / 14);
  const drops = Array(cols).fill(1);
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789NEXUS';
  const tick = () => {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    ctx.fillStyle = '#33e6ff';
    ctx.font = '14px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 14, y * 14);
      if (y * 14 > matrixCanvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
    matrixRaf = requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => { if (matrixCanvas) stopMatrix(); }, 8000);
}
function stopMatrix() {
  if (matrixRaf) cancelAnimationFrame(matrixRaf);
  if (matrixCanvas) { matrixCanvas.remove(); matrixCanvas = null; }
  matrixRaf = null;
}

/* ══════════════════════════════════════════════════════════
   CURSOR FX
   ══════════════════════════════════════════════════════════ */
const CursorFX = {
  canvas: null, ctx: null, particles: [], raf: null, alive: false,
  init() {
    this.canvas = $('#cursorFx');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', e => this.spawn(e.clientX, e.clientY));
    window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) this.spawn(t.clientX, t.clientY); }, { passive: true });
    this.alive = true;
    this.loop();
  },
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  spawn(x, y) {
    if (State.settings.perfMode || State.settings.animations === 'OFF') return;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x, y, vx: rnd(-1, 1), vy: rnd(-1, 1),
        life: 1, size: rnd(1, 3),
        hue: State.chaos ? rnd(0, 360) : 190 + rnd(-20, 20)
      });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  },
  loop() {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(() => this.loop());
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= 0.025;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/* ══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════════════════ */
function setupKeyboard() {
  window.addEventListener('keydown', e => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') {
      if (State.windows.length) closeAllWindows();
      if (State.chaos) toggleChaos(false);
    }
    // Number 1-8 opens nav sections
    const map = { '1': 'hub', '2': 'games', '3': 'laptop', '4': 'car', '5': 'science', '6': 'space', '7': 'arcade', '8': 'system' };
    if (map[e.key]) { openApp(map[e.key]); }
    if (e.key === '`') { openApp('terminal'); }
    if (e.key.toLowerCase() === 'c' && e.shiftKey) toggleChaos();
    if (e.key.toLowerCase() === 'm' && e.shiftKey) toggleMatrix();
  });
}

/* ══════════════════════════════════════════════════════════
   MOBILE NAV
   ══════════════════════════════════════════════════════════ */
function setupMobileNav() {
  const nav = $('.navbar');
  if (!nav) return;
  // Double-tap logo opens nav on mobile
  let lastTap = 0;
  $('#navLogo').addEventListener('touchstart', () => {
    const t = Date.now();
    if (t - lastTap < 300) $('#navLinks').classList.toggle('mobile-open');
    lastTap = t;
  });
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
function init() {
  Settings.load();
  Audio2.init();
  Audio2.enabled = State.settings.sound;

  // Ensure canvas sizes are set on load
  setTimeout(() => { if (BG && BG.onResize) BG.onResize(); }, 100);

  // Boot sequence begins immediately
  runBoot();

  // When OS is ready, initialize systems (we chain on enterOS too, but safe-guard here)
  document.addEventListener('nexus.enter', () => {}, { once: true });

  // Wire nav and dock now (they'll work once OS is visible)
  setupNav();
  setupDock();
  setupNavControls();
  setupKeyboard();
  setupMobileNav();

  // Cursor FX after boot
  setTimeout(() => CursorFX.init(), 1000);

  // Random hidden button easter egg
  setTimeout(() => {
    if (Math.random() < 0.35) {
      const btn = el('button', 'icon-btn', '✦');
      btn.style.cssText = 'position:fixed;bottom:80px;left:20px;z-index:600;background:linear-gradient(135deg,#a05cff,#33e6ff);color:#fff;border:none;';
      btn.title = 'A wild button appeared';
      btn.addEventListener('click', () => {
        toast('You found the wandering button! ✦', 'ok');
        Audio2.tone(1200, 0.2, 'sine', 0.06);
        btn.remove();
      });
      document.body.appendChild(btn);
    }
  }, 6000);

  // Try to init Three.js background immediately
  try { BG.init(); } catch (e) { console.warn('BG failed:', e); }

  console.log('%c◈ NEXUS OS loaded', 'color:#33e6ff;font-size:16px;font-family:monospace');
  console.log('%cTry typing "help" in the terminal.', 'color:#a05cff;font-family:monospace');
}

// Fire when DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ══════════════════════════════════════════════════════════
   ENTER-OS EVENT (called from runBoot)
   ══════════════════════════════════════════════════════════ */
const _origEnterOS = window.enterOS;
window.enterOS = function () {
  if (_origEnterOS) _origEnterOS();
  document.dispatchEvent(new Event('nexus.enter'));
};
