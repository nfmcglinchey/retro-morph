// public/js/ui/panels.js
export function mount(state, { onChange }) {
  const qs = id => document.getElementById(id);

  // === Settings panel ===
  const elSettings = qs('btnSettings'), elPanel = qs('panel'), elClose = qs('btnClose');
  const elCRT = qs('optCrt'), elSfx = qs('optSfx'), elMusic = qs('optMusic'),
        elDiff = qs('optDiff'), elCB = qs('optCB');

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

  // === Mini-Game Select (NEAL + Konami) ===
  const miniPanel = qs('miniPanel');
  const btnMiniClose = qs('btnMiniClose');
  state.unlocks = state.unlocks || { pong:false, pac:false, tron:false, asteroids:false, invaders:false, river:false };
  let miniUnlocked = false;

  function renderMini(){
    if (!miniPanel) return;
    const nodes = miniPanel.querySelectorAll('.mini');
    nodes.forEach(node => {
      const kind = node.getAttribute('data-kind');
      const btn = node.querySelector('.btnStart');
      const locked = (kind === 'river') ? !state.unlocks.river : !miniUnlocked;
      node.classList.toggle('locked', locked);
      btn.disabled = locked;
      btn.onclick = () => {
        if (btn.disabled) return;
        // request a mode switch; main.js handles start on next frame
        state.toMode = kind;
        miniPanel.classList.add('hidden');
      };
    });
  }
  function openMini(){ renderMini(); miniPanel.classList.remove('hidden'); }
  function closeMini(){ miniPanel.classList.add('hidden'); }
  btnMiniClose?.addEventListener('click', closeMini);
  miniPanel?.addEventListener('click', (e)=>{ if(e.target===miniPanel) closeMini(); });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeMini(); });

  // Unlock sequences
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  let kIdx = 0;
  const NEAL = ['KeyN','KeyE','KeyA','KeyL'];
  let nIdx = 0;

  window.addEventListener('keydown', (e)=>{
    // Konami
    if (e.code === KONAMI[kIdx]) {
      kIdx++;
      if (kIdx === KONAMI.length) {
        kIdx = 0;
        state.unlocks.river = true;
        renderMini();
      }
    } else {
      kIdx = (e.code === KONAMI[0]) ? 1 : 0;
    }

    // NEAL (case-insensitive)
    const want = NEAL[nIdx];
    if (e.code === want || (want==='KeyN'&&/^[Nn]$/.test(e.key)) || (want==='KeyE'&&/^[Ee]$/.test(e.key)) || (want==='KeyA'&&/^[Aa]$/.test(e.key)) || (want==='KeyL'&&/^[Ll]$/.test(e.key))) {
      nIdx++;
      if (nIdx === NEAL.length && !miniUnlocked) {
        miniUnlocked = true;
        nIdx = 0;
        renderMini();
        openMini();
      }
    } else {
      nIdx = (e.code === NEAL[0]) ? 1 : 0;
    }
  });
}
