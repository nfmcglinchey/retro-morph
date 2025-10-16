// docs/js/modes/asteroids.js
// Mini-game: Asteroids (with brick-morph integration)

import {
  compactBricks,
  restoreBricks,
  hitMorphWithCircle
} from './brickMorph.js';

// ---------- Tunables ----------
const TIMER_SECS         = 18;
const SHIP_TURN_SPEED    = 3.2;     // rad/s
const SHIP_THRUST        = 380;     // px/s^2
const SHIP_DRAG          = 0.995;   // per frame
const SHOT_SPEED         = 480;     // px/s
const SHOT_COOLDOWN      = 0.18;    // s
const ROCK_MIN_R         = 10;      // split threshold
const ROCK_SPLIT_FACTOR  = 0.6;     // size after split
const ROCK_COUNT         = 6;
const ROCK_SPEED_X       = 120;
const ROCK_SPEED_Y       = 80;

function wrap(p, W, H) {
  if (p.x < 0) p.x = W;
  if (p.x > W) p.x = 0;
  if (p.y < 0) p.y = H;
  if (p.y > H) p.y = 0;
}

function spawnRocks(n, W, H) {
  const a = [];
  for (let i = 0; i < n; i++) {
    a.push({
      x: 50 + Math.random() * (W - 100),
      y: 80 + Math.random() * 200,
      vx: (Math.random() * 2 - 1) * ROCK_SPEED_X,
      vy: (Math.random() * 2 - 1) * ROCK_SPEED_Y,
      r: 18 + Math.random() * 12
    });
  }
  return a;
}

function splitRock(list, rock) {
  if (rock.r <= ROCK_MIN_R) return;
  for (let i = 0; i < 2; i++) {
    list.push({
      x: rock.x,
      y: rock.y,
      vx: (Math.random() * 2 - 1) * ROCK_SPEED_X * 1.1,
      vy: (Math.random() * 2 - 1) * ROCK_SPEED_Y * 1.1,
      r: rock.r * ROCK_SPLIT_FACTOR
    });
  }
}

// ---------- Mode ----------
export default {
  start(state, canvas) {
    state.mode = 'asteroids';

    // Rearrange remaining bricks into a compact block for this mode.
    // Any bricks destroyed here stay broken when we return to Ball.
    compactBricks(state, {
      x: 90, y: 90, w: canvas.width - 180, h: 220,
      cols: 10, rows: 5, gap: 6
    });

    const W = canvas.width || 960;
    const H = canvas.height || 600;

    state.morph = {
      kind: 'asteroids',
      timer: TIMER_SECS,
      max:   TIMER_SECS,
      ship:  { x: W / 2, y: H * 0.65, dir: -Math.PI / 2, vx: 0, vy: 0 },
      shots: [],
      rocks: spawnRocks(ROCK_COUNT, W, H),
      cooldown: 0
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600; // logical size
    const M = state.morph;
    if (!M) return;

    // --- timer ---
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // --- ship control ---
    const s = M.ship;

    // rotation (left/right)
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    s.dir += steer * SHIP_TURN_SPEED * dt;

    // thrust + fire (space)
    if (input.space) {
      s.vx += Math.cos(s.dir) * SHIP_THRUST * dt;
      s.vy += Math.sin(s.dir) * SHIP_THRUST * dt;

      if (M.cooldown <= 0) {
        M.cooldown = SHOT_COOLDOWN;
        M.shots.push({
          x: s.x,
          y: s.y,
          vx: Math.cos(s.dir) * SHOT_SPEED,
          vy: Math.sin(s.dir) * SHOT_SPEED
        });
      }
    }
    M.cooldown -= dt;

    // integrate ship
    s.vx *= SHIP_DRAG;
    s.vy *= SHIP_DRAG;
    s.x  += s.vx * dt;
    s.y  += s.vy * dt;
    wrap(s, W, H);

    // --- shots ---
    for (const sh of M.shots) {
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      wrap(sh, W, H);

      // Shots can also destroy mapped bricks (persistently)
      if (hitMorphWithCircle(state, sh.x, sh.y, 3)) {
        state.score += 7;
        sh.hit = true;
        window.SFX?.brick?.();
      }
    }
    M.shots = M.shots.filter(sh => !sh.hit);

    // --- rocks ---
    for (const r of M.rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      wrap(r, W, H);

      // ship collision = lose
      if (Math.hypot(s.x - r.x, s.y - r.y) < r.r + 8) {
        return this.end(state, false);
      }
    }

    // shot/rock collisions
    for (const sh of M.shots) {
      for (const r of M.rocks) {
        if (Math.hypot(sh.x - r.x, sh.y - r.y) < r.r) {
          // rock hit
          r.hit = true;
          sh.hit = true;
          state.score += 10;
          window.SFX?.brick?.();
          splitRock(M.rocks, r);
        }
      }
    }
    M.shots = M.shots.filter(sh => !sh.hit);
    M.rocks = M.rocks.filter(r => !r.hit);

    // win if all rocks cleared early
    if (!M.rocks.length) {
      window.SFX?.win?.();
      return this.end(state, true);
    }
  },

  draw(ctx, state) {
    const M = state.morph;
    if (!M) return;

    // --- timer ring ---
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (M.timer / M.max) * Math.PI * 2);
    ctx.stroke();

    // --- ship ---
    const s = M.ship;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.dir);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- shots ---
    ctx.fillStyle = '#ffffff';
    for (const sh of M.shots) {
      ctx.fillRect(sh.x - 2, sh.y - 2, 4, 4);
    }

    // --- rocks (outline) ---
    ctx.strokeStyle = '#9ca3af';
    for (const r of M.rocks) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // legend
    const W = 960;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '13px system-ui';
    const text = '←/→ rotate • Space thrust & fire';
    const pad = 10, mw = ctx.measureText(text).width + pad * 2;
    const x = W - mw - 12, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, mw, 32);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(text, x + pad, y + 21);

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

    // Put only the surviving (not-broken) bricks back where they came from
    restoreBricks(state);

    // Hand back to Ball mode
    state.toMode = 'ball';
  }
};
