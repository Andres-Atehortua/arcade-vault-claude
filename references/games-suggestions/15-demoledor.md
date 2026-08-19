# PROPUESTA 15 — Demoledor

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Bomberman ligero; esfuerzo alto, el más ambicioso de la categoría laberinto.

## Qué es

El jugador se mueve por un laberinto de bloques destructibles colocando bombas para abrir camino y eliminar enemigos antes de que lo acorralen.

## Por qué encaja

- Grilla + explosión propagada en cruz es directo de dibujar en canvas.
- `score` por enemigo/bloque destruido, `lives` por explosión propia o contacto enemigo, `level` por cantidad de enemigos.
- Controles de 4 direcciones + botón "bomba", apto táctil.

## Riesgos y dudas

- Esfuerzo alto: temporizador de bombas, propagación de explosión, IA de enemigos y destrucción de mapa combinados son el conjunto más pesado del lote entero.

## Alternativas consideradas y por qué no

- Frente a `gloton`/`ranaria`/`barriles` (todos de menor esfuerzo): `demoledor` solo se justifica como apuesta a mediano plazo, no como siguiente juego a implementar.

## Siguiente paso

`/arcade-game-spec demoledor`
