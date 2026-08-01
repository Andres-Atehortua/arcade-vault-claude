# SPEC 05 — Asteroides: motor jugable

> **Estado:** Approved
> **Depende de:** SPEC 01 — MVP visual: cinco pantallas del portal
> **Fecha:** 2026-08-01
> **Objetivo:** Añadir "Asteroides" como juego nuevo de la biblioteca (`app/data/games.ts`), portar el motor de `references/started-games/02-asteroids/game.js` a `/juegos/asteroides/jugar` con HUD sincronizado en vivo, paleta neon del sitio, controles de teclado y táctiles, y botones PAUSA/FIN funcionales.

## Alcance

**Dentro:**

- Nueva entrada en `app/data/games.ts`: `id: 'asteroides'`, `title: 'ASTEROIDES'`, `cat: 'SHOOTER'`, `cover: 'cover-asteroides'`, `color: 'cyan'`, con `short`/`long`/`best`/`plays` redactados a mano siguiendo el tono y formato de las entradas existentes. No se toca la entrada `rocas`.
- Nueva clase CSS `.cover-asteroides` en `app/globals.css`, con la misma técnica (gradiente + pseudo-elementos) que los covers existentes (`cover-rocas`, `cover-invaders`, etc.), pero visualmente distinta de `cover-rocas`.
- Motor del juego portado a `app/lib/games/asteroides/engine.ts`: las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` del original, tipadas en TypeScript, con la lógica de `update`/`draw`/colisiones/split/power-up de disparo triple intacta. **Excepción documentada** a la convención "siempre arrow functions" del CLAUDE.md: estas son entidades internas del motor, no componentes React ni helpers de Next.js.
- Paleta del motor adaptada a los acentos neon del sitio (`var(--cyan)` nave/balas, blanco tenue con glow para asteroides, `var(--magenta)`/`var(--yellow)` en partículas y power-up) en vez del blanco/negro puro del original.
- El HUD dibujado dentro del canvas original (SCORE, NIVEL, iconos de vida) se elimina; el canvas solo dibuja la arena de juego y el overlay de GAME OVER/PAUSA.
- Client Component `app/lib/games/asteroides/player.tsx`: monta el `<canvas>`, corre el loop (`requestAnimationFrame`), captura teclado (flechas + espacio) y controles táctiles, y sincroniza `score`/`lives`/`level`/estado con el HUD externo vía `useState`, actualizado solo cuando esos valores cambian (no cada frame).
- Controles táctiles: D-pad con dos botones de rotación + botón de propulsar abajo-izquierda, botón grande de disparo abajo-derecha. Visibles solo en pantallas táctiles/estrechas (`pointer: coarse` o breakpoint móvil), ocultos en escritorio.
- `app/juegos/[id]/jugar/page.tsx` (Server Component) ramifica: si `id === 'asteroides'`, renderiza `<AsteroidesPlayer game={game} />`; para el resto de ids, conserva exactamente la pantalla estática "SIN CARTUCHO" actual.
- Botones `PAUSA` y `FIN` del `player-hud`, habilitados solo para `asteroides`: `PAUSA` detiene/reanuda el loop y muestra "PAUSADO" en el canvas; `FIN` fuerza game-over de inmediato con el puntaje actual.
- Overlay de GAME OVER dentro del canvas (fiel al original): puntaje final + "ESPACIO / TOCA PARA REINICIAR"; reiniciar vuelve a `initGame()` sin salir de la página ni perder el montaje del componente.
- Auto-inicio: la partida arranca sola al entrar a `/juegos/asteroides/jugar`, sin pantalla previa de título.
- Verificación manual con servidor de desarrollo (teclado en escritorio, emulación táctil en DevTools/Playwright) contra los criterios de aceptación; sin suite de tests versionada, igual que specs anteriores.

**Fuera de alcance (para specs futuras):**

- Persistencia real del puntaje (Supabase o `localStorage`). El puntaje vive solo en memoria durante la partida; el leaderboard de `/juegos/asteroides` sigue usando `seededScores` (ficticio), sin mezclarse con partidas reales.
- Sonido/efectos de audio: el original no los tiene y no se añaden aquí.
- Cualquier cambio a la entrada `rocas` o a su `/juegos/rocas/jugar` estático.
- Una arquitectura genérica de "motor enchufable" para que otros juegos reutilicen este patrón. Se revisita cuando exista un segundo caso real.
- Login o identificación real del jugador (el HUD sigue mostrando `INVITADO`).
- Ajustes al nav, la landing o la biblioteca más allá de que la nueva tarjeta aparezca automáticamente por estar en `GAMES`.
- Suite de tests automatizados (Playwright versionado, unit tests del motor).

## Modelo de datos

### `app/data/games.ts`

Una entrada nueva en el array `GAMES` (el tipo `Game` ya existe, no cambia):

```ts
{
  id: 'asteroides',
  title: 'ASTEROIDES',
  short: 'Pulveriza rocas espaciales en gravedad cero.',
  long: 'Pilota una nave triangular a la deriva en el vacío. Dispara y rota para partir asteroides en fragmentos cada vez más pequeños, recoge el power-up de disparo triple y sobrevive tanto como puedas.',
  cat: 'SHOOTER',
  cover: 'cover-asteroides',
  color: 'cyan',
  best: 0,        // sin partidas reales todavía; ficticio como el resto
  plays: '0',
}
```

Convención: `best`/`plays` arrancan en `0` en vez de un número ficticio inventado, porque a diferencia de los demás juegos éste sí va a tener un motor real — inventarle historia falsa sería más confuso que sincero. Se documenta como decisión.

### `app/lib/games/asteroides/engine.ts`

Motor framework-agnostic, sin imports de React. Puerto directo de `game.js`, tipado:

```ts
export type EntitySize = 1 | 2 | 3; // pequeño, mediano, grande
export type GamePhase = 'playing' | 'paused' | 'dead' | 'gameover';

