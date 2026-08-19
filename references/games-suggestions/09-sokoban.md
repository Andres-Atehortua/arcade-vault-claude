# PROPUESTA 09 — Sokoban

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Empujar cajas a casillas objetivo; único puzzle del lote con progresión por niveles diseñados a mano.

## Qué es

El jugador empuja cajas dentro de un laberinto de celdas hasta colocarlas todas sobre las casillas objetivo, con movimientos limitados por nivel.

## Por qué encaja

- Motor de niveles tipo `levels.ts` (mismo patrón que `serpentina`), controles de 4 direcciones simples.
- `score` = movimientos restantes o su inverso, `level` = número de mapa, `lives` no es crítico (se puede reiniciar el nivel actual).

## Riesgos y dudas

- Requiere diseñar varios mapas de nivel a mano (contenido, no solo código) — más trabajo de autoría que los demás puzzles.

## Alternativas consideradas y por qué no

- Frente a `2048`/`buscaminas` (generados proceduralmente): `sokoban` pide diseño de niveles curado, lo que sube el costo real más allá del "medio" técnico.

## Siguiente paso

`/arcade-game-spec sokoban`
