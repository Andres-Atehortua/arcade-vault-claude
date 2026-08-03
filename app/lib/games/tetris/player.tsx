'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { GameRow } from '@/app/lib/supabase/types';
import SaveScoreForm from '../save-score-form';
import { PIECE_COLORS, PIECE_SHAPES, TetrisGame, type GameSnapshot } from './engine';

const WIDTH = 300;
const HEIGHT = 600;

/** Next-piece preview: a 4x4 box of cells, the widest piece being 4 wide. */
const PREVIEW_CELL = 14;
const PREVIEW_SIZE = PREVIEW_CELL * 4;

/** Keys the game owns: their default scrolling is suppressed while mounted. */
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyP'];

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lines: 0,
  level: 1,
  phase: 'playing',
  nextPiece: 1,
};

const sameSnapshot = (a: GameSnapshot, b: GameSnapshot) =>
  a.score === b.score && a.lines === b.lines && a.level === b.level && a.phase === b.phase && a.nextPiece === b.nextPiece;

/** While the alias field has focus its keys belong to the form, not to the piece. */
const isTyping = (event: KeyboardEvent) => event.target instanceof HTMLInputElement;

/** Thousands separator without Intl, so server and client markup always match. */
const formatScore = (score: number) => String(score).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const TetrisPlayer = ({ game }: { game: GameRow }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const crtRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<(() => void) | null>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const justPressedRef = useRef<Record<string, boolean>>({});
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const keys = keysRef.current;
    const justPressed = justPressedRef.current;
    const consume = (code: string) => {
      const value = !!justPressed[code];
      justPressed[code] = false;
      return value;
    };

    const instance = new TetrisGame(ctx, WIDTH, HEIGHT);
    instance.handleInput(keys, consume);
    gameRef.current = instance;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event) || !GAME_KEYS.includes(event.code)) return;
      event.preventDefault();
      if (!keys[event.code]) justPressed[event.code] = true;
      keys[event.code] = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTyping(event) || !GAME_KEYS.includes(event.code)) return;
      event.preventDefault();
      keys[event.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let lastTime: number | null = null;
    let lastSnapshot = instance.getSnapshot();

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      instance.update(dt);
      instance.draw();

      // Push to React only when a HUD value actually changed, not every frame.
      const next = instance.getSnapshot();
      if (!sameSnapshot(next, lastSnapshot)) {
        lastSnapshot = next;
        setSnapshot(next);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gameRef.current = null;
    };
  }, []);

  /**
   * The label must also follow Esc and the browser's own fullscreen controls.
   * `F` mirrors the button because the HUD sits outside the fullscreen element,
   * so once expanded the button itself is no longer reachable.
   */
  useEffect(() => {
    const toggle = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void crtRef.current?.requestFullscreen().catch(() => {});
    };
    const onChange = () => setIsFullscreen(document.fullscreenElement === crtRef.current);
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event) || event.code !== 'KeyF' || event.metaKey || event.ctrlKey || event.altKey) return;
      toggle();
    };
    fullscreenToggleRef.current = toggle;
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  /**
   * The engine only reports which piece comes next; painting it is the HUD's job.
   * Depending on `nextPiece` alone keeps this off the 60 fps path: it redraws when
   * a piece locks, and never while paused.
   */
  useEffect(() => {
    const ctx = previewRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const shape = PIECE_SHAPES[snapshot.nextPiece];

    // Center on the filled cells, not on the matrix: several shapes carry an
    // empty padding row that would push them off-center.
    let minR = shape.length;
    let maxR = -1;
    let minC = shape[0].length;
    let maxC = -1;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }

    const offX = (PREVIEW_SIZE - (maxC - minC + 1) * PREVIEW_CELL) / 2;
    const offY = (PREVIEW_SIZE - (maxR - minR + 1) * PREVIEW_CELL) / 2;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = shape[r][c];
        if (!cell) continue;
        const x = offX + (c - minC) * PREVIEW_CELL;
        const y = offY + (r - minR) * PREVIEW_CELL;
        ctx.fillStyle = PIECE_COLORS[cell];
        ctx.fillRect(x + 1, y + 1, PREVIEW_CELL - 2, PREVIEW_CELL - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(x + 1, y + 1, PREVIEW_CELL - 2, 3);
      }
    }
  }, [snapshot.nextPiece]);

  const toggleFullscreen = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    fullscreenToggleRef.current?.();
  };

  const isPaused = snapshot.phase === 'paused';
  const isGameOver = snapshot.phase === 'gameover';

  // Blur after clicking so a later Space drops the piece instead of pressing the button again.
  const togglePause = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    const instance = gameRef.current;
    if (!instance) return;
    if (instance.getSnapshot().phase === 'paused') instance.resume();
    else instance.pause();
    setSnapshot(instance.getSnapshot());
  };

  const forceEnd = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    const instance = gameRef.current;
    if (!instance) return;
    instance.end();
    setSnapshot(instance.getSnapshot());
  };

  /** Tap or click on the canvas restarts, mirroring the Space shortcut on touch devices. */
  const restartOnTap = () => {
    const instance = gameRef.current;
    if (!instance || instance.getSnapshot().phase !== 'gameover') return;
    instance.restart();
    setSnapshot(instance.getSnapshot());
  };

  /**
   * Touch buttons write into the very same `keys`/`justPressed` the engine reads,
   * so they simulate keystrokes instead of opening a second input path. The key
   * each button stands for travels in `data-code`, which keeps the refs out of
   * render and inside the event handlers.
   */
  const onTouchPress = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const code = event.currentTarget.dataset.code;
    if (!code) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!keysRef.current[code]) justPressedRef.current[code] = true;
    keysRef.current[code] = true;
  };

  const onTouchRelease = (event: PointerEvent<HTMLButtonElement>) => {
    const code = event.currentTarget.dataset.code;
    if (!code) return;
    keysRef.current[code] = false;
  };

  const touchHandlers = {
    onPointerDown: onTouchPress,
    onPointerUp: onTouchRelease,
    onPointerCancel: onTouchRelease,
    onPointerLeave: onTouchRelease,
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v plain">INVITADO</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{formatScore(snapshot.score)}</div>
          </div>
          <div className="hud-stat lines">
            <div className="l">Líneas</div>
            <div className="v">{snapshot.lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(snapshot.level).padStart(2, '0')}</div>
          </div>
          <div className="hud-stat next">
            <div className="l">Siguiente</div>
            <canvas ref={previewRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE} aria-hidden />
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause} disabled={isGameOver}>
            {isPaused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={forceEnd} disabled={isGameOver}>
            FIN
          </button>
          <button className="btn ghost" onClick={toggleFullscreen}>
            {isFullscreen ? 'VENTANA' : 'PANTALLA'}
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt" ref={crtRef}>
        <div className="crt-screen">
          <canvas className="game-canvas tall" ref={canvasRef} width={WIDTH} height={HEIGHT} onPointerDown={restartOnTap} />

          {/* Unmounts on restart, so the next run always starts with an empty field. */}
          {isGameOver && <SaveScoreForm gameId={game.id} score={snapshot.score} />}

          {/* Touch controls: same keys the engine already reads, no separate input path */}
          <div className="touch-controls tetris">
            <div className="touch-pad">
              <button className="touch-btn" aria-label="Mover a la izquierda" data-code="ArrowLeft" {...touchHandlers}>
                ◀
              </button>
              <button className="touch-btn" aria-label="Mover a la derecha" data-code="ArrowRight" {...touchHandlers}>
                ▶
              </button>
            </div>
            <button className="touch-btn" aria-label="Bajar una fila" data-code="ArrowDown" {...touchHandlers}>
              ▼
            </button>
            <div className="touch-pad">
              <button className="touch-btn" aria-label="Rotar" data-code="ArrowUp" {...touchHandlers}>
                ↻
              </button>
              <button className="touch-btn drop" aria-label="Soltar hasta el fondo" data-code="Space" {...touchHandlers}>
                ⤓
              </button>
            </div>
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led">EN PARTIDA</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 100 %</span>
        </div>
      </div>
    </div>
  );
};

export default TetrisPlayer;
