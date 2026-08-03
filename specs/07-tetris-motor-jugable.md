# SPEC 07 — Tetris: motor jugable en el Vault

> **Estado:** Implementado
> **Depende de:** SPEC 05 — Asteroides: motor jugable, SPEC 06 — Leaderboard y catálogo en Supabase
> **Fecha:** 2026-08-03
> **Objetivo:** Añadir "Tetris" al catálogo y a `/juegos/tetris/jugar` portando el motor de `references/started-games/03-tetris/game.js`, con HUD externo (puntos, líneas, nivel, pieza siguiente), controles de teclado y táctiles, y guardado de puntaje en el leaderboard.

## Alcance

**Dentro:**

- Migración `supabase/migrations/0004_add_game_tetris.sql`: fila nueva en `public.games` con `id: 'tetris'`, `title: 'TETRIS'`, `cat: 'PUZZLE'`, `cover: 'cover-tetris'`, `color: 'green'`, `best = 0`, `plays = '0'`, `position = 10`. No se toca la entrada `caida` ni sus puntajes sembrados.
- Clase `.cover-tetris` en `app/globals.css`, visualmente distinta de `cover-tetro` (el cover del stub `caida`), con la misma técnica de gradientes + pseudo-elementos.
- Motor en `app/lib/games/tetris/engine.ts`: puerto tipado de `game.js` — matriz `board` de 20×10, las 7 piezas clásicas más la pieza no estándar `N` ("tuerca", anillo 3×3 hueco), `rotateCW` con wall kicks `[0, −1, +1, −2, +2]`, `collide`, `clearLines`, pieza fantasma, hard drop y soft drop con su puntaje, y la curva de velocidad `dropInterval = max(100, 1000 − (level − 1) × 90)`.
- `GameSnapshot` propio del juego: `{ score, lines, level, phase, nextPiece }`. **Sin campo `lives`**: Tetris no tiene vidas y un `0` permanente en el HUD sería ruido.
- Paleta neon: los 8 colores de pieza del original se reencuadran sobre `#05050c` con los acentos del Vault, cuidando que las 8 sigan distinguiéndose entre sí.
- El HUD del original (sidebar con SCORE/LINES/LEVEL y el canvas de NEXT) sale del canvas de juego y pasa al `player-hud` de HTML. La pieza siguiente se dibuja en un **mini-canvas propio del reproductor**, alimentado solo por `snapshot.nextPiece`; el motor no lo conoce.
- Reproductor `app/lib/games/tetris/player.tsx` (`'use client'`): canvas de 300×600 dentro de `.crt-screen`, loop de `requestAnimationFrame` con `dt` acotado, captura de teclado y sincronización del snapshot.
- Controles de teclado: `←`/`→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop, `P` pausa. `F` para pantalla completa, como en Asteroides.
- Controles táctiles con layout propio: `◀ ▶` abajo-izquierda, `▼` (soft drop) en el centro, `↻` rotar y `⤓` (hard drop, botón grande) abajo-derecha. Escriben en los mismos `keys`/`justPressed` que consume el motor.
- Botones `PAUSA` / `FIN` / `PANTALLA` / `SALIR` del HUD, conectados a `pause()`/`resume()`, `end()`, fullscreen sobre el `.crt` y `Link` a `/juegos/tetris`.
- Overlay de GAME OVER dentro del canvas con el puntaje final, más `SaveScoreForm` para guardar bajo alias; reiniciar sin guardar sigue siendo posible.
- Dispatch de `app/juegos/[id]/jugar/page.tsx` convertido en mapa `slug -> componente`, conservando el fallback "SIN CARTUCHO".
- `SaveScoreForm` movido de `app/lib/games/asteroides/` a `app/lib/games/save-score-form.tsx` (ubicación compartida) y el bloque CSS `ASTEROIDS TOUCH CONTROLS` renombrado a `ARCADE TOUCH CONTROLS`.
- Verificación manual con servidor de desarrollo contra los criterios de aceptación; sin suite de tests versionada, igual que las specs anteriores.

**Fuera de alcance (para specs futuras):**

- Toggle de tema claro/oscuro del original y su persistencia en `localStorage`. El Vault es oscuro por diseño.
- *Hold piece* (guardar una pieza en reserva).
- Wall kicks SRS completos. Se porta el kick simple del original; el SRS es otra mecánica, no un arreglo.
- Bolsa 7-bag. Se conserva el random puro del original, tuerca incluida.
- Audio y efectos de sonido: el original no los tiene.
- Modo a dos jugadores o versus.
- Cualquier cambio a la entrada `caida`, a sus puntajes sembrados o a su `/juegos/caida/jugar` estático.
- Recalcular `best`/`plays` de `games` desde los puntajes reales (sigue siendo estático, como fijó SPEC 06).

## Modelo de datos

### Fila de catálogo — `supabase/migrations/0004_add_game_tetris.sql`

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas y limpia líneas sin dejar huecos.',
  'Ocho piezas caen desde la oscuridad, incluida una tuerca hueca que no encaja en ningún hueco limpio. Rótalas, deslízalas y complétales la línea antes de que la torre alcance el techo. Cada 10 líneas el descenso se acelera y no vuelve atrás.',
  'PUZZLE',
  'cover-tetris',
  'green',
  0,
  '0',
  10
);
```

