// public/js/modes/ball.js
import { clamp, now } from '../util.js';
import { CFG } from '../config.js';
import { capBall, enforceMinAngle, circleRect, resolveBallBrick } from '../physics.js';
import { resetForLevel } from '../state.js';
import * as HUD from '../ui/hud.js';
import {
  fillBackground, drawPaddle, drawBall, drawBricks, drawOverlay,
  drawPowerups, drawBullets
} from '../renderer.js';
import { POWERS, pickRandom, colorOf } from '../powerups/index.js';

export default {
  start(state, canvas){
    state.mode = 'ball';
    HUD.set.mode('Ball');
    HUD.set.status('Ready');
    resetForLevel(state);
    this.resetBall(state, true);
    state.running = false;

    // gun state
    state.gun = { time: 0, cd: 0 };

    // resize transform for crisp scaling
    function resizeCanvas(){
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / state.W;
      const scaleY = rect.height / state.H;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  },

  reset(state){
    state.level=0; state.score=0; state.lives=3;
    HUD.set.score(state.score); HUD.set.level(state.level+1); HUD.set.lives(state.lives);
    resetForLevel(state);
    this.resetBall(state, true);
    state.running=false; HUD.set.status('Ready');
    state.gun = { time: 0, cd: 0 };
  },

  nextLevel(state){
    state.level++;
    if (state.level>=15) { HUD.set.status('You won'); state.level=0; }
    HUD.set.level(state.level+1);
    resetForLevel(state);
    this.resetBall(state, true);
    state.running=false; HUD.set.status('Ready');
  },

  resetBall(state, center=false){
    const W = state.W, H = state.H, BALL_R = 8;
    state.balls=[ this.newBall(state, center? W/2 : state.paddle.x + state.paddle.w/2, state.paddle.y - BALL_R - 2) ];
    state.running=false;
  },

  newBall(state, x,y){
    const BALL_R = 8;
    const sp = this.levelBallSpeed(state);
    const minA = toRad(CFG.LAUNCH_MIN_DEG), maxA = toRad(CFG.LAUNCH_MAX_DEG);
    const ang = -minA - Math.random()*(maxA-minA);
    const b = {x,y,vx: sp*Math.cos(ang), vy: sp*Math.sin(ang), r:BALL_R};
    capBall(b);
    return b;
  },

  levelBallSpeed(state){ const base = 320; const inc = Math.min(180, state.level * 16); return base + inc; },

  // powerup helpers
  spawnPower(state, x, y, kind){
    state.powerups.push({ x:x-10, y:y-10, w:20, h:20, vy: 140 + Math.random()*80, kind });
  },
  maybeDrop(state){
    // base chance increases slowly with level
    const human = state.level + 1;
    const base = human < 4 ? 0.10 : human < 7 ? 0.14 : 0.18;
    return Math.random() < base;
  },

  update(dt, io, state){
    // launch
    if (!state.running && io.fire) { state.running = true; HUD.set.status('Running'); }

    // move paddle
    const move = (io.right?1:0) - (io.left?1:0);
    const prevX = state.paddle.x;
    state.paddle.x = clamp(state.paddle.x + move * state.paddle.speed * dt, 0, state.W-state.paddle.w);
    state.paddle.vx = (state.paddle.x - prevX)/dt;

    // gun
    if (state.gun && state.gun.time > 0) {
      state.gun.time -= dt;
      state.gun.cd -= dt;
      if (io.fire && state.gun.cd <= 0) {
        state.bullets.push({ x: state.paddle.x + state.paddle.w/2 - 2, y: state.paddle.y-10, w:4, h:10, vy: 420 });
        state.gun.cd = 0.18;
      }
    }

    if (!state.running) {
      const b = state.balls[0];
      if (b) { b.x = state.paddle.x + state.paddle.w/2; b.y = state.paddle.y - b.r - 2; }
      return;
    }

    // balls
    const tnow = now();
    for(const ball of state.balls){
      ball.px = ball.x; ball.py = ball.y;
      ball.x += ball.vx*dt; ball.y += ball.vy*dt;
      const decay = Math.pow(CFG.SPEED_DECAY, dt * 60);
      ball.vx *= decay; ball.vy *= decay;

      // walls/top
      if(ball.x < ball.r){ ball.x=ball.r; ball.vx*=-1; }
      if(ball.x > state.W-ball.r){ ball.x=state.W-ball.r; ball.vx*=-1; }
      if(ball.y < ball.r+4){ ball.y=ball.r+4; ball.vy*=-1; }
      enforceMinAngle(ball);

      // paddle
      const pad={x:state.paddle.x,y:state.paddle.y,w:state.paddle.w,h:state.paddle.h};
      if(circleRect(ball.x, ball.y, ball.r, pad) && ball.vy>0){
        ball.y = pad.y - ball.r - 0.01;
        this.arkRebound(ball, state);
      }

      // bricks
      for(const br of state.bricks){
        if(br.type==='broken') continue;
        if(circleRect(ball.x, ball.y, ball.r, br)){
          resolveBallBrick(ball, br);
          if(br.type!=='unbreakable'){
            br.hit++;
            if (br.type!=='double' || br.hit>=2) {
              br.type='broken';
              state.score+=10; HUD.set.score(state.score);
              // drop power?
              if (this.maybeDrop(state)) {
                const kind = pickRandom();
                this.spawnPower(state, br.x + br.w/2, br.y + br.h/2, kind);
              }
              state.lastBrickHitT = tnow;
            }
          }
          break;
        }
      }

      if(ball.y > state.H+ball.r){
        const idx = state.balls.indexOf(ball); if(idx>-1) state.balls.splice(idx,1);
      }
    }

    // bullets travel + hit bricks
    for (const bu of state.bullets) {
      bu.y -= bu.vy * dt;
      for (const br of state.bricks) {
        if (br.type==='broken') continue;
        if (bu.x < br.x + br.w && bu.x + bu.w > br.x && bu.y < br.y + br.h && bu.y + bu.h > br.y) {
          if (br.type!=='unbreakable') {
            br.hit++;
            if (br.type!=='double' || br.hit>=2) {
              br.type='broken';
              state.score += 10; HUD.set.score(state.score);
              if (this.maybeDrop(state)) {
                const kind = pickRandom();
                this.spawnPower(state, br.x + br.w/2, br.y + br.h/2, kind);
              }
            }
          }
          bu.hit = true;
        }
      }
    }
    state.bullets = state.bullets.filter(b=>!b.hit && b.y>-12);

    // falling powerups
    for (const p of state.powerups) {
      p.y += p.vy * dt;
      const pad = { x:state.paddle.x, y:state.paddle.y, w:state.paddle.w, h:state.paddle.h };
      if (p.x < pad.x + pad.w && p.x + p.w > pad.x && p.y < pad.y + pad.h && p.y + p.h > pad.y) {
        // apply power
        const mod = POWERS[p.kind];
        if (mod && typeof mod.apply === 'function') {
          mod.apply(state);
          HUD.set.power(mod.label || p.kind, colorOf(p.kind));
          // level warp requests a transition
          if (state._requestNextLevel) {
            state._requestNextLevel = false;
            this.nextLevel(state);
          }
        }
        p.remove = true;
      }
    }
    state.powerups = state.powerups.filter(p=>!p.remove && p.y < state.H + 24);

    // balls out
    if(!state.balls.length){
      state.lives--; HUD.set.lives(state.lives);
      if(state.lives<=0){ HUD.set.status('Game Over'); this.reset(state); }
      else this.resetBall(state, true);
    }

    // level clear
    if(state.bricks.every(b=>b.type==='broken' || b.type==='unbreakable')) this.nextLevel(state);
  },

  draw(ctx, state){
    ctx.save();
    ctx.clearRect(0,0,state.W,state.H);
    fillBackground(ctx, state.W, state.H);
    drawBricks(ctx, state.bricks);
    drawPaddle(ctx, state.paddle);
    for(const b of state.balls) drawBall(ctx, b);
    drawBullets(ctx, state.bullets);
    drawPowerups(ctx, state.powerups);
    drawOverlay(ctx, state);
    ctx.restore();
  },

  arkRebound(ball, state){
    const pad = state.paddle;
    const hit = (ball.x - (pad.x + pad.w/2)) / (pad.w/2); // -1..+1
    const t = Math.max(-1, Math.min(1, hit));
    const theta = Math.abs(t) * CFG.MAX_REFLECT_FROM_H;
    const speed = Math.hypot(ball.vx, ball.vy);
    const dirX = t>=0 ? 1 : -1;
    ball.vx = dirX * speed * Math.cos(theta);
    ball.vy = -Math.abs(speed * Math.sin(theta)); // always up
    enforceMinAngle(ball);
  }
};

function toRad(d){ return d*Math.PI/180; }
