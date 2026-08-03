/**
 * Serpentina — fruit spritesheet loader and draw helper.
 *
 * Typed port of references/started-games/snake/sprites.js (fruits row only).
 * Instantiated by the engine (never at module scope), so importing this file
 * never touches `Image`/`document` outside of an instance method.
 */

export type FruitName =
  | 'banana' | 'orange' | 'grape' | 'garlic' | 'eggplant' | 'strawberry' | 'cherry'
  | 'carrot' | 'mushroom' | 'broccoli' | 'watermelon' | 'pepper' | 'kiwi' | 'lemon'
  | 'peach' | 'peanut' | 'apple' | 'tomato' | 'berries' | 'grapes2' | 'pineapple' | 'melon';

interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUITS: Record<FruitName, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];

const FRUITS_SRC = '/games/serpentina/fruits.png';

export interface FruitSpritesheet {
  load(onReady: () => void): void;
  drawFruit(ctx: CanvasRenderingContext2D, name: FruitName, x: number, y: number, w: number, h: number): void;
}

export class ImageFruitSpritesheet implements FruitSpritesheet {
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
    rawImg.onerror = () => console.error('Failed to load fruit spritesheet');
    rawImg.src = FRUITS_SRC;
  }

  drawFruit(ctx: CanvasRenderingContext2D, name: FruitName, x: number, y: number, w: number, h: number): void {
    if (!this.loaded || !this.image) return;
    const sprite = FRUITS[name];
    ctx.drawImage(this.image, sprite.x, sprite.y, sprite.w, sprite.h, x, y, w, h);
  }
}