`best = 0` y `plays = '0'` porque este juego sí tiene motor real, siguiendo el precedente de `asteroides`. No se siembran puntajes: el leaderboard arranca con "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO".

### `app/lib/games/tetris/engine.ts`

Framework-agnostic: sin imports de `react` ni `next`, sin tocar `window`/`document` en el cuerpo del módulo.

```ts
export type GamePhase = 'playing' | 'paused' | 'gameover';

/** 1–7 = classic tetrominoes (I, O, T, S, Z, J, L); 8 = the non-standard nut. */
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Board cell: 0 = empty, otherwise the PieceType that locked there. */
export type Cell = 0 | PieceType;

export interface Piece {
  type: PieceType;
  shape: Cell[][];
  x: number;
  y: number;
}

export interface GameSnapshot {
  score: number;
  lines: number;
  level: number;
  phase: GamePhase;
  nextPiece: PieceType;
}

export class TetrisGame {
  constructor(ctx: CanvasRenderingContext2D, w: number, h: number);
  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean): void;
  update(dt: number): void;   // dt in seconds
  draw(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  getSnapshot(): GameSnapshot;
}

/** Shape matrix for the HUD preview canvas. The player draws it; the engine never touches that canvas. */
export const PIECE_SHAPES: Record<PieceType, Cell[][]>;
export const PIECE_COLORS: Record<PieceType, string>;
```

Notas del contrato:

- **`phase` no incluye `'dead'`.** Asteroides lo usa para el respawn tras perder una vida; aquí no hay vidas ni estado intermedio: se juega, se pausa o se acabó.
- **`update(dt)` recibe segundos** y acumula internamente contra `dropInterval`, que el original maneja en milisegundos. La conversión vive dentro del motor.
- **`PIECE_SHAPES` y `PIECE_COLORS` se exportan** para que el reproductor dibuje el preview sin duplicar las matrices. Es la única superficie del motor que el HUD consume directamente.
- Todo el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `dropAccum`) es **de instancia**. El original los tiene como variables de módulo; ese es justo el cambio que impide que dos montajes compartan partida.
- `pause()` guarda la fase previa y no hace nada si `phase` ya es `gameover`.

### Estado interno relevante

| Concepto | Representación |
| --- | --- |
| Tablero | `Cell[20][10]`, `0` = vacío |
| Pieza actual / siguiente | `Piece` (matriz + posición), rotación por transposición + inversión |
| Wall kick | offsets `[0, −1, +1, −2, +2]`, primer offset sin colisión gana |
| Puntaje de línea | `[0, 100, 300, 500, 800][cleared] × level` |
| Puntaje de caída | hard drop `+2` por celda; soft drop `+1` por fila |
| Nivel | `floor(lines / 10) + 1` |
| Velocidad | `dropInterval = max(100, 1000 − (level − 1) × 90)` ms |
| Fin de partida | la pieza recién generada colisiona al aparecer |

### Archivos que aparecen o cambian

