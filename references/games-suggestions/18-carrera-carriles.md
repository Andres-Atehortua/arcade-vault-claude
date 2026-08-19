# PROPUESTA 18 — Carrera de Carriles

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Endless runner lateral tipo "esquiva"; primer candidato de "carreras" en el catálogo.

## Qué es

Un vehículo/nave se mueve entre 3-4 carriles verticales esquivando obstáculos que bajan a velocidad creciente; sobrevivir suma puntaje por distancia recorrida.

## Por qué encaja

- `score` = distancia recorrida, `level` = velocidad/densidad de obstáculos, `lives` = choques permitidos.
- Todo vectorial (rectángulos/triángulos), controles de 2-4 direcciones (izquierda/derecha o cambio de carril).
- No hay nada de "carreras"/endless runner en el catálogo hoy: aporta un giro real.

## Riesgos y dudas

- Requiere generación procedural de obstáculos con dificultad progresiva bien ajustada; esfuerzo medio, más ajuste fino que los otros candidatos de la categoría.

## Alternativas consideradas y por qué no

- Frente a `duelo-pixel`/`reflejo-neón` (menor esfuerzo): `carrera-carriles` se justifica si se prioriza diversidad de género sobre velocidad de entrega.

## Siguiente paso

`/arcade-game-spec carrera-carriles`
