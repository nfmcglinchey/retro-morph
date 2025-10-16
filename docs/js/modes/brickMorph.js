// docs/js/modes/brickMorph.js
// Helper utilities for "brick morph" mini-games.
// - compactBricks:      pack remaining (unbroken) bricks into a grid area for a mini-game
// - restoreBricks:      return only surviving bricks to their original positions
// - hitMorphWithCircle: collide the mini-game's circle with mapped bricks (persist-break)
// - hitMorphWithRect:   collide a rectangle with mapped bricks (persist-break)
//
// Conventions:
// state.bricks[i] = { x,y,w,h,type, ... } with type: 'normal' | 'double' | 'unbreakable' | 'broken'
// We persist destruction by setting backing brick's type = 'broken' and marking map[i].alive = false.

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function circleIntersectsRect(cx, cy, r, rect) {
  const qx = clamp(cx, rect.x, rect.x + rect.w);
  const qy = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - qx, dy = cy - qy;
  return dx * dx + dy * dy <= r * r;
}

function rectIntersectsRect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Ensure storage for morph mapping
function ensureMorph(state) {
  if (!state._morph) state._morph = {};
  if (!state._morph.map) state._morph.map = [];
  return state._morph;
}

// Build list of indexes of CURRENTLY breakable bricks.
function remainingBrickIndexes(state) {
  const idxs = [];
  for (let i = 0; i < state.bricks.length; i++) {
    const br = state.bricks[i];
    if (!br) continue;
    if (br.type === 'broken') continue;
    // Treat unbreakable as "still there" but we typically skip them for morph targets
    // because most mini-games assume breakable. If you want them as obstacles, include them.
    if (br.type === 'unbreakable') continue;
    idxs.push(i);
  }
  return idxs;
}

/**
 * compactBricks(state, {x,y,w,h,cols,rows,gap})
 * Packs remaining breakable bricks into the given grid area. Creates mapping:
 *   map[k] = { src, orig:{x,y,w,h}, to:{x,y,w,h}, alive:true, base?:{x,y,w,h} }
 * Also moves the backing bricks to the mapped "to" positions for rendering/collision.
 */
export function compactBricks(state, area) {
  const { x, y, w, h, cols, rows, gap = 4 } = area;
  const morph = ensureMorph(state);
  morph.map = []; // reset

  const idxs = remainingBrickIndexes(state);
  if (!idxs.length) return;

  // Compute cell sizes
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;

  // Fill grid cells with available bricks
  let k = 0;
  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (k >= idxs.length) break outer;
      const i = idxs[k++];
      const br = state.bricks[i];
      if (!br || br.type === 'broken') { continue; }

      const toX = x + c * (cellW + gap);
      const toY = y + r * (cellH + gap);
      const to  = { x: toX, y: toY, w: cellW, h: cellH };

      morph.map.push({
        src: i,
        orig: { x: br.x, y: br.y, w: br.w, h: br.h },
        to:   { ...to },
        alive: true
      });

      // Move backing brick now so the renderer shows the compacted layout
      br.x = to.x; br.y = to.y; br.w = to.w; br.h = to.h;
    }
  }
}

/**
 * restoreBricks(state)
 * Return only surviving bricks (map.alive) back to their original positions.
 * Mapped bricks that were "broken" during the mini-game stay broken and are NOT restored.
 * Clears state._morph afterwards.
 */
export function restoreBricks(state) {
  const morph = state._morph;
  if (!morph || !morph.map) {
    // nothing to do
    return;
  }
  for (const m of morph.map) {
    const br = state.bricks[m.src];
    if (!br) continue;

    if (m.alive && br.type !== 'broken') {
      // restore to original grid spot
      br.x = m.orig.x; br.y = m.orig.y; br.w = m.orig.w; br.h = m.orig.h;
    } else {
      // brick died during mini-game; ensure it's marked broken
      br.type = 'broken';
    }
  }
  // clear morph mapping
  state._morph = null;
}

/**
 * hitMorphWithCircle(state, cx, cy, r)
 * If circle hits a mapped, ALIVE brick, mark that brick broken persistently and return true.
 */
export function hitMorphWithCircle(state, cx, cy, r) {
  const morph = state._morph;
  if (!morph || !morph.map) return false;

  for (const m of morph.map) {
    if (!m.alive) continue;
    const rect = m.to;
    if (circleIntersectsRect(cx, cy, r, rect)) {
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

/**
 * hitMorphWithRect(state, rect)
 * Rect vs mapped bricks; on hit, break persistently and return true.
 * rect = {x,y,w,h}
 */
export function hitMorphWithRect(state, rect) {
  const morph = state._morph;
  if (!morph || !morph.map) return false;

  for (const m of morph.map) {
    if (!m.alive) continue;
    if (rectIntersectsRect(rect, m.to)) {
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
