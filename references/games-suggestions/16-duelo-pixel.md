# PROPUESTA 16 — Duelo Pixel

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Pong contra la máquina; cierra deuda de un slug ya reservado con el menor esfuerzo de todo el lote.

## Qué es

Una pelota rebota entre dos paletas: la del jugador y la de una IA simple. Cada rebote/punto suma puntaje y la velocidad de la pelota sube con el nivel.

## Por qué encaja

- `score` = puntos anotados, `level` = velocidad de la pelota, `lives` = vidas antes de perder (o partidas al mejor de N).
- Geometría pura (líneas y rectángulos), sin sprites.
- El slug `duelo-pixel` ya existe en el catálogo sin motor: implementarlo cierra deuda directamente.

## Riesgos y dudas

- Es el juego más simple del lote entero; poca profundidad de juego a largo plazo, aunque eso no es un defecto para un catálogo que busca variedad de esfuerzos.

## Alternativas consideradas y por qué no

- `reflejo-neón` (propuesta 17) es igual de bajo esfuerzo pero sin slug reservado; `duelo-pixel` tiene prioridad por cerrar deuda de catálogo.

## Siguiente paso

`/arcade-game-spec duelo-pixel`
