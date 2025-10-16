import { capBall } from '../physics.js';

export default {
  id: 'hyper',
  label: 'Hyper',
  apply(state){
    for (const b of state.balls){
      b.vx *= 1.4; b.vy *= 1.4;
      capBall(b);
    }
  }
};