export interface GameSnapshot {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  tripleShotActive: boolean; // ship.tripleShot > 0, para el indicador del HUD
}

// Clases internas (no exportadas o exportadas solo para el player): Bullet, Asteroid, Ship, Particle, PowerUp — mismos campos que el original.

export class AsteroidsGame {
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number);
  update(dt: number): void;
  draw(): void;
  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean): void;
  pause(): void;
  resume(): void;
  end(): void; // fuerza game-over (botón FIN)
  restart(): void;
  getSnapshot(): GameSnapshot;
}
```

`AsteroidsGame` encapsula lo que en el original eran globals sueltos (`ship`, `bullets`, `asteroids`, `score`, `state`, etc.) como propiedades de instancia, para que el Client Component pueda crear/destruir una instancia por montaje sin variables de módulo compartidas.

### `app/lib/games/asteroides/player.tsx`

Client Component. Estado local:

```ts
const [snapshot, setSnapshot] = useState<GameSnapshot>({ score: 0, lives: 3, level: 1, phase: 'playing', tripleShotActive: false });
```

`snapshot` se actualiza desde el loop solo cuando `getSnapshot()` difiere del último valor (comparación superficial de sus campos primitivos), para no forzar un re-render en cada frame.

### Lo que **no** es un dato nuevo

Los controles táctiles (D-pad, botón de disparo) no tienen modelo de datos: son botones que escriben directamente en el mismo objeto `keys`/`justPressed` que ya consume `handleInput`, simulando teclas.

## Plan de implementación

0. Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` (Next 16.2.12) sobre la frontera Server/Client Component y uso de `'use client'`, para el patrón del paso 4. Seguir esos documentos por encima de cualquier patrón previo.

1. **Entrada en la biblioteca.** Añadir el objeto `asteroides` a `GAMES` en `app/data/games.ts` (ver Modelo de datos). Verificación: `/juegos/asteroides` renderiza la ficha con `npx tsc --noEmit` sin errores; `/biblioteca` muestra la novena tarjeta.

2. **Cover.** Añadir `.cover-asteroides` y su pseudo-elemento a `app/globals.css`, siguiendo la técnica de los covers existentes (gradiente + `radial-gradient` decorativo), visualmente distinta de `.cover-rocas`. Verificación: la tarjeta de "Asteroides" en `/biblioteca` se ve con un cover propio.

