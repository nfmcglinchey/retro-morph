// docs/js/modes/pac.js
// Pac-Ball mini-game: eat bricks (pellets), avoid ghosts; power pellets in 4 corners.
// Controls: ← / → for hard 90° turns (up/down are optional if you want them too).
// Grid-locked 4-way movement with buffered turns, classic feel.

import { compactBricks as arrangeGrid, restoreBricks as restoreGrid } from './brickMorph.js';

const W = 960, H = 600;

// --- Tuning ---
const CELL        = 20;      // Pac grid cell size (keep it a multiple of your brick size)
const SPEED       = 180;     // Pac base speed
const GHOST_SPEED = 150;
const FRIGHT_SECS = 6;       // frightened duration after power pellet
const ROUND_TIME  = 24;      // length of the Pac morph
const PAC_R       = 9;

// Colors (retro-ish)
const C = {
  pellet: '#ffd54f',
  pelletBig: '#fff176',
  pac: '#fde047',
  wall: '#364152',
  ghost: '#f87171',
  ghostFright: '#60a5fa'
};

export default {
  start(state /*, canvas */){
    state.mode = 'pac';
    state._skipRebuildOnReturn = true;

    // Arrange remaining bricks into a compact arena (safe if no-op)
    // We keep it wide and not too tall so it feels maze-like.
    try { arrangeGrid?.(state, { x: 80, y: 70, w: W-160, h: 300, cols: 20, rows: 12, keepGaps: true }); } catch {}

    // Build a pellet list directly from *current* undestroyed bricks.
    // Each pellet tracks the backing brick reference so we can persist its removal.
    const pellets = [];
    const liveRects = [];
    for (let i=0; i<state.bricks.length; i++){
      const br = state.bricks[i];
      if (!br || br.type === 'broken') continue;
      pellets.push({
        x: br.x, y: br.y, w: br.w, h: br.h,
        idx: i        // index back into state.bricks for persistence
      });
      // also use as walls for ghost bouncing
      liveRects.push({ x: br.x, y: br.y, w: br.w, h: br.h });
    }

    // add 4 power pellets at the arena corners (if space exists)
    const pad = 10;
    const corners = [
      { x: 90,       y: 90 },
      { x: W-90,     y: 90 },
      { x: 90,       y: 70+300-20 },
      { x: W-90,     y: 70+300-20 }
    ];
    const power = corners.map(p => ({ x: snap(p.x), y: snap(p.y), r: 10, eaten: false }));

    // Pac starts near the bottom center
    const pac = {
      x: snap(W/2), y: snap(70+300+40),
      dir: {x:0, y:-1},          // up to enter the grid
      want: {x:0, y:-1},         // buffered desired dir
      speed: SPEED
    };

    // Ghosts: simple patrol+chase
    const ghosts = [
      mkGhost( snap(W/2 - 60), snap(70+60),  1, 0 ), // right
      mkGhost( snap(W/2 + 60), snap(70+60), -1, 0 ), // left
      mkGhost( snap(W/2),      snap(70+100), 0, 1 ), // down
    ];

    state._pac = {
      t: 0,
      timerMax: ROUND_TIME,
      pellets,
      power,
      ghosts,
      walls: liveRects,
      pac,
      frightT: 0,
      scoreOnEnter: state.score|0
    };

    // No normal balls during morph
    state.balls = [];
    state.running = true;

    setText('uiMode', 'Pac-Ball');
    setText('uiStatus', 'Eat bricks • Avoid ghosts • Corners = power');
  },

  update(dt, input, state){
    const G = state._pac;
    if (!G) return;

    G.t += dt;
    if (G.t >= G.timerMax || G.pellets.length === 0){
      // Success or time: return a running ball
      window.SFX?.win?.();
      return this._handoffToBall(state, { x: G.pac.x, y: G.pac.y, vx: 300, vy: -300, r: PAC_R });
    }

    // Input → buffered direction (hard 90°)
    const want = { x: G.pac.want.x, y: G.pac.want.y };
    if (input.left)  { want.x = -1; want.y = 0; }
    if (input.right) { want.x =  1; want.y = 0; }
    // Optional up/down
    if (input.up)    { want.x =  0; want.y = -1; }
    if (input.down)  { want.x =  0; want.y =  1; }
    G.pac.want = want;

    // attempt turn when aligned to grid and path open
    if (canTurn(G.pac, want, G.walls)) {
      G.pac.dir = want;
      snapToGrid(G.pac);
    }

    // move pac along current dir
    G.pac.x += G.pac.dir.x * G.pac.speed * dt;
    G.pac.y += G.pac.dir.y * G.pac.speed * dt;
    clampToArena(G.pac);

    // stop on wall and re-snap
    if (hitsWallCircle(G.pac, PAC_R, G.walls)) {
      // back up to previous cell edge
      while (hitsWallCircle(G.pac, PAC_R, G.walls)) {
        G.pac.x -= G.pac.dir.x * 0.5;
        G.pac.y -= G.pac.dir.y * 0.5;
      }
      snapToGrid(G.pac);
      // can't continue in this dir; wait for next turn buffer
      G.pac.dir = { x:0, y:0 };
    }

    // eat pellets (bricks)
    for (const p of G.pellets) {
      if (circleRect(G.pac.x, G.pac.y, PAC_R, p)) {
        // persistently break the source brick
        const br = state.bricks[p.idx];
        if (br && br.type !== 'broken') {
          br.type = 'broken';
          state.score = (state.score|0) + 9;
          window.SFX?.brick?.();
        }
        p._eat = true;
      }
    }
    G.pellets = G.pellets.filter(p => !p._eat);

    // power pellets
    for (const pp of G.power) {
      if (!pp.eaten && dist2(G.pac.x, G.pac.y, pp.x, pp.y) < (PAC_R+10)*(PAC_R+10)) {
        pp.eaten = true;
        G.frightT = FRIGHT_SECS;
        window.SFX?.power?.();
      }
    }
    if (G.frightT > 0) G.frightT -= dt;

    // move ghosts
    for (const gh of G.ghosts) {
      const sp = (G.frightT>0 ? 0.75 : 1) * GHOST_SPEED;
      // crude chase: bias toward Pac in axis with larger delta
      const dx = G.pac.x - gh.x, dy = G.pac.y - gh.y;
      if (Math.abs(dx) > Math.abs(dy)) gh.vx = Math.sign(dx), gh.vy = 0;
      else                             gh.vx = 0, gh.vy = Math.sign(dy);

      gh.x += gh.vx * sp * dt;
      gh.y += gh.vy * sp * dt;

      // collide with walls → bounce
      if (hitsWallCircle(gh, PAC_R, G.walls)) {
        // reverse
        gh.x -= gh.vx * sp * dt; gh.y -= gh.vy * sp * dt;
        gh.vx *= -1; gh.vy *= -1;
      }
      clampToArena(gh);
    }

    // ghost collisions
    for (const gh of G.ghosts) {
      if (dist2(G.pac.x, G.pac.y, gh.x, gh.y) < (PAC_R*2)*(PAC_R*2)) {
        if (G.frightT > 0) {
          // eat ghost → score
          state.score = (state.score|0) + 20;
          window.SFX?.brick?.();
          // send ghost back to a corner
          Object.assign(gh, mkGhost( snap(W/2), snap(70+60), (Math.random()<0.5?1:-1), 0 ));
        } else {
          // lose: life --
          return this._lose(state);
        }
      }
    }
  },

  draw(ctx, state){
    const G = state._pac;
    if (!G) return;

    // clean frame (no vignette)
    ctx.fillStyle = '#0b0c15';
    ctx.fillRect(0,0,W,H);

    // pellets (bricks) – tiny dots where bricks were / are
    ctx.fillStyle = C.pellet;
    for (const p of G.pellets){
      const cx = p.x + p.w/2, cy = p.y + p.h/2;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
    }

    // power pellets
    for (const pp of G.power){
      if (pp.eaten) continue;
      ctx.fillStyle = C.pelletBig;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, 6, 0, Math.PI*2); ctx.fill();
    }

    // pac
    drawPac(ctx, G.pac, C.pac);

    // ghosts
    for (const gh of G.ghosts){
      drawGhost(ctx, gh, G.frightT>0 ? C.ghostFright : C.ghost);
    }

    // small timer ring top-left
    const remain = 1 - (G.t / G.timerMax);
    ctx.save(); ctx.translate(30,30);
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath(); ctx.arc(0,0,18,-Math.PI/2,-Math.PI/2 + remain*2*Math.PI); ctx.stroke();
    ctx.restore();
  },

  _lose(state){
    const G = state._pac;
    state.lives = Math.max(0, (state.lives||3) - 1);
    window.SFX?.lose?.();
    // undo nothing – pellets eaten already persisted in state.bricks
    return this._handoffToBall(state, null);
  },

  _handoffToBall(state, hand){
    try { restoreGrid?.(state); } catch {}
    state._pac = null;
    state.mode = 'ball';

    if (hand) {
      state.balls = [{ x: clamp(hand.x, 8, W-8), y: clamp(hand.y, 8, H-60), vx: hand.vx, vy: hand.vy, r: hand.r }];
      state.running = true;
      setText('uiStatus','Running');
    } else {
      const px = state.paddleX ?? (W-120)/2;
      state.balls = [{ x: px+60, y: H-48, vx:0, vy:0, r: PAC_R }];
      state.running = false;
      setText('uiStatus','Ready');
    }
    setText('uiMode','Ball');
  }
};

