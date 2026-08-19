# PROPUESTA 13 — Excavador

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Dig Dug; esfuerzo alto por terreno destructible, mecánica sin equivalente en el catálogo actual.

## Qué es

El jugador cava túneles bajo tierra e infla/revienta a los monstruos que lo persiguen por esos mismos túneles antes de que lo alcancen.

## Por qué encaja

- Grilla destructible pintada en canvas; enemigos que solo se mueven por túneles ya cavados.
- `score` por enemigo reventado, `lives`, `level` por profundidad alcanzada.
- Controles de 4 direcciones + botón de "inflar".

## Riesgos y dudas

- Esfuerzo alto: destrucción de terreno en tiempo real + IA de enemigos restringida a túneles cavados es la combinación más compleja de todo el lote de laberinto/plataformas.
- Slug nuevo, sin identidad reservada en catálogo.

## Alternativas consideradas y por qué no

- Frente a `gloton`/`ranaria` (ya con slug reservado y menor esfuerzo): `excavador` solo se justifica si se busca deliberadamente una mecánica de destrucción de terreno que hoy no existe.

## Siguiente paso

`/arcade-game-spec excavador`
