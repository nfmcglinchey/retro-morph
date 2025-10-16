export default {
  id: 'gun',
  label: 'Guns',
  apply(state){
    state.gun = state.gun || { time:0, cd:0 };
    state.gun.time = Math.max(state.gun.time, 10); // seconds of uptime
  }
};