3. **Motor.** Crear `app/lib/games/asteroides/engine.ts`: portar `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y la clase `AsteroidsGame` desde `references/started-games/02-asteroids/game.js`, tipado en TypeScript, sin el HUD dibujado en canvas (se elimina `drawHUD`/`drawLifeIcon`), con la paleta recoloreada a los acentos neon del sitio y `getSnapshot()`/`pause()`/`resume()`/`end()`/`restart()` como API pública. Verificación: `npx tsc --noEmit` pasa; el archivo no importa nada de `react` ni `next`.

4. **Client Component del reproductor.** Crear `app/lib/games/asteroides/player.tsx` (`'use client'`): monta `<canvas width={800} height={600}>` escalado a 100%/100% dentro de `.crt-screen`, instancia `AsteroidsGame` en un `useEffect` (crear al montar, limpiar `cancelAnimationFrame` al desmontar), captura `keydown`/`keyup` para flechas + espacio igual que el original, corre el loop con `requestAnimationFrame`, y sincroniza `snapshot` al HUD externo (Jugador/Puntuación/Vidas/Nivel/indicador `3x`) reemplazando los valores estáticos del `player-hud` para esta ruta. Verificación: en `/juegos/asteroides/jugar` el juego arranca solo, la nave rota/propulsa/dispara con teclado, y el HUD externo refleja puntuación y vidas en tiempo real.

5. **Controles táctiles.** Dentro del mismo componente, renderizar un D-pad (rotar izq/rotar der + propulsar) abajo-izquierda y un botón de disparo abajo-derecha, visibles solo bajo `pointer: coarse` o un breakpoint móvil (CSS nueva en `globals.css`, sección comentada `ASTEROIDS TOUCH CONTROLS`). Cada botón escribe en el mismo `keys`/`justPressed` que consume `handleInput`, con `touchstart`/`touchend` (o `pointerdown`/`pointerup`) para mantener presionado. Verificación: con DevTools en modo dispositivo o emulación táctil, los botones rotan/propulsan/disparan la nave sin usar teclado.

6. **PAUSA y FIN.** En `player.tsx`, sustituir los botones `disabled` del `player-hud` por botones activos solo cuando `game.id === 'asteroides'`: `PAUSA` alterna `pause()`/`resume()` (el canvas muestra "PAUSADO" mientras `phase === 'paused'`) y `FIN` llama a `end()` forzando `phase: 'gameover'` con el puntaje actual. Verificación: `PAUSA` congela el loop y el texto del botón cambia a `REANUDAR`; `FIN` muestra de inmediato el overlay de game-over con el puntaje correcto.

7. **Rama en la ruta.** Modificar `app/juegos/[id]/jugar/page.tsx`: si `game.id === 'asteroides'`, renderizar `<AsteroidesPlayer game={game} />` dentro del mismo `.crt`/`.crt-screen`/`.crt-bottom`; para cualquier otro id, conservar exactamente el markup estático actual (`game-arena`, `crt-attract`, `SIN CARTUCHO`). Verificación: `/juegos/caida/jugar` no cambia visualmente; `/juegos/asteroides/jugar` muestra el canvas jugable.

8. **Overlay de reinicio.** Confirmar que el overlay de GAME OVER dibujado por el motor (paso 3) acepta tanto `Space` como un tap/click sobre el canvas para reiniciar (`restart()`), cubriendo teclado y táctil. Verificación: tras perder las 3 vidas, tanto presionar espacio como tocar la pantalla reinician la partida sin recargar la página.

9. **Pasada estática.** `npm run lint` y `npm run build` sin errores ni advertencias.

10. **Verificación manual.** Con `npm run dev` levantado: jugar una partida completa en escritorio (rotar, propulsar, disparar, recoger el power-up 3x, partir asteroides de tamaño 3→2→1, subir de nivel, perder las 3 vidas, reiniciar), probar `PAUSA`/`FIN`/`SALIR`, y repetir los controles básicos con emulación táctil. Revisar la consola del navegador en busca de errores o warnings de hidratación.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni advertencias.
- [ ] `npx tsc --noEmit` pasa, incluyendo `app/lib/games/asteroides/engine.ts` y `player.tsx`.
- [ ] `/biblioteca` muestra una novena tarjeta "ASTEROIDES" (SHOOTER, cyan) con su propio cover, distinto del de "Rocas".
- [ ] `/juegos/asteroides` renderiza la ficha del juego (portada, tags, descripción, stat-strip, botón `JUGAR AHORA`) igual que cualquier otro juego, sin cambios en `page.tsx` de detalle.
- [ ] `/juegos/rocas` y `/juegos/rocas/jugar` no cambian respecto a su estado actual (placeholder estático "SIN CARTUCHO").
- [ ] `/juegos/asteroides/jugar` arranca el juego automáticamente al cargar, con 3 vidas, nivel 1 y puntuación 0.
- [ ] Con teclado: `←`/`→` rotan la nave, `↑` propulsa, `Espacio` dispara. La nave envuelve los bordes del canvas (toroidal).
- [ ] Los asteroides grandes se dividen en medianos al ser destruidos, y los medianos en pequeños; los pequeños no se dividen.
- [ ] El HUD externo (`player-hud`) refleja en vivo la puntuación, las vidas y el nivel reales de la partida, sin duplicarse dentro del canvas.
- [ ] Al recoger el power-up `3x`, la nave dispara tres balas en abanico durante su duración y el HUD muestra el indicador correspondiente.
- [ ] Botón `PAUSA`: congela el juego, cambia su texto a `REANUDAR`, y al presionarlo de nuevo la partida continúa exactamente donde quedó.
- [ ] Botón `FIN`: termina la partida de inmediato mostrando el overlay de GAME OVER con el puntaje acumulado hasta ese momento.
- [ ] Al perder las 3 vidas, aparece el overlay de GAME OVER con el puntaje final; tanto `Espacio` como un tap/click sobre el canvas reinician la partida sin recargar la página.
- [ ] Botón `SALIR` navega a `/juegos/asteroides`.
- [ ] En una ventana angosta o con emulación táctil, aparecen el D-pad (rotar izq/der + propulsar) y el botón de disparo, y accionarlos mueve y dispara la nave sin usar teclado; en escritorio (ancho normal, sin puntero táctil) esos controles no se muestran.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/asteroides/jugar`.
- [ ] El leaderboard de `/juegos/asteroides` sigue mostrando `seededScores` ficticio, sin mezclarse con el puntaje real de las partidas jugadas.

