-- SPEC 08 — Rompebloques: motor jugable en el Vault.
-- Replaces the `bloque-buster` stub with the real-engine entry, same position (1).
-- Its 12 seeded scores are invented history for a stub with no engine behind it;
-- a game that will accumulate real history does not keep it, same criterion as
-- `asteroides` (SPEC 05) and `tetris` (SPEC 07).

delete from public.scores where game_id = 'bloque-buster';

update public.games
set
  id    = 'rompebloques',
  title = 'ROMPEBLOQUES',
  short = 'Rebota la pelota y destruye muros de neón.',
  long  = 'Pilota una paleta y rebota una bola de plasma para pulverizar muros de bloques cromáticos a lo largo de 5 niveles. La velocidad sube en cada uno. ¿Llegarás a limpiar el muro final?',
  cover = 'cover-rompebloques',
  best  = 0,
  plays = '0'
where id = 'bloque-buster';
