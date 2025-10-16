export default {
  id: 'widen',
  label: 'Widen',
  apply(state){
    const p = state.paddle;
    p.w = Math.min(p.w * 1.25, p.wMax);
  }
};
