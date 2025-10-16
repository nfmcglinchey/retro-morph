import { compactBricks, restoreBricks, hitMorphWithCircle } from './brickMorph.js';

export default {
  start(state, canvas) {
    state.mode = 'pong';

    // Layout remaining bricks into a top rack
    compactBricks(state, {
      x: 70, y: 60, w: canvas.width - 140, h: 140,
      cols: 13, rows: 4, gap: 4
    });

    // Puck + paddles
    const speed = 300;
    const r = 8;
    state.morph = {
      kind: 'pong',
      timer: 18, max: 18,
      puck: { x: canvas.width / 2, y: canvas.height * 0.60, vx: speed, vy: -speed, r },
      top: { x: (canvas.width - 120) / 2, w: 120, h: 10, y: 28 },
      chain: 0, accel: 1.06
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600; // canvas logical size
    const M = state.morph;
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // Move bottom paddle from main state
    const PADDLE = { y: H - 38, w: state.paddleW || 120, h: 16 };
    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    state.paddleX = Math.max(0, Math.min(W - (PADDLE.w || 120), state.paddleX + (560 * move * dt)));

    // Puck
    const p = M.puck;
    p.x += p.vx * dt; p.y += p.vy * dt;

    // Walls
    if (p.x < p.r) { p.x = p.r; p.vx *= -1; }
    if (p.x > W - p.r) { p.x = W - p.r; p.vx *= -1; }

    // Top paddle AI
    M.top.x = Math.max(0, Math.min(W - M.top.w, M.top.x + (p.x - (M.top.x + M.top.w / 2)) * 0.05));

    // Score if you pass the top paddle without touching it
    if (p.y - p.r < M.top.y && !(p.x > M.top.x && p.x < M.top.x + M.top.w)) {
      state.score += 120 + 12 * (M.chain || 0);
      state.lives = Math.min(99, (state.lives || 3) + 1);
      try { document.getElementById('uiLives').textContent = state.lives; } catch {}
      window.SFX?.win();
      return this.end(state, true);
    }

    // Miss bottom = lose
    if (p.y > H + p.r) {
      window.SFX?.lose();
      state.lives = Math.max(0, (state.lives || 3) - 1);
      try { document.getElementById('uiLives').textContent = state.lives; } catch {}
      return this.end(state, false);
    }

    // Collide bottom paddle
    const pad = { x: state.paddleX, y: PADDLE.y, w: PADDLE.w || 120, h: PADDLE.h || 16 };
    if (p.y + p.r > pad.y && p.y - p.r < pad.y + pad.h && p.x > pad.x && p.x < pad.x + pad.w && p.vy > 0) {
      p.y = pad.y - p.r - 0.01;
      p.vy = -Math.abs(p.vy) * M.accel;
      p.vx *= M.accel;
      M.chain = (M.chain || 0) + 1;
      state.score += 6 * M.chain;
      window.SFX?.paddle();
    }

    // Collide top paddle
    if (p.y - p.r < M.top.y + M.top.h && p.x > M.top.x && p.x < M.top.x + M.top.w && p.vy < 0) {
      p.y = M.top.y + M.top.h + p.r + 0.01;
      p.vy = Math.abs(p.vy) * M.accel;
      p.vx *= M.accel;
    }

    // Hit mapped bricks → break persisting source bricks
    if (hitMorphWithCircle(state, p.x, p.y, p.r)) {
      state.score += 10;
      p.vy *= -1;
      window.SFX?.brick();
    }
  },

  draw(ctx, state) {
    // Bricks are drawn by the global renderer (already moved), so just draw mode UI
    const W = 960;
    ctx.save();
    // Timer ring
    ctx.strokeStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (state.morph.timer / state.morph.max) * Math.PI * 2);
    ctx.stroke();
    // Legend
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

  end(state, _success) {
    restoreBricks(state);
    state.toMode = 'ball';
  }
};
