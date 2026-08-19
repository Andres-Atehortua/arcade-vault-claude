# PROPUESTA 01 — Invasores

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Space Invaders clásico; cierra deuda de un slug ya reservado en catálogo con esfuerzo medio.

## Qué es

Una formación de aliens desciende en bloque de lado a lado del canvas mientras el jugador mueve un cañón horizontal en la parte inferior y dispara verticalmente para eliminarlos antes de que lleguen abajo.

## Por qué encaja

- `score` sube por alien eliminado, `lives` son los impactos recibidos, `level` es la oleada (formación más rápida y más densa).
- Vectorial puro (rectángulos/naves simples en la paleta neón), sin assets binarios.
- Controles mínimos: izquierda/derecha/disparo — perfecto para 2-3 botones táctiles.
- El slug `invasores` ya existe en el catálogo (`0002_seed_games.sql`) sin motor: implementarlo cierra deuda en vez de abrir catálogo nuevo.

## Riesgos y dudas

- Ya existe `asteroides` como shooter; hay que dejar clara la diferencia de mecánica (formación fija que desciende vs. campo abierto con física libre) para que no se lea como repetición.

## Alternativas consideradas y por qué no

- `galería`, `torreta`, `misiles`, `escuadrón` — ver propuestas 02-05; todos son slugs nuevos sin identidad reservada, mientras `invasores` ya la tiene.

## Siguiente paso

`/arcade-game-spec invasores`
