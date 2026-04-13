// main.js — State Machine + UI Controller

const canvas     = document.getElementById('game-canvas');
const uiOverlay  = document.getElementById('ui-overlay');
const engine     = new GameEngine(canvas);

// ─── State Enum ──────────────────────────────────────────────────────────────

const STATE = {
  MENU_PRINCIPAL : 'MENU_PRINCIPAL',
  MENU_NIVELLS   : 'MENU_NIVELLS',
  MENU_MAESTRO   : 'MENU_MAESTRO',
  JUGANDO        : 'JUGANDO',
  GAME_OVER      : 'GAME_OVER',
  VICTORY        : 'VICTORY'
};

let currentState        = null;
let currentCampaignIdx  = null;
let activeScaleData     = null; // { sequences, name }

// ─── Persistència (localStorage) ─────────────────────────────────────────────

function _loadProgress() {
  try { return parseInt(localStorage.getItem('noteSnake_maxUnlocked') || '1', 10); }
  catch { return 1; }
}

function _saveProgress(val) {
  try { localStorage.setItem('noteSnake_maxUnlocked', String(val)); }
  catch {}
}

let _maxUnlocked = _loadProgress(); // nivell màxim desbloquejat (1-based)

// ─── Engine Callbacks ─────────────────────────────────────────────────────────

engine.onNoteEaten = (progress, score) => {
  if (!activeScaleData) return;
  _hudUpdate(progress, score);
};

engine.onSequenceComplete = (seqIdx, score) => {
  _hudNewSequence(seqIdx, score);
};

engine.onGameOver = (score, progress) => {
  transitionTo(STATE.GAME_OVER, { score, progress });
};

engine.onVictory = (score) => {
  if (currentCampaignIdx !== null) {
    const completedLevel = currentCampaignIdx + 1; // 1-based
    if (completedLevel >= _maxUnlocked && completedLevel < MUSIC_DATA.campaign.length) {
      _maxUnlocked = completedLevel + 1;
      _saveProgress(_maxUnlocked);
    }
  }
  transitionTo(STATE.VICTORY, { score });
};

// ─── Input ───────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  const map = {
    ArrowUp:    { x: 0,  y: -1 }, w: { x: 0,  y: -1 },
    ArrowDown:  { x: 0,  y:  1 }, s: { x: 0,  y:  1 },
    ArrowLeft:  { x: -1, y:  0 }, a: { x: -1, y:  0 },
    ArrowRight: { x:  1, y:  0 }, d: { x:  1, y:  0 }
  };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); engine.setDirection(dir); }
});

window.addEventListener('resize', () => {
  if (currentState === STATE.JUGANDO) engine.resize();
});

// ─── State Machine ────────────────────────────────────────────────────────────

function transitionTo(state, data = {}) {
  currentState = state;
  engine.stopGame();
  uiOverlay.innerHTML       = '';
  uiOverlay.style.pointerEvents = 'none';

  switch (state) {
    case STATE.MENU_PRINCIPAL: _renderMenuPrincipal();  break;
    case STATE.MENU_NIVELLS:   _renderMenuNivells();    break;
    case STATE.MENU_MAESTRO:   _renderMenuMaestro();    break;
    case STATE.JUGANDO:        _renderHUD(data);        break;
    case STATE.GAME_OVER:      _renderGameOver(data);   break;
    case STATE.VICTORY:        _renderVictory(data);    break;
  }
}

// ─── MENU PRINCIPAL ───────────────────────────────────────────────────────────

function _renderMenuPrincipal() {
  const wrap = _el('div', 'menu-wrap');
  wrap.innerHTML = `
    <div class="menu glass">
      <div class="title-block">
        <h1 class="title-neon">NOTE<br>SNAKE</h1>
        <p class="title-sub">NEON SCALES</p>
      </div>
      <div class="menu-buttons">
        <button id="btn-campana" class="btn btn-primary">
          <span class="btn-icon">▶</span> Mode Campanya
        </button>

        <button id="btn-maestro" class="btn btn-secondary">
          <span class="btn-icon">🎵</span> Mode Mestre
        </button>
      </div>
      <div class="instructions">
        <p>↑ ↓ ← → &nbsp;·&nbsp; WASD per moure</p>
        <p>Menja les notes <span class="c-cyan">correctes</span> en ordre.</p>
        <p>Esquiva les trampes <span class="c-magenta">incorrectes</span>.</p>
      </div>
    </div>
  `;
  uiOverlay.appendChild(wrap);
  _enablePointer(wrap);

  wrap.querySelector('#btn-campana').onclick = () => transitionTo(STATE.MENU_NIVELLS);
  wrap.querySelector('#btn-maestro').onclick = () => transitionTo(STATE.MENU_MAESTRO);
}

