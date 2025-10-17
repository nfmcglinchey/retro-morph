// docs/js/modes/invaders.js
// Space Invaders–style mini-game
// Controls: ← / → move, Space fire
// Win: destroy all invaders. Lose: invaders reach your paddle line or you get hit.

import { compactBricks, restoreBricks } from './brickMorph.js'; // safe-optional below

const W = 960, H = 600;

// Palette
const C = {
  bg:   '#0b0c15',
  ui:   '#e5e7eb',
  player: '#cbd5e1',
  enemy:  '#86efac',
  bolt:   '#ffee58', // player shot
  bomb:   '#f472b6', // enemy shot
};

// Tuning
const ENEMY_ROWS   = 5;
const ENEMY_COLS   = 10;
const ENEMY_W      = 36;
const ENEMY_H      = 22;
const GAP_X        = 16;
const GAP_Y        = 16;
const START_Y      = 90;

const STEP_X       = 16;     // horizontal shift per step
const DROP_Y       = 14;     // drop when hitting edge
const BASE_SPEED   = 0.75;   // steps/second (scaled with remaining enemies)
const BOMB_RATE    = 1.2;    // lower = more bombs (seconds between attempts)
const BOMB_CHANCE  = 0.35;   // chance per attempt that a column fires
const PLAYER_Y     = H - 58;
const FIRE_CD      = 0.16;   // player fire cooldown
const SHOT_SPEED   = 540;    // player shot px/s
const BOMB_SPEED   = 260;    // enemy bomb px/s