| Archivo | Acción |
| --- | --- |
| `supabase/migrations/0004_add_game_tetris.sql` | nuevo |
| `app/lib/games/tetris/engine.ts` | nuevo |
| `app/lib/games/tetris/player.tsx` | nuevo |
| `app/lib/games/save-score-form.tsx` | movido desde `app/lib/games/asteroides/` |
| `app/lib/games/asteroides/player.tsx` | actualiza el import de `SaveScoreForm` |
| `app/globals.css` | `.cover-tetris` nuevo; bloque táctil renombrado a `ARCADE TOUCH CONTROLS` |
| `app/juegos/[id]/jugar/page.tsx` | `if` → mapa `slug -> componente` |

## Plan de implementación

Cada paso deja el repo compilando y trae su propia verificación.

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/` la guía vigente sobre la frontera Server/Client Component y `'use client'`, y cualquier nota de deprecación que afecte a `page.tsx` o a `generateStaticParams`. Esos documentos mandan sobre cualquier patrón previo del repo.
   *Verificación:* queda anotado en el PR qué guía se consultó y si contradice algo de SPEC 05.

1. **Entrada de catálogo.** Escribir `supabase/migrations/0004_add_game_tetris.sql` con el `insert` de la sección anterior y aplicarlo con `apply_migration` del MCP de Supabase.
   *Verificación:* `list_migrations` reporta `0004` aplicada; `select id, position from public.games order by position` devuelve 10 filas con `tetris` al final y sin huecos; `/biblioteca` renderiza la tarjeta.

2. **Cover.** Añadir `.cover-tetris` en la sección de covers de `app/globals.css`, con un comentario que documente en qué se diferencia de `.cover-tetro` (el stub `caida`), tal como `.cover-asteroides` hace respecto a `.cover-rocas`.
   *Verificación:* en `/biblioteca` las tarjetas de CAÍDA y TETRIS se distinguen a simple vista; en `/juegos/tetris` la portada de la ficha es la nueva.

3. **Motor — tablero y piezas.** Crear `app/lib/games/tetris/engine.ts` con los tipos, `PIECE_SHAPES`, `PIECE_COLORS`, la clase `TetrisGame`, y la lógica de tablero: `collide`, `rotateCW` con wall kicks, `merge`, `clearLines`, `ghostY`, `spawn` y detección de game over. Sin dibujo todavía.
   *Verificación:* `npx tsc --noEmit` pasa; el archivo no importa `react` ni `next` y no accede a `window`/`document` en el cuerpo del módulo.

4. **Motor — loop y dibujo.** Completar `update(dt)` (acumulador contra `dropInterval`, auto-drop, `lockPiece`), `draw()` (grilla, tablero, pieza fantasma al 20% de alpha, pieza actual, overlays GAME OVER y PAUSADO), `handleInput`, `pause`/`resume`/`end`/`restart` y `getSnapshot()`. Paleta neon sobre `#05050c`; **nada de score, líneas ni nivel dibujados en el canvas**.
   *Verificación:* `npx tsc --noEmit` pasa; revisión de que las 8 piezas se distinguen entre sí y contra la grilla.

5. **Reproductor.** Crear `app/lib/games/tetris/player.tsx` (`'use client'`) copiando la estructura de `app/lib/games/asteroides/player.tsx`: canvas 300×600 en `.crt-screen`, instancia del motor en un `useEffect` de montaje con limpieza que cancela el `requestAnimationFrame` y quita los listeners, `dt = Math.min((ts − last) / 1000, 0.05)`, `consume(code)` para las teclas de pulsación única, `setSnapshot` solo cuando el snapshot cambia, `preventDefault()` limitado a `GAME_KEYS`, guard `isTyping`, y `formatScore` con regex (nunca `Intl`).
   *Verificación:* en `/juegos/tetris/jugar` la partida arranca sola; `←/→/↓/↑/X/Espacio` responden; el HUD muestra puntos, líneas y nivel en vivo.

6. **Preview de la pieza siguiente.** Mini-canvas dentro del `player-hud`, redibujado en un `useEffect` que depende solo de `snapshot.nextPiece`, usando `PIECE_SHAPES`/`PIECE_COLORS` y centrando la forma en una caja de 4×4.
   *Verificación:* la pieza mostrada es siempre la que aparece a continuación; al pausar no parpadea ni se redibuja en bucle.

