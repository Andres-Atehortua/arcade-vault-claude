# PROPUESTA 14 — Barriles

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Donkey Kong; el plataformas puro del lote, física de salto simple.

## Qué es

El jugador trepa plataformas y escaleras esquivando barriles rodantes hasta llegar arriba del todo de la pantalla.

## Por qué encaja

- Plataformas fijas + gravedad simple encajan bien en el motor canvas existente.
- `score` por altura/tiempo, `lives` por impacto, `level` por pantalla.
- Controles reducibles a mover + saltar, cómodo en táctil con un botón único de salto.

## Riesgos y dudas

- Física de salto + colisión con barriles en cascada es más ajuste fino que los candidatos de grilla (`gloton`, `ranaria`); esfuerzo medio, no bajo.
- Slug nuevo, sin identidad reservada.

## Alternativas consideradas y por qué no

- Único plataformas "puro" del lote (con salto y gravedad); si se quiere diversificar más allá de mecánicas de grilla, es el candidato natural.

## Siguiente paso

`/arcade-game-spec barriles`
