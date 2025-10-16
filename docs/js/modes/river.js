// docs/js/modes/river.js
// River Raid–style mini-game (Atari look & feel)
// Controls: ←/→ steer, Space fire
// Goal: stay within banks, shoot foes & bridges. Timer-based run; on crash you lose a life.

import { compactBricks, restoreBricks } from './brickMorph.js';

const W = 960, H = 600;

// Atari-like palette
const C = {
  river: '#5b54f7',      // purple-blue
  bank:  '#2d7a2a',      // green
  road:  '#b9babf',      // light gray bands where bridges sit
  bridge:'#955c2a',      // brown planks
  foe:   '#f06b6b',      // red-ish
  plane: '#56e3ff',      // cyan
  bullet:'#ffee58',      // yellow
  ui:    '#e5e7eb'       // HUD text
};

// game tuning
const SEG_H       = 26;      // vertical segment height of the river spline
const SCROLL_PX   = 140;     // base scroll speed
const RIVER_HW0   = 110;     // starting half-width
const RIVER_MIN   = 80;      // min half-width
const RIVER_MAX   = 180;     // max half-width
const TURN_MAX    = 60;      // max center shift per seg
const HW_DELTA    = 18;      // max width change per seg
const PLANE_Y     = H - 86;  // plane draw baseline
const SPAN_TIME   = 22;      // mission length (seconds)
const FIRE_CD     = 0.16;    // rate of fire

export default {
  start(state/*, canvas */){
    state.mode = 'river';
    state._skipRebuildOnReturn = true;

    // Morph bricks to side banks so remaining bricks persist and return later.
    // Safe if brickMorph isn't present (wrapped in try).
    try { compactBricks?.(state, { x: 0, y: 0, w: W, h: H, cols: 2, rows: 12 }); } catch {}

    // make scene
    const path = buildRiverPath();

    // plane uses only x; y is fixed
    const plane = {
      x: W/2,
      vx: 0,
      speed: 360,
      cooldown: 0
    };

    state._river = {
      t: 0,                  // mission timer
      timerMax: SPAN_TIME,
      scroll: 0,
      path,                  // array of control points
      foes: [],              // {x,y,vy,hit}
      bridges: [],           // {y, cx, hw, hp, down}
      bullets: [],           // {x,y,vy,hit}
      spawnT: 0,             // generic spawner cooldown
      plane
    };

    // clear ball(s) while in morph
    state.balls = [];
    state.running = true;

    // HUD
    setText('uiMode','River Raid');
    setText('uiStatus','Stay in river • Space fire');
  },

  update(dt, input, state){
    const M = state._river;
    if (!M) return;

    // mission time
    M.t += dt;
    if (M.t >= M.timerMax){
      // success — hand back a live ball
      window.SFX?.win?.();
      this._handoffToBall(state, { x: state.paddleX + 60, y: PLANE_Y, vx: 300, vy: -300 });
      return;
    }

    // scroll forward
    M.scroll += SCROLL_PX * dt;

    // plane control
    const p = M.plane;
    p.cooldown -= dt;
    const steer = (input.right?1:0) - (input.left?1:0);
    p.x = clamp(p.x + steer * p.speed * dt, 26, W - 26);

    // fire
    if (input.space && p.cooldown <= 0){
      p.cooldown = FIRE_CD;
      M.bullets.push({ x: p.x, y: PLANE_Y - 16, vy: -480, hit:false });
      window.SFX?.power?.();
    }

    // spawn foes/bridges
    M.spawnT -= dt;
    if (M.spawnT <= 0){
      M.spawnT = 0.85 + Math.random()*0.55;

      if (Math.random() < 0.22){
        // bridge across the current river
        const s = sampleRiver(M.path, -H + M.scroll - 40);
        const hw = Math.max(44, Math.min(s.hw - 12, 220));
        M.bridges.push({ y: -H + M.scroll - 40, cx: s.cx, hw, hp: 3, down:false });
      } else {
        // foe in the river
        const s = sampleRiver(M.path, -H + M.scroll - 30);
        const x = clamp(randBetween(s.cx - s.hw + 22, s.cx + s.hw - 22), 30, W-30);
        M.foes.push({ x, y: -H + M.scroll - 30, vy: 160 + Math.random()*80, hit:false });
      }
    }

    // move bullets
    for (const b of M.bullets) b.y += b.vy * dt;
    M.bullets = M.bullets.filter(b => !b.hit && b.y > -24);

    // move foes & bridges with scroll
    for (const f of M.foes) f.y += SCROLL_PX*dt + f.vy*dt;
    M.foes = M.foes.filter(f => !f.hit && f.y < H + 30);

    for (const br of M.bridges) br.y += SCROLL_PX * dt;
    M.bridges = M.bridges.filter(br => br.y < H + 40 && !br.down);

    // collisions: plane vs river bank
    if (!insideRiver(p.x, PLANE_Y, M)){
      this._lose(state);
      return;
    }

    // plane vs foes
    for (const f of M.foes){
      if (Math.abs(f.x - p.x) < 12 && Math.abs(f.y - PLANE_Y) < 12){
        this._lose(state);
        return;
      }
    }

    // bullets vs foes
    for (const f of M.foes){
      for (const b of M.bullets){
        if (!b.hit && Math.abs(f.x - b.x) < 12 && Math.abs(f.y - b.y) < 12){
          f.hit = true; b.hit = true;
          state.score = (state.score||0) + 8;
        }
      }
    }

    // bullets vs bridge planks; plane vs intact bridge
    for (const br of M.bridges){
      const left = br.cx - br.hw, right = br.cx + br.hw;
      for (const b of M.bullets){
        if (!b.hit && Math.abs(b.y - br.y) < 8 && b.x > left && b.x < right){
          b.hit = true;
          br.hp--;
          state.score = (state.score||0) + 6;
          if (br.hp <= 0) br.down = true;
        }
      }
      if (!br.down && Math.abs(PLANE_Y - br.y) < 10 && p.x > left && p.x < right){
        this._lose(state);
        return;
      }
    }

    // tidy bullets after hit
    M.bullets = M.bullets.filter(b => !b.hit && b.y > -20);
  },

  draw(ctx, state){
    const M = state._river;
    if (!M) return;

    // full background (no vignette circle)
    ctx.fillStyle = '#0b0c15';
    ctx.fillRect(0,0,W,H);

    // draw banks + river in Atari style: two green polygons, purple channel
    drawRiver(ctx, M);

    // draw gray road bands behind each bridge to sell the VCS look
    for (const br of M.bridges){
      ctx.fillStyle = C.road;
      ctx.fillRect(0, br.y - 12, W, 24);
    }

    // bridge planks
    for (const br of M.bridges){
      if (br.down) continue;
      ctx.fillStyle = C.bridge;
      ctx.fillRect(br.cx - br.hw, br.y - 6, br.hw*2, 12);
    }

    // foes (boats/helicopters) — simple 16px squares
    ctx.fillStyle = C.foe;
    for (const f of M.foes){
      ctx.fillRect(f.x - 8, f.y - 8, 16, 16);
    }

    // plane (triangle)
    const p = M.plane;
    ctx.save();
    ctx.translate(p.x, PLANE_Y);
    ctx.fillStyle = C.plane;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // bullets
    ctx.fillStyle = C.bullet;
    for (const b of M.bullets){
      ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
    }

    // mini timer dial in the top-left (retro-ish)
    const remain = 1 - (M.t / M.timerMax);
    ctx.save();
    ctx.translate(30, 30);
    ctx.strokeStyle = C.ui;
    ctx.beginPath();
    ctx.arc(0,0,18,-Math.PI/2,-Math.PI/2 + remain*2*Math.PI);
    ctx.stroke();
    ctx.restore();
  },

  _lose(state){
    // crash: lose life, hand back parked ball
    state.lives = Math.max(0, (state.lives||3) - 1);
    window.SFX?.lose?.();
    this._handoffToBall(state, null);
  },

  _handoffToBall(state, hand){
    // restore original brick layout (only non-destroyed bricks return)
    try { restoreBricks?.(state); } catch {}
    state._river = null;
    state.mode = 'ball';

    if (hand){
      state.balls = [{ x: clamp(hand.x, 8, W-8), y: clamp(hand.y, 8, H-60), vx:hand.vx, vy:hand.vy, r:8 }];
      state.running = true;
      setText('uiStatus','Running');
    } else {
      // parked at paddle
      const px = state.paddleX ?? (W-120)/2;
      state.balls = [{ x: px + 60, y: H-38 - 10, vx:0, vy:0, r:8 }];
      state.running = false;
      setText('uiStatus','Ready');
    }

    setText('uiMode','Ball');
  }
};

