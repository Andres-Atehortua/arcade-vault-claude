# SPEC 09 — Serpentina: motor jugable en el Vault

> **Estado:** Implementado
> **Depende de:** SPEC 05 — Asteroides: motor jugable, SPEC 06 — Leaderboard y catálogo en Supabase
> **Fecha:** 2026-08-03
> **Objetivo:** Añadir "Serpentina" como motor real en `/juegos/serpentina/jugar` —un Snake
> clásico de grilla con wrap-around en los bordes y sin sistema de vidas—, portando los
> sprites de fruta de `references/started-games/snake/` (no hay motor completo de
> referencia, solo assets), sustituyendo la historia inventada de la fila stub
> `serpentina` del catálogo por la entrada real.

## Alcance

**Dentro:**

- Migración `supabase/migrations/0006_reset_serpentina_scores.sql`: `delete from public.scores where game_id = 'serpentina'` (los puntajes sembrados son historia inventada para el stub), y `update public.games set best = 0, plays = '0', short = ..., long = ... where id = 'serpentina'`. `id`/`title`/`cover`/`color`/`position` no cambian — ya encajan con un Snake clásico; solo se afina `short`/`long` para que el texto mencione frutas en vez de "núcleos magenta", coherente con el arte real que ahora se porta. Aplicar con `apply_migration` y verificar con `list_migrations`.
- Assets: copiar `references/started-games/snake/fruits.png` a `public/games/serpentina/fruits.png`. `app/lib/games/serpentina/sprites.ts` porta `sprites.js` (solo la fila de frutas del atlas, 21 variantes), instanciado dentro del motor — nunca en el cuerpo del módulo, para no romper el render en servidor.
- Motor en `app/lib/games/serpentina/engine.ts`: puerto propio (sin motor original completo que replicar) contra el contrato de `architecture.md` — grilla 40×30 (celdas de 20px, 40×20=800, 30×20=600), movimiento por tick fijo acumulado (no framerate continuo), wrap-around en los 4 bordes (no muere al chocar pared), colisión contra la propia cola como único game over, comida única con sprite de fruta elegido al azar entre las 21 variantes del atlas en cada spawn, crecimiento de la serpiente y `+10` puntos por fruta, curva de velocidad propia (el tick baja con cada fruta hasta un piso).
- `GameSnapshot` propio: `{ score, length, phase }`. Sin `lives` ni `level` — no aplican a un Snake endless. `phase: 'playing' | 'paused' | 'gameover'` (sin `'dead'` ni `'win'`).
- Paleta: serpiente vectorial en verde neón (acento ya asignado a `serpentina`), comida con el sprite de fruta real, fondo `#05050c`.
- Carga de la imagen de sprites ocurre en el constructor de `SerpentinaGame`, que solo se instancia dentro del `useEffect` del reproductor (client-only); el módulo del motor no toca `window`/`document`/`Image` en su cuerpo.
- Control de dirección: teclado (`←↑↓→`), leído por `justPressed` (borde de pulsación, no `keys` sostenidas) para no encolar giros repetidos al mantener presionada una flecha; se ignora el giro opuesto exacto de 180° (no te puedes morder por un input, solo por una decisión de movimiento real).
- Controles táctiles: bloque `.dpad` nuevo en `app/globals.css` (junto a `ARCADE TOUCH CONTROLS`), cruz de 4 botones (▲◀▶▼) — el layout horizontal de 3 botones de Asteroides no cubre 4 direcciones sin disparo.
- `P` o `Escape` pausan/reanudan (además del botón `PAUSA` del HUD).
- Reproductor `app/lib/games/serpentina/player.tsx` (`'use client'`): canvas 800×600 dentro de `.crt-screen`, loop de `requestAnimationFrame` con `dt` acotado, sincronización de snapshot con `player-hud`, botones `PAUSA`/`FIN`/`PANTALLA`/`SALIR`.
- `SaveScoreForm` compartido (`app/lib/games/save-score-form.tsx`) recibe `{ gameId: 'serpentina', score }` al terminar la partida.
- Dispatch de `app/juegos/[id]/jugar/page.tsx`: añade `serpentina: SerpentinaPlayer` al mapa `PLAYERS` ya existente.
- Verificación manual con servidor de desarrollo contra los criterios de aceptación; sin suite de tests versionada, igual que las specs anteriores.

