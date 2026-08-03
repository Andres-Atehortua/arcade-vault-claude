/**
 * Tetris — framework-agnostic engine.
 *
 * Direct port of references/started-games/03-tetris/game.js, typed and
 * encapsulated in a class so a React component can own one instance per mount.
 *
 * Deliberate deviations from the CLAUDE.md conventions and from the original,
 * all of them already argued in SPEC 07:
 *  - `class` instead of arrow-function factories: this is an engine, not a React
 *    component. A faithful port beats a rewrite.
 *  - Every piece of game state (`board`, `current`, `next`, `score`, ...) is an
 *    instance field. The original keeps them as module variables, which would
 *    make two mounts share a single game.
 *  - No module-level access to `window`/`document`: everything touching the DOM
 *    lives inside instance methods, so importing this file is SSR-safe.
 *
 * The sidebar HUD of the original (SCORE / LINES / LEVEL and the NEXT canvas) is
 * gone from the game canvas; that information is rendered by the external HTML
 * HUD via `getSnapshot()`.
 */

export type GamePhase = 'playing' | 'paused' | 'gameover';

/** 1–7 = classic tetrominoes (I, O, T, S, Z, J, L); 8 = the non-standard nut. */
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Board cell: 0 = empty, otherwise the PieceType that locked there. */
export type Cell = 0 | PieceType;

export interface Piece {
  type: PieceType;
  shape: Cell[][];
  x: number;
  y: number;
}

export interface GameSnapshot {
  score: number;
  lines: number;
  level: number;
  phase: GamePhase;
  nextPiece: PieceType;
}

// ── Board geometry ────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;

// ── Palette ───────────────────────────────────────────────────────────────────
/**
 * The 8 pastel colors of the original reframed over the Vault's #05050c, keeping
 * every pair distinguishable: the four hues are spread apart and the two blues
 * (I and J) and the two warms (O and L) differ in luminosity, not only in tone.
 * Exported so the HUD preview paints the next piece from the same source.
 */
export const PIECE_COLORS: Record<PieceType, string> = {
  1: '#00f5ff', // I — cyan
  2: '#f5ff00', // O — yellow
  3: '#b14dff', // T — violet
  4: '#00ff88', // S — green
  5: '#ff006e', // Z — magenta
  6: '#3d8bff', // J — azure
  7: '#ff8a1f', // L — orange
  8: '#c7d0e0', // N — the nut, metallic silver
};

/**
 * Shape matrix per piece, in its spawn rotation. Exported for the HUD preview
 * canvas; the engine never touches that canvas. Read-only by contract: callers
 * must clone before mutating, which is what `randomPiece` does.
 */
export const PIECE_SHAPES: Record<PieceType, Cell[][]> = {
  1: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  2: [
    [2, 2],
    [2, 2],
  ],
  3: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  4: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  5: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  6: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  7: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
  8: [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ],
};

const LINE_SCORES = [0, 100, 300, 500, 800];

/** Wall kick offsets, tried in order; the first one that fits wins. */
const KICKS = [0, -1, 1, -2, 2];

/**
 * Held-key repeat, in seconds. The original is driven by `keydown` and leans on
 * the browser's own key repeat; polling the key state every frame would move the
 * piece 60 times a second, so the delay and the rate reproduce that same feel.
 */
const REPEAT_DELAY = 0.17;
const REPEAT_RATE = 0.05;

const BG = '#05050c';
const GRID_LINE = 'rgba(0, 245, 255, 0.09)';
const GHOST_ALPHA = 0.2;

// ── Utils ─────────────────────────────────────────────────────────────────────
const createBoard = (): Cell[][] => Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));

const randomPiece = (): Piece => {
  const type = (Math.floor(Math.random() * 8) + 1) as PieceType;
  const shape = PIECE_SHAPES[type].map((row) => [...row]);

  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
};

