-- SPEC 09 — Serpentina: motor jugable en el Vault.
-- Clears invented history and refreshes the copy to match the real fruit art
-- now used for food. id/title/cover/color/position stay untouched.

delete from public.scores where game_id = 'serpentina';

update public.games
set
  best  = 0,
  plays = '0',
  short = 'Crece devorando frutas sin morder tu propia cola.',
  long  = 'Una serpiente de luz recorre la grilla devorando frutas jugosas que la hacen crecer y acelerar. Cruza los bordes del tablero sin miedo: solo tu propia cola puede detenerte.'
where id = 'serpentina';
