# PROPUESTA 06 — Memoria

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Juego de parejas contrarreloj; el puzzle de menor esfuerzo del lote, control solo de click/tap.

## Qué es

Un grid de cartas boca abajo; el jugador destapa de a dos buscando parejas antes de agotar el tiempo o los intentos permitidos.

## Por qué encaja

- `score` = parejas encontradas con bonus por rapidez, `lives`/intentos restantes, `level` = tamaño de grid.
- Control único (click/tap), el más simple de todo el lote propuesto — ideal táctil sin ambigüedad.
- Vectorial (cartas dibujadas con formas y color, sin sprites).

## Riesgos y dudas

- Mecánica de "memoria pura" es menos vistosa en movimiento que el resto del catálogo (todo lo demás tiene animación continua); vale la pena cuidar el feedback visual al voltear cartas.

## Alternativas consideradas y por qué no

- Frente a `2048`, `buscaminas`, `sokoban`, `conecta-3`: `memoria` es el más simple de implementar pero el de menor profundidad de juego a largo plazo.

## Siguiente paso

`/arcade-game-spec memoria`
