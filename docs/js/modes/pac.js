import { clamp } from '../util.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawPaddle, drawBricks, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas) {
    state.mode = 'pac';
    HUD.set.mode('Pac-Ball');
    HUD.set.status('Mini-game');

    // snapshot + arrange the remaining bricks into a dense grid
    const live = snapshotBricks(state);
    arrangeGrid(state, live, { cols: 14, gap: 6, ox: 0, oy: 80 });

    // pac & ghosts
    const p0x = (state.paddle.x + state.paddle.w / 2) || state.W / 2;
    this.M = {
      pac:  { x: p0x, y: state.H * 0.65, dir: -Math.PI/2, speed: 210, r: 10 },
      ghosts: spawnGhosts(state.W),
      timer: 18, timerMax: 18
    };

    // crisp CSS->logical transform
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

    // hand a ball back to Ball mode (from pac position heading up)
    state.toMode = 'ball';
    const p = this.M.pac;
    state._handoffBall = { x: clamp(p.x, 8, state.W - 8), y: Math.max(60, p.y), vx: 0, vy: -300, r: 8 };
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state) {
    const M = this.M;
    M.timer -= dt;
    if (M.timer <= 0) return this._finish(state);

    // player paddle is cosmetic here (keeps controls consistent)
    const mv = (io.right?1:0) - (io.left?1:0);
    state.paddle.x = clamp(state.paddle.x + mv * state.paddle.speed * dt, 0, state.W - state.paddle.w);

    // steer Pac
    const turn = (io.right?1:0) + (io.left?-1:0);
    M.pac.dir += turn * 2.6 * dt;
    M.pac.speed = io.fire ? 260 : 210;
    M.pac.x += Math.cos(M.pac.dir) * M.pac.speed * dt;
    M.pac.y += Math.sin(M.pac.dir) * M.pac.speed * dt;

    // wrap left/right, clamp top/bottom inside play area
    if (M.pac.x < 0) M.pac.x = state.W;
    if (M.pac.x > state.W) M.pac.x = 0;
    if (M.pac.y < 60 || M.pac.y > state.H - 40) return this._finish(state); // out of bounds ends mini

    // eat bricks on contact
    for (const br of state.bricks) {
      if (br.type === 'broken') continue;
      if (circleRect(M.pac.x, M.pac.y, M.pac.r, br)) {
        if (br.type !== 'unbreakable') {
          br.type = 'broken';
          state.score += 9; HUD.set.score(state.score);
        }
      }
    }

    // ghosts patrol horizontally, bounce at margins
    for (const g of M.ghosts) {
      g.x += g.dir * g.speed * dt;
      if (g.x < 40 || g.x > state.W - 40) g.dir *= -1;
      // collision with pac ends mini-game (treat as a “lose”)
      if (dist(M.pac.x - g.x, M.pac.y - g.y) < 16) return this._finish(state);
    }
  },

  draw(ctx, state) {
    const M = this.M;
    ctx.save();
    ctx.clearRect(0,0,state.W,state.H);
    fillBackground(ctx, state.W, state.H);

    // bricks (in temporary layout)
    drawBricks(ctx, state.bricks);

    // paddle (cosmetic)
    drawPaddle(ctx, state.paddle);

    // pac
    ctx.beginPath();
    const m = 0.35;
    ctx.moveTo(M.pac.x, M.pac.y);
    ctx.arc(M.pac.x, M.pac.y, M.pac.r, M.pac.dir + m, M.pac.dir - m, true);
    ctx.closePath();
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // ghosts
    for (const g of M.ghosts) {
      ctx.fillStyle = '#f87171';
      ctx.fillRect(g.x-8, g.y-8, 16, 12);
      ctx.beginPath(); ctx.arc(g.x, g.y-8, 8, Math.PI, 0); ctx.fill();
      for (let i=0;i<3;i++) ctx.fillRect(g.x-9 + i*6, g.y+4, 6, 4);
    }

    // timer ring
    drawTimer(ctx, M.timer / M.timerMax, '#fde047');

    drawCRTOverlay(ctx);
    ctx.restore();
  }
};

function spawnGhosts(W){
  const arr=[]; const rows=3;
  for (let i=0;i<rows;i++){
    arr.push({ x: (i+1)*W/(rows+1), y: 110 + i*60, dir: i%2?1:-1, speed: 120 });
  }
  return arr;
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

function dist(dx,dy){ return Math.hypot(dx,dy); }
function circleRect(cx,cy,r,rect){
  const x = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - x, dy = cy - y;
  return dx*dx + dy*dy <= r*r;
}
