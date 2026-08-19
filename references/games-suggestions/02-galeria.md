# PROPUESTA 02 — Galería

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Galería de tiro tipo Duck Hunt, sin nave que mover; el shooter de menor esfuerzo del lote.

## Qué es

Blancos aparecen y desaparecen en posiciones aleatorias del canvas; el jugador apunta y dispara directamente con click/tap sobre el blanco, sin mover ningún personaje.

## Por qué encaja

- `score` por blanco acertado, `lives` = blancos fallados/expirados, `level` = velocidad de aparición.
- Sin movimiento de jugador: el control es solo "apuntar y disparar" (click/tap), el más simple de todo el lote — ideal táctil.
- Vectorial (círculos/formas geométricas), sin sprites.
- Mecánica distinta de todo lo existente (nadie más en el catálogo carece de movimiento de jugador).

## Riesgos y dudas

- Es un slug nuevo, no hay identidad de catálogo reservada — abre fila nueva en vez de cerrar deuda.
- Puede sentirse ligero en profundidad de juego frente a los demás shooters.

## Alternativas consideradas y por qué no

- `invasores` (propuesta 01) tiene prioridad por ya tener slug reservado; `galería` es buen segundo por su bajo esfuerzo.

## Siguiente paso

`/arcade-game-spec galeria`
