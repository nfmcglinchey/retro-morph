// docs/js/modes/pong.js
// Mini-game: Pong Rally (with brick-morph integration + persistent destruction)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithCircle
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS   = 18;
const TOP_RACK     = { marginX: 70, y: 60, height: 140, cols: 13, rows: 4, gap: 4 };
const PUCK_R       = 8;
const BASE_SPEED   = 300;
const ACCEL        = 1.06;   // speedup after each paddle hit
const PAD_W        = 120;
const PAD_H        = 16;
const TOP_H        = 10;
const TOP_Y        = 28;
const PLAYER_SPEED = 560;

export default {
  start(state, canvas) {
    state.mode = 'pong';

    // Rearrange remaining bricks into a top rack
    compactBricks(state, {
      x: TOP_RACK.marginX,
      y: TOP_RACK.y,
      w: (canvas.width || 960) - TOP_RACK.marginX * 2,
      h: TOP_RACK.height,
      cols: TOP_RACK.cols,
      rows: TOP_RACK.rows,
      gap: TOP_RACK.gap
    });

    const W = canvas.width || 960;
    const H = canvas.height || 600;

    state.morph = {
      kind:  'pong',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      puck:  { x: W / 2, y: H * 0.60, vx: BASE_SPEED, vy: -BASE_SPEED, r: PUCK_R },
      top:   { x: (W - PAD_W) / 2, y: TOP_Y, w: PAD_W, h: TOP_H },
      chain: 0,
      accel: ACCEL
    };

    // Ensure paddle baseline exists
    state.paddleX = state.paddleX ?? (W - PAD_W) / 2;
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // --- timer ---
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // --- player paddle movement (bottom) ---
    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    state.paddleX = Math.max(0, Math.min(W - PAD_W, state.paddleX + PLAYER_SPEED * move * dt));

    const pad = { x: state.paddleX, y: H - 38, w: PAD_W, h: PAD_H };

    // --- puck integration ---
    const p = M.puck;
    p.x += p.vx * dt; p.y += p.vy * dt;

    // walls
    if (p.x < p.r)       { p.x = p.r;         p.vx *= -1; }
    if (p.x > W - p.r)   { p.x = W - p.r;     p.vx *= -1; }

    // top AI paddle tracks puck with smoothing
    M.top.x = Math.max(0, Math.min(W - M.top.w, M.top.x + (p.x - (M.top.x + M.top.w / 2)) * 0.05));

    // score if puck passes above top paddle without touching it
    if (p.y - p.r < M.top.y && !(p.x > M.top.x && p.x < M.top.x + M.top.w)) {
      // Win rally
      const bonus = 120 + 12 * (M.chain || 0);
      state.score += bonus;
      state.lives = Math.min(99, (state.lives || 3) + 1);
      try { document.getElementById('uiLives').textContent = state.lives; } catch {}
      window.SFX?.win?.();
      return this.end(state, true);
    }

    // Miss bottom → lose
    if (p.y > H + p.r) {
      state.lives = Math.max(0, (state.lives || 3) - 1);
      try { document.getElementById('uiLives').textContent = state.lives; } catch {}
      window.SFX?.lose?.();
      return this.end(state, false);
    }

    // collide with bottom paddle
    if (p.y + p.r > pad.y && p.y - p.r < pad.y + pad.h && p.x > pad.x && p.x < pad.x + pad.w && p.vy > 0) {
      // simple Arkanoid-ish rebound: always go upward, increase speed slightly
      p.y  = pad.y - p.r - 0.01;
      p.vy = -Math.abs(p.vy) * M.accel;
      p.vx =  p.vx * M.accel;
      M.chain = (M.chain || 0) + 1;
      state.score += 6 * M.chain;
      window.SFX?.paddle?.();
    }

    // collide with top paddle
    if (p.y - p.r < M.top.y + M.top.h && p.x > M.top.x && p.x < M.top.x + M.top.w && p.vy < 0) {
      p.y  = M.top.y + M.top.h + p.r + 0.01;
      p.vy =  Math.abs(p.vy) * M.accel;
      p.vx =  p.vx * M.accel;
    }

    // Hit mapped bricks → break persistently, bounce
    if (hitMorphWithCircle(state, p.x, p.y, p.r)) {
      state.score += 10;
      p.vy *= -1;
      window.SFX?.brick?.();
    }
  },

  draw(ctx, state) {
    const M = state.morph;
    if (!M) return;

    // Timer ring
    ctx.save();
    ctx.strokeStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // Top paddle
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(M.top.x, M.top.y, M.top.w, M.top.h);

    // Puck
    const p = M.puck;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ move • Score past top';
    const pad = 10, mw = ctx.measureText(text).width + pad * 2;
    const x = W - mw - 12, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, mw, 32);
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(text, x + pad, y + 21);

    ctx.restore();
  },

  end(state, success) {
    // SFX already handled on win/lose, but keep guard
    if (!success) window.SFX?.lose?.(); else window.SFX?.win?.();

    // Restore only surviving bricks to original places
    restoreBricks(state);

    // Hand back to Ball mode
    state.toMode = 'ball';
  }
};
