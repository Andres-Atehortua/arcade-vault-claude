'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { GameRow } from '@/app/lib/supabase/types';
import { RompebloquesGame, type GameSnapshot } from './engine';
import SaveScoreForm from '../save-score-form';

const WIDTH = 800;
const HEIGHT = 600;

/** Keys the game owns: their default scrolling is suppressed while mounted. */
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'KeyP', 'Escape'];

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  phase: 'playing',
};

const sameSnapshot = (a: GameSnapshot, b: GameSnapshot) =>
  a.score === b.score && a.lives === b.lives && a.level === b.level && a.phase === b.phase;

/** While the alias field has focus its keys belong to the form, not to the paddle. */
const isTyping = (event: KeyboardEvent) => event.target instanceof HTMLInputElement;

/** Thousands separator without Intl, so server and client markup always match. */
const formatScore = (score: number) => String(score).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const RompebloquesPlayer = ({ game }: { game: GameRow }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crtRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<(() => void) | null>(null);
  const gameRef = useRef<RompebloquesGame | null>(null);
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

    const instance = new RompebloquesGame(ctx, WIDTH, HEIGHT);
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

  const toggleFullscreen = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    fullscreenToggleRef.current?.();
  };

  const isPaused = snapshot.phase === 'paused';
  const isGameOver = snapshot.phase === 'gameover';
  const isWin = snapshot.phase === 'win';
  const isFinished = isGameOver || isWin;

  // Blur after clicking so a later Space goes to the game, not back to the button.
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

  /** Tap or click on the canvas restarts once the game is over, mirroring Space on touch devices. */
  const restartOnTap = () => {
    const instance = gameRef.current;
    if (!instance || !isFinished) return;
    instance.restart();
    setSnapshot(instance.getSnapshot());
  };

  /** Continuous pointer-driven paddle control, mouse and touch alike. */
  const onPaddlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const instance = gameRef.current;
    if (!instance) return;
    instance.setPaddleX(event.clientX, event.currentTarget.getBoundingClientRect());
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
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{snapshot.lives > 0 ? '♥ '.repeat(snapshot.lives).trim() : '—'}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(snapshot.level).padStart(2, '0')}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause} disabled={isFinished}>
            {isPaused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={forceEnd} disabled={isFinished}>
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
          <canvas
            className="game-canvas"
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={restartOnTap}
            onPointerMove={onPaddlePointerMove}
          />

          {/* Unmounts on restart, so the next run always starts with an empty field. */}
          {isFinished && <SaveScoreForm gameId={game.id} score={snapshot.score} />}
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

export default RompebloquesPlayer;
