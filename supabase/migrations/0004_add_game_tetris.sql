-- SPEC 07 — Tetris: motor jugable en el Vault.
-- New catalog entry for the game that ships with a real engine.
-- `best = 0` / `plays = '0'`: same criterion as `asteroides` in SPEC 05 — a game
-- that will accumulate real history does not get an invented past.
-- The `caida` stub and its seeded scores are left untouched on purpose.

insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas y limpia líneas sin dejar huecos.',
  'Ocho piezas caen desde la oscuridad, incluida una tuerca hueca que no encaja en ningún hueco limpio. Rótalas, deslízalas y complétales la línea antes de que la torre alcance el techo. Cada 10 líneas el descenso se acelera y no vuelve atrás.',
  'PUZZLE',
  'cover-tetris',
  'green',
  0,
  '0',
  10
);
