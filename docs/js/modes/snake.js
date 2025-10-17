// docs/js/modes/snake.js
// Snake Mode (grid-locked 4-way). Eat bricks (pellets) to grow.
// Colliding with yourself or the arena bounds ends the morph and costs a life.

import { compactBricks as arrangeGrid, restoreBricks as restoreGrid } from './brickMorph.js';

const W = 960, H = 600;

// --- tuning ---
const CELL        = 20;      // grid cell size
const STEP_HZ     = 10;      // snake steps per second (speed)
const ROUND_TIME  = 22;      // seconds for the mode
const START_LEN   = 5;       // initial body segments
const GROW_LEN    = 1;       // growth per pellet
const HEAD_R      = 8;

// palette
const C = {
  bg:     '#0b0c15',
  head:   '#67e8f9',
  body:   '#22d3ee',
  pellet: '#ffe066',
  ui:     '#e5e7eb'
};

export default {
  start(state /*, canvas */){
    state.mode = 'snake';
    state._skipRebuildOnReturn = true;

    // Arrange remaining bricks into a compact grid so they're easy to "eat".
    // Safe no-op if helpers are absent.
    try { arrangeGrid?.(state, { x: 80, y: 70, w: W-160, h: 320, cols: 22, rows: 14, keepGaps: true }); } catch {}

    // Build pellet list from all NOT-broken bricks, keeping an index back
    // to persist the destruction into the main game.
    const pellets = [];
    for (let i=0; i<state.bricks.length; i++){
      const br = state.bricks[i];
      if (!br || br.type === 'broken') continue;
      // pellet at the brick center, snapped to grid
      const cx = snap(br.x + br.w/2);
      const cy = snap(br.y + br.h/2);
      pellets.push({ cx, cy, idx: i }); // idx → state.bricks index
    }

    // Make a clean snake centered near the bottom
    const startX = snap(W/2);
    const startY = snap(70 + 320 + 40);
    const body = [];
    for (let i=0; i<START_LEN; i++){
      body.push({ x: startX - i*CELL, y: startY });
    }

    state._snake = {
      t: 0,
      timerMax: ROUND_TIME,
      stepAcc: 0,
      stepDt: 1 / STEP_HZ,
      dir: { x: 1, y: 0 },        // moving right initially
      want: { x: 1, y: 0 },       // buffered desired dir
      body,                       // array of {x,y} in grid coords (px units)
      grow: 0,
      pellets,                    // array of {cx,cy,idx}
      scoreOnEnter: state.score|0
    };

    // no regular ball during morph
    state.balls = [];
    state.running = true;
    setText('uiMode', 'Snake');
    setText('uiStatus', '4-way grid • Eat bricks • Avoid walls & tail');
  },

  update(dt, input, state){
    const S = state._snake;
    if (!S) return;

    // timer end → handoff a live ball
    S.t += dt;
    if (S.t >= S.timerMax || S.pellets.length === 0){
      window.SFX?.win?.();
      const head = S.body[0];
      return this._handoffToBall(state, { x: head.x, y: head.y, vx: 300, vy: -300, r: HEAD_R });
    }

    // buffered input (prevent 180° immediate reversals)
    if (input.left  && !(S.dir.x ===  1 && S.dir.y === 0)) S.want = { x:-1, y: 0 };
    if (input.right && !(S.dir.x === -1 && S.dir.y === 0)) S.want = { x: 1, y: 0 };
    if (input.up    && !(S.dir.x ===  0 && S.dir.y === 1)) S.want = { x: 0, y:-1 };
    if (input.down  && !(S.dir.x ===  0 && S.dir.y ===-1)) S.want = { x: 0, y: 1 };

    // advance in fixed steps for crisp grid movement
    S.stepAcc += dt;
    while (S.stepAcc >= S.stepDt){
      S.stepAcc -= S.stepDt;

      // apply buffered turn at cell boundary
      if ((S.want.x !== S.dir.x || S.want.y !== S.dir.y)) {
        // turning is always valid in snake (no walls inside arena)
        S.dir = { x: S.want.x, y: S.want.y };
      }

      const head = S.body[0];
      const nx = clamp(head.x + S.dir.x * CELL, CELL, W - CELL);
      const ny = clamp(head.y + S.dir.y * CELL, CELL, H - 60 - CELL);

      // bounds collision
      if (nx <= CELL-1 || nx >= W-CELL+1 || ny <= CELL-1 || ny >= H-60-CELL+1){
        return this._die(state);
      }

      // self collision
      for (let i=0; i<S.body.length; i++){
        const seg = S.body[i];
        if (seg.x === nx && seg.y === ny){
          return this._die(state);
        }
      }

      // move: push new head
      S.body.unshift({ x: nx, y: ny });

      // pellet eat?
      let ate = false;
      for (const p of S.pellets){
        if (p.cx === nx && p.cy === ny){
          // persistently break backing brick
          const br = state.bricks[p.idx];
          if (br && br.type !== 'broken'){
            br.type = 'broken';
            state.score = (state.score|0) + 12;
            window.SFX?.brick?.();
          }
          p._eat = true;
          ate = true;
          S.grow += GROW_LEN;
          break;
        }
      }
      S.pellets = S.pellets.filter(p => !p._eat);

      // growth control
      if (S.grow > 0) S.grow--;
      else S.body.pop(); // drop tail if not growing
    }
  },

  draw(ctx, state){
    const S = state._snake;
    if (!S) return;

    // clean frame (no CRT circle)
    ctx.fillStyle = C.bg;
    ctx.fillRect(0,0,W,H);

    // pellets
    ctx.fillStyle = C.pellet;
    for (const p of S.pellets){
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 4, 0, Math.PI*2);
      ctx.fill();
    }

    // body
    for (let i=1; i<S.body.length; i++){
      const b = S.body[i];
      ctx.fillStyle = C.body;
      ctx.fillRect(b.x - 8, b.y - 8, 16, 16);
    }

    // head
    const h = S.body[0];
    ctx.fillStyle = C.head;
    ctx.beginPath();
    ctx.arc(h.x, h.y, HEAD_R, 0, Math.PI*2);
    ctx.fill();

    // timer ring
    const remain = 1 - (S.t / S.timerMax);
    ctx.save(); ctx.translate(30,30);
    ctx.strokeStyle = C.ui;
    ctx.beginPath(); ctx.arc(0,0,18,-Math.PI/2,-Math.PI/2 + remain*2*Math.PI); ctx.stroke();
    ctx.restore();
  },

  _die(state){
    state.lives = Math.max(0, (state.lives||3) - 1);
    window.SFX?.lose?.();
    return this._handoffToBall(state, null);
  },

  _handoffToBall(state, hand){
    try { restoreGrid?.(state); } catch {}
    state._snake = null;
    state.mode = 'ball';

    if (hand){
      state.balls = [{ x: clamp(hand.x, 8, W-8), y: clamp(hand.y, 8, H-60), vx: hand.vx, vy: hand.vy, r: hand.r }];
      state.running = true;
      setText('uiStatus','Running');
    } else {
      const px = state.paddleX ?? (W-120)/2;
      state.balls = [{ x: px + 60, y: H - 48, vx:0, vy:0, r: HEAD_R }];
      state.running = false;
      setText('uiStatus','Ready');
    }
    setText('uiMode','Ball');
  }
};

/* ---------- helpers ---------- */

function setText(id, v){ try{ const el=document.getElementById(id); if(el) el.textContent=v; }catch{} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function snap(v){ return Math.round(v / CELL) * CELL; }
