// public/js/ui/hud.js
const el = {
  level: document.getElementById('uiLevel'),
  score: document.getElementById('uiScore'),
  lives: document.getElementById('uiLives'),
  mode:  document.getElementById('uiMode'),
  status:document.getElementById('uiStatus'),
  label: document.getElementById('powerLabel'),
};

export const set = {
  level: n => el.level.textContent = n,
  score: n => el.score.textContent = n,
  lives: n => el.lives.textContent = n,
  mode:  s => el.mode.textContent = s,
  status:s => el.status.textContent = s,
  power: (text, color='#fff') => {
    el.label.textContent = text.toUpperCase();
    el.label.style.borderColor = color;
    el.label.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(()=> el.label.classList.remove('show'), 900);
  }
};
