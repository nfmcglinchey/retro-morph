// public/js/input.js
const keys = { left:false, right:false, space:false };

window.addEventListener('keydown', e => {
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=true;
  if(e.code==='Space') keys.space=true;
});
window.addEventListener('keyup', e => {
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=false;
  if(e.code==='Space') keys.space=false;
});

export function read(){
  return { left: keys.left ? -1 : 0, right: keys.right ? 1 : 0, fire: !!keys.space };
}

// touch synth (mobile)
export function bindTouch(){
  const wrap = document.getElementById('touch');
  const left = document.getElementById('tLeft');
  const right = document.getElementById('tRight');
  const fire = document.getElementById('tFire');
  const isSmall = ()=> matchMedia('(max-width: 820px)').matches;
  const toggle = ()=> isSmall() ? wrap.classList.remove('hidden') : wrap.classList.add('hidden');
  toggle(); matchMedia('(max-width: 820px)').addEventListener('change', toggle);

  const press = (k, on)=> { if(k==='left') keys.left=on; else if(k==='right') keys.right=on; else if(k==='space') keys.space=on; };
  ['pointerdown','touchstart','mousedown'].forEach(evt=>{
    left.addEventListener(evt, e=>{ e.preventDefault(); press('left',true); });
    right.addEventListener(evt, e=>{ e.preventDefault(); press('right',true); });
    fire.addEventListener(evt, e=>{ e.preventDefault(); press('space',true); });
  });
  ['pointerup','pointercancel','touchend','mouseup','mouseleave'].forEach(evt=>{
    left.addEventListener(evt, e=>{ e.preventDefault(); press('left',false); });
    right.addEventListener(evt, e=>{ e.preventDefault(); press('right',false); });
    fire.addEventListener(evt, e=>{ e.preventDefault(); press('space',false); });
  });
}
