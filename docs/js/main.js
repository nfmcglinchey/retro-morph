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

// create and hydrate state
const state = createState();
Object.assign(state.settings, loadSettings());
setDifficulty(state.settings.diff);
CRT.enabled = !!state.settings.crt;
COLORBLIND.enabled = !!state.settings.cb;

// HUD buttons
document.getElementById('btnPause').onclick = () => {
  state.paused = !state.paused;
  HUD.set.status(state.paused ? 'Paused' : (state.running ? 'Running' : 'Ready'));
  document.getElementById('btnPause').textContent = state.paused ? 'Resume (P)' : 'Pause (P)';
};
document.getElementById('btnReset').onclick = () => MODES.ball.reset(state);

// Settings / panels
Panels.mount(state, {
  onChange(s) {
    saveSettings(s);
    setDifficulty(s.diff);
    CRT.enabled = !!s.crt;
    COLORBLIND.enabled = !!s.cb;
  }
});

// Input bindings
Input.bindTouch();
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP') {
    state.paused = !state.paused;
    HUD.set.status(state.paused ? 'Paused' : (state.running ? 'Running' : 'Ready'));
    document.getElementById('btnPause').textContent = state.paused ? 'Resume (P)' : 'Pause (P)';
  }
});

// Start in Ball mode
MODES.ball.start(state, canvas);

// FPS meter
const fpsEl = document.getElementById('fps');
let lastFpsT = performance.now(), frames = 0;

// --- Main loop ---
function frame(ts) {
  const dt = Math.min(0.033, ((ts - (state.clock.last || ts)) / 1000));
  state.clock.last = ts;

  // update current mode
  if (!state.paused) {
    MODES[state.mode].update(dt, Input.read(), state);
  }

  // --- handle mode switches and handoffs ---
  if (state.toMode && MODES[state.toMode]) {
    MODES[state.toMode].start(state, canvas);
    state.toMode = null;
  }

  // when a mini-game ends and returns a ball to Ball mode
  if (state._handoffBall && state.mode === 'ball') {
    const b = state._handoffBall;
    state.balls = [{ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r }];
    state.running = true;
    state._handoffBall = null;
  }

  // draw current mode
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
