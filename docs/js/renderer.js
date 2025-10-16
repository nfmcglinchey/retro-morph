// public/js/renderer.js
import { CRT, COLORBLIND } from './config.js';
import { roundRect, shade } from './util.js';
import { colorOf, glyphOf } from './powerups/index.js';

export function fillBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0b0c15');
  g.addColorStop(1,'#10152a');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

export function drawBricks(ctx, bricks){
  for(const br of bricks){
    if(br.type==='broken') continue;
    const base = br.color;
    let fill = base;
    if (br.type==='double') fill = shade(base,-0.18);
    if (br.type==='unbreakable') fill = COLORBLIND.enabled ? '#b08b00' : '#c7a100';
    ctx.fillStyle = fill;
    ctx.fillRect(br.x, br.y, br.w, br.h);
  }
}

export function drawPaddle(ctx, p){
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(p.x, p.y, p.w, p.h);
}

export function drawBall(ctx, b){
  ctx.beginPath();
  ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
  const g=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.r);
  g.addColorStop(0,'#fff'); g.addColorStop(1,'#b6c2ff');
  ctx.fillStyle=g; ctx.fill();
}

export function drawPowerups(ctx, drops){
  for(const p of drops){
    ctx.save();
    ctx.fillStyle = colorOf(p.kind);
    if (COLORBLIND.enabled) { ctx.strokeStyle='#fff'; ctx.lineWidth=2; }
    ctx.beginPath();
    ctx.arc(p.x + p.w/2, p.y + p.h/2, 10, 0, Math.PI*2);
    ctx.fill();
    if (COLORBLIND.enabled) ctx.stroke();
    ctx.fillStyle = '#0b0c15';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyphOf(p.kind), p.x + p.w/2, p.y + p.h/2 + 0.5);
    ctx.restore();
  }
}

export function drawBullets(ctx, bullets){
  ctx.fillStyle = '#ff5252';
  for(const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
}

export function drawCRTOverlay(ctx){
  const { canvas } = ctx;
  const W = canvas.width, H = canvas.height;
  // scanlines
  ctx.save();
  ctx.globalAlpha = CRT.scanlineAlpha;
  ctx.fillStyle = '#000';
  for (let y=0; y<H; y+=2) ctx.fillRect(0,y,W,1);
  ctx.restore();
  // vignette
  const g = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.2, W/2,H/2,Math.max(W,H)*0.7);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,`rgba(0,0,0,${CRT.vignette})`);
  ctx.save(); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.restore();
}

export function drawOverlay(ctx, state){
  const W = state.W, H = state.H;
  const color = '#60a5fa'; // Ball mode accent
  // border
  ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(2,2,W-4,H-4); ctx.restore();
  // legend
  const text = 'Left/Right move • Space launch';
  ctx.save(); ctx.globalAlpha=0.85; ctx.font='13px system-ui'; const pad=10;
  const mw = ctx.measureText(text).width + pad*2;
  const x=W-mw-12, y=12;
  ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(ctx,x,y,mw,32,8); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.stroke();
  ctx.fillStyle='#e5e7eb'; ctx.textAlign='left'; ctx.fillText(text, x+pad, y+21); ctx.restore();
}
