'use client';

import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';

/** One on-screen button. `code` is the KeyboardEvent.code the engine already reads. */
export type TouchButton = {
  code: string; // 'ArrowLeft', 'ArrowUp', 'Space', 'KeyX', ...
  label: string; // glyph shown on the button: '◀', '▲', '⟳', ...
  ariaLabel: string; // Spanish copy for screen readers: 'Girar a la izquierda'
  size?: 'md' | 'lg'; // 'lg' for the primary action (fire, hard drop)
  /**
   * Hold-to-repeat, mirrors the game's keyboard behaviour. Informational only: the pad
   * keeps the key held while the finger is down and the engines already derive their own
   * auto-repeat from `keys`, exactly as with a physical key. No synthetic re-presses.
   */
  repeat?: boolean;
};

/** Layout per game: a group on the left (movement) and one on the right (actions). */
export type TouchLayout = {
  left: TouchButton[];
  right: TouchButton[];
  variant: 'row' | 'cross'; // 'cross' for Serpentina's 4-direction pad
};

/** Props of the shared shell; it writes into the same refs the keyboard handlers use. */
type TouchPadProps = {
  layout: TouchLayout;
  keysRef: RefObject<Record<string, boolean>>;
  justPressedRef: RefObject<Record<string, boolean>>;
};

const VIBRATION_MS = 12;

/** Short haptic tick where supported; silently ignored elsewhere (iOS Safari, desktop). */
const pulse = () => {
  try {
    navigator.vibrate?.(VIBRATION_MS);
  } catch {
    // Some browsers throw when vibration is blocked by policy; the tick is optional.
  }
};

const PRESSED_CLASS = 'is-pressed';

/**
 * On-screen controls for touch devices. Each button behaves like a physical key:
 * pointerdown sets `justPressed` (first press only) and holds `keys[code]`; the key is
 * released when the last pointer holding it lifts, is cancelled or loses capture, and
 * whenever the page is hidden, so a key can never stay stuck. Several fingers can hold
 * different buttons at once (e.g. rotate + fire).
 */
const TouchPad = ({ layout, keysRef, justPressedRef }: TouchPadProps) => {
  // pointerId -> code it is holding, so multitouch and double-held codes release correctly.
  const pointersRef = useRef(new Map<number, { code: string; el: HTMLElement }>());

  const isHeldByPad = (code: string) => [...pointersRef.current.values()].some((p) => p.code === code);

  const press = (pointerId: number, code: string, el: HTMLElement) => {
    const keys = keysRef.current;
    if (!keys[code]) justPressedRef.current[code] = true;
    keys[code] = true;
    pointersRef.current.set(pointerId, { code, el });
    el.classList.add(PRESSED_CLASS);
    pulse();
  };

  const release = (pointerId: number) => {
    const held = pointersRef.current.get(pointerId);
    if (!held) return;
    pointersRef.current.delete(pointerId);
    if (isHeldByPad(held.code)) return;
    keysRef.current[held.code] = false;
    held.el.classList.remove(PRESSED_CLASS);
  };

  // Safety net: tab switch, incoming call or unmount releases every key the pad holds.
  useEffect(() => {
    const pointers = pointersRef.current;
    const keys = keysRef.current;
    const releaseAll = () => {
      for (const { code, el } of pointers.values()) {
        keys[code] = false;
        el.classList.remove(PRESSED_CLASS);
      }
      pointers.clear();
    };
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', releaseAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [keysRef]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, code: string) => {
    // No focus, no text selection, no synthetic mouse events.
    event.preventDefault();
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    press(event.pointerId, code, el);
  };

  const onPointerEnd = (event: PointerEvent<HTMLButtonElement>) => release(event.pointerId);

  const renderButton = (button: TouchButton) => (
    <button
      key={button.code}
      type="button"
      className={`touch-btn ${button.size === 'lg' ? 'lg' : 'md'}`}
      data-code={button.code}
      aria-label={button.ariaLabel}
      onPointerDown={(event) => onPointerDown(event, button.code)}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden>{button.label}</span>
    </button>
  );

  return (
    <div className={`touch-pad ${layout.variant}`} role="group" aria-label="Controles táctiles">
      <div className="touch-group left">{layout.left.map(renderButton)}</div>
      {layout.right.length > 0 && <div className="touch-group right">{layout.right.map(renderButton)}</div>}
    </div>
  );
};

export default TouchPad;
