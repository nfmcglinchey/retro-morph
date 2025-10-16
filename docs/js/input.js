// public/js/input.js
// Unified keyboard + touch input system
// Provides smooth key state tracking for all mini-games

const keys = { left: false, right: false, space: false };

// --- Keyboard bindings ---
export function bind() {
  const onKeyDown = (e) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true;
        e.preventDefault();
        break;
      case 'Space':
        keys.space = true;
        e.preventDefault(); // prevents page scrolling
        break;
    }
  };

  const onKeyUp = (e) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false;
        break;
      case 'Space':
        keys.space = false;
        break;
    }
  };

  // Passive must be false so preventDefault works on Space
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
}

// --- Touch controls (for mobile) ---
export function bindTouch() {
  const wrap = document.getElementById('touch');
  const leftBtn = document.getElementById('tLeft');
  const rightBtn = document.getElementById('tRight');
  const fireBtn = document.getElementById('tFire');
  if (!wrap || !leftBtn || !rightBtn || !fireBtn) return;

  const setKey = (key, pressed) => { keys[key] = pressed; };

  const addPressHandlers = (btn, key) => {
    ['pointerdown', 'touchstart', 'mousedown'].forEach(evt =>
      btn.addEventListener(evt, e => { e.preventDefault(); setKey(key, true); })
    );
    ['pointerup', 'pointercancel', 'touchend', 'mouseup', 'mouseleave'].forEach(evt =>
      btn.addEventListener(evt, e => { e.preventDefault(); setKey(key, false); })
    );
  };

  addPressHandlers(leftBtn, 'left');
  addPressHandlers(rightBtn, 'right');
  addPressHandlers(fireBtn, 'space');
}

// --- Read current state (used by all modes) ---
export function read() {
  // Return a shallow copy so consumers can't mutate directly
  return { left: keys.left, right: keys.right, space: keys.space };
}
