// public/js/physics.js
import { CFG } from './config.js';

export function capBall(ball){
  const s = Math.hypot(ball.vx, ball.vy);
  if (s > CFG.MAX_BALL_SPEED){
    const k = CFG.MAX_BALL_SPEED / s;
    ball.vx *= k; ball.vy *= k;
  }
}

export function enforceMinAngle(ball){
  if (Math.abs(ball.vy) < CFG.MIN_VY) {
    ball.vy = (ball.vy<0?-1:1) * CFG.MIN_VY;
  }
  const speed = Math.hypot(ball.vx, ball.vy);
  const ang = Math.atan2(ball.vy, ball.vx);
  const fromHoriz = Math.abs(Math.sin(ang));
  const minSin = Math.sin(CFG.MIN_BOUNCE_RAD);
  if (fromHoriz < minSin) {
    const sign = ball.vy>=0 ? 1 : -1;
    const newAng = (Math.cos(ang)>=0?0:Math.PI) + sign * CFG.MIN_BOUNCE_RAD;
    ball.vx = speed * Math.cos(newAng);
    ball.vy = speed * Math.sin(newAng);
  }
  capBall(ball);
}

export function circleRect(cx,cy,r,rect){
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx=cx-closestX, dy=cy-closestY;
  return dx*dx+dy*dy <= r*r;
}

export function resolveBallBrick(ball, br) {
  const r = ball.r, EPS = 0.01;
  const penL = (ball.x + r) - br.x;
  const penR = (br.x + br.w) - (ball.x - r);
  const penT = (ball.y + r) - br.y;
  const penB = (br.y + br.h) - (ball.y - r);
  const minX = Math.min(penL, penR);
  const minY = Math.min(penT, penB);
  if (minX < minY) {
    if (penL < penR) { ball.x = br.x - r - EPS; ball.vx = -Math.abs(ball.vx); }
    else { ball.x = br.x + br.w + r + EPS; ball.vx = Math.abs(ball.vx); }
    ball.vx *= 0.995;
  } else {
    if (penT < penB) { ball.y = br.y - r - EPS; ball.vy = -Math.abs(ball.vy); }
    else { ball.y = br.y + br.h + r + EPS; ball.vy = Math.abs(ball.vy); }
    ball.vy *= 0.995;
  }
  enforceMinAngle(ball);
  capBall(ball);
}
