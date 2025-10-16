// docs/js/modes/ball.js
// Core Ball mode (Arkanoid-style) with:
// - Space launch when parked
// - Persistent bricks across mini-games (no rebuild on return)
// - Power-up assignment, falling, pickup, and mini-game morphs

import { CFG } from '../config.js';

const W = 960, H = 600;
const PADDLE = { w: 120, h: 16, y: H - 38, speed: 560, wMin: 80, wMax: 240 };
const BALL   = { r: 8 };

// === Power setup ===
const POWER_KINDS = ['widen','multi','hyper','warp','snake','pong','pac','tron','asteroids','invaders','river'];

function setText(id, v) { try { const el = document.getElementById(id); if (el) el.textContent = v; } catch {} }
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const deg   = (d)=>d*Math.PI/180;

// ---- collisions ----
function circleRect(cx,cy,r,rect){
  const qx = clamp(cx, rect.x, rect.x + rect.w);
  const qy = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - qx, dy = cy - qy;
  return dx*dx + dy*dy <= r*r;
}

// ---- level build & power assignment ----
function maybePower(levelIdx, state){
  const human = (levelIdx||0) + 1;
  const base = human < 4 ? 0.10 : human < 7 ? 0.14 : 0.18; // drop chance
  if (Math.random() >= base) return null;

  // filter by unlocks (river requires code)
  const bag = POWER_KINDS.filter(k => k !== 'river' || (state.unlocks && state.unlocks.river));
  return bag[(Math.random()*bag.length)|0];
}

function buildLevel(state){
  const levelIdx = state.level || 0;
  const human = levelIdx + 1;

  const cols = 13;
  const rows = Math.min(14, 6 + Math.floor(levelIdx/2));
  const gap = 4;
  const brickH = 18;
  const playW = W - 80;
  const brickW = (playW - (cols-1)*gap) / cols;
  const offsetX = (W - playW) / 2;
  const offsetY = 70;
  const ARK_COLS = ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590'];

  const allowDouble = (human >= 4);
  const allowUnbreak = (human >= 7);

  const bricks = [];
  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      const x = offsetX + c*(brickW+gap);
      const y = offsetY + r*(brickH+gap);
      let type = 'normal';
      if (allowUnbreak) {
        const pUn = clamp(0.04 + levelIdx*0.01, 0, 0.25);
        const pDb = clamp(0.10 + levelIdx*0.02, 0, 0.35);
        const roll = Math.random();
        if (roll < pUn) type = 'unbreakable';
        else if (roll < pUn + pDb) type = 'double';
      } else if (allowDouble) {
        if (Math.random() < 0.08 + Math.max(0, levelIdx-3)*0.03) type = 'double';
      }

      // <<< assign a power to some bricks >>>
      const power = (type !== 'unbreakable') ? maybePower(levelIdx, state) : null;

      bricks.push({ x, y, w: brickW, h: brickH, type, hit: 0, color: ARK_COLS[r % ARK_COLS.length], power });
    }
  }
  state.bricks = bricks;
}

// ---- paddle rebound (Arkanoid mapping) ----
function arkanoidRebound(ball, state){
  const pad = {x: state.paddleX, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h || 16};
  const hit = (ball.x - (pad.x + pad.w/2)) / (pad.w/2); // -1..+1
  const t = clamp(hit,-1,1);
  const theta = Math.abs(t) * (CFG.MAX_REFLECT_FROM_H || deg(60));
  const speed = Math.hypot(ball.vx, ball.vy) || levelBallSpeed(state);
  const dirX = t>=0 ? 1 : -1;
  ball.vx = dirX * speed * Math.cos(theta);
  ball.vy = -Math.abs(speed * Math.sin(theta));
  enforceMinAngle(ball);
  capBall(ball);
}

function capBall(ball){
  const max = CFG.MAX_BALL_SPEED || 520;
  const s = Math.hypot(ball.vx, ball.vy);
  if (s > max){ const k = max/s; ball.vx*=k; ball.vy*=k; }
}