**Fuera de alcance (para specs futuras):**

- Power-ups u obstáculos internos en el tablero (solo comida clásica).
- Modo a dos jugadores o versus.
- Sonido / efectos de audio — no hay assets de audio en `references/started-games/snake/`.
- Selector de dificultad manual (la velocidad sube sola con el progreso, no es configurable).
- Cualquier cambio a `id`/`title`/`cover`/`color`/`position` de `serpentina`, o a otras entradas del catálogo.

## Modelo de datos

### Migración — `supabase/migrations/0006_reset_serpentina_scores.sql`

```sql
-- SPEC 09 — Serpentina: motor jugable en el Vault.
-- Clears invented history and refreshes the copy to match the real fruit art
-- now used for food. id/title/cover/color/position stay untouched.

delete from public.scores where game_id = 'serpentina';

update public.games
set
  best  = 0,
  plays = '0',
  short = 'Crece devorando frutas sin morder tu propia cola.',
  long  = 'Una serpiente de luz recorre la grilla devorando frutas jugosas que la hacen crecer y acelerar. Cruza los bordes del tablero sin miedo: solo tu propia cola puede detenerte.'
where id = 'serpentina';
```

`position` (3), `cat` (`ARCADE`), `color` (`green`), `cover` (`cover-snake`) no se tocan.

### `app/lib/games/serpentina/sprites.ts`

Puerto tipado de `references/started-games/snake/sprites.js` (solo la fila de frutas usada del atlas):

```ts
export type FruitName =
  | 'banana' | 'orange' | 'grape' | 'garlic' | 'eggplant' | 'strawberry' | 'cherry'
  | 'carrot' | 'mushroom' | 'broccoli' | 'watermelon' | 'pepper' | 'kiwi' | 'lemon'
  | 'peach' | 'peanut' | 'apple' | 'tomato' | 'berries' | 'grapes2' | 'pineapple' | 'melon';

export interface FruitSpritesheet {
  load(onReady: () => void): void;
  drawFruit(ctx: CanvasRenderingContext2D, name: FruitName, x: number, y: number, w: number, h: number): void;
}
```

`FRUITS: Record<FruitName, { x: number; y: number; w: number; h: number }>` porta las coordenadas exactas de `sprites.js`. Imagen referenciada por ruta pública: `/games/serpentina/fruits.png`.

### `app/lib/games/serpentina/engine.ts`

Framework-agnostic: sin imports de `react` ni `next`, sin tocar `window`/`document`/`Image` en el cuerpo del módulo — solo dentro de la clase.

```ts
export type GamePhase = 'playing' | 'paused' | 'gameover';

export interface GameSnapshot {
  score: number;
  length: number;
  phase: GamePhase;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface Segment {
  col: number;
  row: number;
}

interface Food {
  col: number;
  row: number;
  fruit: FruitName;
}

export class SerpentinaGame {
  constructor(ctx: CanvasRenderingContext2D, w: number, h: number);
  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean): void;
  update(dt: number): void;
  draw(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  getSnapshot(): GameSnapshot;
}
```

`Segment`, `Food` y `Direction` son entidades internas, no exportadas — igual que `Block`/`Explosion` en Rompebloques.

### Geometría de grilla y velocidad

```
GRID_COLS = 40, GRID_ROWS = 30, CELL = 20   // 40×20 = 800px, 30×20 = 600px
BASE_TICK_MS = 140
TICK_DECREASE_PER_FOOD = 4
MIN_TICK_MS = 70
POINTS_PER_FOOD = 10
```

El movimiento avanza por tick fijo (acumulador de `dt`), un paso de grilla por tick. Cada fruta resta `TICK_DECREASE_PER_FOOD` al intervalo hasta el piso `MIN_TICK_MS`.

### Assets — `public/games/serpentina/`

Copia literal de `references/started-games/snake/fruits.png`:

```
public/games/serpentina/
  fruits.png
```

