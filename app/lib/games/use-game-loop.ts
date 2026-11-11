'use client';

import { useEffect, useRef, useState } from 'react';
import { createPerfSampler, usePerfDebug } from './perf-meter';

/** What useGameLoop needs from any engine. Each engine keeps its own GameSnapshot type. */
export interface LoopEngine<S> {
  update(dt: number): void;
  draw(): void;
  getSnapshot(): S;
  /** false when the last drawn frame is still valid (static pause / game over). */
  needsRedraw(): boolean;
}

export type UseGameLoopOptions<S> = {
  /** Engine instance; null until the player's setup effect creates it. */
  engine: LoopEngine<S> | null;
  /** HUD equality, so React only re-renders on real changes (existing sameSnapshot). */
  sameSnapshot: (a: S, b: S) => boolean;
  initialSnapshot: S;
};

/** Returns the live HUD snapshot; owns rAF, dt clamp (0.05 s), visibility pause and perf sampling. */
export type UseGameLoop = <S>(options: UseGameLoopOptions<S>) => S;

/** Longest simulated step: a long frame never makes the game jump further than this. */
const MAX_DT_S = 0.05;
/** Publish perf stats every N frames; sorting the window every frame would skew what it measures. */
const PERF_PUBLISH_EVERY = 30;

/**
 * Shared frame loop for every game player. `sameSnapshot` must be stable (module-level),
 * otherwise the loop restarts on every render.
 */
export const useGameLoop: UseGameLoop = ({ engine, sameSnapshot, initialSnapshot }) => {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  // Last value pushed to React: the loop compares against it instead of re-rendering per frame.
  const lastSnapshotRef = useRef(initialSnapshot);
  const perfEnabled = usePerfDebug();

  useEffect(() => {
    if (!engine) return;

    const sampler = perfEnabled ? createPerfSampler() : null;
    let frame = 0;
    let lastTime: number | null = null;
    let sampledFrames = 0;

    const loop = (ts: number) => {
      const elapsedMs = lastTime === null ? 0 : ts - lastTime;
      lastTime = ts;

      engine.update(Math.min(elapsedMs / 1000, MAX_DT_S));
      // Static pause / game over: the canvas already shows this state, so skip the repaint.
      if (engine.needsRedraw()) engine.draw();

      // Push to React only when a HUD value actually changed, not every frame.
      const next = engine.getSnapshot();
      if (!sameSnapshot(next, lastSnapshotRef.current)) {
        lastSnapshotRef.current = next;
        setSnapshot(next);
      }

      if (sampler && elapsedMs > 0) {
        sampler.push(elapsedMs);
        if (++sampledFrames % PERF_PUBLISH_EVERY === 0) window.__avPerf = sampler.stats();
      }

      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      // Fresh timestamp after a pause, so the first frame back never carries the hidden time.
      lastTime = null;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    // Hidden tab: no frames at all, instead of relying on the browser's rAF throttling.
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else if (frame === 0) start();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sampler) delete window.__avPerf;
    };
  }, [engine, sameSnapshot, perfEnabled]);

  return snapshot;
};
