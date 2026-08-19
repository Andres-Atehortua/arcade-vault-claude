# PROPUESTA 08 — Buscaminas

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Buscaminas clásico; puzzle de deducción con soporte natural para marcar banderas en táctil.

## Qué es

Un grid de celdas ocultas; el jugador destapa celdas evitando las que contienen minas, usando los números revelados como pistas para deducir dónde están el resto.

## Por qué encaja

- `score` = celdas descubiertas, `lives` = 1 (game over al pisar mina), `level` = tamaño de tablero/densidad de minas.
- Control dual simple: click para destapar, long-press/click derecho para marcar bandera — buen caso de uso táctil.
- Vectorial (grid de celdas con números/banderas dibujados).

## Riesgos y dudas

- El "1 vida" es un mal encaje literal con `lives` del `GameSnapshot`; conviene decidir en la spec si se usa como contador de banderas mal puestas en vez de game-over instantáneo.

## Alternativas consideradas y por qué no

- Frente a `sokoban`: ambos son esfuerzo medio; `buscaminas` tiene mecánica de deducción más reconocible para el público general.

## Siguiente paso

`/arcade-game-spec buscaminas`