7. **Controles táctiles.** Renombrar el bloque `/* ===== ASTEROIDS TOUCH CONTROLS ===== */` a `ARCADE TOUCH CONTROLS` y añadir el layout de Tetris: `◀ ▶` abajo-izquierda, `▼` centrado, `↻` y `⤓` (grande) abajo-derecha, cada botón con su `data-code` escribiendo en los mismos `keys`/`justPressed`.
   *Verificación:* con emulación táctil de DevTools se juega una partida completa sin teclado; en escritorio los botones no se muestran; Asteroides sigue con sus controles intactos tras el renombrado.

8. **PAUSA / FIN / PANTALLA / SALIR.** Conectar los botones del HUD a `pause()`/`resume()`, `end()`, fullscreen sobre el `div.crt` (más tecla `F`) y `Link` a `/juegos/tetris`, con `event.currentTarget.blur()` tras cada clic. La tecla `P` también alterna la pausa.
   *Verificación:* PAUSA congela la caída y cambia su texto a REANUDAR; `P` hace lo mismo; FIN muestra el overlay de game over con el puntaje acumulado; en pantalla completa los controles siguen alcanzables.

9. **`SaveScoreForm` a ubicación compartida.** Mover `app/lib/games/asteroides/save-score-form.tsx` a `app/lib/games/save-score-form.tsx` y actualizar el import del reproductor de Asteroides. El componente no cambia por dentro.
   *Verificación:* `npm run build` pasa; guardar un puntaje en Asteroides sigue funcionando igual que antes.

10. **Guardado de puntaje.** Montar `<SaveScoreForm gameId="tetris" score={snapshot.score} />` en el overlay de game over, dejando disponible el reinicio sin guardar.
    *Verificación:* terminar una partida, guardar con alias válido, ver `PUESTO #N`, y encontrar esa fila en `/juegos/tetris` y en la pestaña TETRIS del salón tras recargar. Un alias de 2 caracteres muestra error en línea y no inserta nada.

11. **Dispatch de la ruta.** Sustituir el `if (game.id === 'asteroides')` de `app/juegos/[id]/jugar/page.tsx` por un mapa `slug -> componente`, conservando `export const revalidate = 60`, `generateStaticParams`, `notFound()` y el fallback "SIN CARTUCHO".
    *Verificación:* `/juegos/asteroides/jugar` sin cambios; `/juegos/tetris/jugar` muestra el canvas jugable; `/juegos/caida/jugar` sigue en "SIN CARTUCHO".

12. **Pasada estática.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni advertencias.

13. **Verificación manual.** Con `npm run dev`: partida completa hasta perder, comprobación de que el nivel sube cada 10 líneas y la caída acelera, PAUSA/FIN/PANTALLA/SALIR, entrar y salir de `/juegos/tetris/jugar` varias veces seguidas (para descartar loops duplicados de `requestAnimationFrame`), y consola del navegador sin errores ni warnings de hidratación.

## Criterios de aceptación

**Integración y catálogo**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni advertencias.
- [ ] `supabase/migrations/` contiene `0004_add_game_tetris.sql` y `list_migrations` la reporta aplicada.
- [ ] `select count(*) from public.games` devuelve `10`, con `position` de 1 a 10 sin huecos ni repetidos.
- [ ] La fila `tetris` tiene `best = 0`, `plays = '0'`, `cat = 'PUZZLE'`, `color = 'green'`, `cover = 'cover-tetris'`.
- [ ] La fila `caida` y sus puntajes sembrados quedan exactamente como estaban.
- [ ] `/biblioteca` muestra la tarjeta de TETRIS con `.cover-tetris`, visualmente distinta de la de CAÍDA.
- [ ] El filtro `PUZZLE` de `/biblioteca` incluye TETRIS.
- [ ] `/juegos/tetris` renderiza la ficha completa (portada, tags, descripción, stat-strip, botón `JUGAR AHORA`).
- [ ] `/juegos/tetris` muestra "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" antes de la primera partida guardada.
- [ ] `/juegos/asteroides/jugar` funciona igual que antes del cambio de dispatch y del movimiento de `SaveScoreForm`.
- [ ] `/juegos/caida/jugar` y el resto de juegos sin motor siguen mostrando "SIN CARTUCHO".

