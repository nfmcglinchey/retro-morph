import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas){
    state.mode='asteroids'; HUD.set.mode('Asteroids'); HUD.set.status('Mini-game');

    const live=snapshotBricks(state);
    arrangeGrid(state, live, { cols: 10, gap: 8, oy: 90 });

    const ship={x:state.W/2, y:state.H*0.65, dir:-Math.PI/2, vx:0, vy:0};
    const rocks = spawnRocks(6, state);
    this.M={ ship, rocks, shots:[], cd:0, timer:18, timerMax:18 };

    const resize=()=>{ const ctx=canvas.getContext('2d'); const r=canvas.getBoundingClientRect();
      ctx.setTransform(r.width/state.W,0,0,r.height/state.H,0,0);};
    resize(); this._onResize=resize; window.addEventListener('resize', this._onResize);
  },

  _finish(state){
    restoreBricks(state); clearSnapshots(state);
    const s=this.M.ship; state.toMode='ball';
    state._handoffBall={x:s.x,y:s.y,vx:0,vy:-300,r:8};
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state){
    const M=this.M; M.timer-=dt; if(M.timer<=0) return this._finish(state);
    const s=M.ship;

    // rotate + thrust/fire on Space
    const steer=(io.right?1:0)+(io.left?-1:0); s.dir += steer*3.2*dt;
    if(io.fire){ s.vx += Math.cos(s.dir)*380*dt; s.vy += Math.sin(s.dir)*380*dt; M.cd-=dt; if(M.cd<=0){ M.cd=0.18; M.shots.push({x:s.x,y:s.y,vx:Math.cos(s.dir)*480,vy:Math.sin(s.dir)*480}); } }
    s.vx*=0.995; s.vy*=0.995; s.x+=s.vx*dt; s.y+=s.vy*dt;
    if(s.x<0)s.x=state.W; if(s.x>state.W)s.x=0; if(s.y<0)s.y=state.H; if(s.y>state.H)s.y=0;

    for(const sh of M.shots){ sh.x+=sh.vx*dt; sh.y+=sh.vy*dt; wrap(sh,state); }
    for(const r of M.rocks){ r.x+=r.vx*dt; r.y+=r.vy*dt; wrap(r,state); if(dist(s.x-r.x,s.y-r.y)<r.r) return this._finish(state); }

    // shots split rocks
    for(const sh of M.shots){ for(const r of M.rocks){ if(dist(sh.x-r.x, sh.y-r.y)<r.r){ r.hit=true; sh.hit=true; state.score+=7; splitRock(M.rocks, r);} } }
    M.rocks=M.rocks.filter(r=>!r.hit); M.shots=M.shots.filter(s=>!s.hit);

    // win if rocks cleared
    if(!M.rocks.length) return this._finish(state);
  },

  draw(ctx, state){
    const M=this.M, s=M.ship;
    ctx.save(); ctx.clearRect(0,0,state.W,state.H); fillBackground(ctx,state.W,state.H);

    // ship
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.dir); ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-10,-8); ctx.lineTo(-6,0); ctx.lineTo(-10,8); ctx.closePath(); ctx.stroke(); ctx.restore();

    // shots
    ctx.fillStyle='#fff'; for(const sh of M.shots) ctx.fillRect(sh.x-2,sh.y-2,4,4);

    // rocks
    ctx.strokeStyle='#9ca3af'; for(const r of M.rocks){ ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); }

    drawTimer(ctx, M.timer/M.timerMax, '#cbd5e1'); drawCRTOverlay(ctx);
    ctx.restore();
  }
};

function spawnRocks(n, state){ const a=[]; for(let i=0;i<n;i++){ a.push({x:50+Math.random()*(state.W-100), y:80+Math.random()*200, vx:(Math.random()*120-60), vy:(Math.random()*80-40), r: 18+Math.random()*12}); } return a; }
function splitRock(rocks, r){ if(r.r>12){ for(let i=0;i<2;i++){ rocks.push({x:r.x,y:r.y,vx:(Math.random()*160-80),vy:(Math.random()*160-80),r:r.r*0.6}); } } }
function wrap(o, state){ if(o.x<0)o.x=state.W; if(o.x>state.W)o.x=0; if(o.y<0)o.y=state.H; if(o.y>state.H)o.y=0; }
function dist(dx,dy){ return Math.hypot(dx,dy); }
function drawTimer(ctx, frac, color){ ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=0.8; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(30,30,18,-Math.PI/2,-Math.PI/2+Math.max(0,frac)*Math.PI*2); ctx.stroke(); ctx.restore(); }
