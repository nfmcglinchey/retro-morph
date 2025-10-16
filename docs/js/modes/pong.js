import { clamp } from '../util.js';
import { capBall, enforceMinAngle, circleRect, resolveBallBrick } from '../physics.js';
import * as HUD from '../ui/hud.js';
import { fillBackground, drawPaddle, drawBricks, drawCRTOverlay } from '../renderer.js';
import { snapshotBricks, arrangeGrid, restoreBricks, clearSnapshots } from './brickMorph.js';

export default {
  start(state, canvas) {
    state.mode = 'pong';
    HUD.set.mode('Pong');
    HUD.set.status('Mini-game');

    // save & rearrange the live bricks into a compact grid at the top
    const live = snapshotBricks(state);
    arrangeGrid(state, live, { cols: 10, gap: 4, ox: 0, oy: 70 });

    // setup puck and top paddle
    const p0x = (state.paddle.x + state.paddle.w / 2) || state.W / 2;
    this.M = {
      puck: { x: p0x, y: state.H * 0.6, vx: 260, vy: -260, r: 8 },
      topX: (state.W - 120) / 2, topW: 120,
      accel: 1.06,
      timer: 18, timerMax: 18
    };
    capBall(this.M.puck);

    // crisp CSS->logical scaling
    function resizeCanvas() {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(rect.width / state.W, 0, 0, rect.height / state.H, 0, 0);
    }
    resizeCanvas();
    this._onResize = resizeCanvas;
    window.addEventListener('resize', this._onResize);
  },

  _finish(state) {
    // put every brick back to its original coordinates
    restoreBricks(state);
    clearSnapshots(state);

    // hand a normal ball back to Ball mode, launching upward from puck position
    const bx = clamp(this.M.puck.x, 8, state.W - 8);
    const by = Math.max(60, this.M.puck.y);
    state.toMode = 'ball'; // main.js will switch modes next frame
    state._handoffBall = { x: bx, y: by, vx: this.M.puck.vx, vy: -Math.abs(this.M.puck.vy), r: 8 };

    // cleanup
    window.removeEventListener('resize', this._onResize);
  },

  update(dt, io, state) {
    const M = this.M;
    M.timer -= dt;
    if (M.timer <= 0) return this._finish(state);

    // move the bottom paddle with player input
    const move = (io.right ? 1 : 0) - (io.left ? 1 : 0);
    const p = state.paddle;
    p.x = clamp(p.x + move * p.speed * dt, 0, state.W - p.w);

    // puck motion
    const b = M.puck;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
    if (b.x > state.W - b.r) { b.x = state.W - b.r; b.vx *= -1; }
    if (b.y < 28 + b.r) { b.y = 28 + b.r; b.vy = Math.abs(b.vy); }
    if (b.y > state.H + b.r) return this._finish(state); // out bottom ends mini-game
    capBall(b);

    // collide with player paddle
    const pad = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (circleRect(b.x, b.y, b.r, pad) && b.vy > 0) {
      b.y = pad.y - b.r - 0.01;
      // arkanoid-style rebound
      const hit = (b.x - (pad.x + pad.w / 2)) / (pad.w / 2);
      const t = Math.max(-1, Math.min(1, hit));
      const theta = Math.abs(t) * (Math.PI * (60 / 180)); // 60°
      const speed = Math.hypot(b.vx, b.vy);
      const dirX = t >= 0 ? 1 : -1;
      b.vx = dirX * speed * Math.cos(theta);
      b.vy = -Math.abs(speed * Math.sin(theta));
      enforceMinAngle(b);
      // small speed-up per rally
      b.vx *= M.accel; b.vy *= M.accel; capBall(b);
    }

    // simple top AI paddle
    M.topX = clamp(M.topX + (b.x - (M.topX + M.topW / 2)) * 0.05, 0, state.W - M.topW);
    // bounce on top paddle if intersecting
    const top = { x: M.topX, y: 28, w: M.topW, h: 10 };
    if (circleRect(b.x, b.y, b.r, top) && b.vy < 0) { b.y = top.y + top.h + b.r + 0.01; b.vy = Math.abs(b.vy) * M.accel; capBall(b); }

    // brick collisions — puck breaks bricks exactly like Ball mode
    for (const br of state.bricks) {
      if (br.type === 'broken') continue;
      if (circleRect(b.x, b.y, b.r, br)) {
        resolveBallBrick(b, br);
        if (br.type !== 'unbreakable') {
          br.hit++;
          if (br.type !== 'double' || br.hit >= 2) {
            br.type = 'broken';
            state.score += 10; HUD.set.score(state.score);
          }
        }
        break;
      }
    }
  },

  draw(ctx, state) {
    const M = this.M;
    ctx.save();
    ctx.clearRect(0, 0, state.W, state.H);
    fillBackground(ctx, state.W, state.H);

    // bricks (in their temporary, rearranged places)
    drawBricks(ctx, state.bricks);

    // paddles
    drawPaddle(ctx, state.paddle);                 // bottom (player)
    ctx.fillStyle = '#cbd5e1';                     // top (AI)
    ctx.fillRect(M.topX, 28, M.topW, 10);

    // puck
    ctx.beginPath(); ctx.arc(M.puck.x, M.puck.y, M.puck.r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(M.puck.x - 2, M.puck.y - 2, 1, M.puck.x, M.puck.y, M.puck.r);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#dbeafe'); ctx.fillStyle = g; ctx.fill();

    // timer ring (top-left)
    const tFrac = Math.max(0, M.timer) / M.timerMax;
    ctx.save();
    ctx.strokeStyle = '#fca5a5';
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + tFrac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // optional scanlines/vignette follow global CRT
    drawCRTOverlay(ctx);
    ctx.restore();
  }
};
