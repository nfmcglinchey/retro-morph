// public/js/config.js
export const CFG = {
  MIN_BOUNCE_RAD: deg(8),
  MIN_VY: 180,
  LAUNCH_MIN_DEG: 42,
  LAUNCH_MAX_DEG: 70,
  STALL_SECS: 5,
  NUDGE_RAD: deg(12),
  NUDGE_SPEEDUP: 1.07,
  MAX_BALL_SPEED: 520,
  SPEED_DECAY: 0.995,
  MAX_REFLECT_FROM_H: deg(60)
};

export const CRT = { enabled:true, vignette:0.35, scanlineAlpha:0.06 };
export const COLORBLIND = { enabled:false };

export function setDifficulty(tag) {
  if (tag === 'zen') { CFG.MIN_VY = 160; CFG.STALL_SECS = 6; }
  else if (tag === 'hard') { CFG.MIN_VY = 200; CFG.STALL_SECS = 4; }
  else { CFG.MIN_VY = 180; CFG.STALL_SECS = 5; }
}

export function deg(d){ return d*Math.PI/180; }
