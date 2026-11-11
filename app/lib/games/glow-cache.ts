/**
 * Pre-rendered neon glow for canvas engines.
 *
 * `shadowBlur` is one of the most expensive Canvas 2D operations: the blur runs again on
 * every fill/stroke, every frame. Here each shape is drawn once, with its shadow, into an
 * offscreen canvas, and the engine then stamps that sprite with `drawImage`, which costs
 * the same however wide the halo is.
 *
 * No module-level access to `window`/`document`: canvases are created lazily inside
 * `getGlowSprite`, and each engine creates its own cache in its constructor (SSR-safe).
 */

/** Key: shape id + color + blur radius. Value: pre-blurred offscreen canvas drawn with drawImage. */
export type GlowSpriteKey = `${string}|${string}|${number}`;
export type GlowCache = Map<GlowSpriteKey, HTMLCanvasElement>;

export const createGlowCache = (): GlowCache => new Map();

/** Paints the shape around (0, 0); the sprite takes care of centering and of the glow. */
export type GlowPainter = (ctx: CanvasRenderingContext2D) => void;

/**
 * Paints one glow sprite, uncached. `extent` is how far the shape reaches from its origin,
 * line width included. The sprite adds 2× the blur radius as padding on every side, so the
 * halo is never clipped. Use it directly only for one-off shapes owned by a single entity
 * (e.g. an asteroid's random outline), so the sprite is collected together with it.
 */
export const renderGlowSprite = (color: string, blur: number, extent: number, paint: GlowPainter): HTMLCanvasElement => {
  const size = Math.ceil(2 * (extent + 2 * blur));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(size / 2, size / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    paint(ctx);
  }
  return canvas;
};

/** Returns the shared sprite for `shape` in `color` with a `blur` px halo, painting it on first use. */
export const getGlowSprite = (
  cache: GlowCache,
  shape: string,
  color: string,
  blur: number,
  extent: number,
  paint: GlowPainter
): HTMLCanvasElement => {
  const key: GlowSpriteKey = `${shape}|${color}|${blur}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = renderGlowSprite(color, blur, extent, paint);
  cache.set(key, canvas);
  return canvas;
};

/**
 * Stamps a sprite centered on (x, y), optionally rotated. Uses setTransform instead of
 * save/translate/rotate/restore and resets to identity afterwards, so callers must not
 * rely on a non-identity transform around this call (none of the engines do).
 */
export const drawGlowSprite = (ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, rotation = 0) => {
  const half = sprite.width / 2;
  if (rotation === 0) {
    ctx.drawImage(sprite, x - half, y - half);
    return;
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  ctx.setTransform(cos, sin, -sin, cos, x, y);
  ctx.drawImage(sprite, -half, -half);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
