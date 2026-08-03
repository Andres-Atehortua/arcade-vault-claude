---
name: arcade-game-spec
description: Escribe la spec de implementación de un juego nuevo para Arcade Vault — motor en canvas, reproductor React, cover CSS, fila de catálogo en Supabase y leaderboard con guardado de puntaje. Úsala siempre que se hable de añadir, portar, meter o crear un juego en este proyecto (Tetris, Arkanoid, Pong, uno de references/started-games/, o uno inventado desde cero), aunque no se mencione la palabra "spec" ni "leaderboard". Para features que no son un juego (páginas, auth, filtros, formularios), usa /spec.
argument-hint: 'nombre del juego, o carpeta de references/started-games/'
---

# /arcade-game-spec — Spec de un juego nuevo del Vault

Produces **un archivo**: `specs/NN-<slug>.md` en estado `Draft`. No escribes código aquí;
de eso se encarga `/spec-impl` después.

## Por qué esta skill existe aparte de /spec

`/spec` es un entrevistador genérico: pregunta por persistencia, integración y modelo de
datos porque no sabe nada del proyecto. Para un juego del Vault esas respuestas ya están
cerradas — SPEC 05 definió el contrato del motor y del reproductor, SPEC 06 dejó el
catálogo y el leaderboard funcionando para cualquier `gameId`. Repetir esas preguntas
haría perder el tiempo al usuario y, peor, invitaría a improvisar una arquitectura
distinta para el segundo juego.

Así que aquí el trabajo es el inverso: llegas **sabiendo** la arquitectura y solo preguntas
lo que de verdad cambia entre un juego y otro (mecánica, controles, qué muestra el HUD,
identidad de catálogo). El contrato completo está en `references/architecture.md`.

## Fase 1 — Reconocer el terreno

Antes de preguntar nada, junta el contexto. Llegar a la Fase 2 con datos concretos es lo
que permite que las preguntas sean pocas y buenas:

1. Lee `references/architecture.md` de esta skill. Es el contrato que la spec debe
   respetar y la fuente de las recomendaciones que darás.
2. Lee `CLAUDE.md` y `AGENTS.md` del proyecto. Dos cosas cuentan: la convención de arrow
   functions (con su excepción documentada para las clases del motor) y la obligación de
   consultar `node_modules/next/dist/docs/01-app/` antes de escribir código de Next.
3. `ls specs/` para saber el número siguiente. Hojea `specs/05-asteroides-implementation.md`
   y `specs/06-leaderboard-y-catalogo-supabase.md`: son el tono, el formato y la densidad
   que tu spec debe igualar.
4. `ls supabase/migrations/` para el número de la migración nueva, y mira la última fila
   insertada en `0002_seed_games.sql` para conocer el `position` más alto ocupado.
5. Si el juego tiene carpeta en `references/started-games/`, léela entera: `game.js`
   (la lógica a portar), `index.html` (tamaño del canvas, orden de scripts) y `CLAUDE.md`
   (el original documenta ahí su estado, sus assets y su arquitectura). Anota **assets
   externos** — spritesheets, `.mp3`, `levels.js`, `style.css` — porque son justo el punto
   donde el patrón de Asteroides, motor autocontenido en un solo archivo, no llega tal
   cual y hace falta una decisión.

Si el juego no tiene carpeta de referencia, no pasa nada: la spec describirá un motor
escrito desde cero contra el mismo contrato. Dilo explícitamente en el header de la spec.

## Fase 2 — Preguntar solo lo que sigue abierto

Un **único bloque** de 4 a 6 preguntas numeradas, y esperas la respuesta. No la escalera de
bloques de `/spec`.

Cuando ofrezcas opciones, da 2–3 y marca tu recomendación con el porqué. El usuario invocó
esto para decidir rápido, no para redactar él la spec.

Cubre estos frentes:

1. **Identidad de catálogo.** `id` (slug en español, coherente con `bloque-buster`,
   `caida`, `serpentina`), `title` en mayúsculas, `cat` (`ARCADE` / `PUZZLE` / `SHOOTER` /
   `VERSUS`), `color` de acento (`cyan` / `magenta` / `yellow` / `green`). Propón tú los
   textos `short` y `long` en el tono de las entradas existentes en vez de pedírselos.
   Ojo: hay 9 juegos ya en el catálogo — comprueba si el slug que propones choca con uno
   existente (`rocas` y `asteroides` conviven como juegos distintos por decisión previa).
