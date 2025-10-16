import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawPaddle, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas) {
    state.mode = 'invaders';
    HUD.set.mode('Space Invaders');
    HUD.set.status('Mini-game');

    // Snapshot current live bricks and arrange them into rows for the fleet
    const live = snapshotBricks(state);
    arrangeGrid(state, live, { cols: 10, gap: 6, ox: 0, oy: 90 }); // bricks now represent aliens

    // mini-game state
    this.M = {
      dir: 1, step: 22, drop: 12, speed: 30,  // fleet motion
      timer: 16, timerMax: 16,
      bullets: [], cd: 0                        // player bullets
    };

    const resize = () => {
      const ctx = canvas.getContext('2d');
      const r = canvas.getBoundingClientRect();
      ctx.setTransform(r.width / state.W, 0, 0, r.height / state.H, 0, 0);
    };
    resize();
    this._onResize = resize;
    window.addEventListener('resize', this._onResize);
  },

  _finish(state) {
    restoreBricks(state);
    clearSnapshots(state);

    // hand back to Ball mode; launch a ball upward from paddle center
    state.toMode = 'ball';
    const x = state.paddle.x + state.paddle.w / 2;
    state._handoffBall = { x, y: state.paddle.y - 20, vx: 0, vy: -300, r: 8 };
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state) {
    const M = this.M;
    M.timer -= dt;
    if (M.timer <= 0) return this._finish(state);

    // paddle + player fire
    const mv = (io.right?1:0) - (io.left?1:0);
    state.paddle.x = clamp(state.paddle.x + mv * state.paddle.speed * dt, 0, state.W - state.paddle.w);
    M.cd -= dt;
    if (io.fire && M.cd <= 0) {
      M.cd = 0.16;
      M.bullets.push({ x: state.paddle.x + state.paddle.w/2 - 2, y: state.paddle.y - 12, w:4, h:10, vy: 460 });
    }

    // fleet horizontal motion
    const shift = M.dir * M.step * dt * (M.speed/30);
    for (const br of state.bricks) if (br.type !== 'broken') br.x += shift;

    // edge bounce & drop
    let edge = false;
    for (const br of state.bricks) {
      if (br.type === 'broken') continue;
      if (br.x < 20 || br.x + br.w > state.W - 20) { edge = true; break; }
    }
    if (edge) {
      M.dir *= -1;
      for (const br of state.bricks) if (br.type !== 'broken') br.y += M.drop;
    }

    // lose condition: fleet reaches paddle line
    for (const br of state.bricks) {
      if (br.type !== 'broken' && br.y + br.h > state.paddle.y - 20) {
        return this._finish(state);
      }
    }

    // bullets travel + hit bricks (aliens)
    for (const bu of M.bullets) {
      bu.y -= bu.vy * dt;
      for (const br of state.bricks) {
        if (br.type === 'broken') continue;
        if (overlap(bu, br)) {
          if (br.type !== 'unbreakable') {
            br.type = 'broken';
            state.score += 5; HUD.set.score(state.score);
          }
          bu.hit = true;
        }
      }
    }
    M.bullets = M.bullets.filter(b => !b.hit && b.y > -12);

    // win: all aliens down
    if (state.bricks.every(b => b.type==='broken' || b.type==='unbreakable')) return this._finish(state);
  },

  draw(ctx, state) {
    const M = this.M;
    ctx.save();
    ctx.clearRect(0,0,state.W,state.H);
    fillBackground(ctx, state.W, state.H);

    // draw the fleet using the bricks (green)
    ctx.fillStyle = '#86efac';
    for (const br of state.bricks) {
      if (br.type !== 'broken') ctx.fillRect(br.x, br.y, br.w, br.h);
    }

    // paddle
    drawPaddle(ctx, state.paddle);

    // bullets
    ctx.fillStyle = '#fffd8a';
    for (const b of M.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    // timer ring
    drawTimer(ctx, M.timer / M.timerMax, '#86efac');

    drawCRTOverlay(ctx);
    ctx.restore();
  }
};

function overlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function drawTimer(ctx, frac, color){
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(30, 30, 18, -Math.PI/2, -Math.PI/2 + Math.max(0, frac)*Math.PI*2);
  ctx.stroke();
  ctx.restore();
}
