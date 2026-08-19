# PROPUESTA 19 — Duelo de Esgrima

> **Estado:** Propuesto
> **Fecha:** 2026-08-19
> **Veredicto:** Timing de parry/ataque contra IA; variante de "duelo" con mecánica de ritmo que hoy no existe en catálogo.

## Qué es

El jugador enfrenta a un rival controlado por IA en una barra de duelo; debe pulsar en la ventana correcta para atacar o parar el ataque rival. Cada acierto limpio suma puntaje y el ritmo del rival se acelera.

## Por qué encaja

- `score` sube por golpe limpio, `level` = velocidad/agresividad de la IA, `lives` = golpes recibidos permitidos.
- Se dibuja con formas simples (barras, indicadores de timing), un solo eje de input (una o dos teclas).
- Aporta mecánica de ritmo/timing distinta de `duelo-pixel` (que es reflejos de posicionamiento, no timing de pulsación).

## Riesgos y dudas

- La lógica de IA con ventanas de timing y feedback visual pide más cuidado que un contador simple; esfuerzo medio, no trivial pese al control reducido.

## Alternativas consideradas y por qué no

- Frente a `duelo-pixel` (mismo espíritu de "duelo" pero mecánica de posicionamiento): `duelo-esgrima` es el candidato si se busca variar el tipo de duelo, no repetirlo.

## Siguiente paso

`/arcade-game-spec duelo-esgrima`