## Plan de implementación

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/` la guía vigente sobre la frontera Server/Client Component y `'use client'`. Seguir esos documentos por encima de cualquier patrón previo.

1. **Assets.** Copiar `references/started-games/snake/fruits.png` a `public/games/serpentina/fruits.png`.
   *Verificación:* el archivo existe bajo `public/games/serpentina/`; `npm run build` no se queja de assets faltantes.

2. **Migración de catálogo.** `supabase/migrations/0006_reset_serpentina_scores.sql`: borra los puntajes sembrados de `serpentina`, resetea `best = 0` / `plays = '0'`, y actualiza `short`/`long` para mencionar frutas. Aplicar con `apply_migration`.
   *Verificación:* `select count(*) from scores where game_id = 'serpentina'` devuelve `0`; `select short, long, best, plays from games where id = 'serpentina'` refleja el texto y las cifras nuevas; `/biblioteca` sigue mostrando la tarjeta en su posición 3.

3. **Sprites de frutas.** `app/lib/games/serpentina/sprites.ts`, puerto tipado de `sprites.js`, apuntando a `/games/serpentina/fruits.png`.
   *Verificación:* `npx tsc --noEmit` pasa.

4. **Motor.** `app/lib/games/serpentina/engine.ts` con la clase `SerpentinaGame`: grilla, movimiento por tick, wrap-around, colisión contra la cola, comida con sprite de fruta aleatorio, crecimiento, curva de velocidad, cambio de dirección por `justPressed` ignorando el giro de 180°. Carga del spritesheet en el constructor.
   *Verificación:* `npx tsc --noEmit` pasa; el archivo no importa `react` ni `next` y no toca `window`/`document`/`Image` en el cuerpo del módulo.

5. **CSS táctil.** Bloque `.dpad` nuevo en `app/globals.css`: cruz de 4 botones (▲◀▶▼), visible solo bajo `pointer: coarse` o el breakpoint móvil.
   *Verificación:* con emulación táctil de DevTools aparece la cruz; en escritorio no se muestra.

6. **Reproductor.** `app/lib/games/serpentina/player.tsx` (`'use client'`): canvas 800×600 dentro de `.crt-screen`, instancia del motor en `useEffect` con limpieza, loop de `requestAnimationFrame` con `dt` acotado, captura de teclado (`←↑↓→`, `P`/`Escape`), botones táctiles del `.dpad` escribiendo en los mismos `keys`/`justPressed` del motor, sincronización del snapshot con el `player-hud`.
   *Verificación:* en `/juegos/serpentina/jugar` la partida arranca sola, teclado y D-pad táctil mueven la serpiente, y el HUD refleja el estado real en vivo.

7. **PAUSA / FIN / PANTALLA / SALIR.** Botones del HUD conectados a `pause()`/`resume()`, `end()`, fullscreen sobre el `.crt` (también la tecla `F`), y `Link` a `/juegos/serpentina`.
   *Verificación:* PAUSA congela y cambia su texto a REANUDAR; FIN muestra el overlay de game over con el puntaje acumulado.

8. **Dispatch de la ruta.** Añadir `serpentina: SerpentinaPlayer` al mapa `PLAYERS` de `app/juegos/[id]/jugar/page.tsx`.
   *Verificación:* `/juegos/serpentina/jugar` muestra el canvas jugable; el resto de rutas sin motor no cambia.

9. **Guardado de puntaje.** Terminar una partida, guardar con un alias válido, ver `PUESTO #N`, y encontrar esa fila en `/juegos/serpentina` y en la pestaña del salón tras recargar.
   *Verificación:* igual a los criterios de aceptación de puntaje.

10. **Pasada estática.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni advertencias.

11. **Verificación manual.** Con `npm run dev`: partida completa (crecer comiendo distintas frutas, cruzar los 4 bordes en wrap-around, morderse la cola para terminar), PAUSA/FIN/SALIR, emulación táctil de DevTools, entrar y salir de la ruta varias veces, y consola del navegador sin errores ni warnings de hidratación.

