// docs/js/modes/invaders.js
// Mini-game: Space Invaders (with brick-morph integration and persistent destruction)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithRect
} from './brickMorph.js';

// ---- Tunables ----
const TIMER_SECS   = 16;
const COLS         = 10;
const ROWS         = 5;
const GAP          = 6;
const AREA_MARGINX = 90;
const AREA_Y       = 80;
const AREA_H       = 200;

const STEP_PIX     = 22;   // horizontal step speed basis
const DROP_PIX     = 12;   // drop when bouncing at edges
const SPEED_GAIN   = 2.0;  // speeds up over time

const FIRE_CD      = 0.16; // player auto-fire cooldown
const BULLET_VY    = -480; // px/s upwards

export default {
  start(state, canvas) {
    state.mode = 'invaders';

    // Pack remaining bricks into an invader block region
    compactBricks(state, {
      x: AREA_MARGINX,
      y: AREA_Y,
      w: (canvas.width || 960) - AREA_MARGINX * 2,
      h: AREA_H,
      cols: COLS,
      rows: ROWS,
      gap: GAP
    });

    // Stash a "base" position for each mapped brick so we can animate offsets
    // by mutating m.to per frame (helpers read m.to for collisions).
    if (state._morph?.map) {
      for (const m of state._morph.map) {
        m.base = { x: m.to.x, y: m.to.y, w: m.to.w, h: m.to.h };
      }
    }

    const W = canvas.width || 960;
    const H = canvas.height || 600;

    state.morph = {
      kind: 'invaders',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      // block motion
      dir: 1,
      step: STEP_PIX,
      drop: DROP_PIX,
      speed: 30,   // base "tempo"; increases over time
      ox: 0,       // horizontal offset
      oy: 0,       // vertical drop accumulated
      // player fire
      shots: [],
      fireCD: 0
    };

    // Ensure paddle exists for bottom reference; renderer likely draws it already.
    state.paddleX = state.paddleX || (W - 120) / 2;
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    if (!M) return;

    // --- timer ---
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // --- move player paddle (for aiming) ---
    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    state.paddleX = Math.max(0, Math.min(W - 120, state.paddleX + 560 * move * dt));

    // --- firing ---
    M.fireCD -= dt;
    if (input.space && M.fireCD <= 0) {
      M.fireCD = FIRE_CD;
      const x = state.paddleX + 60; // center of bottom paddle
      const y = H - 50;
      M.shots.push({ x, y, w: 4, h: 10, vy: BULLET_VY });
    }

    // --- advance shots + collide with mapped bricks ---
    for (const b of M.shots) {
      b.y += b.vy * dt;
      if (hitMorphWithRect(state, b)) {
        b.hit = true;
        state.score += 5;
        window.SFX?.brick?.();
      }
    }
    M.shots = M.shots.filter(b => !b.hit && b.y > -24);

    // --- animate invader block (by mutating mapped brick positions) ---
    // accelerate tempo over time
    M.speed += SPEED_GAIN * dt;
    M.ox += M.dir * M.step * dt * (M.speed / 30);

    const map = state._morph?.map || [];
    // Compute bounding box using current animated positions
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity, anyAlive = false;
    for (const m of map) {
      if (!m.alive) continue;
      anyAlive = true;
      const nx = (m.base?.x ?? m.to.x) + M.ox;
      const ny = (m.base?.y ?? m.to.y) + M.oy;
      // apply to both the mapped rect and the backing brick so renderer stays in sync
      m.to.x = nx; m.to.y = ny;
      const br = state.bricks[m.src];
      if (br) { br.x = nx; br.y = ny; br.w = m.to.w; br.h = m.to.h; }
      if (nx < minX) minX = nx;
      if (nx + m.to.w > maxX) maxX = nx + m.to.w;
      if (ny + m.to.h > maxY) maxY = ny + m.to.h;
    }

    // All cleared early = win
    if (!anyAlive) {
      window.SFX?.win?.();
      return this.end(state, true);
    }

    // Edge bounce → reverse and drop
    const leftHit  = minX < 20;
    const rightHit = maxX > W - 20;
    if (leftHit || rightHit) {
      M.dir *= -1;
      M.oy  += M.drop;
      // Re-apply Y with new drop this frame
      for (const m of map) {
        if (!m.alive) continue;
        const nx = (m.base?.x ?? m.to.x) + M.ox;
        const ny = (m.base?.y ?? m.to.y) + M.oy;
        m.to.x = nx; m.to.y = ny;
        const br = state.bricks[m.src];
        if (br) { br.x = nx; br.y = ny; }
      }
      // Update maxY after drop to evaluate failure
      maxY += M.drop;
    }

    // Lose if block crosses paddle line
    const PADDLE_Y = H - 38;
    if (maxY > PADDLE_Y - 20) {
      return this.end(state, false);
    }
  },

  draw(ctx, state) {
    // Timer ring + simple legend. Bricks render via your global renderer.
    const M = state.morph;
    if (!M) return;

    ctx.save();
    // Timer
    ctx.strokeStyle = '#86efac';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // Legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ move • Space fire';
    const pad = 10, mw = ctx.measureText(text).width + pad * 2;
    const x = W - mw - 12, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, mw, 32);
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(text, x + pad, y + 21);

    // Player shots
    ctx.fillStyle = '#ffffff';
    for (const b of (M.shots || [])) ctx.fillRect(b.x - 2, b.y - 10, 4, 10);

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

    // Put only surviving bricks back where they came from (broken ones stay gone)
    restoreBricks(state);

    // Return to Ball mode
    state.toMode = 'ball';
  }
};
