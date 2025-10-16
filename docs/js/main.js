// public/js/main.js
// App bootstrap + main loop

import { createState, saveSettings, loadSettings } from './state.js';
import { CFG, setDifficulty, CRT, COLORBLIND } from './config.js';
import * as HUD from './ui/hud.js';
import * as Panels from './ui/panels.js';
import * as Input from './input.js';
import { drawCRTOverlay } from './renderer.js';
import { MODES } from './modes/index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- create and hydrate state ---
const state = createState();
Object.assign(state.settings, loadSettings());
setDifficulty(state.settings.diff);
CRT.enabled = !!state.settings.crt;
COLORBLIND.enabled = !!state.settings.cb;

// ---- Unlock persistence and secret codes ----
const UNLOCK_KEY = 'bb_unlocks';
function loadUnlocks() {
  try { return JSON.parse(localStorage.getItem(UNLOCK_KEY) || '{}'); } catch { return {}; }
}
function saveUnlocks() {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(state.unlocks)); } catch {}
}
Object.assign(state.unlocks, loadUnlocks());

// refresh mini-game lock visuals
function renderMiniLocks() {
  const panel = document.getElementById('miniPanel');
  if (!panel) return;
  panel.querySelectorAll('.mini').forEach(t => {
    const kind = t.getAttribute('data-kind');
    const locked = (kind === 'river') ? !state.unlocks.river : !state.unlocks[kind];
    t.classList.toggle('locked', locked);
    const btn = t.querySelector('.btnStart');
    if (btn) btn.disabled = locked;
  });
}

// open Mini-Game panel
function openMiniPanel() {
  const panel = document.getElementById('miniPanel');
  if (!panel) return;
  renderMiniLocks();
  panel.classList.remove('hidden');
}

// ---- HUD buttons ----
document.getElementById('btnPause').onclick = () => {
  state.paused = !state.paused;
  HUD.set.status(state.paused ? 'Paused' : (state.running ? 'Running' : 'Ready'));
  document.getElementById('btnPause').textContent = state.paused ? 'Resume (P)' : 'Pause (P)';
};
document.getElementById('btnReset').onclick = () => MODES.ball.reset(state);

// ---- Settings / panels ----
Panels.mount(state, {
  onChange(s) {
    saveSettings(s);
    setDifficulty(s.diff);
    CRT.enabled = !!s.crt;
    COLORBLIND.enabled = !!s.cb;
  }
});

// ---- Input bindings ----
Input.bind();         // ensure keyboard works for all modes (esp. River)
Input.bindTouch();
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP') {
    state.paused = !state.paused;
    HUD.set.status(state.paused ? 'Paused' : (state.running ? 'Running' : 'Ready'));
    document.getElementById('btnPause').textContent = state.paused ? 'Resume (P)' : 'Pause (P)';
  }
});

// ---- Secret Codes: NEAL & Konami ----
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
let konamiIdx = 0;
const NEAL = ['KeyN','KeyE','KeyA','KeyL'];
let nealIdx = 0;

window.addEventListener('keydown', (e) => {
  // Konami tracker
  if (e.code === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;

      // Unlock River + grant 99 lives
      state.unlocks.river = true;
      state.lives = 99;
      try {
        const el = document.getElementById('uiLives');
        if (el) el.textContent = state.lives;
      } catch {}
      saveUnlocks();
      renderMiniLocks();
      try { HUD.set.status('Konami unlocked: River Raid + 99 Lives'); } catch {}
      window.SFX?.win?.();
    }
  } else {
    konamiIdx = (e.code === KONAMI[0]) ? 1 : 0;
  }

  // NEAL tracker (case-insensitive)
  if (e.code === NEAL[nealIdx]) {
    nealIdx++;
    if (nealIdx === NEAL.length) {
      nealIdx = 0;
      ['pong','pac','tron','asteroids','invaders','snake'].forEach(k => state.unlocks[k] = true);
      saveUnlocks();
      renderMiniLocks();
      openMiniPanel();
      try { HUD.set.status('Mini-Game Select unlocked'); } catch {}
      window.SFX?.power?.();
    }
  } else {
    nealIdx = (e.code === NEAL[0]) ? 1 : 0;
  }
});

// ---- Bind Mini-Game panel buttons ----
(function bindMiniStartButtons(){
  const panel = document.getElementById('miniPanel');
  if (!panel) return;
  panel.querySelectorAll('.mini .btnStart').forEach(btn => {
    btn.addEventListener('click', () => {
      const tile = btn.closest('.mini');
      if (!tile) return;
      const kind = tile.getAttribute('data-kind');
      const locked = (kind === 'river') ? !state.unlocks.river : !state.unlocks[kind];
      if (locked) return;
      state.toMode = kind;
      panel.classList.add('hidden');
    });
  });
})();

// ---- Start in Ball mode ----
MODES.ball.start(state, canvas);

// ---- FPS meter ----
const fpsEl = document.getElementById('fps');
let lastFpsT = performance.now(), frames = 0;

// ---- Main loop ----
function frame(ts) {
  const dt = Math.min(0.033, ((ts - (state.clock.last || ts)) / 1000));
  state.clock.last = ts;

  // update current mode
  if (!state.paused) {
    MODES[state.mode].update(dt, Input.read(), state);
  }

  // handle mode switches
  if (state.toMode && MODES[state.toMode]) {
    MODES[state.toMode].start(state, canvas);
    state.toMode = null;
  }

  // mini-game handoff back to Ball
  if (state._handoffBall && state.mode === 'ball') {
    const b = state._handoffBall;
    state.balls = [{ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r }];
    state.running = true;
    state._handoffBall = null;
  }

  // draw
  MODES[state.mode].draw(ctx, state);
  if (CRT.enabled) drawCRTOverlay(ctx);

  // FPS meter update
  frames++;
  if (ts - lastFpsT >= 500) {
    fpsEl.textContent = `${Math.round(1000 * frames / (ts - lastFpsT))} fps`;
    frames = 0;
    lastFpsT = ts;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