// ─── MENU NIVELLS ─────────────────────────────────────────────────────────────

function _renderMenuNivells() {
  const wrap = _el('div', 'menu-wrap');

  const buttons = MUSIC_DATA.campaign.map((lvl, i) => {
    const num       = i + 1;
    const unlocked  = num <= _maxUnlocked;
    const completed = num < _maxUnlocked;
    const isSurprise = num === 7;
    const shortName  = isSurprise && !unlocked
      ? '???'
      : (lvl.name.split(': ')[1] || lvl.name);
    const seqCount   = lvl.sequences.length;
    const passades   = seqCount > 1 ? `<span class="lvl-seq">${seqCount} passades</span>` : '';
    const icon       = completed ? '✓' : unlocked ? '▶' : '🔒';
    const cls        = `lvl-btn ${unlocked ? (completed ? 'lvl-done' : 'lvl-unlocked') : 'lvl-locked'}`;

    return `
      <button class="${cls}" data-idx="${i}" ${!unlocked ? 'disabled' : ''}>
        <span class="lvl-num">${num}</span>
        <span class="lvl-name">${shortName}</span>
        ${passades}
        <span class="lvl-icon">${icon}</span>
      </button>`;
  }).join('');

  wrap.innerHTML = `
    <div class="menu glass menu-nivells">
      <h2 class="menu-title">Selecciona Nivell</h2>
      <div class="nivells-grid">${buttons}</div>
      <button id="btn-back-nivells" class="btn btn-ghost">← Tornar</button>
    </div>
  `;
  uiOverlay.appendChild(wrap);
  _enablePointer(wrap);

  wrap.querySelectorAll('.lvl-btn:not([disabled])').forEach(btn => {
    btn.onclick = () => _startCampaign(parseInt(btn.dataset.idx));
  });
  wrap.querySelector('#btn-back-nivells').onclick = () => transitionTo(STATE.MENU_PRINCIPAL);
}

// ─── MENU MAESTRO ─────────────────────────────────────────────────────────────

