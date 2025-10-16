import { compactBricks, restoreBricks, hitMorphWithCircle } from './brickMorph.js';

export default {
  start(state, canvas) {
    state.mode = 'pac';
    compactBricks(state, {
      x: 60, y: 70, w: canvas.width - 120, h: 240,
      cols: 14, rows: 6, gap: 4
    });

    state.morph = {
      kind: 'pac',
      timer: 18, max: 18,
      pac: { x: canvas.width / 2, y: canvas.height * 0.6, r: 10, dir: -Math.PI / 2, speed: 210 },
      ghosts: [
        { x: canvas.width * 0.35, y: 120, dir: 1, speed: 120 },
        { x: canvas.width * 0.65, y: 180, dir: -1, speed: 120 },
        { x: canvas.width * 0.50, y: 220, dir: 1, speed: 140 }
      ]
    };
  },

  update(dt, input, state) {
    const W = 960, H = 600;
    const M = state.morph;
    M.timer -= dt;
    if (M.timer <= 0) return this.end(state, true);

    // steer / dash
    const pac = M.pac;
    pac.dir += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 2.6 * dt;
    const sp = input.space ? 260 : 210;
    pac.x += Math.cos(pac.dir) * sp * dt;
    pac.y += Math.sin(pac.dir) * sp * dt;

    // wrap X, clamp Y (hitting top/bottom ends mode)
    if (pac.x < 0) pac.x = W;
    if (pac.x > W) pac.x = 0;
    if (pac.y < pac.r || pac.y > H - pac.r) return this.end(state, false);

    // Eat mapped bricks
    if (hitMorphWithCircle(state, pac.x, pac.y, pac.r)) {
      state.score += 9;
      window.SFX?.brick();
    }

    // Ghosts
    for (const g of M.ghosts) {
      g.x += g.dir * g.speed * dt;
      if (g.x < 40 || g.x > W - 40) g.dir *= -1;
      if (Math.hypot(pac.x - g.x, pac.y - g.y) < 16) return this.end(state, false);
    }
  },

  draw(ctx, state) {
    // Timer ring
    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(30, 30, 18, -Math.PI / 2, -Math.PI / 2 + (state.morph.timer / state.morph.max) * Math.PI * 2);
    ctx.stroke();

    // Pac
    const pac = state.morph.pac;
    ctx.beginPath();
    const m = 0.35;
    ctx.moveTo(pac.x, pac.y);
    ctx.arc(pac.x, pac.y, pac.r, pac.dir + m, pac.dir - m, true);
    ctx.closePath();
    ctx.fillStyle = '#fde047'; ctx.fill();

    // Ghosts
    for (const g of state.morph.ghosts) {
      ctx.fillStyle = '#f87171';
      ctx.fillRect(g.x - 8, g.y - 8, 16, 12);
      ctx.beginPath(); ctx.arc(g.x, g.y - 8, 8, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 3; i++) ctx.fillRect(g.x - 9 + i * 6, g.y + 4, 6, 4);
    }
    ctx.restore();
  },

  end(state, success) {
    if (!success) {
      state.lives = Math.max(0, (state.lives || 3) - 1);
      try { document.getElementById('uiLives').textContent = state.lives; } catch {}
      window.SFX?.lose();
    } else {
      window.SFX?.win();
    }
    restoreBricks(state);
    state.toMode = 'ball';
  }
};
