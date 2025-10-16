// docs/js/modes/tron.js
// Mini-game: Tron Cycle (brick-morph layout; bricks are not destroyed in this mode)

import {
  compactBricks,
  restoreBricks
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS  = 16;
const GRID_CFG    = { cols: 14, rows: 8, gap: 6, marginX: 70, topY: 70 };
const SPEED_BASE  = 300;
const SPEED_BOOST = 360;
const TURN_RATE   = 3.0;   // rad/s
const HEAD_R      = 5;     // head radius
const MAX_TRAIL   = 360;   // number of points to keep

export default {
  start(state, canvas) {
    state.mode = 'tron';

    // Rearrange remaining (unbroken) bricks into a mid-board grid
    compactBricks(state, {
      x: GRID_CFG.marginX,
      y: GRID_CFG.topY,
      w: (canvas.width || 960) - GRID_CFG.marginX * 2,
      h: (canvas.height || 600) - 240,
      cols: GRID_CFG.cols,
      rows: GRID_CFG.rows,
      gap: GRID_CFG.gap
    });

    const W = canvas.width || 960;
    const H = canvas.height || 600;
    const seed = (state.balls && state.balls[0]) || { x: W / 2, y: H * 0.60 };

    state.morph = {
      kind:  'tron',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      head:  { x: seed.x, y: seed.y, dir: 0 },
      trail: []
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // timer
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // steer + move
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    M.head.dir += steer * TURN_RATE * dt;
    const speed = input.space ? SPEED_BOOST : SPEED_BASE;
    M.head.x += Math.cos(M.head.dir) * speed * dt;
    M.head.y += Math.sin(M.head.dir) * speed * dt;

    // record trail
    M.trail.unshift({ x: M.head.x, y: M.head.y });
    while (M.trail.length > MAX_TRAIL) M.trail.pop();

    // walls → lose
    if (M.head.x < 4 || M.head.x > W - 4 || M.head.y < 4 || M.head.y > H - 4) {
      return this.end(state, false);
    }

    // self collision → lose
    for (let i = 6; i < M.trail.length; i++) {
      const p = M.trail[i];
      if (Math.hypot(M.head.x - p.x, M.head.y - p.y) < HEAD_R) {
        return this.end(state, false);
      }
    }

    // Note: In Tron we do NOT interact with bricks. They’re laid out by compactBricks()
    // for visual variety/obstacles, then restored on exit.
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

    // Trail
    ctx.strokeStyle = '#22d3ee';
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < M.trail.length; i++) {
      const p = M.trail[i];
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(M.head.x, M.head.y, HEAD_R, 0, Math.PI * 2);
    ctx.fillStyle = '#67e8f9';
    ctx.fill();

    // Legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ steer • Space boost • Don’t hit walls/trail';
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

    // Restore bricks (none were broken in Tron)
    restoreBricks(state);

    // Return to Ball mode
    state.toMode = 'ball';
  }
};
