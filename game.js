// game.js — Core Game Engine (Canvas Renderer + Snake Logic)

const GRID = 15;

const C = {
  bg:          '#0B0C10',
  grid:        '#1F2833',
  snakeHead:   '#66FCF1',
  snakeBody:   '#45A29E',
  glowHead:    'rgba(102,252,241,0.7)',
  glowBody:    'rgba(69,162,158,0.35)',
  noteCorrect: '#66FCF1',
  noteTrap:    '#FF00FF',
  glowCorrect: 'rgba(102,252,241,0.9)',
  glowTrap:    'rgba(255,0,255,0.9)',
  text:        '#F3E600',
  flashRed:    'rgba(255,0,80,',
  flashGreen:  'rgba(0,255,140,'
};

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.dpr    = window.devicePixelRatio || 1;

    this.snake        = [];
    this.dir          = { x: 1, y: 0 };
    this.nextDir      = { x: 1, y: 0 };
    this.notes        = [];
    this.particles    = [];
    this.score        = 0;
    this.progress     = 0;
    this.currentScale = [];
    this.stepInterval = 150;
    this.lastStep     = 0;
    this.isRunning    = false;
    this.flashAlpha   = 0;
    this.flashColor   = C.flashRed;
    this.logicalSize  = 0;
    this.cellSize     = 0;

    this.onNoteEaten       = null;
    this.onGameOver        = null;
    this.onVictory         = null;
    this.onSequenceComplete = null;

    this._sequences    = [];
    this._seqIdx       = 0;
    this._trapCount    = 3;
    this._coloredNotes = true;

    this._loop      = this._loop.bind(this);
    this._raf       = null;
    this._lastFrame = 0;

    this._pulse = 0;
  }

  // ─── Setup ───────────────────────────────────────────────────────────────

  resize() {
    const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 175, 900);
    const size = Math.max(maxSize, 280);
    this.logicalSize = size;
    this.cellSize    = size / GRID;
    this.canvas.width  = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width  = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  // sequences: [{scale, speed, trapCount, coloredNotes}, ...]
  startGame(sequences) {
    this.resize();
    this._sequences = sequences;
    this._seqIdx    = 0;
    this.score      = 0;
    this.dir        = { x: 1, y: 0 };
    this.nextDir    = { x: 1, y: 0 };
    this.particles  = [];
    this.flashAlpha = 0;
    this.isRunning  = true;

    this._applySequence(sequences[0]);

    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    this.snake = [
      { x: cx,     y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];

    this._spawnNotes();

    if (this._raf) cancelAnimationFrame(this._raf);
    this.lastStep   = performance.now();
    this._lastFrame = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  _applySequence(seq) {
    this.currentScale  = [...seq.scale];
    this.stepInterval  = seq.speed;
    this._trapCount    = seq.trapCount  ?? 3;
    this._coloredNotes = seq.coloredNotes ?? true;
    this.progress      = 0;
  }

  stopGame() {
    this.isRunning = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  setDirection(dir) {
    if (dir.x !== -this.dir.x || dir.y !== -this.dir.y) {
      this.nextDir = dir;
    }
  }

  // ─── Game Loop ───────────────────────────────────────────────────────────

  _loop(ts) {
    if (!this.isRunning) return;

    // True per-frame delta (frame rate independent)
    const dt = Math.min((ts - this._lastFrame) / 1000, 0.1);
    this._lastFrame = ts;

    // Fixed-interval game step
    const elapsed = ts - this.lastStep;
    if (elapsed >= this.stepInterval) {
      this.lastStep = ts - (elapsed % this.stepInterval);
      this._step();
    }

    this._updateParticles(dt);
    this._pulse     = (this._pulse + dt * 3) % (Math.PI * 2);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3.5);

    this._render();
    this._raf = requestAnimationFrame(this._loop);
  }

  _step() {
    this.dir = this.nextDir;

    const head = this.snake[0];
    const nx = (head.x + this.dir.x + GRID) % GRID;
    const ny = (head.y + this.dir.y + GRID) % GRID;

    // Self-collision
    if (this.snake.some(s => s.x === nx && s.y === ny)) {
      this._triggerGameOver(); return;
    }

    this.snake.unshift({ x: nx, y: ny });

    const hit = this.notes.findIndex(n => n.x === nx && n.y === ny);
    if (hit !== -1) {
      const note = this.notes[hit];
      if (note.isCorrect) { this._eatCorrect(); }
      else                { this._eatWrong(nx, ny); }
    } else {
      this.snake.pop(); // no note hit → no growth
    }
  }

  // ─── Note Logic ──────────────────────────────────────────────────────────

  _eatCorrect() {
    // tail stays (snake grows by 1)
    this.score += 100 + this.progress * 15;
    this.progress++;

    const head = this.snake[0];
    this._burst(head.x, head.y, C.noteCorrect, 18);
    this.flashColor = C.flashGreen;
    this.flashAlpha = 0.4;

    if (this.onNoteEaten) this.onNoteEaten(this.progress, this.score);

    if (this.progress >= this.currentScale.length) {
      // Sequence complete — try next
      this._seqIdx++;
      if (this._seqIdx < this._sequences.length) {
        this._applySequence(this._sequences[this._seqIdx]);
        this._spawnNotes();
        if (this.onSequenceComplete) this.onSequenceComplete(this._seqIdx, this.score);
      } else {
        // All sequences done → victory
        this.isRunning = false;
        setTimeout(() => { if (this.onVictory) this.onVictory(this.score); }, 500);
      }
      return;
    }
    this._spawnNotes();
  }

  _eatWrong(nx, ny) {
    this._burst(nx, ny, C.noteTrap, 22);
    this.flashColor = C.flashRed;
    this.flashAlpha = 1.0;
    this._triggerGameOver();
  }

  _triggerGameOver() {
    this.isRunning = false;
    setTimeout(() => { if (this.onGameOver) this.onGameOver(this.score, this.progress); }, 450);
  }

  _spawnNotes() {
    this.notes = [];
    const occupied = new Set(this.snake.map(s => `${s.x},${s.y}`));

    const correct = this.currentScale[this.progress];
    const cPos = this._emptyCell(occupied);
    occupied.add(`${cPos.x},${cPos.y}`);
    this.notes.push({ ...cPos, label: correct, isCorrect: true });

    const traps = this._pickTraps(correct, this._trapCount);
    for (const t of traps) {
      const pos = this._emptyCell(occupied);
      occupied.add(`${pos.x},${pos.y}`);
      this.notes.push({ ...pos, label: t, isCorrect: false });
    }
  }

  _pickTraps(correct, n) {
    const pool = MUSIC_DATA.allNotes.filter(x => x !== correct);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  _emptyCell(occupied) {
    let pos, tries = 0;
    do {
      pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      tries++;
    } while (occupied.has(`${pos.x},${pos.y}`) && tries < 300);
    return pos;
  }

  // ─── Particles ───────────────────────────────────────────────────────────

  _burst(gx, gy, color, count) {
    const cx = (gx + 0.5) * this.cellSize;
    const cy = (gy + 0.5) * this.cellSize;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd   = 80 + Math.random() * 160;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1.0,
        decay: 0.7 + Math.random() * 0.6,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vx *= 0.90;
      p.vy *= 0.90;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  _render() {
    const { ctx } = this;
    const S = this.logicalSize;

    // BG
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, S, S);

    this._drawGrid(S);
    this._drawNotes();
    this._drawSnake();
    this._drawParticles();

    // Screen flash
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = this.flashColor + this.flashAlpha.toFixed(3) + ')';
      ctx.fillRect(0, 0, S, S);
    }
  }

  _drawGrid(S) {
    const { ctx, cellSize } = this;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(S, i * cellSize); ctx.stroke();
    }
  }

  _drawNotes() {
    const { ctx, cellSize, _pulse, _coloredNotes } = this;
    const pScale = 1 + Math.sin(_pulse) * 0.06;

    for (const note of this.notes) {
      const cx = (note.x + 0.5) * cellSize;
      const cy = (note.y + 0.5) * cellSize;
      const r  = (cellSize * 0.42) * (note.isCorrect && _coloredNotes ? pScale : 1);

      // Mode gris: totes les notes igual (sense pista de color)
      const color  = _coloredNotes
        ? (note.isCorrect ? C.noteCorrect : C.noteTrap)
        : '#8899AA';
      const glow   = _coloredNotes
        ? (note.isCorrect ? C.glowCorrect : C.glowTrap)
        : 'rgba(136,153,170,0.6)';
      const bgFill = _coloredNotes
        ? (note.isCorrect ? 'rgba(102,252,241,0.12)' : 'rgba(255,0,255,0.12)')
        : 'rgba(136,153,170,0.08)';

      ctx.save();
      ctx.shadowBlur  = _coloredNotes ? (note.isCorrect ? 20 : 14) : 8;
      ctx.shadowColor = glow;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle   = bgFill;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();

      ctx.shadowBlur  = 8;
      ctx.fillStyle   = color;
      const fs = Math.max(cellSize * 0.34, 10);
      ctx.font        = `700 ${fs}px 'Segoe UI', sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(note.label, cx, cy);

      ctx.restore();
    }
  }

  _drawSnake() {
    const { ctx, cellSize, snake } = this;
    const pad = Math.max(2, cellSize * 0.08);
    const r   = Math.max(3, cellSize * 0.18);
    const w   = cellSize - pad * 2;

    for (let i = snake.length - 1; i >= 0; i--) {
      const seg   = snake[i];
      const isHead = i === 0;
      const alpha  = isHead ? 1 : Math.max(0.25, 1 - (i / snake.length) * 0.72);
      const color  = isHead ? C.snakeHead : C.snakeBody;
      const glow   = isHead ? C.glowHead  : C.glowBody;

      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.shadowBlur   = isHead ? 22 : 8;
      ctx.shadowColor  = glow;
      ctx.fillStyle    = color;

      this._roundRect(seg.x * cellSize + pad, seg.y * cellSize + pad, w, w, r);
      ctx.fill();

      // Head eyes
      if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = C.bg;
        const ex = cellSize * 0.22;
        const ey = cellSize * 0.28;
        const er = Math.max(1.5, cellSize * 0.08);
        const hcx = seg.x * cellSize + cellSize / 2;
        const hcy = seg.y * cellSize + cellSize / 2;
        // Rotate eyes toward direction
        const dx = this.dir.x, dy = this.dir.y;
        const eye1 = { x: hcx + dy * ex - dx * ey, y: hcy - dx * ex - dy * ey };
        const eye2 = { x: hcx - dy * ex - dx * ey, y: hcy + dx * ex - dy * ey };
        ctx.beginPath(); ctx.arc(eye1.x, eye1.y, er, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eye2.x, eye2.y, er, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  _roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha  = p.life;
      ctx.shadowBlur   = 8;
      ctx.shadowColor  = p.color;
      ctx.fillStyle    = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