/* ------------ helpers ------------ */

function setText(id, v){ try{ const el=document.getElementById(id); if(el) el.textContent=v; }catch{} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function snap(v){ return Math.round(v / CELL) * CELL; }
function snapToGrid(p){ p.x = snap(p.x); p.y = snap(p.y); }

function canTurn(pac, want, walls){
  if (!want || (want.x===pac.dir.x && want.y===pac.dir.y)) return false;
  // only when aligned near grid center
  const nearX = Math.abs(pac.x - snap(pac.x)) < 2;
  const nearY = Math.abs(pac.y - snap(pac.y)) < 2;
  if (!(nearX && nearY)) return false;

  // test a little step into the desired direction
  const probe = { x: snap(pac.x) + want.x * 6, y: snap(pac.y) + want.y * 6 };
  return !hitsWallCircle(probe, PAC_R, walls);
}

function circleRect(cx,cy,r,rect){
  const x = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - x, dy = cy - y;
  return (dx*dx + dy*dy) <= r*r;
}

function hitsWallCircle(p, r, walls){
  for (const w of walls) if (circleRect(p.x, p.y, r, w)) return true;
  return false;
}

function clampToArena(p){
  p.x = clamp(p.x, 10, W-10);
  p.y = clamp(p.y, 10, H-60);
}

function mkGhost(x,y,vx,vy){
  return { x, y, vx, vy };
}

function drawPac(ctx, pac, color){
  // draw as a wedge with a classic chomping mouth
  const dir = Math.atan2(pac.dir.y, pac.dir.x) || 0;
  const mouth = 0.35 + 0.12 * Math.sin(performance.now()/100); // little chew
  ctx.save();
  ctx.translate(pac.x, pac.y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0,PAC_R, mouth, -mouth, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx, g, color){
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.fillStyle = color;
  // body
  ctx.beginPath();
  ctx.arc(0, -6, 10, Math.PI, 0);
  ctx.rect(-10, -6, 20, 16);
  ctx.fill();
  // feet
  for (let i=0;i<3;i++) ctx.fillRect(-10 + i*7, 8, 6, 4);
  ctx.restore();
}
