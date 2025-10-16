// public/js/bricks.js
import { clamp01 } from './util.js';

const ARK_COLS = ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590'];

export function buildLevel(i, W, H){
  const human = i + 1;
  const cols = 13;
  const rows = Math.min(14, 6 + Math.floor(i/2));
  const gap = 4, brickH = 18;
  const playW = W - 80;
  const brickW = (playW - (cols-1)*gap) / cols;
  const offsetX = (W - playW) / 2, offsetY = 70;
  const res = [];
  const allowDouble = (human >= 4); const allowUnbreak = (human >= 7);
  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      const x = offsetX + c*(brickW+gap);
      const y = offsetY + r*(brickH+gap);
      const color = ARK_COLS[r % ARK_COLS.length];
      let type = 'normal';
      if (allowUnbreak) {
        const pUn = clamp01(0.04 + i*0.01);
        const pDb = clamp01(0.10 + i*0.02);
        const roll = Math.random();
        if (roll < pUn) type = 'unbreakable';
        else if (roll < pUn + pDb) type = 'double';
      } else if (allowDouble) {
        if (Math.random() < 0.08 + (i-3)*0.03) type = 'double';
      }
      res.push({ x, y, w: brickW, h: brickH, type, hit:0, color, power: null });
    }
  }
  return res;
}
