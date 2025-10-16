// public/js/state.js
import { buildLevel } from './bricks.js';

export function createState() {
  const W = 960, H = 600;
  return {
    W, H,
    clock: { last: 0 },
    running: false,
    paused: false,
    level: 0, score: 0, lives: 3,
    mode: 'ball',            // router key into MODES
    toMode: null,
    paddle: { x: (W-120)/2, vx: 0, w: 120, h: 16, y: H-38, speed: 560, wMin:80, wMax:240 },
    balls: [],
    bullets: [],
    powerups: [],
    bricks: [],
    labels: [],
    settings: { crt: true, sfx: true, music: false, diff: 'normal', cb: false },
    unlocks: { pong:false, pac:false, tron:false, asteroids:false, invaders:false, river:false },
    lastBrickHitT: 0,
    banner: { text:'', color:'#fff', timer:0 },
    theme: { bg: (t)=> {
      const g = this? null : null; // placeholder to avoid accidental this-binding
      return null; // background filled in mode draw
    } }
  };
}

const KEY = 'bb_settings';
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

// helpers used by modes
export function resetForLevel(state) {
  state.bricks = buildLevel(state.level, state.W, state.H);
  state.powerups = [];
  state.bullets = [];
  state.labels = [];
}
