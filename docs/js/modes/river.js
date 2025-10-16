// docs/js/modes/river.js
// Mini-game: River Raid (with brick-morph integration + persistent destruction)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithRect
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS   = 24;

const GRID_CFG     = { cols: 12, rows: 6, gap: 6, marginX: 100, topY: 60, height: 260 };
// The compacted bricks play the role of bridges/targets. Bullets that hit a mapped brick
// permanently break the backing brick in the main game.

const PLANE_SPEED  = 320;
const FIRE_CD      = 0.18;
const BULLET_VY    = -460;

const FOE_MIN_CD   = 0.9;
const FOE_VAR_CD   = 0.6;
const FOE_SPEED_MIN= 140;
const FOE_SPEED_VAR= 80;

// ---- Helpers ----
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

// ---- Mode ----
export default {
  start(state, canvas) {
    state.mode = 'river';

    // Compact remaining (unbroken) bricks into a mid/upper block.
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
      kind: 'river',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      plane:  { x: W / 2, y: H - 80, speed: PLANE_SPEED, cd: 0 },
      bullets: [],
      foes:    [],
      tSpawn:  0
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // --- timer ---
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // --- plane movement ---
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    M.plane.x = clamp(M.plane.x + steer * M.plane.speed * dt, 20, W - 20);

    // --- fire ---
    M.plane.cd -= dt;
    if (input.space && M.plane.cd <= 0) {
      M.plane.cd = FIRE_CD;
      M.bullets.push({ x: M.plane.x, y: M.plane.y - 14, w: 4, h: 12, vy: BULLET_VY });
    }

    // --- spawn foes ---
    M.tSpawn -= dt;
    if (M.tSpawn <= 0) {
      M.tSpawn = FOE_MIN_CD + Math.random() * FOE_VAR_CD;
      M.foes.push({
        x: 40 + Math.random() * (W - 80),
        y: -20,
        vy: FOE_SPEED_MIN + Math.random() * FOE_SPEED_VAR
      });
    }

    // --- bullets advance + hit mapped bricks (bridges/targets) ---
    for (const b of M.bullets) {
      b.y += b.vy * dt;
      // Break mapped brick -> backing brick becomes 'broken' persistently
      if (hitMorphWithRect(state, { x: b.x - 2, y: b.y - 6, w: 4, h: 12 })) {
        b.hit = true;
        state.score += 5;
        window.SFX?.brick?.();
      }
    }
    M.bullets = M.bullets.filter(b => !b.hit && b.y > -24);

    // --- foes move + collisions (with bullets and plane) ---
    for (const f of M.foes) {
      f.y += f.vy * dt;
      // plane crash
      if (Math.abs(f.x - M.plane.x) < 12 && Math.abs(f.y - M.plane.y) < 12) {
        return this.end(state, false);
      }
      // bullets vs foes
      for (const b of M.bullets) {
        if (Math.abs(f.x - b.x) < 10 && Math.abs(f.y - b.y) < 12) {
          f.hit = true; b.hit = true;
          state.score += 8;
        }
      }
    }
    M.foes    = M.foes.filter(f => !f.hit && f.y < H + 30);
    M.bullets = M.bullets.filter(b => !b.hit);

    // Optional failure if too many foes pass? (Omitted—timer/plane crash are primary conditions.)
  },

  draw(ctx, state) {
    const M = state.morph;
    if (!M) return;

    // Timer ring
    ctx.save();
    ctx.strokeStyle = '#67e8f9';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // Plane
    ctx.save();
    ctx.translate(M.plane.x, M.plane.y);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Foes
    ctx.fillStyle = '#f87171';
    for (const f of M.foes) ctx.fillRect(f.x - 8, f.y - 8, 16, 16);

    // Bullets
    ctx.fillStyle = '#ffee58';
    for (const b of M.bullets) ctx.fillRect(b.x - 2, b.y - 6, 4, 12);

    // Legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ steer • Space fire';
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

    // Only intact bricks return; bricks destroyed during River stay broken in Ball
    restoreBricks(state);

    // Back to Ball mode
    state.toMode = 'ball';
  }
};
