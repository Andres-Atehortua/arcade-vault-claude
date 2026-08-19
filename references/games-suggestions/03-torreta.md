# PROPUESTA 03 — Torreta

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Defensor 360° estilo Robotron/Space Zap; buen tercer shooter por su control distinto (rotación, no desplazamiento).

## Qué es

Una torreta fija en el centro del canvas rota y dispara contra enemigos que se acercan desde todos los bordes; el jugador defiende un núcleo central de oleadas cada vez más numerosas.

## Por qué encaja

- `score` por enemigo eliminado, `lives` = impactos al núcleo, `level` = oleada con más enemigos y más velocidad.
- Vectorial simple (torreta + enemigos geométricos), sin assets.
- Control de un solo eje (rotación + disparo), distinto de `invasores` (horizontal) y `asteroides` (thrust libre) — aporta variedad real de controles dentro de la categoría shooter.

## Riesgos y dudas

- Requiere lógica de spawn desde los 4 bordes y cálculo de ángulo de disparo; algo más de esfuerzo que `galería`.
- Slug nuevo, sin identidad reservada en catálogo.

## Alternativas consideradas y por qué no

- Frente a `misiles` (propuesta 04): `torreta` es ataque directo, `misiles` es intercepción — ambos válidos, se listan por separado.

## Siguiente paso

`/arcade-game-spec torreta`
