// docs/js/modes/brickMorph.js
// Rearrange *remaining* bricks into a mini-game board and keep destruction persistent.

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function circleRect(cx, cy, r, rect) {
  const clx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const cly = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - clx, dy = cy - cly;
  return dx * dx + dy * dy <= r * r;
}

// INTERNAL: build a compact grid of target rects in an area
function buildGrid(area) {
  const { x, y, w, h, cols, rows, gap = 4 } = area;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: x + c * (cellW + gap),
        y: y + r * (cellH + gap),
        w: cellW,
        h: cellH
      });
    }
  }
  return cells;
}

/**
 * Snapshot current brick layout and filter to live bricks.
 * Saves into state._morph:{ map[], saved[], area, grid[], liveIdxs:Set }
 */
export function snapshotBricks(state) {
  const liveIdxs = [];
  state.bricks.forEach((br, i) => {
    if (br && br.type !== 'broken') liveIdxs.push(i);
  });

  state._morph = {
    map: [],        // array of {src:i, from:{x,y,w,h}, to:{x,y,w,h}}
    saved: state.bricks.map(b => b && { x: b.x, y: b.y, w: b.w, h: b.h }),
    grid: null,
    area: null,
    liveIdxs: new Set(liveIdxs)
  };
}

/**
 * Compact remaining bricks into an area with a grid.
 * area = { x,y,w,h, cols, rows, gap? }
 * Returns count of bricks placed.
 */
export function compactBricks(state, area) {
  if (!state._morph) snapshotBricks(state);
  const grid = buildGrid(area);
  state._morph.grid = grid;
  state._morph.area = area;

  const srcIdxs = Array.from(state._morph.liveIdxs.values());
  const count = Math.min(srcIdxs.length, grid.length);

  state._morph.map = [];
  for (let i = 0; i < count; i++) {
    const src = srcIdxs[i];
    const to = grid[i];
    const from = state._morph.saved[src];
    state._morph.map.push({ src, from, to, alive: true });

    // move the real brick into the morph cell (so drawing stays unified)
    const br = state.bricks[src];
    br.x = to.x; br.y = to.y; br.w = to.w; br.h = to.h;
  }
  return count;
}

/**
 * Mark a mapped brick "hit" and break the backing source brick.
 * Returns true if a brick was broken.
 */
export function breakMappedBrickAt(state, predicate) {
  if (!state._morph) return false;
  for (const m of state._morph.map) {
    if (!m.alive) continue;
    const r = { x: m.to.x, y: m.to.y, w: m.to.w, h: m.to.h };
    if (predicate(r)) {
      const br = state.bricks[m.src];
      if (br && br.type !== 'unbreakable') {
        br.type = 'broken';
        m.alive = false;
        return true;
      }
    }
  }
  return false;
}

// Convenience wrappers for common collision shapes
export function hitMorphWithCircle(state, cx, cy, r) {
  return breakMappedBrickAt(state, rect => circleRect(cx, cy, r, rect));
}
export function hitMorphWithRect(state, rect) {
  return breakMappedBrickAt(state, r => rectsOverlap(rect, r));
}

/**
 * Restore bricks to their original places.
 * Bricks marked 'broken' remain gone in main mode.
 */
export function restoreBricks(state) {
  if (!state._morph) return;
  state._morph.map.forEach(m => {
    const br = state.bricks[m.src];
    if (!br || br.type === 'broken') return; // stay broken
    const from = m.from;
    br.x = from.x; br.y = from.y; br.w = from.w; br.h = from.h;
  });
  state._morph = null;
}
