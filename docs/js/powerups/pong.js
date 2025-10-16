export default {
  id: 'pong',
  label: 'Pong',
  apply(state){
    state.toMode = 'pong';  // main loop will switch on next frame
  }
};
