// helpers to rearrange existing (unbroken) bricks for a mini-game,
// then restore them exactly where they were.
export function snapshotBricks(state) {
  // capture only live bricks (not broken)
  const live = state.bricks.filter(b => b.type !== 'broken');
  for (const br of live) {
    if (br._snap) continue;
    br._snap = { x: br.x, y: br.y, w: br.w, h: br.h };
  }
  return live;
}

// compact bricks into a centered grid (columns x rows) starting at (ox, oy)
export function arrangeGrid(state, bricks, { cols, gap = 4, ox = 80, oy = 80 }) {
  if (!bricks.length) return;
  const W = state.W;
  const rows = Math.ceil(bricks.length / cols);
  // keep original brick sizes; just reposition
  const w = bricks[0].w, h = bricks[0].h;
  const gridW = cols * w + (cols - 1) * gap;
  const startX = Math.max( (W - gridW) / 2, 12 );
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols && i < bricks.length; c++, i++) {
      const br = bricks[i];
      br.x = startX + c * (w + gap);
      br.y = oy + r * (h + gap);
    }
  }
}

export function restoreBricks(state) {
  for (const br of state.bricks) {
    if (br._snap) {
      br.x = br._snap.x; br.y = br._snap.y;
    }
  }
}

export function clearSnapshots(state) {
  for (const br of state.bricks) delete br._snap;
}