2. **Mecánica y fin de partida.** ¿Hay vidas? ¿Niveles? ¿Se puede *ganar* o solo perder?
   Esto define directamente los campos de `GameSnapshot` y, por tanto, qué muestra el HUD
   externo. Un Tetris no tiene vidas; un Arkanoid sí y además tiene condición de victoria,
   que el motor de Asteroides no contempla.
3. **Controles.** Teclas de escritorio y su equivalente táctil. El layout de botones
   táctiles de Asteroides (rotar/rotar/propulsar + disparo) casi nunca sirve tal cual.
4. **Assets.** Si el original usa sprites o sonidos: ¿se portan, se sustituyen por dibujo
   vectorial en la paleta neón (recomendado, es lo que hizo SPEC 05), o quedan fuera de
   alcance? Portar binarios implica decidir dónde viven y cómo se cargan.
5. **Fuera de alcance.** Qué se deja explícitamente para una spec futura. Esta pregunta
   evita que la spec crezca sin límite y llena la sección más útil del documento.

Deja de preguntar cuando puedas responder sin suponer: qué archivos aparecen o cambian,
cuál es el primer paso ejecutable y cuál el último, y cómo se verifica que está terminado.

## Fase 3 — Escribir la spec sección a sección

No generes el documento de una sentada. Muestra cada sección, pregunta si queda así o se
ajusta, y solo entonces pasa a la siguiente. El orden es el del repo:

1. **Header** — `> **Estado:** Draft`, `> **Depende de:**`, `> **Fecha:**`,
   `> **Objetivo:**` en una sola frase. Toda spec de juego depende de SPEC 05 (contrato
   del motor) y SPEC 06 (catálogo y leaderboard). Si el objetivo no cabe en una frase, el
   juego es demasiado grande: propón partirlo.
2. **Alcance** — "Dentro" y "Fuera de alcance (para specs futuras)", ambos explícitos.
3. **Modelo de datos** — la fila de `games`, la interfaz `GameSnapshot` concreta de este
   juego, y las entidades del motor. Nombres reales de archivo, nunca "el módulo del
   motor".
4. **Plan de implementación** — pasos numerados, cada uno con su verificación, cada uno
   dejando el repo compilando. Parte de `references/spec-skeleton.md`, que ya trae los
   pasos canónicos; instancia los marcadores y añade o quita según el juego.
5. **Criterios de aceptación** — checklist booleano y comprobable. `spec-skeleton.md` trae
   los recurrentes; los propios de la mecánica los escribes tú.
6. **Decisiones** — qué se eligió y qué se descartó, con el porqué en una línea. Es la
   sección con más valor a los seis meses. Toda desviación del contrato de
   `architecture.md` va aquí, argumentada.
7. **Riesgos** — tabla riesgo/mitigación. `architecture.md` documenta las trampas ya
   conocidas del patrón; incluye las que apliquen y añade las propias del juego.

## Fase 4 — Guardar

1. Número secuencial según `specs/`; slug corto derivado del objetivo.
2. Confirma el nombre de archivo con el usuario antes de escribirlo.
3. Escribe `specs/NN-<slug>.md` con las secciones aprobadas. Etiquetas del header en
   español con el valor de estado en inglés (`> **Estado:** Draft`): es la convención real
   del repo y `/spec-impl` la reconoce.
4. Confirma la ruta, recuerda que el estado lo cambia el usuario a `Approved` a mano
   después de releer, y que el siguiente paso es `/spec-impl NN-<slug>`.
5. **Para ahí.** No propongas implementar ni empieces a escribir código.

## Reglas duras

- **Nunca escribas código en esta skill.** Solo el `.md` final. Los fragmentos de tipos o
  SQL dentro de la spec son ilustrativos y van cortos.
- **Nunca marques la spec como `Approved`.** Eso lo hace el humano tras releerla.
- **Nunca inventes una arquitectura distinta** a la de `references/architecture.md` sin
  registrarla como decisión explícita en la sección Decisiones. El valor de esta skill es
  que el juego número 5 se integre igual que el número 2.
- **Responde en el idioma del prompt inicial.** Las specs del repo están en español; el
  código y los comentarios dentro de ellas, en inglés.
- Si el usuario pide implementar sin spec, recuérdale una vez que el repo es spec-driven y
  que `/spec-impl` es el camino. Si insiste, es su decisión.
