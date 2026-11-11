/**
 * Asteroides — framework-agnostic engine.
 *
 * Direct port of references/started-games/02-asteroids/game.js, typed and
 * encapsulated in a class so a React component can own one instance per mount.
 *
 * Two deliberate deviations from the CLAUDE.md conventions and from the original:
 *  - `class` instead of arrow-function factories: these are engine entities, not
 *    React components or Next.js helpers. A faithful port beats a rewrite.
 *  - No module-level access to `window`/`document`: everything touching the DOM
 *    lives inside instance methods, so importing this file is SSR-safe.
 *
 * The in-canvas HUD of the original (score, level, life icons) is gone; that
 * information is rendered by the external HTML HUD via `getSnapshot()`.
 *
 * SPEC 11: the neon glow is no longer a live `shadowBlur` per entity and per frame.
 * Every glowing shape is pre-rendered once (see `glow-cache.ts`) and stamped with
 * `drawImage`; continuous sizes (power-up pulse, flame, particle trails) are quantized
 * to steps too fine to tell apart. Only the static overlays keep `shadowBlur`.
 */

import { createGlowCache, drawGlowSprite, getGlowSprite, renderGlowSprite, type GlowCache } from '../glow-cache';

export type EntitySize = 1 | 2 | 3; // small, medium, large
export type GamePhase = 'playing' | 'paused' | 'dead' | 'gameover';

export interface GameSnapshot {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  /** ship.tripleShot > 0, for the HUD indicator */
  tripleShotActive: boolean;
}

export interface InputState {
  keys: Record<string, boolean>;
  justPressed: (code: string) => boolean;
}

// ── Palette (site neon accents, mirrors the CSS custom properties) ────────────
const CYAN = '#00f5ff';
const MAGENTA = '#ff006e';
const YELLOW = '#f5ff00';
const ROCK = 'rgba(230, 233, 255, 0.85)';

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Constants ─────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // by size 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // base speed by size
const POINTS = [0, 100, 50, 20]; // score by size

// ── Glow sprites ──────────────────────────────────────────────────────────────
const ROCK_GLOW = 'rgba(230, 233, 255, 0.5)';
/** Power-up pulse runs 0.7–1.0; 16 sizes are 0.02 apart, under a pixel at its radius. */
const PULSE_MIN = 0.7;
const PULSE_STEPS = 15;
/** Particle trail lengths, in half-pixel steps. */
const TRAIL_STEPS_PER_PX = 2;

const paintBullet = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
};

/** Classic silhouette: triangle with a rear notch, nose pointing to +x. */
const paintShip = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 0); // nose
  ctx.lineTo(-12, -9); // left wing
  ctx.lineTo(-7, 0); // rear notch
  ctx.lineTo(-12, 9); // right wing
  ctx.closePath();
  ctx.stroke();
};

/**
 * Per-engine sprite table. Every variant is resolved through the GlowCache once and then
 * kept in a plain array, so the frame loop builds no keys and no closures.
 */
class AsteroidSprites {
  private cache: GlowCache = createGlowCache();
  private bulletSprite: HTMLCanvasElement | null = null;
  private shipSprite: HTMLCanvasElement | null = null;
  private flames: HTMLCanvasElement[] = [];
  private powerUps: HTMLCanvasElement[] = [];
  private trails: Record<string, HTMLCanvasElement[]> = {};

  bullet() {
    return (this.bulletSprite ??= getGlowSprite(this.cache, 'bullet', CYAN, 10, 3, paintBullet));
  }

  ship() {
    return (this.shipSprite ??= getGlowSprite(this.cache, 'ship', CYAN, 10, 21, paintShip));
  }

