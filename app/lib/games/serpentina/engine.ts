/**
 * Serpentina — framework-agnostic engine.
 *
 * Own port: references/started-games/snake/ ships fruit assets only, no
 * complete original engine to replicate — grid, movement, wrap-around and
 * speed curve are this spec's own design (see SPEC 09 — Decisiones).
 *
 * No module-level access to `window`/`document`/`Image`: everything touching
 * the DOM or loading assets lives inside the constructor or instance methods,
 * so importing this file is SSR-safe.
 *
 * `GameSnapshot` drops `lives`/`level` (no notion of either in an endless
 * Snake) and adds `length`, same deviation from the base contract that
 * Tetris already made.
 */

import { FRUIT_NAMES, ImageFruitSpritesheet, type FruitName } from './sprites';

export type GamePhase = 'playing' | 'paused' | 'gameover';

export interface GameSnapshot {
  score: number;
  length: number;
  phase: GamePhase;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface Segment {
  col: number;
  row: number;
}

interface Food {
  col: number;
  row: number;
  fruit: FruitName;
}

const GRID_COLS = 40;
const GRID_ROWS = 30;
const CELL = 20;
const BASE_TICK_MS = 140;
const TICK_DECREASE_PER_FOOD = 4;
const MIN_TICK_MS = 70;
const POINTS_PER_FOOD = 10;

const GREEN = '#39ff6a';
const YELLOW = '#f5ff00';

const DIRECTION_VECTOR: Record<Direction, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const wrap = (value: number, max: number) => ((value % max) + max) % max;

export class SerpentinaGame {
  private snake: Segment[] = [];
  private direction: Direction = 'right';
  private pendingDirection: Direction = 'right';
  private food: Food = { col: 0, row: 0, fruit: 'apple' };
  private score = 0;
  private tickMs = BASE_TICK_MS;
  private accumulator = 0;
  private phase: GamePhase = 'playing';
  private phaseBeforePause: GamePhase = 'playing';
  private keys: Record<string, boolean> = {};
  private justPressed: (code: string) => boolean = () => false;
  private spritesheet: ImageFruitSpritesheet;
  private ready = false;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
    this.spritesheet = new ImageFruitSpritesheet();
    this.spritesheet.load(() => {
      this.ready = true;
    });
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
      length: this.snake.length,
      phase: this.phase,
    };
  }

  update(dt: number) {
    if (this.justPressed('KeyP') || this.justPressed('Escape')) {
      if (this.phase === 'paused') this.resume();
      else this.pause();
    }

    if (!this.ready || this.phase === 'paused') return;

    if (this.phase === 'gameover') {
      if (this.justPressed('Space')) this.restart();
      return;
    }

    this.readDirectionInput();

    this.accumulator += dt * 1000;
    while (this.accumulator >= this.tickMs) {
      this.accumulator -= this.tickMs;
      this.step();
      if ((this.phase as GamePhase) === 'gameover') break;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, this.w, this.h);

    if (!this.ready) return;

    this.spritesheet.drawFruit(ctx, this.food.fruit, this.food.col * CELL, this.food.row * CELL, CELL, CELL);

    ctx.fillStyle = GREEN;
    ctx.shadowColor = GREEN;
    ctx.shadowBlur = 8;
    for (const segment of this.snake) {
      ctx.fillRect(segment.col * CELL + 1, segment.row * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.shadowBlur = 0;

    if (this.phase === 'gameover') {
      this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    } else if (this.phase === 'paused') {
      this.drawOverlay('PAUSA', '', 'PULSA REANUDAR PARA CONTINUAR');
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private init() {
    const startCol = Math.floor(GRID_COLS / 2);
    const startRow = Math.floor(GRID_ROWS / 2);
    this.snake = [
      { col: startCol - 1, row: startRow },
      { col: startCol - 2, row: startRow },
      { col: startCol - 3, row: startRow },
    ];
    this.direction = 'right';
    this.pendingDirection = 'right';
    this.score = 0;
    this.tickMs = BASE_TICK_MS;
    this.accumulator = 0;
    this.phase = 'playing';
    this.phaseBeforePause = 'playing';
    this.spawnFood();
  }

  private readDirectionInput() {
    let requested: Direction | null = null;
    if (this.justPressed('ArrowUp')) requested = 'up';
    else if (this.justPressed('ArrowDown')) requested = 'down';
    else if (this.justPressed('ArrowLeft')) requested = 'left';
    else if (this.justPressed('ArrowRight')) requested = 'right';

    if (requested && requested !== OPPOSITE[this.direction]) {
      this.pendingDirection = requested;
    }
  }

  private step() {
    this.direction = this.pendingDirection;
    const vector = DIRECTION_VECTOR[this.direction];
    const head = this.snake[0];
    const newHead: Segment = {
      col: wrap(head.col + vector.col, GRID_COLS),
      row: wrap(head.row + vector.row, GRID_ROWS),
    };

    if (this.snake.some((segment) => segment.col === newHead.col && segment.row === newHead.row)) {
      this.phase = 'gameover';
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.col === this.food.col && newHead.row === this.food.row) {
      this.score += POINTS_PER_FOOD;
      this.tickMs = Math.max(MIN_TICK_MS, this.tickMs - TICK_DECREASE_PER_FOOD);
      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  private spawnFood() {
    const free: Segment[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!this.snake.some((segment) => segment.col === col && segment.row === row)) {
          free.push({ col, row });
        }
      }
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const fruit = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    this.food = { col: cell.col, row: cell.row, fruit };
  }

  private drawOverlay(title: string, value: string, sub: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 12, 0.72)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    ctx.shadowColor = GREEN;
    ctx.shadowBlur = 16;
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 40px monospace';
    ctx.fillText(title, this.w / 2, this.h / 2 - 18);

    ctx.shadowBlur = 0;
    if (value) {
      ctx.fillStyle = YELLOW;
      ctx.font = 'bold 22px monospace';
      ctx.fillText(value, this.w / 2, this.h / 2 + 20);
    }

    ctx.fillStyle = 'rgba(230, 233, 255, 0.65)';
    ctx.font = '16px monospace';
    ctx.fillText(sub, this.w / 2, this.h / 2 + (value ? 56 : 26));
    ctx.restore();
  }
}
