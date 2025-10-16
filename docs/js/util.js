// public/js/util.js
export const clamp = (n,min,max)=> Math.max(min, Math.min(max, n));
export const clamp01 = (n)=> clamp(n,0,1);
export const now = ()=> performance.now()/1000;

export function roundRect(ctx, x, y, w, h, r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

export function shade(hex, amt){
  try{
    const c=parseInt(hex.slice(1),16);
    let r=(c>>16)&255,g=(c>>8)&255,b=c&255;
    r=Math.max(0,Math.min(255,Math.round(r + 255*amt)));
    g=Math.max(0,Math.min(255,Math.round(g + 255*amt)));
    b=Math.max(0,Math.min(255,Math.round(b + 255*amt)));
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
  }catch{return hex;}
}
