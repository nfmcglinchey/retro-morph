// docs/js/modes/pac.js
// Mini-game: Pac-Ball (with brick-morph integration + persistent destruction)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithCircle
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS   = 18;
const GRID_CFG     = { cols: 14, rows: 6, gap: 4, marginX: 60, topY: 70, height: 240 };
const BASE_SPEED   = 210;
const DASH_SPEED   = 260;
const PAC_R        = 10;
const GHOST_PROX   = 16;   // collide distance
const GHOST_SPEED1 = 120;
const GHOST_SPEED2 = 140;

export default {
  start(state, canvas) {
    state.mode = 'pac';

    // Rearrange remaining (unbroken) bricks into our maze area
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

    state.morph = {
      kind: 'pac',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      pac:   { x: W / 2, y: H * 0.60, r: PAC_R, dir: -Math.PI / 2, speed: BASE_SPEED },
      ghosts: [
        { x: W * 0.35, y: 120, dir:  1, speed: GHOST_SPEED1 },
        { x: W * 0.65, y: 180, dir: -1, speed: GHOST_SPEED1 },
        { x: W * 0.50, y: 220, dir:  1, speed: GHOST_SPEED2 }
      ]
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // timer
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // steer + dash
    const pac = M.pac;
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    pac.dir   += steer * 2.6 * dt;
    const sp   = input.space ? DASH_SPEED : BASE_SPEED;
    pac.x     += Math.cos(pac.dir) * sp * dt;
    pac.y     += Math.sin(pac.dir) * sp * dt;

    // wrap X, clamp Y (leaving vertically ends the mode with a fail)
    if (pac.x < 0) pac.x = W;
    if (pac.x > W) pac.x = 0;
    if (pac.y < pac.r || pac.y > H - pac.r) return this.end(state, false);

    // Eat mapped bricks -> persistently break sources
    if (hitMorphWithCircle(state, pac.x, pac.y, pac.r)) {
      state.score += 9;
      window.SFX?.brick?.();
    }

    // Ghosts patrol; touch = lose
    for (const g of M.ghosts) {
      g.x += g.dir * g.speed * dt;
      if (g.x < 40 || g.x > W - 40) g.dir *= -1;
      if (Math.hypot(pac.x - g.x, pac.y - g.y) < GHOST_PROX) return this.end(state, false);
    }
  },

  draw(ctx, state) {
    const M = state.morph;
    if (!M) return;

    // timer ring
    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // pac
    const pac = M.pac;
    ctx.beginPath();
    const mouth = 0.35; // small wedge
    ctx.moveTo(pac.x, pac.y);
    ctx.arc(pac.x, pac.y, pac.r, pac.dir + mouth, pac.dir - mouth, true);
    ctx.closePath();
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // ghosts
    for (const g of M.ghosts) {
      ctx.fillStyle = '#f87171';
      ctx.fillRect(g.x - 8, g.y - 8, 16, 12);
      ctx.beginPath(); ctx.arc(g.x, g.y - 8, 8, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 3; i++) ctx.fillRect(g.x - 9 + i * 6, g.y + 4, 6, 4);
    }

    // legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ steer • Space dash';
    const pad = 10, mw = ctx.measureText(text).width + pad * 2;
    const x = W - mw - 12, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, mw, 32);
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(text, x + pad, y + 21);

    ctx.restore();
  },

  end(state, success) {
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

    // Only intact bricks return to their original positions
    restoreBricks(state);

    // hand off to Ball
    state.toMode = 'ball';
  }
};