function enforceMinAngle(ball){
  const minVy = CFG.MIN_VY || 180;
  if (Math.abs(ball.vy) < minVy) ball.vy = (ball.vy<0?-1:1)*minVy;
  const ang = Math.atan2(ball.vy, ball.vx);
  const fromHoriz = Math.abs(Math.sin(ang));
  const minSin = Math.sin(CFG.MIN_BOUNCE_RAD || deg(8));
  if (fromHoriz < minSin){
    const speed = Math.hypot(ball.vx, ball.vy) || levelBallSpeed({level:0});
    const sign = ball.vy>=0 ? 1 : -1;
    const newAng = (Math.cos(ang)>=0?0:Math.PI) + sign*(CFG.MIN_BOUNCE_RAD || deg(8));
    ball.vx = speed*Math.cos(newAng);
    ball.vy = speed*Math.sin(newAng);
  }
  capBall(ball);
}

function resolveBallBrick(ball, br){
  const r = BALL.r, EPS = 0.01;
  const penL=(ball.x+r)-br.x, penR=(br.x+br.w)-(ball.x-r);
  const penT=(ball.y+r)-br.y, penB=(br.y+br.h)-(ball.y-r);
  const minX=Math.min(penL,penR), minY=Math.min(penT,penB);
  if (minX < minY){
    if (penL < penR){ ball.x=br.x - r - EPS; ball.vx = -Math.abs(ball.vx); }
    else            { ball.x=br.x + br.w + r + EPS; ball.vx =  Math.abs(ball.vx); }
    ball.vx *= 0.995;
  } else {
    if (penT < penB){ ball.y=br.y - r - EPS; ball.vy = -Math.abs(ball.vy); }
    else            { ball.y=br.y + br.h + r + EPS; ball.vy =  Math.abs(ball.vy); }
    ball.vy *= 0.995;
  }
  enforceMinAngle(ball);
  capBall(ball);
}

function levelBallSpeed(state){
  const base=320, inc=Math.min(180,(state.level||0)*16);
  return base+inc;
}

// ---- power-up mechanics ----
function spawnPowerup(state, x, y, kind){
  if (!kind) return;
  if (!state.powerups) state.powerups = [];
  state.powerups.push({ x: x-10, y: y-10, w: 20, h: 20, vy: 140 + Math.random()*80, kind, hit:false });
}

function applyPower(state, kind){
  switch(kind){
    case 'widen':
      PADDLE.w = Math.min(PADDLE.w * 1.25, PADDLE.wMax || 240);
      window.SFX?.power?.();
      break;
    case 'multi':
      if (state.balls && state.balls[0]){
        const b = state.balls[0];
        for (let i=0;i<2;i++){
          const nb = {
            x:b.x, y:b.y,
            vx:b.vx*(0.8+0.4*Math.random())*(Math.random()<0.5?-1:1),
            vy:b.vy*(0.8+0.4*Math.random()),
            r: BALL.r
          };
          capBall(nb);
          state.balls.push(nb);
        }
      }
      window.SFX?.power?.();
      break;
    case 'hyper':
      if (state.balls) for (const b of state.balls){ b.vx*=1.4; b.vy*=1.4; capBall(b); }
      window.SFX?.power?.();
      break;
    case 'warp':
      // Next level (respect broken bricks—just rebuild)
      window.SFX?.win?.();
      state.level = (state.level||0) + 1;
      // force rebuild next start
      state._rebuildLevel = true;
      // re-enter Ball mode clean
      state.balls = [];
      state.running = false;
      break;
    case 'snake':
    case 'pong':
    case 'pac':
    case 'tron':
    case 'asteroids':
    case 'invaders':
    case 'river':
      // Start a mini-game, if unlocked (river needs code)
      if (kind === 'river' && !(state.unlocks && state.unlocks.river)) return;
      state.toMode = kind;
      window.SFX?.power?.();
      break;
  }
}

