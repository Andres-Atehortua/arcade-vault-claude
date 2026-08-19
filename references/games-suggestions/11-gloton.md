# PROPUESTA 11 — Glotón

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Pac-Man; cierra deuda de un slug ya reservado, el candidato de mayor diversidad de catálogo (persecución con IA).

## Qué es

El jugador recorre un laberinto en grilla comiendo puntos mientras 4 fantasmas lo persiguen; una píldora especial invierte los roles por un tiempo limitado.

## Por qué encaja

- Grilla fija = loop de canvas simple; `score` = puntos comidos, `lives` = intentos, `level` = velocidad/ronda de fantasmas.
- Controles de 4 direcciones, aptos para swipe/D-pad táctil.
- El slug `gloton` ya existe en el catálogo sin motor: implementarlo cierra deuda.
- Aporta la mecánica que más falta hace hoy: persecución con IA (ni shooter, ni puzzle, ni snake).

## Riesgos y dudas

- IA de persecución de 4 enemigos simultáneos es más trabajo que cualquier otro candidato de la categoría; puede empujar el esfuerzo real por encima de "medio" si se busca fidelidad al original.

## Alternativas consideradas y por qué no

- `ranaria` (propuesta 12) también tiene slug reservado y es de menor esfuerzo — buen candidato si se prioriza velocidad de entrega sobre diversidad de mecánica.

## Siguiente paso

`/arcade-game-spec gloton`
