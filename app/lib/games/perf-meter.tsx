'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/** Rolling window of frame times, fed by useGameLoop only when ?debug=perf is present. */
export type PerfStats = {
  fps: number; // mean over the window
  p95Ms: number; // 95th percentile frame time
  over33Pct: number; // % of frames > 33 ms
  frames: number; // samples in the window
};

export const PERF_WINDOW_FRAMES = 600; // ~10 s at 60 fps
export const PERF_QUERY_PARAM = 'debug'; // ?debug=perf
const PERF_QUERY_VALUE = 'perf';

/** A frame slower than this counts as a visible hitch (two missed 60 Hz vsyncs). */
const SLOW_FRAME_MS = 33;
/** One 60 Hz frame: the p95 budget the spec sets. */
const FRAME_BUDGET_MS = 1000 / 60;
/** How often the overlay re-reads window.__avPerf. */
const REFRESH_MS = 500;

declare global {
  interface Window {
    /** Last published stats; only defined while a game runs with ?debug=perf. */
    __avPerf?: PerfStats;
  }
}

// The query string never changes while the player is mounted, so there is nothing to subscribe to.
const subscribe = () => () => {};
const getSnapshot = () => new URLSearchParams(window.location.search).get(PERF_QUERY_PARAM) === PERF_QUERY_VALUE;
// SSR and the hydration pass always render without the meter, so markup never mismatches and
// the prerendered page needs no Suspense boundary (unlike useSearchParams).
const getServerSnapshot = () => false;

/** True on the client when the URL carries ?debug=perf. */
export const usePerfDebug = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export type PerfSampler = {
  /** Records the interval between two consecutive animation frames, in ms. */
  push: (frameMs: number) => void;
  /** Stats over the last PERF_WINDOW_FRAMES samples (or fewer while the window fills). */
  stats: () => PerfStats;
};

/** Ring buffer of frame times. Preallocated, so sampling itself allocates nothing per frame. */
export const createPerfSampler = (): PerfSampler => {
  const samples = new Float64Array(PERF_WINDOW_FRAMES);
  const sorted = new Float64Array(PERF_WINDOW_FRAMES);
  let count = 0;
  let head = 0;

  const push = (frameMs: number) => {
    samples[head] = frameMs;
    head = (head + 1) % PERF_WINDOW_FRAMES;
    if (count < PERF_WINDOW_FRAMES) count++;
  };

  const stats = (): PerfStats => {
    if (count === 0) return { fps: 0, p95Ms: 0, over33Pct: 0, frames: 0 };

    let total = 0;
    let slow = 0;
    for (let i = 0; i < count; i++) {
      const ms = samples[i];
      sorted[i] = ms;
      total += ms;
      if (ms > SLOW_FRAME_MS) slow++;
    }
    // Typed-array sort is numeric, and subarray shares the preallocated buffer.
    const ordered = sorted.subarray(0, count).sort();

    return {
      fps: total > 0 ? (count / total) * 1000 : 0,
      p95Ms: ordered[Math.min(count - 1, Math.floor(count * 0.95))],
      over33Pct: (slow / count) * 100,
      frames: count,
    };
  };

  return { push, stats };
};

/** Spanish decimal comma, fixed digits; plain string ops so nothing depends on Intl. */
const formatNumber = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

type Level = 'ok' | 'warn' | 'bad';

const p95Level = (ms: number): Level => (ms <= FRAME_BUDGET_MS ? 'ok' : ms <= SLOW_FRAME_MS ? 'warn' : 'bad');
const slowLevel = (pct: number): Level => (pct < 1 ? 'ok' : pct < 5 ? 'warn' : 'bad');

/**
 * Hidden "service mode" readout, pinned to a viewport corner outside the canvas. Without
 * ?debug=perf it renders nothing and starts no timer; with it, it polls window.__avPerf,
 * which useGameLoop publishes.
 */
const PerfMeter = () => {
  const enabled = usePerfDebug();
  const [stats, setStats] = useState<PerfStats | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setStats(window.__avPerf ?? null), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside className="perf-meter" aria-label="Medidor de rendimiento">
      <div className="perf-meter-title">Modo servicio</div>
      <dl>
        <div>
          <dt>FPS</dt>
          <dd>{stats ? formatNumber(stats.fps, 0) : '—'}</dd>
        </div>
        <div data-level={stats ? p95Level(stats.p95Ms) : undefined}>
          <dt>p95</dt>
          <dd>{stats ? `${formatNumber(stats.p95Ms, 1)} ms` : '—'}</dd>
        </div>
        <div data-level={stats ? slowLevel(stats.over33Pct) : undefined}>
          <dt>&gt; 33 ms</dt>
          <dd>{stats ? `${formatNumber(stats.over33Pct, 1)} %` : '—'}</dd>
        </div>
      </dl>
      <div className="perf-meter-foot">{stats ? `${stats.frames} frames` : 'Esperando frames'}</div>
    </aside>
  );
};

export default PerfMeter;
