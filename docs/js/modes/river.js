import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas){
    state.mode='river'; HUD.set.mode('River Raid'); HUD.set.status('Mini-game');

    // live bricks just compacted to get them out of the way at top
    const live=snapshotBricks(state);
    arrangeGrid(state, live, { cols: 12, gap: 6, oy: 60 });

    const plane={x:state.W/2, y:state.H-80, speed:320, cd:0};
    const river=makeRiver(state); this.M={ plane, river, scroll:0, bullets:[], foes:[], bridges:[], tSpawn:0, timer:24, timerMax:24 };

    const resize=()=>{ const ctx=canvas.getContext('2d'); const r=canvas.getBoundingClientRect(); ctx.setTransform(r.width/state.W,0,0,r.height/state.H,0,0); };
    resize(); this._onResize=resize; window.addEventListener('resize', this._onResize);
  },

  _finish(state){
    restoreBricks(state); clearSnapshots(state);
    const p=this.M.plane; state.toMode='ball'; state._handoffBall={x:p.x,y:p.y-10,vx:0,vy:-300,r:8};
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state){
    const M=this.M, W=state.W, H=state.H; M.timer-=dt; if(M.timer<=0) return this._finish(state);

    // scroll
    M.scroll += 120*dt;

    // plane control
    const steer=(io.right?1:0)-(io.left?1:0);
    M.plane.x = clamp(M.plane.x + steer*M.plane.speed*dt, 20, W-20);
    M.plane.cd -= dt; if(io.fire && M.plane.cd<=0){ M.plane.cd=0.18; M.bullets.push({x:M.plane.x, y:M.plane.y-14, vy:-460}); }

    // spawn foes / bridges
    M.tSpawn -= dt;
    if(M.tSpawn<=0){
      M.tSpawn = 0.9 + Math.random()*0.6;
      if(Math.random()<0.18){ // bridge
        const sy=-H+M.scroll-40; const s=sampleRiver(M.river, sy);
        M.bridges.push({ y: sy, cx: s.cx, hw: s.hw-10, hp: 3 });
      }else{ // foe inside river
        const sy=-H+M.scroll-20; const s=sampleRiver(M.river, sy);
        const fx = clamp(s.cx+(Math.random()*2-1)*(s.hw-16), 30, W-30);
        M.foes.push({ x: fx, y: sy, vy: 140+Math.random()*60 });
      }
    }

    // integrate actors
    for(const b of M.bullets) b.y += b.vy*dt; M.bullets = M.bullets.filter(b=>b.y>-20);
    for(const f of M.foes) f.y += 120*dt + f.vy*dt;
    for(const br of M.bridges) br.y += 120*dt;

    // bounds: must stay in river
    if(!insideRiver(M.plane.x, M.plane.y, M)) return this._finish(state);

    // collisions
    for(const f of M.foes){
      if(Math.abs(f.x-M.plane.x)<12 && Math.abs(f.y-M.plane.y)<12) return this._finish(state);
      for(const b of M.bullets){ if(Math.abs(f.x-b.x)<10 && Math.abs(f.y-b.y)<12){ f.hit=true; b.hit=true; state.score+=8; } }
    }
    M.foes = M.foes.filter(f=>!f.hit && f.y<H+30); M.bullets = M.bullets.filter(b=>!b.hit);

    for(const br of M.bridges){
      for(const b of M.bullets){ if(Math.abs(b.y-br.y)<6 && b.x>br.cx-br.hw && b.x<br.cx+br.hw){ b.hit=true; br.hp--; state.score+=5; if(br.hp<=0) br.down=true; } }
      if(!br.down && Math.abs(M.plane.y-br.y)<8 && M.plane.x>br.cx-br.hw && M.plane.x<br.cx+br.hw) return this._finish(state);
    }
    M.bridges = M.bridges.filter(br=>br.y<H+20 && !br.down);
  },

  draw(ctx, state){
    const M=this.M, W=state.W, H=state.H, segH=M.river.segH;
    ctx.save(); ctx.clearRect(0,0,W,H); fillBackground(ctx,W,H);

    // river stripes
    for(let sy=-H; sy<H; sy+=segH){
      const s=sampleRiver(M.river, sy+M.scroll); const cx=s.cx, hw=s.hw;
      ctx.fillStyle='#0b0c15'; ctx.fillRect(0, sy+M.scroll, cx-hw, segH+1);
      ctx.fillStyle='#1e3a8a'; ctx.fillRect(cx-hw, sy+M.scroll, hw*2, segH+1);
      ctx.fillStyle='#0b0c15'; ctx.fillRect(cx+hw, sy+M.scroll, W-(cx+hw), segH+1);
    }

    // plane
    ctx.save(); ctx.translate(M.plane.x,M.plane.y); ctx.fillStyle='#67e8f9';
    ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(6,8); ctx.lineTo(-6,8); ctx.closePath(); ctx.fill(); ctx.restore();

    // foes
    ctx.fillStyle='#f87171'; for(const f of M.foes) ctx.fillRect(f.x-8,f.y-8,16,16);
    // bridges
    ctx.fillStyle='#d1d5db'; for(const br of M.bridges) ctx.fillRect(br.cx-br.hw, br.y-6, br.hw*2, 12);
    // bullets
    ctx.fillStyle='#ffee58'; for(const b of M.bullets) ctx.fillRect(b.x-2,b.y-6,4,12);

    drawTimer(ctx, M.timer/M.timerMax, '#67e8f9'); drawCRTOverlay(ctx); ctx.restore();
  }
};

function makeRiver(state){ const segH=24, total=Math.ceil((state.H*2)/segH)+2; let cx=state.W/2, hw=120; const path=[];
  for(let i=0;i<total;i++){ cx+=(Math.random()*80-40); cx=Math.max(160,Math.min(state.W-160,cx)); hw+= (Math.random()*30-15); hw=Math.max(80,Math.min(180,hw)); path.push({ y:-i*segH, cx, hw }); } return { segH, path }; }
function sampleRiver(river, sy){ const i=Math.floor((-sy)/river.segH); const a=river.path[i]||river.path.at(-1); const b=river.path[i+1]||a; const t=(((-sy)%river.segH)+river.segH)%river.segH/river.segH; const cx=a.cx*(1-t)+b.cx*t; const hw=a.hw*(1-t)+b.hw*t; return {cx,hw}; }
function insideRiver(x,y,M){ const sy=y-M.scroll; const s=sampleRiver(M.river, sy); return (x>s.cx-s.hw && x<s.cx+s.hw); }
function drawTimer(ctx, frac, color){ ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=0.8; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(30,30,18,-Math.PI/2,-Math.PI/2+Math.max(0,frac)*Math.PI*2); ctx.stroke(); ctx.restore(); }
