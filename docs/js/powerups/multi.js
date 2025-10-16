import { clamp } from '../util.js';
import { CFG } from '../config.js';
import { capBall } from '../physics.js';

export default {
  id: 'multi',
  label: 'Multi-ball',
  apply(state){
    const b = state.balls[0];
    if (!b) return;
    for (let i=0;i<2;i++){
      const nb = {
        x:b.x, y:b.y,
        vx: b.vx * (0.8 + 0.4*Math.random()) * (Math.random()<0.5?-1:1),
        vy: b.vy * (0.8 + 0.4*Math.random()),
        r: b.r
      };
      capBall(nb);
      state.balls.push(nb);
    }
  }
};
