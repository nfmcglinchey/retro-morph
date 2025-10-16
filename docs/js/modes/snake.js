// docs/js/modes/snake.js
// Mini-game: Snake (with brick-morph integration + persistent destruction)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithCircle
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS   = 30;
const GRID_CFG     = { cols: 14, rows: 7, gap: 6, marginX: 70, topY: 70, height: 600 - 220 };
const SNAKE_SPEED  = 240;  // base speed
const BOOST_SPEED  = 320;  // when holding Space
const TURN_RATE    = 2.2;  // rad/s
const RADIUS       = 6;    // snake "segment" radius
const MAX_TRAIL    = 40;   // base max, grows a bit with level

export default {
  start(state, canvas) {
    state.mode = 'snake';

    // Rearrange remaining (unbroken) bricks into a mid-board grid.
    compactBricks(state, {
      x: GRID_CFG.marginX,
      y: GRID_CFG.topY,
      w: (canvas.width || 960) - GRID_CFG.marginX * 2,
      h: GRID_CFG.height,
      cols: GRID_CFG.cols,
      rows: GRID_CFG.rows,
      gap: GRID_CFG.gap
    });

    const W = canvas.width || 960;
    const H = canvas.height || 600;

    // Seed from current ball position/velocity if available
    const b  = (state.balls && state.balls[0]) || { x: W / 2, y: H * 0.60, vx: 280, vy: -280 };
    const dir = Math.atan2(b.vy || -280, b.vx || 280);

    state.morph = {
      kind:  'snake',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      dir,
      speed: SNAKE_SPEED,
      body: [
        { x: b.x,     y: b.y },
        { x: b.x - 8, y: b.y },
        { x: b.x -16, y: b.y }
      ]
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // --- timer ---
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // --- steering & movement ---
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    M.dir += steer * TURN_RATE * dt;

    const speed = input.space ? BOOST_SPEED : SNAKE_SPEED;
    const head = {
      x: M.body[0].x + Math.cos(M.dir) * speed * dt,
      y: M.body[0].y + Math.sin(M.dir) * speed * dt
    };

    // --- wall collision -> lose ---
    if (head.x < RADIUS || head.x > W - RADIUS || head.y < RADIUS || head.y > H - RADIUS) {
      return this.end(state, false);
    }

    // --- eat mapped bricks (persistently break sources) ---
    if (hitMorphWithCircle(state, head.x, head.y, RADIUS)) {
      state.score += 12;
      window.SFX?.brick?.();
      // grow tail a bit
      for (let g = 0; g < 4; g++) {
        M.body.push({ ...M.body[M.body.length - 1] });
      }
    }

    // --- self collision -> lose ---
    for (let i = 6; i < M.body.length; i++) {
      const p = M.body[i];
      if (Math.hypot(head.x - p.x, head.y - p.y) < RADIUS) {
        return this.end(state, false);
      }
    }

    // --- advance body ---
    M.body.unshift(head);
    const level = state.level || 0;
    const maxLen = MAX_TRAIL + Math.min(80, level * 5);
    while (M.body.length > maxLen) M.body.pop();
  },

  draw(ctx, state) {
    const M = state.morph;
    if (!M) return;

    // Timer ring
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // Snake body
    for (let i = 0; i < M.body.length; i++) {
      const p = M.body[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
      const hue = (i * 6 + performance.now() / 20) % 360;
      ctx.fillStyle = `hsl(${hue},90%,60%)`;
      ctx.fill();
    }

    // Legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ steer • Eat bricks';
    const pad = 10, mw = ctx.measureText(text).width + pad * 2;
    const x = W - mw - 12, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, mw, 32);
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(text, x + pad, y + 21);

    ctx.restore();
  },

  end(state, success) {
    // lives / SFX
    if (!success) {
      state.lives = Math.max(0, (state.lives || 3) - 1);
      try {
        const el = document.getElementById('uiLives');
        if (el) el.textContent = state.lives;
      } catch {}
      window.SFX?.lose?.();
    } else {
      window.SFX?.win?.();
    }

    // Only surviving bricks return to their original positions
    restoreBricks(state);

    // Return to Ball mode
    state.toMode = 'ball';
  }
};
