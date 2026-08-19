# PROPUESTA 04 — Misiles

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Missile Command; único candidato de "defender e interceptar" en vez de "disparar hacia adelante".

## Qué es

Misiles enemigos caen desde arriba hacia bases en la parte inferior del canvas; el jugador hace click en el punto de intercepción para detonar antimisiles antes de que lleguen.

## Por qué encaja

- `score` por intercepción, `lives` = bases sobrevivientes, `level` = oleada más densa/rápida.
- Vectorial (líneas de trayectoria + explosiones circulares), sin sprites.
- Loop de juego distinto a todos los shooters propuestos: target-and-defend en vez de shoot-forward — aporta diversidad real.

## Riesgos y dudas

- Requiere cálculo de trayectorias y radios de explosión superpuestos; esfuerzo medio.
- Slug nuevo, sin identidad reservada.

## Alternativas consideradas y por qué no

- `torreta` (propuesta 03) también es defensivo pero de ataque directo; `misiles` es más táctico (clic anticipado) — se mantienen ambos como opciones distintas.

## Siguiente paso

`/arcade-game-spec misiles`