## Decisiones

- **Sí:** "Asteroides" es un juego nuevo en `games.ts`, independiente de `rocas`. Aunque se parecen, el usuario aclaró que son juegos distintos; reutilizar la entrada `rocas` mezclaría dos conceptos separados bajo un mismo id.
- **No:** eliminar o reescribir la entrada `rocas`. Sigue siendo un juego pendiente de su propio motor en una spec futura; tocarla aquí sería alcance ajeno a esta spec.
- **Sí:** id `asteroides` (español), coherente con la convención de slugs del resto de `GAMES` (`bloque-buster`, `caida`, `serpentina`...).
- **Sí:** cover propio `.cover-asteroides` en vez de reutilizar `.cover-rocas`. Dos tarjetas visualmente idénticas para juegos distintos en la misma biblioteca sería confuso para cualquier visitante.
- **Sí:** `best: 0` / `plays: '0'` en vez de cifras ficticias inventadas. El resto de `GAMES` tiene números falsos porque no hay motor detrás; "Asteroides" sí tiene un motor real, así que fingir una historia de partidas sería más engañoso que sincero.
- **Sí:** el motor (`engine.ts`) usa `class`, excepción documentada a la convención "siempre arrow functions" del CLAUDE.md. Esa convención aplica a componentes React y helpers de Next.js; las entidades de un motor de juego ya probado (`Bullet`, `Asteroid`, `Ship`...) son un dominio aparte, y reescribirlas como factories sería una reescritura completa con riesgo de introducir bugs nuevos en lugar de un port fiel.
- **Sí:** motor framework-agnostic en `app/lib/games/asteroides/engine.ts`, separado del Client Component `player.tsx`. Permite testear/razonar sobre la lógica sin depender de React, y sigue el patrón ya usado por `app/lib/supabase/`.
- **Sí:** el HUD dibujado dentro del canvas original se elimina; toda la información de estado vive en el `player-hud` HTML externo. Evita dos fuentes de verdad visualmente distintas mostrando el mismo dato.
- **Sí:** sincronización de estado vía `getSnapshot()` comparado antes de cada `setState`, no en cada frame. Actualizar React 60 veces por segundo cuando el puntaje cambia unas pocas veces por partida sería trabajo desperdiciado.
- **Sí:** paleta neon (`var(--cyan)`, etc.) en vez del blanco/negro original. Coherencia visual con el resto del Vault; un juego monocromático desentonaría contra las tarjetas y el resto de la UI.
- **Sí:** se conserva el power-up de disparo triple del original. Es gameplay ya probado, no una feature nueva a diseñar desde cero.
- **Sí:** `PAUSA` y `FIN` se activan solo para `asteroides`; para el resto de juegos siguen `disabled`, sin tocar su comportamiento actual.
- **Sí:** overlay de GAME OVER dibujado dentro del canvas (fiel al original) en vez de un modal HTML. Evita diseñar un componente nuevo para un caso que el motor ya resuelve, y mantiene el reinicio dentro del mismo ciclo de juego sin remontar componentes.
- **Sí:** controles táctiles tipo D-pad + botón de disparo, mostrados solo bajo `pointer: coarse`/breakpoint móvil. Es el patrón más simple de implementar y verificar en touch, frente a un joystick virtual que añade complejidad de arrastre sin que se haya pedido esa fidelidad.
- **No:** persistencia real del puntaje (Supabase o `localStorage`). Añadiría modelo de datos, posible necesidad de login, y una decisión de arquitectura de mayor alcance que merece su propia spec.
- **No:** sonido/efectos de audio. El original no los tiene; añadirlos sería una feature nueva no solicitada.
- **No:** arquitectura genérica de "motor enchufable" para futuros juegos. Diseñarla ahora, con un solo caso real, es prematuro — se revisita cuando exista un segundo juego con motor.
- **No:** suite de tests automatizados (Playwright versionado o unit tests del motor). Coherente con las specs anteriores: verificación manual asistida contra los criterios de aceptación.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El motor usa `class` con estado mutable; si `player.tsx` no limpia bien el `useEffect` al desmontar (navegar a `SALIR` y volver a entrar rápido), pueden quedar dos loops de `requestAnimationFrame` corriendo a la vez, duplicando velocidad o colisiones fantasma. | El `useEffect` de montaje guarda el id de `requestAnimationFrame` y lo cancela en su función de limpieza; se verifica en el paso 10 navegando repetidamente a `/juegos/asteroides/jugar` y observando que no haya doble velocidad ni errores en consola. |
| `engine.ts` no debe tocar `window`/`document` en el cuerpo del módulo (a diferencia del original, que registra listeners globales al cargar `game.js`). Si se hiciera, rompería el renderizado en servidor de `page.tsx`. | Todo acceso a `window`/`document`/`canvas` vive dentro de métodos de `AsteroidsGame` o del `useEffect` de `player.tsx`, nunca en el top-level del módulo. Verificado por `npx tsc --noEmit` más el propio SSR de Next al hacer `npm run build`. |
| Las flechas y la barra espaciadora hacen scroll de la página por defecto en el navegador; si no se previene, cada disparo o giro desplazaría el viewport. | `handleInput`/los listeners de teclado en `player.tsx` llaman `preventDefault()` para `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space` mientras el componente está montado, igual que necesitaría el original si corriera embebido en una página con más contenido. |
| Detectar "es táctil" con `pointer: coarse` puede fallar en laptops con pantalla táctil (tienen mouse y touch a la vez), mostrando controles táctiles innecesarios o escondiéndolos donde sí se necesitan. | Es una heurística aceptada, no perfecta; el paso 10 la verifica con emulación de DevTools. Si en la práctica resulta mal calibrada, es un ajuste de CSS de bajo riesgo para una spec posterior, no un rediseño. |
| Sincronizar `snapshot` con `useState` desde dentro del loop de `requestAnimationFrame` puede disparar renders de React fuera de un evento controlado por React, con riesgo de warnings en modo estricto/desarrollo. | Se actualiza `snapshot` solo cuando cambia respecto al anterior (no cada frame), y se usa `startTransition`/actualización simple sin efectos secundarios adicionales; el paso 10 revisa la consola en busca de warnings. |
| Recolorear el motor a la paleta neon puede reducir el contraste entre asteroides y fondo si se usa un tono demasiado apagado, dificultando distinguir tamaños pequeños. | El color de los asteroides se elige con `filter: drop-shadow`/glow igual que el resto del sitio para mantener legibilidad; se verifica visualmente en el paso 10, no hay criterio automatizado de contraste para el motor. |
