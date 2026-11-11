'use client';

import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';

/** What one pad control sends: the KeyboardEvent.code the engine already reads. */
export type PadSlot = {
  code: string; // 'ArrowLeft', 'Space', 'KeyX', ...
  hint: string; // Spanish action name: aria-label, and caption under A/B ('Disparar')
};

type Direction = 'up' | 'right' | 'down' | 'left';
type ActionButton = 'a' | 'b';

/**
 * Per-game mapping onto the fixed gamepad (4-way d-pad + A + B). A slot left undefined is
 * shown dimmed and does nothing, so every game shares the same physical layout.
 */
export type PadLayout = Partial<Record<Direction | ActionButton, PadSlot>>;

/** Props of the shared pad; it writes into the same refs the keyboard handlers use. */
type TouchPadProps = {
  layout: PadLayout;
  keysRef: RefObject<Record<string, boolean>>;
  justPressedRef: RefObject<Record<string, boolean>>;
};

const VIBRATION_MS = 12;
const PRESSED_CLASS = 'on';
/** Fraction of the d-pad's half-size around the centre where the current direction is kept. */
const DEAD_ZONE = 0.3;

const DIRECTIONS: { dir: Direction; path: string; fallback: string }[] = [
  { dir: 'up', path: 'M12 4 L20 16 L4 16 Z', fallback: 'Arriba' },
  { dir: 'right', path: 'M8 4 L20 12 L8 20 Z', fallback: 'Derecha' },
  { dir: 'down', path: 'M4 8 L20 8 L12 20 Z', fallback: 'Abajo' },
  { dir: 'left', path: 'M16 4 L16 20 L4 12 Z', fallback: 'Izquierda' },
];

/** Short haptic tick where supported; silently ignored elsewhere (iOS Safari, desktop). */
const pulse = () => {
  try {
    navigator.vibrate?.(VIBRATION_MS);
  } catch {
    // Some browsers throw when vibration is blocked by policy; the tick is optional.
  }
};

/** Dominant axis of the touch relative to the d-pad centre; null inside the dead zone. */
const directionAt = (event: PointerEvent<HTMLElement>, rect: DOMRect): Direction | null => {
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  if (Math.max(Math.abs(dx), Math.abs(dy)) < (rect.width / 2) * DEAD_ZONE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
};

/**
 * On-screen gamepad for touch devices. Every control behaves like a physical key: a press
 * sets `justPressed` (first holder only) and holds `keys[code]` until the last pointer
 * holding that code lifts, is cancelled or loses capture, or the page is hidden. The d-pad
 * is one touch surface, so the thumb can roll between directions without lifting; A and B
 * are independent, so moving and acting at once works via multitouch.
 */
const TouchPad = ({ layout, keysRef, justPressedRef }: TouchPadProps) => {
  // pointerId -> code it holds and the element that shows the pressed state.
  const pointersRef = useRef(new Map<number, { code: string; el: HTMLElement }>());
  // pointerId -> direction currently held by a finger on the d-pad.
  const dpadPointersRef = useRef(new Map<number, Direction | null>());
  const dirElsRef = useRef<Partial<Record<Direction, HTMLElement | null>>>({});

  const isHeld = (code: string) => [...pointersRef.current.values()].some((p) => p.code === code);

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
    if ([...pointersRef.current.values()].every((p) => p.el !== held.el)) held.el.classList.remove(PRESSED_CLASS);
    if (!isHeld(held.code)) keysRef.current[held.code] = false;
  };

  // Safety net: tab switch, incoming call or unmount releases every key the pad holds.
  useEffect(() => {
    const pointers = pointersRef.current;
    const dpadPointers = dpadPointersRef.current;
    const keys = keysRef.current;
    const releaseAll = () => {
      for (const { code, el } of pointers.values()) {
        keys[code] = false;
        el.classList.remove(PRESSED_CLASS);
      }
      pointers.clear();
      dpadPointers.clear();
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

  /** Moves a d-pad finger to `dir` (null = none), releasing the previous direction first. */
  const setDpadDirection = (pointerId: number, dir: Direction | null) => {
    if (dpadPointersRef.current.get(pointerId) === dir) return;
    release(pointerId);
    dpadPointersRef.current.set(pointerId, dir);
    const slot = dir ? layout[dir] : undefined;
    const el = dir ? dirElsRef.current[dir] : null;
    if (slot && el) press(pointerId, slot.code, el);
  };

  const onDpadDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDpadDirection(event.pointerId, directionAt(event, event.currentTarget.getBoundingClientRect()));
  };

  const onDpadMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dpadPointersRef.current.has(event.pointerId)) return;
    const dir = directionAt(event, event.currentTarget.getBoundingClientRect());
    // Inside the dead zone the thumb keeps its direction, so resting on the hub does not flicker.
    if (dir) setDpadDirection(event.pointerId, dir);
  };

  const onDpadEnd = (event: PointerEvent<HTMLDivElement>) => {
    dpadPointersRef.current.delete(event.pointerId);
    release(event.pointerId);
  };

  const onActionDown = (event: PointerEvent<HTMLButtonElement>, slot: PadSlot) => {
    // No focus, no text selection, no synthetic mouse events.
    event.preventDefault();
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    press(event.pointerId, slot.code, el);
  };

  const onActionEnd = (event: PointerEvent<HTMLButtonElement>) => release(event.pointerId);

  const renderAction = (button: ActionButton) => {
    const slot = layout[button];
    return (
      <div className="gp-action">
        <button
          type="button"
          className={`ab ${button}${slot ? '' : ' off'}`}
          aria-label={slot ? `${button.toUpperCase()}: ${slot.hint}` : `${button.toUpperCase()}: sin uso`}
          disabled={!slot}
          onPointerDown={slot ? (event) => onActionDown(event, slot) : undefined}
          onPointerUp={onActionEnd}
          onPointerCancel={onActionEnd}
          onLostPointerCapture={onActionEnd}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="ab-ring" aria-hidden />
          <span className="ab-letter" aria-hidden>
            {button.toUpperCase()}
          </span>
        </button>
        <span className="ab-hint" aria-hidden>
          {slot?.hint ?? '—'}
        </span>
      </div>
    );
  };

  return (
    <div className="touch-pad" role="group" aria-label="Mando táctil">
      <div
        className="gp-dpad"
        role="group"
        aria-label="Cruceta"
        onPointerDown={onDpadDown}
        onPointerMove={onDpadMove}
        onPointerUp={onDpadEnd}
        onPointerCancel={onDpadEnd}
        onLostPointerCapture={onDpadEnd}
        onContextMenu={(event) => event.preventDefault()}
      >
        {DIRECTIONS.map(({ dir, path, fallback }) => {
          const slot = layout[dir];
          return (
            <span
              key={dir}
              ref={(el) => {
                dirElsRef.current[dir] = el;
              }}
              className={`dp dp-${dir}${slot ? '' : ' off'}`}
              role="img"
              aria-label={slot?.hint ?? `${fallback}: sin uso`}
            >
              <svg className="dp-arrow" viewBox="0 0 24 24" aria-hidden>
                <path d={path} fill="currentColor" />
              </svg>
            </span>
          );
        })}
        <span className="dp-hub" aria-hidden>
          <span className="dp-hub-gem" />
        </span>
      </div>
      <div className="gp-actions">
        {renderAction('b')}
        {renderAction('a')}
      </div>
    </div>
  );
};

export default TouchPad;
