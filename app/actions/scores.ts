'use server';

import { createAdminClient } from '../lib/supabase/admin';

export type SaveScoreResult = { ok: true; rank: number } | { ok: false; error: string };

const ALIAS_REGEX = /^[A-Z0-9_]{3,12}$/;
const MAX_SCORE = 10000000;

/**
 * Saves one finished game under a free-text alias. The alias is not an identity:
 * two people may use the same one, and every game is stored as its own row.
 *
 * The browser reports its own score, so this trusts it: the range check only
 * caps the damage. Real anti-cheat is out of scope.
 */
export const saveScore = async (gameId: string, alias: string, score: number): Promise<SaveScoreResult> => {
  const normalized = alias.trim().toUpperCase();

  if (!ALIAS_REGEX.test(normalized)) {
    return { ok: false, error: 'El alias debe tener de 3 a 12 caracteres: letras, números o guion bajo.' };
  }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: 'La puntuación no es válida.' };
  }

  const supabase = createAdminClient();

  const { data: game, error: gameError } = await supabase.from('games').select('id').eq('id', gameId).maybeSingle();

  if (gameError) return { ok: false, error: 'No se pudo verificar el juego. Inténtalo de nuevo.' };
  if (!game) return { ok: false, error: 'Ese juego no existe en el Vault.' };

  const { error: insertError } = await supabase.from('scores').insert({ game_id: gameId, alias: normalized, score });

  if (insertError) return { ok: false, error: 'No se pudo guardar la puntuación. Inténtalo de nuevo.' };

  // Rank of the row just saved: how many scores beat it, plus one. Ties keep the
  // better position for whoever got there first.
  const { count, error: rankError } = await supabase
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .gt('score', score);

  if (rankError) return { ok: false, error: 'La puntuación se guardó, pero no se pudo calcular el puesto.' };

  return { ok: true, rank: (count ?? 0) + 1 };
};
