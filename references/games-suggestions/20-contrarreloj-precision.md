# PROPUESTA 20 — Contrarreloj de Precisión

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Secuencia tipo Simon con tiempo límite; el candidato más discutible de encaje con la categoría reflejos/duelo.

## Qué es

Se muestra una secuencia de zonas/colores que crece cada ronda; el jugador debe repetirla antes de que expire el tiempo. Cada ronda completa suma puntaje.

## Por qué encaja

- `score` = rondas completadas, `level` = longitud de secuencia, `lives` = errores permitidos.
- Puramente vectorial (cuadrantes de color de la paleta neón), controles de 4 zonas aptos para tap.

## Riesgos y dudas

- Se acerca más a un juego de memoria (categoría puzzle, ver propuesta 06) que a reflejos/tiempo puro; el encaje temático con "deportes/reflejos" es el más discutible del lote.

## Alternativas consideradas y por qué no

- Frente a `reflejo-neón` (propuesta 17): esa es reacción pura sin memoria de secuencia; `contrarreloj-precisión` combina memoria + tiempo, lo que la hace redundante en parte con `memoria` (propuesta 06) si ambas entran al catálogo.

## Siguiente paso

`/arcade-game-spec contrarreloj-precision`
