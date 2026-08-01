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
 */

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

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = ROCK;
    ctx.shadowColor = 'rgba(230, 233, 255, 0.5)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
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

  draw(ctx: CanvasRenderingContext2D, now: number) {
    // Blink out during the last two seconds
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(now / 150) * 0.15;
    ctx.save();
    ctx.shadowColor = YELLOW;
    ctx.shadowBlur = 12;
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = YELLOW;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3x', this.x, this.y);
    ctx.restore();
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

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Blink while respawn invincibility lasts
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    // Classic silhouette: triangle with a rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-12, -9); // left wing
    ctx.lineTo(-7, 0); // rear notch
    ctx.lineTo(-12, 9); // right wing
    ctx.closePath();
    ctx.stroke();

    // Thruster flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = MAGENTA;
      ctx.shadowColor = MAGENTA;
      ctx.stroke();
    }

    ctx.restore();
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
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.restore();
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

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
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
      this.asteroids.forEach((a) => a.update(dt, this.w, this.h));
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
    this.bullets.forEach((b) => b.update(dt, this.w, this.h));
    this.asteroids.forEach((a) => a.update(dt, this.w, this.h));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt, this.w, this.h));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
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
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

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
    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.powerUps.forEach((p) => p.draw(ctx, now));
    this.bullets.forEach((b) => b.draw(ctx));
    this.ship.draw(ctx);

    if (this.phase === 'gameover') {
      this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}`, 'ESPACIO / TOCA PARA REINICIAR');
    } else if (this.phase === 'paused') {
      this.drawOverlay('PAUSADO', '', 'PULSA REANUDAR PARA CONTINUAR');
    }
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
    this.particles.forEach((p) => p.update(dt));
    this.particles = this.particles.filter((p) => !p.dead);
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