## Criterios de aceptación

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni advertencias.
- [x] `supabase/migrations/` contiene `0006_reset_serpentina_scores.sql` y `list_migrations` la reporta aplicada.
- [x] `select count(*) from public.games` no cambia respecto al estado previo (10 filas; no se insertó ni borró ninguna).
- [x] `select count(*) from public.scores where game_id = 'serpentina'` devuelve `0`.
- [x] `/biblioteca` muestra la tarjeta "SERPENTINA" con `cover-snake`, posición 3, y el texto nuevo sobre frutas.
- [x] Los filtros por categoría de `/biblioteca` siguen incluyendo el juego en ARCADE.
- [x] `/juegos/serpentina` renderiza la ficha completa con el texto actualizado (portada, tags, descripción, stat-strip, botón `JUGAR AHORA`).
- [x] `/juegos/serpentina` muestra "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" antes de la primera partida guardada.
- [x] `/juegos/serpentina/jugar` arranca la partida automáticamente al cargar.
- [x] `engine.ts` no importa `react` ni `next` y no accede a `window`/`document`/`Image` en el cuerpo del módulo.
- [x] El HUD externo (puntaje, longitud) refleja en vivo el estado real de la partida, sin duplicarse dentro del canvas.
- [x] Botón `PAUSA`: congela el juego, cambia su texto a `REANUDAR`, y al pulsarlo de nuevo la partida sigue donde quedó.
- [x] Botón `FIN`: termina la partida de inmediato con el puntaje acumulado.
- [x] Botón `PANTALLA` (y la tecla `F`) activa fullscreen sobre el `.crt`.
- [x] Botón `SALIR` navega a `/juegos/serpentina`.
- [x] La serpiente responde a `←↑↓→`; el giro opuesto exacto (180°) se ignora.
- [x] Cruzar cualquiera de los 4 bordes reaparece la serpiente en el lado opuesto (wrap-around), sin terminar la partida.
- [x] Comer una fruta (sprite real, aleatoria entre las 21 variantes del atlas) suma 10 puntos, crece la serpiente un segmento, y aparece una nueva fruta en una celda libre.
- [x] La velocidad de la serpiente aumenta progresivamente con cada fruta, hasta el piso definido (`MIN_TICK_MS`).
- [x] Morder la propia cola termina la partida de inmediato y muestra el overlay de GAME OVER con `SaveScoreForm`.
- [x] Guardar con alias válido muestra `PUESTO #N` con la posición real, visible después en `/juegos/serpentina` y en el salón tras recargar.
- [x] Guardar con alias de menos de 3 caracteres muestra un error en línea y no inserta ninguna fila.
- [x] Es posible reiniciar la partida sin guardar el puntaje.
- [x] En ventana angosta o con emulación táctil aparece el `.dpad` y permite jugar sin teclado; en escritorio no se muestra.
- [x] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/serpentina/jugar`.
- [x] Los juegos sin motor (`/juegos/caida/jugar` y compañía) siguen mostrando "SIN CARTUCHO" sin cambios.

## Decisiones

- **Reutilizar la fila `serpentina`** en vez de reemplazarla o coexistir: el `id`/`title`/`cover`/`color`/`position` ya encajan; solo se limpia la historia inventada y se afina el texto para que coincida con el arte real.
- **Actualizar `short`/`long` para mencionar frutas**, decisión explícita del usuario: el texto original decía "núcleos magenta", pero ahora la comida es un sprite de fruta real — dejar el texto desalineado del arte confundiría más que un ajuste menor de copy. `id`/`title`/`cover`/`color`/`position` no cambian, a diferencia de SPEC 08.
- **`best = 0` / `plays = '0'`**, mismo criterio que los motores anteriores: un juego con motor real no arranca con cifras ni puntajes inventados.
- **Comida con sprite real, serpiente vectorial.** El atlas portado (`references/started-games/snake/sprites.js` + `fruits.png`) solo trae las 21 frutas, no un sprite de serpiente; se porta lo que existe y se dibuja el resto en vectorial neón, igual que Rompebloques portó su spritesheet completo por tenerlo disponible.
- **Fruta aleatoria por spawn**, decisión explícita del usuario: aprovecha las 21 variantes del atlas en vez de desperdiciar 20 de ellas.
- **Wrap-around en vez de morir contra la pared**, decisión explícita del usuario sobre la mecánica clásica alternativa (Nokia Snake); el único game over es morderse la cola.
- **Sin sistema de vidas ni niveles.** `GameSnapshot` se aparta del contrato base (`lives`, `level`) igual que Tetris ya lo hizo — un Snake endless no tiene ninguno de los dos; se añade `length` como estadística propia del HUD.
- **Curva de velocidad inventada** (`BASE_TICK_MS` → `MIN_TICK_MS`, `-4ms` por fruta): no hay motor original completo que portar (solo assets), así que la dificultad progresiva es una decisión de diseño de esta spec.
- **Cambio de dirección por `justPressed`, no por `keys` sostenidas.** Sostener una flecha en un juego de tick fijo no debe encolar giros repetidos; se descarta además el giro opuesto exacto a la dirección actual.
- **`class` en el motor** como excepción documentada a la convención de arrow functions de `CLAUDE.md` — entidades internas (`Segment`, `Food`) y la clase principal `SerpentinaGame`, no componentes React.
- **Motor separado del reproductor, framework-agnostic**, mismo patrón que los tres motores previos.
- **HUD fuera del canvas**: el canvas solo dibuja tablero, serpiente, comida y overlays (PAUSA/GAME OVER); `score`/`length` salen por `getSnapshot()`.
- **Paleta neon coherente con el texto ya sembrado**: serpiente verde (acento `green` ya asignado a `serpentina`), comida con sprite de fruta real, fondo `#05050c`.
- **Overlay de game over dentro del canvas**, no modal HTML — mismo patrón que Asteroides/Tetris/Rompebloques.
- **Dispatch: mapa `slug -> componente`**, ya existente en `page.tsx`; se agrega una entrada más.
- **`SaveScoreForm` compartido**, ya vive en `app/lib/games/save-score-form.tsx` desde SPEC 07; esta spec solo lo reutiliza.
- **CSS táctil: bloque nuevo `.dpad`, no reutiliza el layout de Asteroides.** El layout horizontal de 3 botones (◀▲▶ + disparo) no cubre 4 direcciones sin disparo; se añade un layout en cruz dentro de la misma sección `ARCADE TOUCH CONTROLS`, sin renombrar el bloque completo.
- **Sin sonido**, decisión explícita del usuario: no hay assets de audio en `references/started-games/snake/`; queda fuera de alcance.
- **Sin power-ups ni obstáculos**, decisión explícita del usuario: mantiene el alcance acotado a un Snake clásico.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cleanup incompleto del `useEffect`: al navegar a SALIR y volver rápido quedan dos loops de `requestAnimationFrame`. | Guardar el id del frame y cancelarlo en la limpieza; verificar entrando y saliendo de la ruta varias veces (paso 11 del plan). |
| `window`/`document`/`Image` en el cuerpo del módulo del motor rompe el render en servidor de `page.tsx`. | Todo el acceso al DOM y a los assets dentro de la clase o del `useEffect`. Lo detecta `npm run build`. |
| El acumulador de tick podría disparar más de un paso de grilla en un mismo `update(dt)` si el `dt` fuera grande. | El `dt` ya llega acotado a 0.05s desde el loop del reproductor (convención compartida); con `MIN_TICK_MS = 70` nunca cabe más de un tick por frame, así que no hace falta lógica adicional de "procesar N pasos". |
| El sprite de fruta tarda en cargar y el motor intenta dibujar antes de tiempo. | Mismo patrón que Rompebloques: un flag `ready` se activa en el callback de `load()`; `draw()` no dibuja fruta/serpiente hasta entonces (solo fondo). |
| Flechas hacen scroll de la página. | `preventDefault()` en los listeners, solo para las teclas del juego. |
| `Intl`/`toLocaleString` en valores renderizados → hydration mismatch. | Formatear con regex (`formatScore`), como en los motores anteriores. |
| `setState` desde dentro del loop puede disparar renders fuera de un evento de React. | Comparar el snapshot y actualizar solo al cambiar. |
| El catálogo se sirve con `revalidate = 60`; los puntajes no. | Ya resuelto en `queries.ts`; no se toca. |
| El navegador reporta su propio puntaje y puede mentir. | Riesgo aceptado y documentado en SPEC 06; el `CHECK` de rango acota el daño. |
| Actualizar `short`/`long` es visible de inmediato en producción tras aplicar la migración (no hay borrador). | Revisar el texto antes de aplicar con `apply_migration`; es reversible con una migración de corrección si hiciera falta. |
