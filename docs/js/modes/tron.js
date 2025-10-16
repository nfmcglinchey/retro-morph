import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawPaddle, drawBricks, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas){
    state.mode = 'tron';
    HUD.set.mode('Tron Cycle'); HUD.set.status('Mini-game');

    const live = snapshotBricks(state);
    arrangeGrid(state, live, { cols: 12, gap: 6, oy: 90 });

    const p0x = state.paddle.x + state.paddle.w/2;
    this.M = { head:{x:p0x, y:state.H*0.65, dir:-Math.PI/2}, trail:[], timer:16, timerMax:16 };

    const resize = () => {
      const ctx = canvas.getContext('2d'); const r = canvas.getBoundingClientRect();
      ctx.setTransform(r.width/state.W,0,0,r.height/state.H,0,0);
    };
    resize(); this._onResize = resize; window.addEventListener('resize', this._onResize);
  },

  _finish(state){
    restoreBricks(state); clearSnapshots(state);
    const h = this.M.head; state.toMode='ball';
    state._handoffBall = { x: clamp(h.x,8,state.W-8), y: Math.max(60,h.y), vx: 0, vy: -300, r:8 };
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state){
    const M=this.M, H=state.H, W=state.W;
    M.timer -= dt; if(M.timer<=0) return this._finish(state);

    // paddle cosmetic
    const mv=(io.right?1:0)-(io.left?1:0);
    state.paddle.x = clamp(state.paddle.x + mv*state.paddle.speed*dt, 0, W-state.paddle.w);

    // cycle
    const speed = io.fire?360:300; const steer = (io.right?1:0) + (io.left?-1:0);
    M.head.dir += steer*3.0*dt;
    M.head.x += Math.cos(M.head.dir)*speed*dt;
    M.head.y += Math.sin(M.head.dir)*speed*dt;

    // walls kill
    if(M.head.x<4||M.head.x>W-4||M.head.y<4||M.head.y>H-4) return this._finish(state);

    // trail collide kills
    M.trail.unshift({x:M.head.x,y:M.head.y});
    while(M.trail.length>360) M.trail.pop();
    for(let i=6;i<M.trail.length;i++){
      const dx=M.head.x-M.trail[i].x, dy=M.head.y-M.trail[i].y;
      if(dx*dx+dy*dy<16) return this._finish(state);
    }

    // bricks act like solid walls
    for(const br of state.bricks){
      if(br.type==='broken') continue;
      if(M.head.x>br.x && M.head.x<br.x+br.w && M.head.y>br.y && M.head.y<br.y+br.h) return this._finish(state);
    }
  },

  draw(ctx, state){
    const M=this.M;
    ctx.save(); ctx.clearRect(0,0,state.W,state.H);
    fillBackground(ctx,state.W,state.H);
    drawBricks(ctx,state.bricks);
    drawPaddle(ctx,state.paddle);

    // trail
    ctx.strokeStyle='#22d3ee'; ctx.globalAlpha=0.9; ctx.lineWidth=2;
    ctx.beginPath(); for(let i=0;i<M.trail.length;i++){ const p=M.trail[i]; if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); } ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(M.head.x,M.head.y,5,0,Math.PI*2); ctx.fillStyle='#67e8f9'; ctx.fill();

    // timer ring
    drawTimer(ctx, M.timer/M.timerMax, '#22d3ee');
    drawCRTOverlay(ctx);
    ctx.restore();
  }
};

function drawTimer(ctx, frac, color){
  ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=0.8; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(30,30,18,-Math.PI/2,-Math.PI/2+Math.max(0,frac)*Math.PI*2); ctx.stroke(); ctx.restore();
}
