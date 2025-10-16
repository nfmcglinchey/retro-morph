import widen from './widen.js';
import multi from './multi.js';
import gun from './gun.js';
import hyper from './hyper.js';
import warp from './warp.js';
import pong from './pong.js';
import pac from './pac.js';
import tron from './tron.js';
import asteroids from './asteroids.js';
import invaders from './invaders.js';
import river from './river.js';
import snake from './snake.js';

export const POWERS = { widen, multi, gun, hyper, warp, pong, pac, tron, asteroids, invaders, river, snake };
export const POWER_IDS = Object.keys(POWERS);

export function colorOf(id){
  return {
    widen:'#34d399', multi:'#60a5fa', gun:'#f472b6', hyper:'#f59e0b', warp:'#a3e635',
    pong:'#fca5a5', pac:'#fde047', tron:'#22d3ee', asteroids:'#cbd5e1', invaders:'#86efac', river:'#67e8f9', snake:'#22d3ee'
  }[id] || '#ddd';
}
export function glyphOf(id){
  return { widen:'W', multi:'M', gun:'G', hyper:'H', warp:'⤴', pong:'P', pac:'C', tron:'T', asteroids:'A', invaders:'I', river:'R', snake:'S' }[id] || '?';
}
export function pickRandom(){ const bag = POWER_IDS; return bag[(Math.random()*bag.length)|0]; }