  /** Thruster flame of integer length 6–14 behind the ship's origin, in ship space. */
  flame(length: number) {
    return (this.flames[length] ??= getGlowSprite(this.cache, `flame${length}`, MAGENTA, 10, 8 + length + 1, (ctx) => {
      ctx.strokeStyle = MAGENTA;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - length, 0);
      ctx.lineTo(-8, 4);
      ctx.stroke();
    }));
  }

  /** Diamond at pulse step 0..PULSE_STEPS. */
  powerUp(step: number) {
    return (this.powerUps[step] ??= getGlowSprite(this.cache, `powerup${step}`, YELLOW, 12, 19, (ctx) => {
      const r = 12 * (PULSE_MIN + (step / PULSE_STEPS) * (1 - PULSE_MIN));
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
    }));
  }

  /** Trail from the origin back along -x, `step` half-pixels long. */
  trail(color: string, step: number) {
    const list = (this.trails[color] ??= []);
    return (list[step] ??= getGlowSprite(this.cache, `trail${step}`, color, 6, step / TRAIL_STEPS_PER_PX + 1, (ctx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-step / TRAIL_STEPS_PER_PX, 0);
      ctx.stroke();
    }));
  }
}

/** Drops dead entities in place, without allocating a new array every frame. */
const compact = <T extends { dead: boolean }>(list: T[]) => {
  let alive = 0;
  for (const item of list) if (!item.dead) list[alive++] = item;
  list.length = alive;
};

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, sprites: AsteroidSprites) {
    drawGlowSprite(ctx, sprites.bullet(), this.x, this.y);
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: EntitySize;
  radius: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  verts: [number, number][] = [];
  dead = false;
  /** Own glow sprite: the outline is unique to this rock, so it lives and dies with it. */
  private sprite: HTMLCanvasElement | null = null;

  constructor(x: number, y: number, size: EntitySize = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    const size = (this.size - 1) as EntitySize;
    return [new Asteroid(this.x, this.y, size), new Asteroid(this.x, this.y, size)];
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.sprite ??= renderGlowSprite(ROCK_GLOW, 8, this.radius + 1, (sprite) => {
      sprite.strokeStyle = ROCK;
      sprite.lineWidth = 1.5;
      sprite.lineJoin = 'round';
      sprite.beginPath();
      sprite.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) sprite.lineTo(this.verts[i][0], this.verts[i][1]);
      sprite.closePath();
      sprite.stroke();
    });
    drawGlowSprite(ctx, this.sprite, this.x, this.y, this.rot);
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, now: number, sprites: AsteroidSprites) {
    // Blink out during the last two seconds
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(now / 150) * 0.15;
    const step = Math.round(((pulse - PULSE_MIN) / (1 - PULSE_MIN)) * PULSE_STEPS);
    drawGlowSprite(ctx, sprites.powerUp(step), this.x, this.y);

    ctx.fillStyle = YELLOW;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3x', this.x, this.y);
    // Back to the canvas defaults the rest of draw() relies on.
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = 0;
  y = 0;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;

  constructor(
    private w: number,
    private h: number,
  ) {
    this.reset();
  }

  reset() {
    this.x = this.w / 2;
    this.y = this.h / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys['ArrowLeft']) this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, this.w);
    this.y = wrap(this.y + this.vy * dt, this.h);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, sprites: AsteroidSprites) {
    if (this.dead) return;
    // Blink while respawn invincibility lasts
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    drawGlowSprite(ctx, sprites.ship(), this.x, this.y, this.angle);

    // Thruster flame, flickering in length (rounded to whole pixels for the sprite table)
    if (this.thrusting && Math.random() > 0.35) {
      drawGlowSprite(ctx, sprites.flame(Math.round(rand(6, 14))), this.x, this.y, this.angle);
    }
  }
}

// ── Particles (explosions) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: string;
  dead = false;
  /** Heading of the velocity, fixed for the particle's whole life. */
  private heading: number;
  /** Trail length (|v| · 0.05 s) in half-pixel steps, also fixed. */
  private trailStep: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.color = color;
    this.heading = angle;
    this.trailStep = Math.round(speed * 0.05 * TRAIL_STEPS_PER_PX);
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, sprites: AsteroidSprites) {
    ctx.globalAlpha = Math.max(0, this.ttl / this.life);
    drawGlowSprite(ctx, sprites.trail(this.color, this.trailStep), this.x, this.y, this.heading);
    ctx.globalAlpha = 1;
  }
}

