// Registry for power-ups + helpers

import widen from './widen.js';
import multi from './multi.js';
import gun from './gun.js';
import hyper from './hyper.js';
import warp from './warp.js';
import pong from './pong.js';   // ← add this

export const POWERS = { widen, multi, gun, hyper, warp, pong }; // ← add pong
export const POWER_IDS = Object.keys(POWERS);

export function colorOf(id){
  return {
    widen: '#34d399',
    multi: '#60a5fa',
    gun:   '#f472b6',
    hyper: '#f59e0b',
    warp:  '#a3e635',
    pong:  '#fca5a5'          // ← add
  }[id] || '#ddd';
}
export function glyphOf(id){
  return { widen:'W', multi:'M', gun:'G', hyper:'H', warp:'⤴', pong:'P' }[id] || '?'; // ← add
}

export function pickRandom(){
  const bag = POWER_IDS;
  return bag[(Math.random() * bag.length) | 0];
}
