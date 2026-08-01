import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from './server';
import type { GameRow, ScoreRow } from './types';

const GAME_COLUMNS = 'id, title, short, long, cat, cover, color, best, plays, position';
const SCORE_COLUMNS = 'id, game_id, alias, score, created_at';

/**
 * Anon, cookie-less client for catalog reads. The client from ./server calls
 * cookies(), a Request-time API that would opt every catalog page out of static
 * rendering and make `export const revalidate = 60` inert. The catalog is public
 * and identical for everyone, so it needs no session.
 */
const createCatalogClient = () =>
  createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });

/** The whole catalog, in library order. */
export const getGames = async (): Promise<GameRow[]> => {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from('games').select(GAME_COLUMNS).order('position', { ascending: true }).returns<GameRow[]>();

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);

  return data ?? [];
};

/** A single catalog entry, or undefined when the slug does not exist. */
export const getGameById = async (id: string): Promise<GameRow | undefined> => {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from('games').select(GAME_COLUMNS).eq('id', id).maybeSingle<GameRow>();

  if (error) throw new Error(`No se pudo leer el juego ${id}: ${error.message}`);

  return data ?? undefined;
};

/**
 * Top `limit` scores of one game, best first. Score reads go through the session
 * client on purpose: a leaderboard served from a 60s-old cache would hide the
 * score the player just saved, which is the first thing they check.
 */
export const getScoresByGame = async (gameId: string, limit: number): Promise<ScoreRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scores')
    .select(SCORE_COLUMNS)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit)
    .returns<ScoreRow[]>();

  if (error) throw new Error(`No se pudieron leer los puntajes de ${gameId}: ${error.message}`);

  return data ?? [];
};

/**
 * Top `limit` scores of every game, keyed by game id. One round trip: PostgREST
 * cannot limit per group, so the whole table comes back ordered and the cut is
 * applied here.
 */
export const getAllScores = async (limit: number): Promise<Record<string, ScoreRow[]>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scores')
    .select(SCORE_COLUMNS)
    .order('score', { ascending: false })
    .overrideTypes<ScoreRow[]>();

  if (error) throw new Error(`No se pudieron leer los puntajes: ${error.message}`);

  const byGame: Record<string, ScoreRow[]> = {};
  for (const row of data ?? []) {
    const rows = (byGame[row.game_id] ??= []);
    if (rows.length < limit) rows.push(row);
  }

  return byGame;
};
