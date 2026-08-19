# PROPUESTA 17 — Reflejo Neón

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Juego de reacción pura ("toca cuando aparezca"); el más simple de implementar entre los candidatos sin slug reservado.

## Qué es

Círculos/objetivos aparecen en posiciones aleatorias del canvas en momentos impredecibles; el jugador debe tocarlos/clickearlos antes de que expiren, con una ventana de tiempo que se acorta con cada acierto.

## Por qué encaja

- `score` sube por acierto, `level` = ventana de reacción cada vez más corta, `lives` se pierden por objetivo expirado o clic en falso.
- Solo formas vectoriales y un temporizador; controles de un solo botón (tap/click), ideal para táctil.

## Riesgos y dudas

- Mecánica muy cercana a `contrarreloj-precisión` (propuesta 20) en espíritu (reacción/timing); conviene diferenciarlos bien en la spec si se implementan ambos.

## Alternativas consideradas y por qué no

- `duelo-pixel` (propuesta 16) tiene prioridad por slug reservado; `reflejo-neón` es buen segundo por su simplicidad y mecánica distinta a todo lo existente.

## Siguiente paso

`/arcade-game-spec reflejo-neon`
