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
  /** CSS class of the cover gradient, e.g. "cover-bricks" */
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