const rotateCW = (shape: Cell[][]): Cell[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Cell[][] = Array.from({ length: cols }, () => new Array<Cell>(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];

  return result;
};

// ── Game ──────────────────────────────────────────────────────────────────────
export class TetrisGame {
  private board: Cell[][] = createBoard();
  private current: Piece = randomPiece();
  private next: Piece = randomPiece();
  private score = 0;
  private lines = 0;
  private level = 1;
  private phase: GamePhase = 'playing';
  private phaseBeforePause: GamePhase = 'playing';
  /** Milliseconds owed to the next automatic drop. The original counts in ms too. */
  private dropAccum = 0;
  /** Seconds a movement key has been held, per key code. */
  private held: Record<string, number> = {};
  private block: number;
  private keys: Record<string, boolean> = {};
  private justPressed: (code: string) => boolean = () => false;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
    this.block = Math.min(w / COLS, h / ROWS);
    this.init();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean) {
    this.keys = keys;
    this.justPressed = justPressed;
  }

  pause() {
    if (this.phase === 'paused' || this.phase === 'gameover') return;
    this.phaseBeforePause = this.phase;
    this.phase = 'paused';
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = this.phaseBeforePause;
  }

  /** Forces game over with the current score (the FIN button). */
  end() {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
  }

  restart() {
    this.init();
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lines: this.lines,
      level: this.level,
      phase: this.phase,
      nextPiece: this.next.type,
    };
  }

  /** `dt` in seconds; the ms the original's drop timer speaks are converted here, once. */
  update(dt: number) {
    if (this.justPressed('KeyP')) {
      if (this.phase === 'paused') this.resume();
      else this.pause();
    }

    if (this.phase === 'paused') return;

    if (this.phase === 'gameover') {
      if (this.justPressed('Space')) this.restart();

      return;
    }

    this.readInput(dt);

    this.dropAccum += dt * 1000;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (this.collide(this.current.shape, this.current.x, this.current.y + 1)) this.lockPiece();
      else this.current.y++;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawGrid();

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.drawBlock(c, r, this.board[r][c]);

    if (this.phase !== 'gameover') {
      const { shape, x } = this.current;
      const gy = this.ghostY();
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++) this.drawBlock(x + c, gy + r, shape[r][c], GHOST_ALPHA);
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++) this.drawBlock(x + c, this.current.y + r, shape[r][c]);
    }

    if (this.phase === 'gameover') this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    else if (this.phase === 'paused') this.drawOverlay('PAUSADO', '', 'PULSA REANUDAR PARA CONTINUAR');
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Speed curve of the original: one row per second at level 1, never under 100 ms. */
  private get dropInterval() {
    return Math.max(100, 1000 - (this.level - 1) * 90);
  }

  /** Fires on press and, for the movement keys, again while they stay held. */
  private repeats(code: string, dt: number) {
    // A tap shorter than one frame is already over by the time we poll `keys`,
    // so the one-shot flag still has to count.
    const tapped = this.justPressed(code);
    if (!this.keys[code]) {
      this.held[code] = 0;

      return tapped;
    }

    const before = this.held[code] ?? 0;
    const after = before + dt;
    this.held[code] = after;
    if (tapped || before === 0) return true;
    if (before < REPEAT_DELAY) return after >= REPEAT_DELAY;

    // Once repeating, fire every REPEAT_RATE seconds.
    return Math.floor((before - REPEAT_DELAY) / REPEAT_RATE) !== Math.floor((after - REPEAT_DELAY) / REPEAT_RATE);
  }

  private readInput(dt: number) {
    if (this.repeats('ArrowLeft', dt) && !this.collide(this.current.shape, this.current.x - 1, this.current.y)) this.current.x--;
    if (this.repeats('ArrowRight', dt) && !this.collide(this.current.shape, this.current.x + 1, this.current.y)) this.current.x++;
    if (this.repeats('ArrowDown', dt)) this.softDrop();
    if (this.justPressed('ArrowUp') || this.justPressed('KeyX')) this.tryRotate();
    if (this.justPressed('Space')) this.hardDrop();
  }

  /** One row down for 1 point, or lock in place when the row below is taken. */
  private softDrop() {
    if (this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.lockPiece();

      return;
    }

    this.current.y++;
    this.score += 1;
    this.dropAccum = 0;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * this.block + 0.5, 0);
      ctx.lineTo(c * this.block + 0.5, ROWS * this.block);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * this.block + 0.5);
      ctx.lineTo(COLS * this.block, r * this.block + 0.5);
    }
    ctx.stroke();
  }

  private drawBlock(x: number, y: number, cell: Cell, alpha = 1) {
    if (!cell) return;
    const ctx = this.ctx;
    const size = this.block;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PIECE_COLORS[cell];
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // Top highlight: reads as a bevel and keeps neighbouring blocks legible.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawOverlay(title: string, value: string, sub: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 12, 0.78)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(title, this.w / 2, this.h / 2 - 14);

    ctx.shadowBlur = 0;
    if (value) {
      ctx.fillStyle = '#f5ff00';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(value, this.w / 2, this.h / 2 + 18);
    }

    ctx.fillStyle = 'rgba(230, 233, 255, 0.65)';
    ctx.font = '12px monospace';
    ctx.fillText(sub, this.w / 2, this.h / 2 + (value ? 48 : 22));
    ctx.restore();
  }

  private init() {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.phase = 'playing';
    this.phaseBeforePause = 'playing';
    this.dropAccum = 0;
    this.held = {};
    this.next = randomPiece();
    this.spawn();
  }

  /** True if `shape` placed at (ox, oy) leaves the board or overlaps a locked cell. */
  private collide(shape: Cell[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }

    return false;
  }

  /** Rotates clockwise, kicking off walls and stack. Leaves the piece untouched if no offset fits. */
  private tryRotate() {
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;

        return;
      }
    }
  }

  private merge() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
  }

  /** Ported loop for loop from the original, `r++` compensation included. */
  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<Cell>(COLS).fill(0));
        cleared++;
        r++;
      }
    }

    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
    }
  }

  /** Row where the current piece would land, for the ghost and the hard drop. */
  private ghostY() {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;

    return gy;
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  /**
   * Promotes `next` to `current` and draws a new one. A piece that does not fit
   * the moment it appears ends the game — that is how the original loses, and
   * the 3x3 nut spawning into a tall stack is the usual way it happens.
   */
  private spawn() {
    this.current = this.next;
    this.next = randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) this.phase = 'gameover';
  }
}
