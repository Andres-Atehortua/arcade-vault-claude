# PROPUESTA 12 — Ranaria

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Frogger; cierra deuda de un slug ya reservado con el menor esfuerzo de su categoría.

## Qué es

El jugador cruza carriles de tráfico y troncos flotantes saltando celda a celda, buscando llegar a los nenúfares antes de que se acabe el tiempo.

## Por qué encaja

- Movimiento por celdas/carriles, sin física compleja; colisiones AABB simples, sin IA.
- `score` por cruce, `lives` por atropello, `level` = velocidad de carriles.
- Un solo control ("saltar en dirección") sirve bien en táctil.
- El slug `ranaria` ya existe en el catálogo sin motor: implementarlo cierra deuda.

## Riesgos y dudas

- Mapear "nivel" a dificultad ascendente necesita definirse con cuidado en la spec (¿más carriles? ¿más velocidad de tráfico? ¿ambos?) — no es tan directo como en otros candidatos.

## Alternativas consideradas y por qué no

- `gloton` (propuesta 11) también tiene slug reservado pero mayor esfuerzo por la IA de fantasmas; `ranaria` es la opción más rápida de entregar dentro de esta categoría.

## Siguiente paso

`/arcade-game-spec ranaria`