function powerColor(k){
  switch(k){
    case 'widen': return '#34d399';
    case 'multi': return '#60a5fa';
    case 'hyper': return '#f59e0b';
    case 'warp':  return '#a3e635';
    case 'snake': return '#22d3ee';
    case 'pong':  return '#fca5a5';
    case 'pac':   return '#fde047';
    case 'tron':  return '#22d3ee';
    case 'asteroids': return '#cbd5e1';
    case 'invaders':  return '#86efac';
    case 'river':     return '#67e8f9';
    default: return '#ddd';
  }
}
function powerGlyph(k){
  switch(k){
    case 'widen': return 'W';
    case 'multi': return 'M';
    case 'hyper': return 'H';
    case 'warp':  return '⤴';
    case 'snake': return 'S';
    case 'pong':  return 'P';
    case 'pac':   return 'C';
    case 'tron':  return 'T';
    case 'asteroids': return 'A';
    case 'invaders':  return 'I';
    case 'river':     return 'R';
    default: return '?';
  }
}

// ---- Public mode API ----
export default {
  start(state, canvas){
    state.mode = 'ball';

    // Build only on first boot or explicit reset
    if (!state.bricks || !state.bricks.length || state._rebuildLevel === true){
      state._rebuildLevel = false;
      buildLevel(state);
    }

    // If coming back from a mini-game, bricks were restored already
    if (state._skipRebuildOnReturn) state._skipRebuildOnReturn = false;

    state.paddleX = state.paddleX ?? (W - PADDLE.w)/2;

    if (!state.balls || !state.balls.length){
      state.balls = [{
        x: state.paddleX + PADDLE.w/2,
        y: PADDLE.y - BALL.r - 2,
        vx:0, vy:0, r:BALL.r
      }];
      state.running = false;
    }

    if (!state.powerups) state.powerups = [];

    setText('uiMode','Ball');
    setText('uiLevel',(state.level||0)+1);
    setText('uiScore',state.score||0);
    setText('uiLives',state.lives||3);
    setText('uiStatus',state.running?'Running':'Ready');
  },

  reset(state){
    state.level = 0;
    state.score = 0;
    state.lives = state.lives ?? 3;
    state._rebuildLevel = true;
    state.balls = [];
    state.powerups = [];
    state.running = false;
  },

  update(dt, input, state){
    // move paddle
    const move = (input.right?1:0) - (input.left?1:0);
    state.paddleX = clamp((state.paddleX ?? (W-PADDLE.w)/2) + move*PADDLE.speed*dt, 0, W-PADDLE.w);
    const pad = { x: state.paddleX, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h };

    // launch with Space when parked
    if (!state.running && input.space){
      const b = state.balls && state.balls[0];
      if (b){
        const sp = levelBallSpeed(state);
        const minA = deg(CFG.LAUNCH_MIN_DEG || 42);
        const maxA = deg(CFG.LAUNCH_MAX_DEG || 70);
        const ang = -minA - Math.random()*(maxA-minA);
        b.vx = sp*Math.cos(ang);
        b.vy = sp*Math.sin(ang);
        state.running = true;
        setText('uiStatus','Running');
      }
    }

    // keep parked ball riding the paddle
    if (!state.running && state.balls && state.balls[0]){
      const b = state.balls[0];
      b.x = state.paddleX + PADDLE.w/2;
      b.y = PADDLE.y - BALL.r - 2;
      // Update falling powerups even while parked
      for (const p of (state.powerups||[])){
        p.y += p.vy * dt;
        if (circleRect(p.x+p.w/2, p.y+p.h/2, 12, pad)) { p.hit = true; applyPower(state, p.kind); }
      }
      state.powerups = state.powerups.filter(p => !p.hit && p.y < H+24);
      return;
    }

    // simulate balls
    const decay = Math.pow(CFG.SPEED_DECAY || 0.995, dt*60);
    for (const ball of state.balls){
      ball.x += ball.vx*dt; ball.y += ball.vy*dt;
      ball.vx *= decay; ball.vy *= decay;

      // walls/top
      if (ball.x < BALL.r){ ball.x = BALL.r; ball.vx *= -1; }
      if (ball.x > W - BALL.r){ ball.x = W - BALL.r; ball.vx *= -1; }
      if (ball.y < BALL.r + 4){ ball.y = BALL.r + 4; ball.vy *= -1; }
      enforceMinAngle(ball);

      // paddle
      if (circleRect(ball.x, ball.y, BALL.r, pad) && ball.vy > 0){
        ball.y = pad.y - BALL.r - 0.01;
        arkanoidRebound(ball, state);
        window.SFX?.paddle?.();
      }

      // bricks
      for (const br of state.bricks){
        if (!br || br.type === 'broken') continue;
        if (circleRect(ball.x, ball.y, BALL.r, br)){
          resolveBallBrick(ball, br);
          if (br.type !== 'unbreakable'){
            br.hit = (br.hit||0) + 1;
            if (br.type === 'double' && br.hit < 2){
              window.SFX?.brick?.();
            } else {
              br.type = 'broken';
              state.score = (state.score||0) + 10;
              window.SFX?.brick?.();
              if (br.power) spawnPowerup(state, br.x + br.w/2, br.y + br.h/2, br.power);
            }
          } else {
            window.SFX?.unbreakable?.();
          }
          break;
        }
      }
    }

    // powerups fall & collect
    for (const p of (state.powerups||[])){
      p.y += p.vy * dt;
      if (circleRect(p.x+p.w/2, p.y+p.h/2, 12, pad)){
        p.hit = true;
        applyPower(state, p.kind);
      }
    }
    state.powerups = state.powerups.filter(p => !p.hit && p.y < H+24);

    // lose life if no balls
    state.balls = state.balls.filter(b => b.y <= H + BALL.r);
    if (!state.balls.length){
      state.lives = Math.max(0, (state.lives||3) - 1);
      setText('uiLives', state.lives);
      window.SFX?.lose?.();
      if (state.lives <= 0){
        setText('uiStatus','Game Over');
        this.reset(state);
        this.start(state, { width: W, height: H });
        return;
      }
      state.balls = [{ x: state.paddleX + PADDLE.w/2, y: PADDLE.y - BALL.r - 2, vx:0, vy:0, r:BALL.r }];
      state.running = false;
      setText('uiStatus','Ready');
    }

    // level clear (all remaining are unbreakable or broken)
    if (state.bricks.every(b => !b || b.type === 'broken' || b.type === 'unbreakable')){
      window.SFX?.win?.();
      state.level = (state.level||0) + 1;
      this.reset(state);
      this.start(state, { width: W, height: H });
      return;
    }

    setText('uiScore', state.score||0);
    setText('uiLevel', (state.level||0)+1);
  },

  draw(ctx, state){
    // background
    ctx.fillStyle = '#0b0c15';
    ctx.fillRect(0,0,W,H);

    // bricks (skip broken)
    for (const br of state.bricks){
      if (!br || br.type === 'broken') continue;
      let fill = br.color || '#cbd5e1';
      if (br.type === 'double') fill = shade(fill, -0.18);
      if (br.type === 'unbreakable') fill = '#c7a100';
      ctx.fillStyle = fill;
      ctx.fillRect(br.x, br.y, br.w, br.h);
    }

    // paddle
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(state.paddleX, PADDLE.y, PADDLE.w, PADDLE.h);

    // balls
    for (const b of (state.balls||[])){
      ctx.beginPath();
      ctx.arc(b.x,b.y,BALL.r,0,Math.PI*2);
      const g = ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,BALL.r);
      g.addColorStop(0,'#fff');
      g.addColorStop(1,'#b6c2ff');
      ctx.fillStyle = g;
      ctx.fill();
    }

    // powerups
    for (const p of (state.powerups||[])){
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x+p.w/2, p.y+p.h/2, 10, 0, Math.PI*2);
      ctx.fillStyle = powerColor(p.kind);
      ctx.fill();
      ctx.fillStyle = '#0b0c15';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(powerGlyph(p.kind), p.x+p.w/2, p.y+p.h/2 + 0.5);
      ctx.restore();
    }
  }
};

// ---- helpers ----
function shade(hex, amt){
  try{
    const c=parseInt(hex.slice(1),16);
    let r=(c>>16)&255,g=(c>>8)&255,b=c&255;
    r=Math.max(0,Math.min(255,Math.round(r + 255*amt)));
    g=Math.max(0,Math.min(255,Math.round(g + 255*amt)));
    b=Math.max(0,Math.min(255,Math.round(b + 255*amt)));
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
  }catch{ return hex; }
}
