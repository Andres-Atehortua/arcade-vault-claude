# PROPUESTA 05 — Escuadrón

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Scroller vertical tipo 1942; el shooter más ambicioso del lote, esfuerzo alto.

## Qué es

Una nave se mueve libremente en dos ejes esquivando balas enemigas mientras dispara hacia arriba, con un fondo de scroll continuo que da sensación de avance constante.

## Por qué encaja

- `score` por enemigo eliminado, `lives` = colisiones, `level` = velocidad de scroll y densidad de patrones enemigos.
- Vectorial, sin sprites nuevos.
- Movimiento libre en 2 ejes lo distingue de `invasores` (horizontal) y de `torreta` (rotación fija).

## Riesgos y dudas

- Esfuerzo alto: patrones de enemigos coordinados + scroll de fondo + colisión de balas suman bastante más que los otros shooters.
- Puede no caber "en una frase" si no se acota bien el alcance de patrones enemigos.

## Alternativas consideradas y por qué no

- Frente a `invasores`, `galería`, `torreta`, `misiles`: todos tienen menor esfuerzo; `escuadrón` solo se justifica si se busca deliberadamente el shooter más vistoso, no el más rápido de entregar.

## Siguiente paso

`/arcade-game-spec escuadron`