**Contrato del motor**

- [ ] `engine.ts` no importa `react` ni `next` y no accede a `window`/`document` en el cuerpo del módulo.
- [ ] Todo el estado de partida es de instancia: entrar y salir de `/juegos/tetris/jugar` tres veces seguidas arranca siempre una partida limpia, a velocidad normal.
- [ ] El canvas de juego no dibuja puntos, líneas ni nivel; esos datos aparecen solo en el `player-hud`.
- [ ] `/juegos/tetris/jugar` arranca la partida automáticamente al cargar.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/tetris/jugar`.

**Mecánica**

- [ ] Las 8 piezas aparecen a lo largo de una partida, incluida la tuerca `N` (anillo 3×3 hueco).
- [ ] `←`/`→` mueven la pieza y se detienen contra las paredes y contra el montón, sin atravesarlos.
- [ ] `↑` o `X` rota en sentido horario; junto a una pared, el wall kick desplaza la pieza en vez de bloquear la rotación; si ningún offset cabe, la pieza no rota y nada se corrompe.
- [ ] `↓` baja la pieza una fila y suma 1 punto; contra el montón, la fija.
- [ ] `Espacio` la deja caer hasta el fondo, suma 2 puntos por celda recorrida y la fija de inmediato.
- [ ] La pieza fantasma se dibuja atenuada exactamente donde caería la pieza actual, y se actualiza al mover y al rotar.
- [ ] Completar una línea la elimina, desplaza hacia abajo lo que había encima y suma `[100, 300, 500, 800][n − 1] × nivel`.
- [ ] Cuatro líneas simultáneas suman `800 × nivel` en un solo evento.
- [ ] El contador de líneas es acumulado; el nivel es `floor(líneas / 10) + 1` y sube visiblemente en el HUD al cruzar cada múltiplo de 10.
- [ ] La caída automática acelera al subir de nivel y nunca baja de 100 ms por fila.
- [ ] La partida termina cuando la pieza nueva no cabe al aparecer, y el overlay de GAME OVER muestra el puntaje final.
- [ ] El preview del HUD muestra siempre la pieza que sale a continuación, centrada, y coincide con la que aparece al fijar la actual.

**HUD y controles**

- [ ] El HUD refleja en vivo puntos, líneas y nivel reales de la partida.
- [ ] Botón `PAUSA` y tecla `P`: congelan la caída, cambian el texto del botón a `REANUDAR`, y al repetirlos la partida sigue donde quedó, con la misma pieza y posición.
- [ ] Estando en game over, `PAUSA` y `P` no hacen nada.
- [ ] Botón `FIN`: termina la partida de inmediato con el puntaje acumulado.
- [ ] Botón `PANTALLA` y tecla `F`: ponen el `.crt` en pantalla completa y permiten volver.
- [ ] Botón `SALIR` navega a `/juegos/tetris`.
- [ ] Las flechas y la barra espaciadora no hacen scroll de la página durante la partida.
- [ ] Mientras el input de alias tiene el foco, escribir no mueve ni rota la pieza.
- [ ] En ventana angosta o con emulación táctil aparecen `◀ ▶ ▼ ↻ ⤓` y permiten jugar una partida completa sin teclado; en escritorio no se muestran.

**Puntaje**

- [ ] Al terminar la partida aparece el formulario de alias; guardar con alias válido muestra `PUESTO #N` con la posición real.
- [ ] Guardar con alias de menos de 3 caracteres muestra un error en línea y no inserta ninguna fila.
- [ ] El puntaje guardado aparece en `/juegos/tetris` y en la pestaña TETRIS de `/salon` tras recargar.
- [ ] Es posible reiniciar la partida sin guardar el puntaje.

## Decisiones

