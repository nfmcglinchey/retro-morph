export default {
  id:'river',
  label:'River Raid',
  apply(state){
    if (state.unlocks && state.unlocks.river) state.toMode='river';
    // locked until Konami; no-op if not unlocked
  }
};
