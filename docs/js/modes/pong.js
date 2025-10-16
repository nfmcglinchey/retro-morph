// docs/js/modes/pong.js
// Classic rally mini-game. Bottom paddle is the same one as Ball mode.

import { arrangeGrid, restoreGrid } from './brickMorph.js'; // no-op if not implemented

const W = 960, H = 600;
const PAD_W = 120, PAD_H = 16;

export default {
  start(state/*, canvas */) {
    state.mode = 'pong';
    state._skipRebuildOnReturn = true;

    // Optional: morph bricks into side walls (safe if helper is absent)
    try { arrangeGrid?.(state, { mode: 'pong' }); } catch {}

    // Seed puck from Ball mode if present; otherwise create a default
    const b = (state.balls && state.balls[0]) || { x: W/2, y: H*0.6, vx: 280, vy: -260, r: 8 };
    state._pong = {
      puck: { x: b.x, y: b.y, vx: b.vx || 280, vy: b.vy || -260, r: 8 },
      topX: (W - PAD_W)/2,
      topW: PAD_W,
      accel: 1.06,
      chain: 0
    };

    // Use shared bottom paddle
    state.paddleX = state.paddleX ?? (W - PAD_W) / 2;

    // This mode owns the ball; clear base balls
    state.balls = [];
    state.running = true;

    setText('uiMode','Pong');
    setText('uiStatus','Rally to win');
  },

  update(dt, input, state) {
    const P = state._pong; if (!P) return;

    // Player paddle
    const speed = 560;
    state.paddleX = clamp((state.paddleX ?? (W-PAD_W)/2) + ((input.right?1:0) - (input.left?1:0))*speed*dt, 0, W-PAD_W);

    // Puck
    const p = P.puck;
    p.x += p.vx*dt; p.y += p.vy*dt;

    // Side walls
    if (p.x < p.r) { p.x = p.r; p.vx *= -1; }
    if (p.x > W - p.r) { p.x = W - p.r; p.vx *= -1; }

    // AI paddle follows softly
    P.topX = clamp(P.topX + (p.x - (P.topX + P.topW/2))*0.05, 0, W - P.topW);

    // Hit top paddle
    if (p.y - p.r < 28 && p.x > P.topX && p.x < P.topX + P.topW) {
      p.vy = Math.abs(p.vy) * P.accel;
      p.vx *= P.accel;
      cap(p);
      P.chain++; state.score = (state.score||0) + 6*P.chain;
    }

    // Win if you pass the top without hitting it
    if (p.y - p.r < 28 && !(p.x > P.topX && p.x < P.topX + P.topW)) {
      state.score = (state.score||0) + 120 + 12*(P.chain||0);
      state.lives = (state.lives||3) + 1;
      this._handoffToBall(state, { x:p.x, y:p.y, vx:p.vx, vy:-Math.abs(p.vy) });
      return;
    }

    // Bottom paddle collision / miss
    const pad = { x: state.paddleX, y: H-38, w: PAD_W, h: PAD_H };
    if (p.y + p.r > pad.y && p.x > pad.x && p.x < pad.x + pad.w) {
      p.y = pad.y - p.r - 0.01;
      const hit = (p.x - (pad.x + pad.w/2)) / (pad.w/2);     // -1..+1
      p.vx = (p.vx + hit * 120);
      p.vy = -Math.abs(p.vy) * P.accel;
      cap(p);
      P.chain++; state.score = (state.score||0) + 6*P.chain;
    } else if (p.y > H + p.r) {
      // Miss → lose life and return to Ball mode parked
      state.lives = Math.max(0, (state.lives||3) - 1);
      this._handoffToBall(state, null);
      return;
    }
  },

  draw(ctx, state) {
    const P = state._pong; if (!P) return;

    // background
    ctx.fillStyle = '#0b0c15';
    ctx.fillRect(0,0,W,H);

    // top paddle (AI)
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(P.topX, 28, P.topW, 10);

    // bottom paddle (player)
    ctx.fillRect(state.paddleX, H-38, PAD_W, PAD_H);

    // puck
    const p = P.puck;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  },

  _handoffToBall(state, puck) {
    try { restoreGrid?.(state); } catch {}
    state._pong = null;
    state.mode = 'ball';

    if (puck) {
      state.balls = [{ x: clamp(puck.x,8,W-8), y: clamp(puck.y,8,H-60), vx:puck.vx, vy:puck.vy, r:8 }];
      state.running = true;
      setText('uiStatus','Running');
    } else {
      // parked on the paddle
      const px = state.paddleX ?? (W-PAD_W)/2;
      state.balls = [{ x: px + PAD_W/2, y: (H-38) - 10, vx:0, vy:0, r:8 }];
      state.running = false;
      setText('uiStatus','Ready');
    }
    setText('uiMode','Ball');
  }
};

/* helpers */
function setText(id, v){ try{ const el=document.getElementById(id); if(el) el.textContent=v; }catch{} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function cap(p){ const s=Math.hypot(p.vx,p.vy); if (s>540){ const k=540/s; p.vx*=k; p.vy*=k; } }