// ── Game ──────────────────────────────────────────────────────────────────────
export class AsteroidsGame {
  private ship: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private phase: GamePhase = 'playing';
  /** Phase to return to when resuming from a pause */
  private phaseBeforePause: GamePhase = 'playing';
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;
  private keys: Record<string, boolean> = {};
  private justPressed: (code: string) => boolean = () => false;
  /** Phase the canvas showed after the last draw(); null forces the next frame to paint. */
  private drawnPhase: GamePhase | null = null;
  private sprites: AsteroidSprites;
  /** Fragments born this frame, reused so collisions allocate no array per frame. */
  private spawned: Asteroid[] = [];

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
    this.sprites = new AsteroidSprites();
    this.ship = new Ship(w, h);
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
    this.lives = 0;
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
      tripleShotActive: this.ship.tripleShot > 0,
    };
  }

  /** false only while a static pause / game over frame is already on the canvas. */
  needsRedraw() {
    if (this.phase !== 'paused' && this.phase !== 'gameover') return true;
    if (this.drawnPhase !== this.phase) return true;
    // Still animated under the overlay: explosion particles keep flying after game over,
    // power-ups pulse with the clock and the thruster flame flickers at random.
    return (this.phase === 'gameover' && this.particles.length > 0) || this.powerUps.length > 0 || (this.ship.thrusting && !this.ship.dead);
  }

  update(dt: number) {
    if (this.phase === 'paused') return;

    if (this.phase === 'gameover') {
      if (this.justPressed('Space')) this.restart();
      this.updateParticles(dt);
      return;
    }

    if (this.phase === 'dead') {
      this.deadTimer -= dt;
      this.updateParticles(dt);
      for (const a of this.asteroids) a.update(dt, this.w, this.h);
      if (this.deadTimer <= 0) {
        this.phase = 'playing';
        this.ship.reset();
      }
      return;
    }

    if (this.justPressed('Space')) {
      this.bullets.push(...this.ship.tryShoot());
    }

    this.ship.update(dt, this.keys);
    for (const b of this.bullets) b.update(dt, this.w, this.h);
    for (const a of this.asteroids) a.update(dt, this.w, this.h);
    for (const p of this.particles) p.update(dt);
    for (const p of this.powerUps) p.update(dt, this.w, this.h);

    compact(this.bullets);
    compact(this.particles);
    compact(this.powerUps);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bullet vs asteroid
    const newAsteroids = this.spawned;
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5, MAGENTA);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    compact(this.asteroids);
    for (const a of newAsteroids) this.asteroids.push(a);
    newAsteroids.length = 0;
    compact(this.bullets);

    // Ship vs asteroid
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    if (this.asteroids.length === 0) this.nextLevel();
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, this.w, this.h);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const sprites = this.sprites;
    for (const p of this.particles) p.draw(ctx, sprites);
    for (const a of this.asteroids) a.draw(ctx);
    for (const p of this.powerUps) p.draw(ctx, now, sprites);
    for (const b of this.bullets) b.draw(ctx, sprites);
    this.ship.draw(ctx, sprites);

    if (this.phase === 'gameover') {
      this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    } else if (this.phase === 'paused') {
      this.drawOverlay('PAUSADO', '', 'PULSA REANUDAR PARA CONTINUAR');
    }
    this.drawnPhase = this.phase;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private init() {
    this.ship = new Ship(this.w, this.h);
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.phase = 'playing';
    this.phaseBeforePause = 'playing';
    this.spawnAsteroids(4);
  }

  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, this.w);
        y = rand(0, this.h);
      } while (Math.hypot(x - this.w / 2, y - this.h / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private explode(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14, YELLOW);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.phase = 'gameover';
    } else {
      this.phase = 'dead';
      this.deadTimer = 2;
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) p.update(dt);
    compact(this.particles);
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
    ctx.font = 'bold 46px monospace';
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