export default {
  start(state/*, canvas */){
    state.mode = 'invaders';
    state._skipRebuildOnReturn = true;

    // Compact the remaining level bricks into a rough grid (optional; safe if missing)
    try { compactBricks?.(state, { to: 'grid' }); } catch {}

    // Build formation anchored to screen center
    const totalW = ENEMY_COLS * ENEMY_W + (ENEMY_COLS - 1) * GAP_X;
    const left0  = (W - totalW) / 2;
    const enemies = [];
    for (let r=0; r<ENEMY_ROWS; r++){
      for (let c=0; c<ENEMY_COLS; c++){
        enemies.push({
          x: left0 + c * (ENEMY_W + GAP_X),
          y: START_Y + r * (ENEMY_H + GAP_Y),
          w: ENEMY_W - 6,
          h: ENEMY_H - 6,
          alive: true
        });
      }
    }

    state._inv = {
      enemies,
      dir: 1,                 // 1=>right, -1=>left
      stepClock: 0,           // time accumulator for step rate
      speedScale: 1,          // increases as enemies die
      bombClock: 0,
      leftEdge: 0,
      rightEdge: 0,
      playerX: state.paddleX ?? (W - 120)/2,
      fireCD: 0,
      shots: [],              // player shots
      bombs: [],              // enemy bombs
      won: false,
    };

    // Remove balls during morph
    state.balls = [];
    state.running = true;

    setText('uiMode', 'Space Invaders');
    setText('uiStatus', '← / → move • Space fire');
  },

  update(dt, input, state){
    const M = state._inv;
    if (!M) return;

    // Move player
    const move = (input.right?1:0) - (input.left?1:0);
    M.playerX = clamp(M.playerX + move * 520 * dt, 16, W - 16);

    // Fire
    M.fireCD -= dt;
    if (input.space && M.fireCD <= 0){
      M.fireCD = FIRE_CD;
      M.shots.push({ x: M.playerX, y: PLAYER_Y - 14, vy: -SHOT_SPEED, hit:false });
      window.SFX?.power?.();
    }

    // Step logic: formation speed scales with remaining enemies
    const aliveCount = M.enemies.filter(e => e.alive).length;
    if (aliveCount === 0){
      // Win → return to ball with a little reward
      state.score = (state.score||0) + 150;
      window.SFX?.win?.();
      return this._handoffToBall(state, { x: M.playerX, y: PLAYER_Y - 24, vx: 300, vy: -300 });
    }
    M.speedScale = 1 + (1 - aliveCount / (ENEMY_ROWS * ENEMY_COLS)) * 1.6;

    M.stepClock += dt * M.speedScale;
    const stepPeriod = 1 / BASE_SPEED; // seconds per step base
    while (M.stepClock >= stepPeriod){
      M.stepClock -= stepPeriod;
      // Compute bounds
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const e of M.enemies){
        if (!e.alive) continue;
        minX = Math.min(minX, e.x);
        maxX = Math.max(maxX, e.x + e.w);
        maxY = Math.max(maxY, e.y + e.h);
      }

      // Edge check
      const atEdge = (M.dir > 0 && maxX + STEP_X > W - 10) ||
                     (M.dir < 0 && minX - STEP_X < 10);
      if (atEdge){
        // Drop and reverse
        for (const e of M.enemies){ if (e.alive) e.y += DROP_Y; }
        M.dir *= -1;
      } else {
        for (const e of M.enemies){ if (e.alive) e.x += M.dir * STEP_X; }
      }

      // Lose if they reach paddle line
      if (maxY + DROP_Y >= PLAYER_Y - 8){
        return this._lose(state);
      }
    }

    // Enemy bombs (random column shooters)
    M.bombClock += dt;
    if (M.bombClock >= BOMB_RATE){
      M.bombClock = 0;
      if (Math.random() < BOMB_CHANCE){
        // pick a random column that still has at least one alive
        const cols = [];
        for (let c=0; c<ENEMY_COLS; c++){
          for (let r=ENEMY_ROWS-1; r>=0; r--){
            const idx = r*ENEMY_COLS + c;
            const e = M.enemies[idx];
            if (e && e.alive){ cols.push(e); break; }
          }
        }
        if (cols.length){
          const shooter = cols[(Math.random()*cols.length)|0];
          M.bombs.push({ x: shooter.x + shooter.w/2, y: shooter.y + shooter.h + 6, vy: BOMB_SPEED, hit:false });
        }
      }
    }

    // Move shots/bombs
    for (const s of M.shots)  s.y += s.vy * dt;
    for (const b of M.bombs)  b.y += b.vy * dt;

    // Collisions: player shots → enemies
    for (const s of M.shots){
      if (s.hit) continue;
      for (const e of M.enemies){
        if (!e.alive) continue;
        if (s.x > e.x && s.x < e.x + e.w && s.y > e.y && s.y < e.y + e.h){
          e.alive = false;
          s.hit = true;
          state.score = (state.score||0) + 10;
          window.SFX?.brick?.();
          break;
        }
      }
    }

    // Collisions: bombs → player line (treat paddle as a bar centered on M.playerX)
    for (const b of M.bombs){
      if (b.hit) continue;
      if (b.y >= PLAYER_Y - 6 && Math.abs(b.x - M.playerX) < 54){
        b.hit = true;
        return this._lose(state);
      }
    }

    // Cull
    M.shots = M.shots.filter(s => !s.hit && s.y > -18);
    M.bombs = M.bombs.filter(b => !b.hit && b.y < H + 18);
  },

  draw(ctx, state){
    const M = state._inv;
    if (!M) return;

    // Clear full background (no vignette circle)
    ctx.fillStyle = C.bg;
    ctx.fillRect(0,0,W,H);

    // Enemies
    ctx.fillStyle = C.enemy;
    for (const e of M.enemies){
      if (!e.alive) continue;
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }

    // Player (use paddle position but draw a little ship)
    ctx.save();
    ctx.translate(M.playerX, PLAYER_Y);
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(16, 8);
    ctx.lineTo(-16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Shots
    ctx.fillStyle = C.bolt;
    for (const s of M.shots) ctx.fillRect(s.x - 2, s.y - 10, 4, 12);

    // Bombs
    ctx.fillStyle = C.bomb;
    for (const b of M.bombs) ctx.fillRect(b.x - 2, b.y - 6, 4, 8);

    // Minimal legend badge (top-right)
    ctx.save();
    const text = '← / → move • Space fire';
    ctx.font = '13px system-ui';
    const pad = 10;
    const mw = ctx.measureText(text).width + pad*2;
    const x = W - mw - 12, y = 12;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, x, y, mw, 32, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
    ctx.fillStyle = C.ui;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + pad, y + 21);
    ctx.restore();
  },

  _lose(state){
    state.lives = Math.max(0, (state.lives||3) - 1);
    window.SFX?.lose?.();
    return this._handoffToBall(state, null);
  },

  _handoffToBall(state, hand){
    // Restore bricks to where they were before morph (optional; safe if helper missing)
    try { restoreBricks?.(state); } catch {}
    state.mode = 'ball';
    state._inv = null;

    if (hand){
      // Throw a live ball back into play
      state.balls = [{
        x: clamp(hand.x, 8, W-8),
        y: clamp(hand.y, 8, H-60),
        vx: hand.vx, vy: hand.vy, r: 8
      }];
      state.running = true;
      setText('uiStatus','Running');
    } else {
      // Park ball on paddle, Ready state
      const px = state.paddleX ?? (W-120)/2;
      state.balls = [{ x: px + 60, y: H - 48, vx:0, vy:0, r:8 }];
      state.running = false;
      setText('uiStatus','Ready');
    }
    setText('uiMode','Ball');
  }
};

/* ----------------- helpers ----------------- */
function setText(id, v){ try{ const el = document.getElementById(id); if (el) el.textContent = v; }catch{} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y,   x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x,   y+h, rr);
  ctx.arcTo(x,   y+h, x,   y,   rr);
  ctx.arcTo(x,   y,   x+w, y,   rr);
  ctx.closePath();
}
