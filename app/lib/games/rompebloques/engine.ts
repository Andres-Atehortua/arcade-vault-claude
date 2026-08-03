/**
 * Rompebloques — framework-agnostic engine.
 *
 * Direct port of references/started-games/04-arkanoid/game.js, typed and
 * encapsulated in a class so a React component can own one instance per mount.
 *
 * Deliberate deviations from the CLAUDE.md conventions and from the original,
 * argued in SPEC 08:
 *  - `class` instead of arrow-function factories: this is an engine, not a React
 *    component. A faithful port beats a rewrite.
 *  - Every piece of game state (`paddle`, `ball`, `blocks`, `score`, ...) is an
 *    instance field, not a module variable, so two mounts never share a game.
 *  - No module-level access to `window`/`document`/`Image`/`Audio`: everything
 *    touching the DOM or loading assets lives inside the constructor or
 *    instance methods, so importing this file is SSR-safe.
 *  - `GamePhase` gains `'win'`, fired on clearing level 5 — the base contract
 *    (asteroides) has no notion of victory.
 *  - `setPaddleX` extends the input contract: `handleInput(keys, justPressed)`
 *    covers keyboard and discrete touch buttons, but not continuous pointer
 *    movement (mouse drag / touch drag), which this game's only control needs.
 *
 * The sidebar HUD of the original (score / level / lives drawn on the canvas)
 * is gone; that information is rendered by the external HTML HUD via
 * `getSnapshot()`. The in-canvas pause overlay's level-skip buttons (a debug
 * feature of the original) are also gone — out of scope per SPEC 08.
 */

import { EXPLOSION_DURATION, EXPLOSION_FRAMES, ImageSpritesheet, type BlockColor } from './spritesheet';
import { LEVELS } from './levels';

export type GamePhase = 'playing' | 'paused' | 'dead' | 'gameover' | 'win';

export interface GameSnapshot {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

const PADDLE_SPEED = 400;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_BOTTOM_MARGIN = 40;
const BALL_SIZE = 16;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const POINTS_PER_BLOCK = 10;

const CYAN = '#00f5ff';
const YELLOW = '#f5ff00';

const SOUND_BOUNCE = '/games/rompebloques/sounds/ball-bounce.mp3';
const SOUND_BREAK = '/games/rompebloques/sounds/break-sound.mp3';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class RompebloquesGame {
  private paddle = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H };
  private ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private phase: GamePhase = 'playing';
  /** Phase to return to when resuming from a pause */
  private phaseBeforePause: GamePhase = 'playing';
  private keys: Record<string, boolean> = {};
  private justPressed: (code: string) => boolean = () => false;
  private spritesheet: ImageSpritesheet;
  private ready = false;
  private bounceSound: HTMLAudioElement;
  private breakSound: HTMLAudioElement;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
    this.spritesheet = new ImageSpritesheet();
    this.spritesheet.load(() => {
      this.ready = true;
    });
    this.bounceSound = new Audio(SOUND_BOUNCE);
    this.breakSound = new Audio(SOUND_BREAK);
    this.init();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean) {
    this.keys = keys;
    this.justPressed = justPressed;
  }

  /** Pointer-driven paddle control (mouse or touch), continuous. */
  setPaddleX(clientX: number, canvasRect: DOMRect) {
    const scaleX = this.w / canvasRect.width;
    const x = (clientX - canvasRect.left) * scaleX;
    this.paddle.x = clamp(x - this.paddle.w / 2, 0, this.w - this.paddle.w);
  }

  pause() {
    if (this.phase === 'paused' || this.phase === 'gameover' || this.phase === 'win') return;
    this.phaseBeforePause = this.phase;
    this.phase = 'paused';
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = this.phaseBeforePause;
  }

  /** Forces game over with the current score (the FIN button). */
  end() {
    if (this.phase === 'gameover' || this.phase === 'win') return;
    this.phase = 'gameover';
  }

  restart() {
    this.init();
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      phase: this.phase,
    };
  }

  update(dt: number) {
    if (this.justPressed('KeyP') || this.justPressed('Escape')) {
      if (this.phase === 'paused') this.resume();
      else this.pause();
    }

    if (!this.ready || this.phase === 'paused') return;

    if (this.phase === 'gameover' || this.phase === 'win') {
      if (this.justPressed('Space')) this.restart();
      return;
    }

    if (this.keys.ArrowLeft) this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight) this.paddle.x = Math.min(this.w - this.paddle.w, this.paddle.x + PADDLE_SPEED * dt);

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.playBounce();
    }
    if (this.ball.x + this.ball.w >= this.w) {
      this.ball.x = this.w - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.playBounce();
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.playBounce();
    }

    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.playBounce();
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({ x: block.x, y: block.y, w: block.w, h: block.h, color: block.color, elapsed: 0 });
        this.score += POINTS_PER_BLOCK;
        this.ball.vy = -this.ball.vy;
        this.playBreak();
        if (this.blocks.every((b) => !b.alive)) {
          if (this.level < 5) this.loadLevel(this.level + 1);
          else this.phase = 'win';
        }
        break; // one block per frame
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (this.ball.y > this.h) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.phase = 'gameover';
      } else {
        this.resetBall();
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, this.w, this.h);

    if (!this.ready) return;

    for (const block of this.blocks) {
      if (block.alive) this.spritesheet.drawSprite(ctx, `block_${block.color}`, block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) {
      const frameIndex = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4), 3);
      this.spritesheet.drawFrame(ctx, EXPLOSION_FRAMES[exp.color][frameIndex], exp.x, exp.y, exp.w, exp.h);
    }

    this.spritesheet.drawSprite(ctx, 'paddle', this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    this.spritesheet.drawSprite(ctx, 'ball', this.ball.x, this.ball.y, this.ball.w, this.ball.h);

    if (this.phase === 'gameover') {
      this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    } else if (this.phase === 'win') {
      this.drawOverlay('¡COMPLETASTE EL JUEGO!', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    } else if (this.phase === 'paused') {
      this.drawOverlay('PAUSA', '', 'PULSA REANUDAR PARA CONTINUAR');
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private init() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.phase = 'playing';
    this.phaseBeforePause = 'playing';
    this.paddle.x = (this.w - this.paddle.w) / 2;
    this.paddle.y = this.h - PADDLE_BOTTOM_MARGIN;
    this.loadLevel(1);
  }

  private loadLevel(n: number) {
    this.level = n;
    const level = LEVELS[n - 1];
    const originX = (this.w - BLOCK_COLS * BLOCK_W) / 2;
    this.blocks = level.blocks.map((b) => ({
      x: originX + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.resetBall(level.speed);
  }

  private resetBall(speed: number = LEVELS[this.level - 1].speed) {
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private collideAABB(block: Block) {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }

  private playBounce() {
    const clone = this.bounceSound.cloneNode() as HTMLAudioElement;
    void clone.play().catch(() => {});
  }

  private playBreak() {
    const clone = this.breakSound.cloneNode() as HTMLAudioElement;
    void clone.play().catch(() => {});
  }

  private drawOverlay(title: string, value: string, sub: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 12, 0.72)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 16;
    ctx.fillStyle = CYAN;
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