function _renderMenuMaestro() {
  const roots = ["Do","Re","Mi","Fa","Sol","La","Si"];
  const alts  = [
    { val: "Natural",   label: "Natural" },
    { val: "Sostingut", label: "Sostingut (#)" },
    { val: "Bemoll",    label: "Bemoll (b)" }
  ];
  const modes = ["Major","Menor"];

  const wrap = _el('div', 'menu-wrap');
  wrap.innerHTML = `
    <div class="menu glass menu-maestro">
      <h2 class="menu-title">Mode Mestre</h2>
      <div class="maestro-controls">
        <label class="ctrl-label">
          Tònica
          <select id="sel-root" class="sel">
            ${roots.map(r => `<option>${r}</option>`).join('')}
          </select>
        </label>
        <label class="ctrl-label">
          Alteració
          <select id="sel-alt" class="sel">
            ${alts.map(a => `<option value="${a.val}">${a.label}</option>`).join('')}
          </select>
        </label>
        <label class="ctrl-label">
          Mode
          <select id="sel-mode" class="sel">
            ${modes.map(m => `<option>${m}</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="scale-preview" class="scale-preview"></div>
      <div class="menu-buttons">
        <button id="btn-play-custom" class="btn btn-primary">▶ Jugar</button>
        <button id="btn-back" class="btn btn-ghost">← Tornar</button>
      </div>
    </div>
  `;
  uiOverlay.appendChild(wrap);
  _enablePointer(wrap);

  const updatePreview = () => {
    const root  = wrap.querySelector('#sel-root').value;
    const alt   = wrap.querySelector('#sel-alt').value;
    const mode  = wrap.querySelector('#sel-mode').value;
    const scale = buildScale(root, alt, mode);
    wrap.querySelector('#scale-preview').innerHTML =
      `<span class="preview-label">Escala:</span>
       <span class="preview-notes">${scale.join(' <span class="arr">→</span> ')}</span>`;

  };

  ['sel-root','sel-alt','sel-mode'].forEach(id => {
    wrap.querySelector(`#${id}`).addEventListener('change', updatePreview);
  });
  updatePreview();

  wrap.querySelector('#btn-play-custom').onclick = () => {
    const root  = wrap.querySelector('#sel-root').value;
    const alt   = wrap.querySelector('#sel-alt').value;
    const mode  = wrap.querySelector('#sel-mode').value;
    const scale = buildScale(root, alt, mode);
    const suffix    = alt === 'Sostingut' ? '#' : alt === 'Bemoll' ? 'b' : '';
    const name      = `${root}${suffix} ${mode}`;
    const sequences = [{ scale, speed: 140, trapCount: 3, coloredNotes: true }];
    _launchGame(sequences, name);
  };
  wrap.querySelector('#btn-back').onclick = () => transitionTo(STATE.MENU_PRINCIPAL);
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function _renderHUD({ sequences, levelName }) {
  const total = sequences.length;
  const firstScale = sequences[0].scale;
  const hud = _el('div', 'hud');
  hud.innerHTML = `
    <div class="hud-top">
      <div class="hud-block">
        <span class="hud-label">PUNTS</span>
        <span id="hud-score" class="hud-value">0</span>
      </div>
      <div class="hud-block hud-center">
        <span class="hud-level">${levelName}</span>
        ${total > 1 ? `<span id="hud-passada" class="hud-passada">Passada <b>1</b> / ${total}</span>` : ''}
      </div>
      <div class="hud-block hud-right">
        <span class="hud-label">MENJA</span>
        <span id="hud-next" class="hud-note">${firstScale[0]}</span>
      </div>
    </div>
    <div id="hud-progress" class="hud-progress">
      ${firstScale.map((n, i) =>
        `<span class="pn${i === 0 ? ' pn-current' : ''}" id="pn${i}">${n}</span>`
      ).join('')}
    </div>
  `;
  uiOverlay.appendChild(hud);

  // D-pad tàctil
  const dpad = _el('div', 'dpad');
  dpad.innerHTML = `
    <button class="dp-btn dp-up"    data-dx="0"  data-dy="-1">▲</button>
    <button class="dp-btn dp-left"  data-dx="-1" data-dy="0" >◀</button>
    <button class="dp-btn dp-mid"   ></button>
    <button class="dp-btn dp-right" data-dx="1"  data-dy="0" >▶</button>
    <button class="dp-btn dp-down"  data-dx="0"  data-dy="1" >▼</button>
  `;
  uiOverlay.appendChild(dpad);
  dpad.style.pointerEvents = 'auto';

  dpad.querySelectorAll('.dp-btn[data-dx]').forEach(btn => {
    const fire = (e) => {
      e.preventDefault();
      engine.setDirection({
        x: parseInt(btn.dataset.dx),
        y: parseInt(btn.dataset.dy)
      });
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown',  fire);
  });
}

function _hudUpdate(progress, score) {
  const seqIdx = engine._seqIdx;
  const scale  = activeScaleData?.sequences[seqIdx]?.scale || [];

  const scoreEl = document.getElementById('hud-score');
  if (scoreEl) scoreEl.textContent = score;

  const nextEl = document.getElementById('hud-next');
  if (nextEl) {
    nextEl.textContent = scale[progress] || '✓';
    nextEl.classList.remove('pulse');
    void nextEl.offsetWidth;
    nextEl.classList.add('pulse');
  }

  const prev = document.getElementById(`pn${progress - 1}`);
  if (prev) { prev.classList.remove('pn-current'); prev.classList.add('pn-done'); }

  const curr = document.getElementById(`pn${progress}`);
  if (curr) curr.classList.add('pn-current');
}

function _hudNewSequence(seqIdx, score) {
  const sequences = activeScaleData?.sequences || [];
  const seq       = sequences[seqIdx];
  if (!seq) return;

  // Update passada counter
  const passadaEl = document.getElementById('hud-passada');
  if (passadaEl) {
    passadaEl.innerHTML = `Passada <b>${seqIdx + 1}</b> / ${sequences.length}`;
    passadaEl.classList.remove('pulse');
    void passadaEl.offsetWidth;
    passadaEl.classList.add('pulse');
  }

  // Rebuild progress bar for new sequence
  const bar = document.getElementById('hud-progress');
  if (bar) {
    bar.innerHTML = seq.scale.map((n, i) =>
      `<span class="pn${i === 0 ? ' pn-current' : ''}" id="pn${i}">${n}</span>`
    ).join('');
  }

  // Update next note
  const nextEl = document.getElementById('hud-next');
  if (nextEl) nextEl.textContent = seq.scale[0];

  // Update score
  const scoreEl = document.getElementById('hud-score');
  if (scoreEl) scoreEl.textContent = score;
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────

function _renderGameOver({ score, progress }) {
  const seqs  = activeScaleData?.sequences || [];
  const total = seqs.reduce((acc, s) => acc + s.scale.length, 0);
  const wrap  = _el('div', 'menu-wrap');
  wrap.innerHTML = `
    <div class="menu glass menu-result">
      <h2 class="result-title lose">GAME OVER</h2>
      <p class="result-subtitle">${activeScaleData?.name ?? ''}</p>
      <div class="result-stats">
        <div class="stat">
          <span class="stat-label">PUNTUACIÓ</span>
          <span class="stat-value">${score}</span>
        </div>
        <div class="stat">
          <span class="stat-label">PROGRÉS</span>
          <span class="stat-value">${progress} <span class="stat-sep">/</span> ${total}</span>
        </div>
      </div>
      <div class="menu-buttons">
        <button id="btn-retry" class="btn btn-primary">↺ Torna-ho a intentar</button>
        <button id="btn-menu"  class="btn btn-ghost">☰ Nivells</button>
      </div>
    </div>
  `;
  uiOverlay.appendChild(wrap);
  _enablePointer(wrap);

  wrap.querySelector('#btn-retry').onclick = () => _retryGame();
  wrap.querySelector('#btn-menu').onclick  = () => transitionTo(STATE.MENU_NIVELLS);
}

// ─── VICTORY ─────────────────────────────────────────────────────────────────

function _renderVictory({ score }) {
  const canAdvance = (
    currentCampaignIdx !== null &&
    currentCampaignIdx < MUSIC_DATA.campaign.length - 1
  );
  const wrap = _el('div', 'menu-wrap');
  wrap.innerHTML = `
    <div class="menu glass menu-result">
      <h2 class="result-title win">COMPLETADA!</h2>
      <p class="result-subtitle">${activeScaleData?.name ?? ''}</p>
      <div class="result-stats">
        <div class="stat stat-big">
          <span class="stat-label">PUNTUACIÓ FINAL</span>
          <span class="stat-value glow-cyan">${score}</span>
        </div>
      </div>
      <div class="menu-buttons">
        ${canAdvance ? `<button id="btn-next" class="btn btn-primary">▶ Nivell Següent</button>` : ''}
        <button id="btn-retry-win" class="btn btn-secondary">↺ Torna-ho a intentar</button>
        <button id="btn-menu-win"  class="btn btn-ghost">☰ Nivells</button>
      </div>
    </div>
  `;
  uiOverlay.appendChild(wrap);
  _enablePointer(wrap);

  const btnNext = wrap.querySelector('#btn-next');
  if (btnNext) btnNext.onclick = () => _startCampaign(currentCampaignIdx + 1);
  wrap.querySelector('#btn-retry-win').onclick = () => _retryGame();
  wrap.querySelector('#btn-menu-win').onclick  = () => transitionTo(STATE.MENU_NIVELLS);
}

// ─── Game Starters ────────────────────────────────────────────────────────────

function _startCampaign(idx) {
  const lvl = MUSIC_DATA.campaign[idx];
  if (!lvl) return;
  currentCampaignIdx = idx;
  _launchGame(lvl.sequences, lvl.name);
}

function _retryGame() {
  if (!activeScaleData) { transitionTo(STATE.MENU_PRINCIPAL); return; }
  _launchGame(activeScaleData.sequences, activeScaleData.name);
}

function _launchGame(sequences, name) {
  activeScaleData = { sequences, name };
  transitionTo(STATE.JUGANDO, { sequences, levelName: name });
  engine.startGame(sequences);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function _enablePointer(el) {
  el.style.pointerEvents = 'auto';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

transitionTo(STATE.MENU_PRINCIPAL);
