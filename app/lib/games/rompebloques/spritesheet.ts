/**
 * Rompebloques — spritesheet loader and draw helpers.
 *
 * Typed port of references/started-games/04-arkanoid/assets/spritesheet.js.
 * Instantiated by the engine (never at module scope), so importing this file
 * never touches `Image`/`document` outside of an instance method.
 */

export type BlockColor = 'gray' | 'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green';

interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITES: { paddle: SpriteRect; ball: SpriteRect; blocks: Record<BlockColor, SpriteRect> } = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

export const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

export const EXPLOSION_DURATION = 150;

const SPRITESHEET_SRC = '/games/rompebloques/spritesheet-breakout.png';

export interface Spritesheet {
  load(onReady: () => void): void;
  drawSprite(ctx: CanvasRenderingContext2D, name: 'paddle' | 'ball' | `block_${BlockColor}`, x: number, y: number, w: number, h: number): void;
  drawFrame(ctx: CanvasRenderingContext2D, frame: SpriteRect, x: number, y: number, w: number, h: number): void;
}

export class ImageSpritesheet implements Spritesheet {
  private image: HTMLCanvasElement | null = null;
  private loaded = false;
  private callbacks: (() => void)[] = [];

  load(onReady: () => void): void {
    if (this.loaded) {
      onReady();
      return;
    }
    this.callbacks.push(onReady);
    if (this.image) return;

    const rawImg = new Image();
    rawImg.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = rawImg.width;
      offscreen.height = rawImg.height;
      const offscreenCtx = offscreen.getContext('2d');
      offscreenCtx?.drawImage(rawImg, 0, 0);
      this.image = offscreen;
      this.loaded = true;
      this.callbacks.forEach((cb) => cb());
    };
    rawImg.onerror = () => console.error('Failed to load spritesheet');
    rawImg.src = SPRITESHEET_SRC;
  }

  drawFrame(ctx: CanvasRenderingContext2D, frame: SpriteRect, x: number, y: number, w: number, h: number): void {
    if (!this.loaded || !this.image) return;
    ctx.drawImage(this.image, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  drawSprite(ctx: CanvasRenderingContext2D, name: 'paddle' | 'ball' | `block_${BlockColor}`, x: number, y: number, w: number, h: number): void {
    if (!this.loaded || !this.image) return;
    const sprite: SpriteRect | undefined = name.startsWith('block_')
      ? SPRITES.blocks[name.slice(6) as BlockColor]
      : SPRITES[name as 'paddle' | 'ball'];
    if (!sprite) return;
    ctx.drawImage(this.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, x, y, w, h);
  }
}
