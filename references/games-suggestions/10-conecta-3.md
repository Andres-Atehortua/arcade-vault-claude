# PROPUESTA 10 — Conecta-3

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Match-3 tipo Bejeweled; el puzzle de mayor esfuerzo por la lógica de cascada.

## Qué es

El jugador intercambia fichas adyacentes en una grilla de colores para alinear 3 o más del mismo color, generando combos que se encadenan al reponerse fichas nuevas desde arriba.

## Por qué encaja

- `score` = combos encadenados, `level` = umbral de puntaje, `lives` = movimientos restantes.
- Control de swipe/tap-tap, apto táctil.
- Vectorial (fichas de color sólido en la paleta neón).

## Riesgos y dudas

- Esfuerzo medio-alto: detección de patrones + lógica de cascada/reposición de fichas es notablemente más compleja que el resto de puzzles propuestos.

## Alternativas consideradas y por qué no

- Frente a `memoria`/`2048`/`buscaminas`/`sokoban`: `conecta-3` es el más vistoso pero el que menos encaja con "cabe en una frase" si se incluye la lógica de cascada completa.

## Siguiente paso

`/arcade-game-spec conecta-3`
