export default {
  id: 'warp',
  label: 'Warp',
  apply(state){
    // instantly advance a level
    state._requestNextLevel = true;
  }
};
