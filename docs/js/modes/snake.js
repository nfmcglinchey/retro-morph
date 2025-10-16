import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawPaddle, drawBricks, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas){
    state.mode='snake'; HUD.set.mode('Snake'); HUD.set.status('Mini-game');
    snapshotBricks(state); // positions unchanged; snake eats in-place

    const b = state.balls[0] || {x: state.W/2, y: state.H*0.6};
    this.M={ body:[{x:b.x,y:b.y},{x:b.x-8,y:b.y},{x:b.x-16,y:b.y}], dir:0, speed:240, timer:30, timerMax:30 };

    const resize=()=>{ const ctx=canvas.getContext('2d'); const r=canvas.getBoundingClientRect();
      ctx.setTransform(r.width/state.W,0,0,r.height/state.H,0,0);};
    resize(); this._onResize=resize; window.addEventListener('resize', this._onResize);
  },

  _finish(state){
    restoreBricks(state); clearSnapshots(state);
    const head=this.M.body[0]; state.toMode='ball';
    state._handoffBall={x:clamp(head.x,8,state.W-8), y: Math.max(60,head.y), vx:300, vy:-300, r:8};
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state){
    const M=this.M; M.timer-=dt; if(M.timer<=0) return this._finish(state);

    // steer snake
    const steer = (io.right?1:0) + (io.left?-1:0);
    M.dir += steer*2.2*dt;
    const head = { x: M.body[0].x + Math.cos(M.dir)*M.speed*dt, y: M.body[0].y + Math.sin(M.dir)*M.speed*dt };
    if(head.x<6||head.x>state.W-6||head.y<6||head.y>state.H-6) return this._finish(state);
    M.body.unshift(head);
    while(M.body.length>120) M.body.pop();

    // eat bricks
    for(const br of state.bricks){
      if(br.type==='broken') continue;
      if(head.x>br.x && head.x<br.x+br.w && head.y>br.y && head.y<br.y+br.h){
        if(br.type!=='unbreakable'){ br.type='broken'; state.score+=12; }
        break;
      }
    }
  },

  draw(ctx, state){
    const M=this.M;
    ctx.save(); ctx.clearRect(0,0,state.W,state.H); fillBackground(ctx,state.W,state.H);
    drawBricks(ctx,state.bricks); drawPaddle(ctx,state.paddle);
    for(let i=0;i<M.body.length;i++){ const p=M.body[i]; ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fillStyle='hsl('+(i*6 + performance.now()/20)%360+',90%,60%)'; ctx.fill(); }
    drawTimer(ctx, M.timer/M.timerMax, '#22d3ee'); drawCRTOverlay(ctx); ctx.restore();
  }
};
function drawTimer(ctx, frac, color){ ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=0.8; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(30,30,18,-Math.PI/2,-Math.PI/2+Math.max(0,frac)*Math.PI*2); ctx.stroke(); ctx.restore(); }
