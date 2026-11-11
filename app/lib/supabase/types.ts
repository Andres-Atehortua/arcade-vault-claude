export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
export type GameAccent = 'cyan' | 'magenta' | 'yellow' | 'green';

/** A row of public.games. Hand-written: kept in sync with supabase/migrations. */
export interface GameRow {
  /** URL slug: /juegos/bloque-buster */
  id: string;
  /** Uppercase, as displayed */
  title: string;
  /** One-liner for the library card */
  short: string;
  /** Paragraph for the detail page */
  long: string;
  cat: GameCategory;
  /** CSS class of the cover gradient, e.g. "cover-rompebloques" */
  cover: string;
  /** Accent of the JUGAR button */
  color: GameAccent;
  /** Global best score */
  best: number;
  /** Pre-formatted, e.g. "12.4K" */
  plays: string;
  /** Explicit library order, 1..N */
  position: number;
}

/** A row of public.scores. */
export interface ScoreRow {
  id: string;
  game_id: string;
  /** Player alias, e.g. "PX_KAI" */
  alias: string;
  score: number;
  /** ISO 8601 desde Postgres; la UI la formatea a DD/MM/YYYY */
  created_at: string;
}

export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;

/** A row of public.profiles: one per auth user. */
export interface ProfileRow {
  /** Same id as auth.users */
  id: string;
  /** Uppercase, e.g. "PX_KAI". Null for OAuth accounts that have not picked one yet. */
  username: string | null;
  created_at: string;
}

/** A row of public.rate_limits (spec 13). Only reachable with the service role. */
export interface RateLimitRow {
  /** Client IP, or 'unknown' when it cannot be determined */
  key: string;
  /** One of RateLimitAction (app/lib/security/rate-limit.ts) */
  action: string;
  /** ISO 8601: start of the current fixed window */
  window_start: string;
  /** Hits within the current window */
  count: number;
}