| Decisión | Alternativa descartada | Porqué |
| --- | --- | --- |
| Slug nuevo `tetris`, con `caida` intacto como stub. | Implementar el motor sobre `caida`. | Repite el precedente `rocas` ↔ `asteroides`: el juego real entra con su nombre canónico y el stub no se toca. Revivir `caida` obligaría a resetear `best`/`plays` y a borrar sus puntajes sembrados, tocando datos existentes sin necesidad. |
| Título `TETRIS` en vez de un nombre inventado en español. | Un nombre propio del Vault (`BLOQUES`, `TORRE`). | El catálogo ya reserva los nombres inventados para los stubs; los juegos con motor real usan el nombre reconocible. Además evita chocar con `bloque-buster`. |
| `color: 'green'`, `cat: 'PUZZLE'`. | `magenta`, el color de `caida`. | Mismo `CHECK`, misma categoría que el stub para que el filtro tenga sentido, pero acento distinto para que las dos tarjetas no se confundan de un vistazo. |
| `best = 0` y `plays = '0'`. | Cifras inventadas como los 8 juegos sin motor. | El juego sí va a acumular historia real; inventarle un pasado sería más engañoso que sincero. Mismo criterio que SPEC 05. |
| Se conserva la 8ª pieza `N` ("tuerca"), anillo 3×3 hueco. | Dejar solo las 7 tetrominós clásicas. | Es lo que distingue este juego de cualquier Tetris; quitarla lo convertiría en genérico. Sube la dificultad a propósito. |
| Random puro sobre las 8 piezas. | Bolsa 7-bag del Tetris moderno. | Es lo que hace el original y cambiarlo altera el ritmo de la partida. Queda fuera de alcance, no descartado para siempre. |
| Wall kicks simples `[0, −1, +1, −2, +2]`. | Tablas SRS completas. | El SRS es otra mecánica, no un arreglo del original. Portar lo que ya funciona evita inventar bugs. |
| `GameSnapshot` sin `lives`, con `lines` y `nextPiece`. | Mantener `lives: 0` para uniformar el snapshot entre juegos. | El HUD se genera desde el snapshot; un `0` permanente sería ruido visual. La uniformidad la da el contrato de métodos, no que todos los juegos tengan los mismos campos. |
| `phase` sin `'dead'`: solo `playing` / `paused` / `gameover`. | Reusar tal cual el tipo de Asteroides. | `'dead'` existe allí para el respawn entre vidas. Aquí no hay estado intermedio y un valor inalcanzable invita a escribir ramas muertas. |
| Preview de la pieza siguiente en un mini-canvas del `player-hud`. | Dibujarla en una franja lateral del canvas de juego. | Respeta la regla de SPEC 05: el canvas dibuja la arena, el HUD vive en HTML. El motor solo expone `nextPiece`; quien pinta es el reproductor. |
| `PIECE_SHAPES` y `PIECE_COLORS` exportados desde el motor. | Duplicar las matrices en el reproductor. | Una sola fuente de verdad para las formas. Es la única superficie del motor que el HUD consume directamente, y es de solo lectura. |
| `class` para `TetrisGame` y las entidades del motor. | Factories con arrow functions, según `CLAUDE.md`. | Excepción ya documentada en SPEC 05: portar un motor probado a factories es una reescritura con riesgo de bugs nuevos, no una traducción. Aplica solo al motor. |
| Motor separado del reproductor, framework-agnostic. | Un único componente cliente con toda la lógica. | Permite que `page.tsx` se renderice en servidor y que el motor sea testeable sin DOM el día que haya tests. |
| Paleta neon sobre `#05050c`, reencuadrando los 8 colores del original. | Conservar los colores pastel del original. | Un juego con otra paleta desentona contra el resto del Vault. Se cuida que las 8 piezas sigan distinguiéndose entre sí. |
| Overlay de GAME OVER dentro del canvas. | Modal HTML sobre el `.crt`. | Fiel al original y coherente con Asteroides. El formulario de alias sí es HTML, superpuesto. |
| Dispatch por mapa `slug -> componente`. | Encadenar `if`. | Con dos juegos ya se nota; con cinco sería ilegible. Sin `next/dynamic` por ahora: ninguno de los dos motores pesa lo suficiente para justificarlo. |
| `SaveScoreForm` movido a `app/lib/games/save-score-form.tsx`. | Duplicarlo bajo `tetris/`. | No tiene nada de Asteroides; vivía ahí por ser el primero. Mover es un cambio de una línea de import; duplicar garantiza que las dos copias diverjan. |
| Bloque CSS táctil renombrado a `ARCADE TOUCH CONTROLS` y compartido. | Un bloque propio para Tetris. | `.touch-controls` y `.touch-btn` ya son genéricos; solo el nombre mentía. El **layout** sí es propio de Tetris, dentro del bloque compartido. |
| Tema oscuro fijo. | Portar el toggle claro/oscuro del original. | El Vault define su propio tema; un toggle por juego rompería la coherencia visual y añadiría `localStorage` sin motivo. |
| Sin *hold piece* ni audio. | Añadirlos en esta spec. | Ninguno está en el original. Meterlos aquí mezclaría "portar" con "diseñar", y la spec dejaría de tener un final claro. |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cleanup incompleto del `useEffect`: al pulsar SALIR y volver rápido quedan dos loops de `requestAnimationFrame`, con caída al doble de velocidad. | Guardar el id del frame y cancelarlo en la limpieza; verificar entrando y saliendo de la ruta tres veces seguidas (criterio de aceptación explícito). |
| `window`/`document` en el cuerpo del módulo del motor rompe el render en servidor de `page.tsx`. El original hace exactamente eso: `getElementById` y `addEventListener` a nivel de módulo. | Todo el acceso al DOM dentro de métodos de la clase o del `useEffect`. Lo detecta `npm run build`. |
| Variables de módulo del original (`board`, `score`, `current`…) portadas tal cual harían que dos montajes compartan partida. | Todas pasan a campos de instancia. Es la primera cosa a revisar en el diff del motor. |
| El original mezcla milisegundos (`dropInterval`, `dropAccum`) con el contrato de `update(dt)` en segundos. Un factor 1000 mal puesto deja el juego congelado o instantáneo. | Convertir una sola vez dentro de `update`, y verificar a ojo que el nivel 1 cae ~1 fila por segundo. |
| Las flechas y la barra espaciadora hacen scroll de la página mientras se juega. | `preventDefault()` en los listeners, solo para `GAME_KEYS`. |
| `toLocaleString()` del original en el puntaje → hydration mismatch. | `formatScore` con regex, como en Asteroides. Nunca `Intl` en valores renderizados. |
| `setState` a 60 fps desde el loop dispara renders innecesarios. | Comparar el snapshot y llamar a `setSnapshot` solo al cambiar; el preview depende únicamente de `nextPiece`. |
| Rotación cerca de una pared o del montón: un wall kick mal portado puede solapar la pieza con celdas ocupadas y corromper el tablero al fijarla. | `tryRotate` prueba los offsets en orden y **no rota** si ninguno cabe; criterio de aceptación dedicado. |
| `clearLines` del original hace `splice` mientras itera y compensa con `r++`. Portarlo mal borra una línea de más o de menos con dos líneas contiguas. | Portar el bucle tal cual, y probar a mano un doble y un cuádruple. |
| Ocho colores de pieza reencuadrados a neón pueden acabar indistinguibles entre sí o contra la grilla. | Revisión visual con las 8 piezas en pantalla antes de cerrar el paso 4; ajustar luminosidad, no solo tono. |
| La tuerca `N` es 3×3 y nace en `y = 0`; si el tablero está alto puede provocar game over inmediato de forma que parezca un bug. | Es comportamiento correcto (así termina el original). Se documenta aquí para que no se "arregle" más adelante. |
| El renombrado del bloque CSS táctil rompe Asteroides si algún selector quedó a medias. | El renombrado es solo del comentario; las clases no cambian. Verificar Asteroides táctil tras el paso 7. |
| Dos Tetris en la biblioteca (`caida` y `tetris`) confunden al visitante. | Riesgo aceptado: es el mismo caso que `rocas`/`asteroides`, y las descripciones y covers los diferencian. Unificarlos es material de una spec futura de limpieza del catálogo. |
| El navegador reporta su propio puntaje y puede mentir. | Riesgo aceptado y documentado en SPEC 06. El `CHECK` de rango acota el daño; el antifraude real está fuera de alcance. |
