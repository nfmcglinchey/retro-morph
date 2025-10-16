// public/js/ui/panels.js
export function mount(state, { onChange }) {
  const qs = id => document.getElementById(id);
  const elSettings = qs('btnSettings'), elPanel = qs('panel'), elClose = qs('btnClose');
  const elCRT = qs('optCrt'), elSfx = qs('optSfx'), elMusic = qs('optMusic'),
        elDiff = qs('optDiff'), elCB = qs('optCB');

  // hydrate
  elCRT.checked = !!state.settings.crt;
  elSfx.checked = !!state.settings.sfx;
  elMusic.checked = !!state.settings.music;
  elDiff.value = state.settings.diff;
  elCB.checked = !!state.settings.cb;

  const open = () => elPanel.classList.remove('hidden');
  const close = () => elPanel.classList.add('hidden');

  elSettings?.addEventListener('click', open);
  elClose?.addEventListener('click', close);
  elPanel?.addEventListener('click', e => { if (e.target === elPanel) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function send() { onChange && onChange(state.settings); }

  elCRT.addEventListener('change', ()=>{ state.settings.crt = elCRT.checked; send(); });
  elSfx.addEventListener('change', ()=>{ state.settings.sfx = elSfx.checked; send(); });
  elMusic.addEventListener('change', ()=>{ state.settings.music = elMusic.checked; send(); });
  elDiff.addEventListener('change', ()=>{ state.settings.diff = elDiff.value; send(); });
  elCB.addEventListener('change', ()=>{ state.settings.cb = elCB.checked; send(); });

  // Mini panel is present in HTML but we keep it locked for now.
  const mini = document.getElementById('miniPanel');
  const miniClose = document.getElementById('btnMiniClose');
  miniClose?.addEventListener('click', ()=> mini.classList.add('hidden'));
}