/* ----------------- helpers ----------------- */

function setText(id, v){ try{ const el=document.getElementById(id); if(el) el.textContent=v; }catch{} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function randBetween(a,b){ return a + Math.random()*(b-a); }

function buildRiverPath(){
  // Build enough segments to fill ~2 screens + buffer
  const total = Math.ceil((H*2)/SEG_H) + 12;
  let cx = W/2, hw = RIVER_HW0;
  const path = [];
  for (let i=0;i<total;i++){
    // wander center and width within bounds
    cx += randBetween(-TURN_MAX, TURN_MAX);
    cx = clamp(cx, 160, W - 160);
    hw += randBetween(-HW_DELTA, HW_DELTA);
    hw = clamp(hw, RIVER_MIN, RIVER_MAX);
    path.push({ y: -i*SEG_H, cx, hw });
  }
  return path;
}

function sampleRiver(path, sy){
  // sy is world-space y we want to sample (top negative)
  const i = Math.floor((-sy) / SEG_H);
  const a = path[i] || path[path.length-1];
  const b = path[i+1] || a;
  const t = ((-sy) % SEG_H) / SEG_H;
  const cx = a.cx*(1-t) + b.cx*t;
  const hw = a.hw*(1-t) + b.hw*t;
  return { cx, hw };
}

function insideRiver(x, y, M){
  const sy = y - M.scroll;
  const s = sampleRiver(M.path, sy);
  return (x > s.cx - s.hw) && (x < s.cx + s.hw);
}

function drawRiver(ctx, M){
  // We render in strips per segment for a crisp retro feel
  const seg = SEG_H;
  for (let sy = -H; sy < H; sy += seg){
    const s = sampleRiver(M.path, sy + M.scroll);
    const cx = s.cx, hw = s.hw;

    // left bank
    ctx.fillStyle = C.bank;
    ctx.fillRect(0, sy + M.scroll, cx - hw, seg+1);

    // river channel
    ctx.fillStyle = C.river;
    ctx.fillRect(cx - hw, sy + M.scroll, hw*2, seg+1);

    // right bank
    ctx.fillStyle = C.bank;
    ctx.fillRect(cx + hw, sy + M.scroll, W - (cx + hw), seg+1);
  }
}
