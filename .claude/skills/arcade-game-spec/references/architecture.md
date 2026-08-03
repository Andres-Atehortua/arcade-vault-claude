# Contrato de integración de un juego en Arcade Vault

Extraído del código real, no de las specs (que ya divergen en detalles como el botón de
pantalla completa, añadido después de SPEC 05). Asteroides es la implementación de
referencia: cuando dudes, abre esos archivos.

## Índice

1. [Motor](#1-motor--applibgamesslugenginets)
2. [Reproductor](#2-reproductor--applibgamesslugplayertsx)
3. [Catálogo](#3-catálogo--supabasemigrations)
4. [Cover CSS](#4-cover-css--appglobalscss)
5. [Dispatch de la ruta](#5-dispatch-de-la-ruta--appjuegosidjugarpagetsx)
6. [Leaderboard](#6-leaderboard--ya-está-hecho)
7. [Controles táctiles](#7-controles-táctiles--css-compartido)
8. [Trampas conocidas](#8-trampas-conocidas)

---

## 1. Motor — `app/lib/games/<slug>/engine.ts`

Framework-agnostic: **sin imports de `react` ni de `next`**, y sin tocar `window`,
`document` ni `canvas` en el cuerpo del módulo. El original de `references/started-games/`
registra listeners globales al cargarse; eso aquí rompería el render en servidor de
`page.tsx`. Todo acceso al DOM vive dentro de métodos de la clase o del `useEffect` del
reproductor.

API pública, tal como la expone `app/lib/games/asteroides/engine.ts`:

```ts
export type GamePhase = 'playing' | 'paused' | 'dead' | 'gameover';

export interface GameSnapshot {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  // + los flags que este juego quiera mostrar en el HUD (p. ej. tripleShotActive)
}

export class <Juego>Game {
  constructor(ctx: CanvasRenderingContext2D, w: number, h: number);
  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean): void;
  update(dt: number): void;
  draw(): void;
  pause(): void;
  resume(): void;
  end(): void;      // fuerza game over con el puntaje actual (botón FIN)
  restart(): void;
  getSnapshot(): GameSnapshot;
}
```

Notas del contrato:

- **Todo el estado es de instancia**, nunca variables de módulo. El reproductor crea y
  destruye una instancia por montaje; con globals, entrar y salir de la página dos veces
  dejaría dos partidas compartiendo estado.
- **`class` es una excepción documentada** a la convención "siempre arrow functions" de
  `CLAUDE.md`. Aplica a las entidades del motor (`Bullet`, `Asteroid`, `Ship`…), no al
  resto del proyecto. La razón: portar un motor ya probado a factories es una reescritura
  con riesgo de bugs nuevos, no una traducción.
- **El HUD no se dibuja en el canvas.** El original pinta score y vidas dentro de la arena;
  eso se elimina. El canvas dibuja la arena y los overlays (GAME OVER, PAUSADO), y todos
  los datos de estado salen por `getSnapshot()` hacia el `player-hud` de HTML. Dos fuentes
  visuales del mismo dato es peor que una.
- **Paleta neon** en vez del blanco/negro del original: `CYAN #00f5ff`, `MAGENTA #ff006e`,
  `YELLOW #f5ff00`, fondo `#05050c`. Un juego monocromático desentona contra el resto del
  Vault. Cuida el contraste de los elementos pequeños: Asteroides usa un blanco tenue con
  glow para las rocas justamente por eso.
- **`pause()` guarda la fase previa** para que `resume()` vuelva a ella. Si `phase` ya es
  `gameover`, `pause()` no hace nada.
- **`update(dt)` recibe segundos**, no milisegundos, y el reproductor ya lo acota.

## 2. Reproductor — `app/lib/games/<slug>/player.tsx`

`'use client'`. Prop única: `{ game: GameRow }`. Copia la estructura de
`app/lib/games/asteroides/player.tsx`, que resuelve una lista larga de detalles que no son
obvios hasta que fallan:

- Un `useEffect` de montaje con dependencias vacías: obtiene el `ctx`, instancia el motor,
  llama a `handleInput(keys, consume)` y arranca el loop. La limpieza cancela el
  `requestAnimationFrame` y quita los listeners.
- `consume(code)` lee **y limpia** `justPressed[code]`. Es lo que distingue "la tecla está
  presionada" de "la tecla acaba de presionarse" sin que el motor conozca eventos del DOM.
- El loop acota el delta: `dt = Math.min((ts - last) / 1000, 0.05)`. Sin el tope, volver a
  una pestaña en segundo plano teletransporta las entidades a través de las paredes.
- `setSnapshot` solo cuando `sameSnapshot(next, last)` es falso. Empujar a React 60 veces
  por segundo un puntaje que cambia cinco veces por partida es trabajo desperdiciado.
- `preventDefault()` únicamente en las teclas del juego (`GAME_KEYS`), o el navegador hace
  scroll de la página con cada flecha y cada disparo.
- Guard `isTyping(event)`: mientras el input de alias tiene el foco, las teclas son suyas,
  no de la nave.
- `event.currentTarget.blur()` tras clicar PAUSA o FIN, para que el siguiente `Espacio`
  vaya al juego y no re-active el botón.
- Los botones táctiles escriben en los **mismos** `keysRef` / `justPressedRef` que lee el
  motor, con el código de tecla en `data-code`. Simulan pulsaciones en vez de abrir una
  segunda vía de entrada.
- `formatScore` usa una regex para el separador de miles. `Intl.NumberFormat` daría un
  string distinto en servidor y en navegador — hydration mismatch garantizado.
- El markup es `.av-player.fade-in` > `.player-hud` (`.hud-stats` con `.hud-stat`,
  `.hud-actions` con `btn yellow` / `btn magenta` / `btn ghost` / `Link` SALIR) + `.crt` >
  `.crt-screen` (canvas `.game-canvas`, `<SaveScoreForm>` si gameover, `.touch-controls`) +
  `.crt-bottom`. Reutiliza esas clases; ya existen en `globals.css`.
- El botón PANTALLA hace fullscreen sobre el `div.crt` y también responde a la tecla `F`,
  porque una vez expandido el HUD queda fuera del elemento y el botón deja de ser
  alcanzable.

## 3. Catálogo — `supabase/migrations/`

El catálogo vive **solo** en Postgres. `app/data/games.ts` fue eliminado en SPEC 06; no lo
resucites.

Migración nueva, `supabase/migrations/000N_add_game_<slug>.sql`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values ('<slug>', '<TÍTULO>', '...', '...', '<CAT>', 'cover-<slug>', '<color>', 0, '0', <N>);
```

- `position` = el máximo actual + 1. Es el orden de `/biblioteca` y del salón; todas las
  lecturas ordenan por él.
- `best = 0` y `plays = '0'` para juegos con motor real. Los 8 juegos sin motor llevan
  cifras inventadas porque no hay nada detrás; inventarle historia a un juego jugable sería
  más engañoso que sincero.
- **No siembres scores.** El leaderboard del juego arranca vacío y muestra
  "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" hasta la primera partida guardada.
- `cat` y `color` tienen `CHECK` en la BD: solo `ARCADE|PUZZLE|SHOOTER|VERSUS` y
  `cyan|magenta|yellow|green`.
- Aplicar con el MCP de Supabase (`apply_migration`), y verificar con `list_migrations`.

Los tipos `GameRow` / `ScoreRow` de `app/lib/supabase/types.ts` están escritos a mano y no
cambian al añadir un juego — solo si una migración añade columnas.

## 4. Cover CSS — `app/globals.css`

Clase `.cover-<slug>` en la sección `/* ===== Cover art generators (pure CSS) ===== */`.
Técnica: un `background` de gradientes en la clase y un `::after` (opcional `::before`) con
`content: ''; position: absolute; inset: 0` que apila `radial-gradient` decorativos, más
`filter: drop-shadow(...)` para el glow. Sin imágenes: todo es CSS.

El valor de la columna `cover` es exactamente este nombre de clase.

Debe verse **distinta** de las 9 existentes (`cover-bricks`, `cover-tetro`, `cover-snake`,
`cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`,
`cover-asteroides`). Dos tarjetas idénticas para juegos distintos confunden a cualquiera
que abra la biblioteca. `cover-asteroides` documenta en un comentario en qué se diferencia
de `cover-rocas`; imita esa práctica.

## 5. Dispatch de la ruta — `app/juegos/[id]/jugar/page.tsx`

Hoy es una rama única:

```tsx
if (game.id === 'asteroides') return <AsteroidesPlayer game={game} />;
```

Con el segundo juego eso pide un mapa `slug -> componente`. **La spec debe decidirlo
explícitamente**; la recomendación es el mapa, y `next/dynamic` si el bundle de algún motor
pesa lo suficiente para justificarlo.

El resto del archivo se conserva: `export const revalidate = 60`, `generateStaticParams`
desde `getGames()`, `notFound()` para slugs inexistentes, y el fallback estático
"SIN CARTUCHO" para los juegos que aún no tienen motor.

## 6. Leaderboard — ya está hecho

No hay nada que construir aquí, y esto es fácil de pasar por alto:

- `saveScore(gameId, alias, score)` en `app/actions/scores.ts` es genérica por `gameId`.
  Valida alias (`/^[A-Z0-9_]{3,12}$/`) y rango, inserta con el cliente admin (única vía de
  escritura: RLS deniega `insert` a `anon`) y devuelve `{ ok: true, rank }`.
- `SaveScoreForm` en `app/lib/games/asteroides/save-score-form.tsx` recibe solo
  `{ gameId, score }` y muestra `PUESTO #N` tras guardar.
- `/juegos/<slug>` y `/salon` leen de `scores` sin cambios; el estado vacío ya está
  implementado en `app/components/empty-scores.tsx`.

El único trabajo real: el componente vive bajo la carpeta de Asteroides pese a no tener
nada de Asteroides. **La spec debe decidir si lo mueve** a `app/lib/games/save-score-form.tsx`
(recomendado, es un cambio de una línea de import) o lo duplica.

## 7. Controles táctiles — CSS compartido

`app/globals.css` tiene un bloque `/* ===== ASTEROIDS TOUCH CONTROLS ===== */` que es
genérico pese al nombre: `.touch-controls` oculto por defecto y visible bajo
`@media (pointer: coarse), (max-width: 720px)`, `.touch-btn` de 56 px y `.touch-btn.fire`
de 84 px.

La spec debe decidir entre renombrarlo a `ARCADE TOUCH CONTROLS` y reutilizarlo, o añadir
un layout propio. Los layouts casi nunca coinciden: Tetris necesita ◀ ▼ ▶ más rotar, no
propulsar y disparar.

`pointer: coarse` es una heurística imperfecta — un portátil con pantalla táctil tiene
ratón y touch a la vez. Se acepta; corregirla es CSS de bajo riesgo en otra spec.

## 8. Trampas conocidas

Inclúyelas en la tabla de riesgos de la spec cuando apliquen.

| Trampa | Mitigación |
| --- | --- |
| Cleanup incompleto del `useEffect`: al navegar a SALIR y volver rápido quedan dos loops de `requestAnimationFrame`, con doble velocidad y colisiones fantasma. | Guardar el id del frame y cancelarlo en la función de limpieza; verificar entrando y saliendo de la ruta varias veces. |
| `window`/`document` en el cuerpo del módulo del motor rompe el render en servidor de `page.tsx`. | Todo el acceso al DOM dentro de métodos de la clase o del `useEffect`. Lo detecta `npm run build`. |
| Flechas y barra espaciadora hacen scroll de la página. | `preventDefault()` en los listeners, solo para las teclas del juego. |
| `Intl` o `toLocaleString` en valores renderizados → hydration mismatch. | Formatear con regex, o formatear en el servidor antes de pasar los datos (como hace `formatScoreDate` en `app/lib/format.ts`). |
| `setState` desde dentro del loop puede disparar renders fuera de un evento de React. | Comparar el snapshot y actualizar solo al cambiar, sin efectos secundarios adicionales. |
| El catálogo se sirve con `revalidate = 60`; los puntajes no. | Ya resuelto en `queries.ts`: el catálogo usa un cliente anon sin cookies y los scores el cliente de sesión, para que el jugador vea su puntaje recién guardado al recargar. No lo cambies sin motivo. |
| El navegador reporta su propio puntaje y puede mentir. | Riesgo aceptado y documentado en SPEC 06. El `CHECK` de rango acota el daño; el antifraude real está fuera de alcance. |
| Assets binarios del original (spritesheets, `.mp3`) no tienen sitio en el patrón actual. | Decidirlo en Fase 2: portarlos con su ubicación explícita, sustituirlos por dibujo vectorial neón, o dejarlos fuera de alcance. |
