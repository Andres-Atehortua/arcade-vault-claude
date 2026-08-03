# SPEC 08 — Rompebloques: motor jugable en el Vault

> **Estado:** Approved
> **Depende de:** SPEC 05 — Asteroides: motor jugable, SPEC 06 — Leaderboard y catálogo en Supabase
> **Fecha:** 2026-08-03
> **Objetivo:** Añadir "Rompebloques" como motor real en `/juegos/rompebloques/jugar`, portando `references/started-games/04-arkanoid/game.js` con sus 5 niveles, sprites y sonido originales, sustituyendo la fila stub `bloque-buster` del catálogo por la entrada real.

## Alcance

**Dentro:**

- Migración `supabase/migrations/0005_replace_bloque_buster_with_rompebloques.sql`: primero `delete from public.scores where game_id = 'bloque-buster'` (los 12 puntajes sembrados son historia inventada para el stub; un juego con motor real no la hereda, mismo criterio que `asteroides`/`tetris`), luego `update public.games set id = 'rompebloques', title = 'ROMPEBLOQUES', short = ..., long = ..., cover = 'cover-rompebloques', best = 0, plays = '0' where id = 'bloque-buster'`. Misma `position = 1` — no se toca el orden del catálogo. Aplicar con `apply_migration` y verificar con `list_migrations` y `select id, position from games order by position`.
- Clase `.cover-rompebloques` en `app/globals.css`, reemplazando visualmente a `.cover-bricks` (que queda huérfana y se puede borrar en esta misma spec, ya que ningún `game.cover` la referencia tras la migración).
- Motor en `app/lib/games/rompebloques/engine.ts`: puerto tipado de `game.js` — paddle, bola, colisiones AABB contra bloques, los 5 niveles de `levels.js` (`LEVELS`, con su `speed` multiplicador), explosiones de bloque, y la clase `RompebloquesGame` según el contrato de `architecture.md`.
- `GamePhase` extendido con `'win'` (`'playing' | 'paused' | 'dead' | 'gameover' | 'win'`), disparado al limpiar el nivel 5 — desviación explícita del contrato base, documentada en Decisiones.
- `GameSnapshot` propio: `{ score, lives, level, phase }`. `lives` inicia en 3, igual que el original.
- Paleta: se conservan los 6 colores de bloque del original (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`) reencuadrados sobre `#05050c`, más el cyan/magenta del sitio para paddle y bola.
- Assets portados literalmente (decisión: sustituir la generación vectorial de Asteroides por los sprites reales, ya que el original ya trae arte propio en spritesheet): `public/games/rompebloques/spritesheet-breakout.png` y `public/games/rompebloques/sounds/{ball-bounce,break-sound}.mp3`, copiados desde `references/started-games/04-arkanoid/assets/`. `app/lib/games/rompebloques/spritesheet.ts` porta `assets/spritesheet.js` (carga de imagen + `drawSprite`/`drawFrame`), instanciado dentro del motor — nunca en el cuerpo del módulo, para no romper el render en servidor.
- Carga de imagen/audio ocurre en el constructor de `RompebloquesGame`, que solo se instancia dentro del `useEffect` del reproductor (client-only); el módulo del motor no toca `window`/`document`/`Image`/`Audio` en su cuerpo.
- Control de paddle: teclado (`←`/`→`) **y** puntero (mouse + touch) sobre el canvas, ambos escribiendo la misma posición de paddle. El puntero se resuelve con un método adicional del motor, `setPaddleX(x: number)`, invocado desde `player.tsx` en los listeners `pointermove`/`mousemove`/`touchmove` del canvas — extensión al contrato de `handleInput(keys, justPressed)`, documentada en Decisiones. Como el movimiento es continuo por puntero, **no hace falta una barra de botones táctiles**: en móvil el jugador arrastra el dedo sobre el canvas igual que arrastraría el mouse.
- `P` o `Escape` pausan/reanudan (además del botón `PAUSA` del HUD).
- Reproductor `app/lib/games/rompebloques/player.tsx` (`'use client'`): canvas 800×600 dentro de `.crt-screen`, loop de `requestAnimationFrame` con `dt` acotado, sincronización de snapshot con `player-hud`, botones `PAUSA`/`FIN`/`PANTALLA`/`SALIR`.
- `SaveScoreForm` compartido (`app/lib/games/save-score-form.tsx`, ya movido en SPEC 07) recibe `{ gameId: 'rompebloques', score }` al terminar la partida o al ganar.
- Overlay de victoria dentro del canvas ("¡COMPLETASTE EL JUEGO!") además del de GAME OVER, ambos con `SaveScoreForm` — ganar también guarda puntaje.
- Dispatch de `app/juegos/[id]/jugar/page.tsx`: añade `rompebloques: RompebloquesPlayer` al mapa `PLAYERS` ya existente.
- Verificación manual con servidor de desarrollo contra los criterios de aceptación; sin suite de tests versionada, igual que las specs anteriores.

**Fuera de alcance (para specs futuras):**

- Selector de nivel dentro del overlay de pausa (clic para saltar a cualquiera de los 5 niveles). Es una función de debug del original, no del loop competitivo; el leaderboard debe reflejar partidas jugadas de principio a fin.
- Toggle de tema claro/oscuro u otras opciones del original que no existan.
- Recalcular `best`/`plays` de `games` desde los puntajes reales (estático, como fijó SPEC 06).
- Cualquier cambio a otras entradas del catálogo distintas de `bloque-buster` → `rompebloques`.
- Modo a dos jugadores o versus.
- Optimización o compresión de los assets portados (`spritesheet-breakout.png` y los `.mp3` se copian tal cual).

## Modelo de datos

### Migración — `supabase/migrations/0005_replace_bloque_buster_with_rompebloques.sql`

```sql
-- SPEC 08 — Rompebloques: motor jugable en el Vault.
-- Replaces the `bloque-buster` stub with the real-engine entry, same position (1).
-- Its 12 seeded scores are invented history for a stub with no engine behind it;
-- a game that will accumulate real history does not keep it, same criterion as
-- `asteroides` (SPEC 05) and `tetris` (SPEC 07).

delete from public.scores where game_id = 'bloque-buster';

update public.games
set
  id    = 'rompebloques',
  title = 'ROMPEBLOQUES',
  short = 'Rebota la pelota y destruye muros de neón.',
  long  = 'Pilota una paleta y rebota una bola de plasma para pulverizar muros de bloques cromáticos a lo largo de 5 niveles. La velocidad sube en cada uno. ¿Llegarás a limpiar el muro final?',
  cover = 'cover-rompebloques',
  best  = 0,
  plays = '0'
where id = 'bloque-buster';
```

`position` no se toca (sigue en `1`); `cat = 'ARCADE'` y `color = 'cyan'` tampoco cambian, ya encajan.

### `app/lib/games/rompebloques/engine.ts`

Framework-agnostic: sin imports de `react` ni `next`, sin tocar `window`/`document` en el cuerpo del módulo — solo dentro de la clase.

```ts
export type GamePhase = 'playing' | 'paused' | 'dead' | 'gameover' | 'win';

export interface GameSnapshot {
  score: number;
  lives: number;
  level: number; // 1-indexed, 1..5
  phase: GamePhase;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

export class RompebloquesGame {
  constructor(ctx: CanvasRenderingContext2D, w: number, h: number);
  handleInput(keys: Record<string, boolean>, justPressed: (code: string) => boolean): void;
  /** Pointer-driven paddle control (mouse or touch), continuous. */
  setPaddleX(clientX: number, canvasRect: DOMRect): void;
  update(dt: number): void;
  draw(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  getSnapshot(): GameSnapshot;
}
```

`Block` y `Explosion` son entidades internas del motor, no exportadas — igual que `Bullet`/`Asteroid` en Asteroides. `LEVELS` se porta desde `levels.js` como una constante tipada dentro del mismo archivo o en `app/lib/games/rompebloques/levels.ts`, con `{ speed: number; blocks: { col: number; row: number; color: string }[] }[]`.

### `app/lib/games/rompebloques/spritesheet.ts`

Puerto tipado de `assets/spritesheet.js`, instanciado por el motor (nunca en el cuerpo del módulo):

```ts
export interface Spritesheet {
  load(onReady: () => void): void;
  drawSprite(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number): void;
  drawFrame(ctx: CanvasRenderingContext2D, frame: unknown, x: number, y: number, w: number, h: number): void;
}
```

Imagen y sonidos se referencian por ruta pública: `/games/rompebloques/spritesheet-breakout.png`,
`/games/rompebloques/sounds/ball-bounce.mp3`, `/games/rompebloques/sounds/break-sound.mp3`.

### Assets — `public/games/rompebloques/`

Copia literal de `references/started-games/04-arkanoid/assets/` (sin el `.DS_Store`):

```
public/games/rompebloques/
  spritesheet-breakout.png
  sounds/
    ball-bounce.mp3
    break-sound.mp3
```

## Plan de implementación

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/` la guía vigente sobre la frontera Server/Client Component y `'use client'`. Seguir esos documentos por encima de cualquier patrón previo.

1. **Assets.** Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` y `assets/sounds/{ball-bounce,break-sound}.mp3` a `public/games/rompebloques/`.
   *Verificación:* los archivos existen bajo `public/games/rompebloques/` y `npm run build` no se queja de assets faltantes.

2. **Migración de catálogo.** `supabase/migrations/0005_replace_bloque_buster_with_rompebloques.sql`: borra los puntajes sembrados de `bloque-buster` y actualiza esa fila a `rompebloques` (mismo `position`). Aplicar con `apply_migration`.
   *Verificación:* `select id, title, position from games order by position` muestra `rompebloques` en el puesto 1, sin fila `bloque-buster`; `select count(*) from scores where game_id = 'bloque-buster'` devuelve `0`; `/biblioteca` renderiza la tarjeta nueva en el mismo lugar.

3. **Cover.** `.cover-rompebloques` en `app/globals.css`, sustituyendo (borrando) `.cover-bricks`, visualmente distinta de los covers restantes.
   *Verificación:* la tarjeta de `/biblioteca` se ve con su portada propia; `grep cover-bricks` no aparece en ningún `game.cover` de Supabase.

4. **Spritesheet helper.** `app/lib/games/rompebloques/spritesheet.ts`, puerto tipado de `assets/spritesheet.js`, apuntando a las rutas públicas del paso 1.
   *Verificación:* `npx tsc --noEmit` pasa.

5. **Niveles.** `app/lib/games/rompebloques/levels.ts`, puerto tipado de `levels.js` (5 niveles, `speed` + `blocks`).
   *Verificación:* `npx tsc --noEmit` pasa; el array tiene longitud 5.

6. **Motor.** `app/lib/games/rompebloques/engine.ts` con la clase `RompebloquesGame` según el contrato de `architecture.md` más las extensiones de esta spec (`GamePhase` con `'win'`, `setPaddleX`): paddle, bola, colisiones AABB, explosiones, sonido, transición de nivel, `lives`, victoria al limpiar el nivel 5.
   *Verificación:* `npx tsc --noEmit` pasa; el archivo no importa nada de `react` ni `next` y no toca `window`/`document`/`Image`/`Audio` en el cuerpo del módulo (solo dentro de la clase).

7. **Reproductor.** `app/lib/games/rompebloques/player.tsx` (`'use client'`): canvas 800×600 dentro de `.crt-screen`, instancia del motor en `useEffect` con limpieza, loop de `requestAnimationFrame` con `dt` acotado, captura de teclado (`←`/`→`, `P`/`Escape`), listeners de puntero (`mousemove`/`touchmove`) sobre el canvas llamando a `setPaddleX`, y sincronización del snapshot con el `player-hud`.
   *Verificación:* en `/juegos/rompebloques/jugar` la partida arranca sola, teclado y arrastre (mouse y touch) mueven la paddle, y el HUD refleja el estado real en vivo.

8. **PAUSA / FIN / PANTALLA / SALIR.** Botones del HUD conectados a `pause()`/`resume()`, `end()`, fullscreen sobre el `.crt` (también la tecla `F`), y `Link` a `/juegos/rompebloques`.
   *Verificación:* PAUSA congela y cambia su texto a REANUDAR; FIN muestra el overlay de game over con el puntaje acumulado.

9. **Dispatch de la ruta.** Añadir `rompebloques: RompebloquesPlayer` al mapa `PLAYERS` de `app/juegos/[id]/jugar/page.tsx`.
   *Verificación:* `/juegos/rompebloques/jugar` muestra el canvas jugable; el resto de rutas sin motor no cambia.

10. **Overlays de fin de partida.** GAME OVER (al perder las 3 vidas) y VICTORIA (al limpiar el nivel 5) dentro del canvas, ambos montando `SaveScoreForm` con `{ gameId: 'rompebloques', score }`.
    *Verificación:* perder todas las vidas y limpiar los 5 niveles muestran su overlay correspondiente y permiten guardar puntaje.

11. **Guardado de puntaje.** Terminar una partida (por muerte o por victoria), guardar con un alias válido, ver `PUESTO #N`, y encontrar esa fila en `/juegos/rompebloques` y en la pestaña del salón tras recargar.
    *Verificación:* igual a los criterios de aceptación de puntaje.

12. **Pasada estática.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni advertencias.

13. **Verificación manual.** Con `npm run dev`: partida completa de principio a fin (incluida una recorrida ganando los 5 niveles), PAUSA/FIN/SALIR, mouse y emulación táctil de DevTools, entrar y salir de la ruta varias veces (para descartar loops duplicados), y consola del navegador sin errores ni warnings de hidratación.

## Criterios de aceptación

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni advertencias.
- [x] `supabase/migrations/` contiene `0005_replace_bloque_buster_with_rompebloques.sql` y `list_migrations` la reporta aplicada.
- [x] `select count(*) from public.games` no cambia respecto al estado previo (se actualizó una fila, no se insertó); no existe ninguna fila con `id = 'bloque-buster'`.
- [x] `select count(*) from public.scores where game_id = 'bloque-buster'` devuelve `0`.
- [x] `/biblioteca` muestra la tarjeta "ROMPEBLOQUES" con `.cover-rompebloques`, distinto de los demás covers, en la posición 1.
- [x] Los filtros por categoría de `/biblioteca` siguen incluyendo el juego en ARCADE.
- [x] `/juegos/rompebloques` renderiza la ficha completa (portada, tags, descripción, stat-strip, botón `JUGAR AHORA`).
- [x] `/juegos/rompebloques` muestra "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" antes de la primera partida guardada.
- [x] `/juegos/rompebloques/jugar` arranca la partida automáticamente al cargar.
- [x] `engine.ts` no importa `react` ni `next` y no accede a `window`/`document`/`Image`/`Audio` en el cuerpo del módulo.
- [x] El HUD externo (score, vidas, nivel) refleja en vivo el estado real de la partida, sin duplicarse dentro del canvas.
- [x] Botón `PAUSA`: congela el juego, cambia su texto a `REANUDAR`, y al pulsarlo de nuevo la partida sigue donde quedó.
- [x] Botón `FIN`: termina la partida de inmediato con el puntaje acumulado.
- [x] Botón `PANTALLA` (y la tecla `F`) activa fullscreen sobre el `.crt`.
- [x] Botón `SALIR` navega a `/juegos/rompebloques`.
- [x] La paddle responde a `←`/`→` y también sigue el puntero (mouse) al mover el cursor sobre el canvas.
- [x] En emulación táctil, arrastrar el dedo sobre el canvas mueve la paddle sin necesidad de botones adicionales.
- [x] La bola rebota correctamente contra paredes, paddle y bloques; cada bloque roto suma 10 puntos y dispara su animación de explosión con sonido.
- [x] Perder la bola resta una vida y la reposiciona; al llegar a 0 vidas aparece el overlay de GAME OVER.
- [x] Limpiar los bloques de un nivel avanza automáticamente al siguiente, con el incremento de velocidad correspondiente (`speed` de `LEVELS`).
- [x] Limpiar el nivel 5 dispara el overlay de VICTORIA (`phase: 'win'`), distinto del de GAME OVER.
- [x] Tanto el overlay de GAME OVER como el de VICTORIA muestran `SaveScoreForm`; guardar con alias válido muestra `PUESTO #N` con la posición real, visible después en `/juegos/rompebloques` y en el salón tras recargar.
- [x] Guardar con alias de menos de 3 caracteres muestra un error en línea y no inserta ninguna fila.
- [x] Es posible reiniciar la partida sin guardar el puntaje.
- [x] No hay selector de nivel accesible desde la pantalla de pausa (fuera de alcance).
- [x] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/rompebloques/jugar`.
- [x] Los juegos sin motor (`/juegos/caida/jugar` y compañía) siguen mostrando "SIN CARTUCHO" sin cambios.

## Decisiones

- **Sustituir `bloque-buster` en vez de coexistir.** A diferencia de `rocas`/`asteroides` y `caida`/`tetris` (que conviven), aquí el usuario pidió reemplazar el stub directamente porque su descripción ya describía este juego con precisión. Se documenta como desviación explícita del patrón de "insertar fila nueva" de `architecture.md`.
- **Borrar los puntajes sembrados de `bloque-buster` antes de renombrar la fila.** La FK `scores.game_id → games.id` no tiene `on update cascade`; un `update` directo del `id` con puntajes existentes habría fallado. Además, esos 12 puntajes son historia inventada para un stub, y un juego con motor real no la hereda (mismo criterio que `asteroides`/`tetris`).
- **Nombre "Rompebloques" en vez de "Arkanoid".** "Arkanoid" es marca registrada de Taito; el resto del catálogo usa nombres genéricos en español. Se descartó explícitamente tras señalarlo.
- **`GamePhase` extendido con `'win'`.** El contrato base de `architecture.md` no contempla victoria. Se agrega como variante propia de este juego (documentado aquí), igual que Tetris quitó `lives` de su snapshot — el contrato es una base, no una lista cerrada.
- **`setPaddleX` como extensión al contrato de input.** `handleInput(keys, justPressed)` alcanza para teclado y para botones táctiles discretos, pero no para movimiento continuo de puntero. Se agrega un método adicional en vez de forzar el mouse a través de teclas sintéticas, que sería más frágil.
- **Sin barra de controles táctiles.** El único control es la paddle, y el puntero (touch incluido) ya la mueve de forma continua vía `setPaddleX`. Añadir botones `◀ ▶` sería redundante y peor que arrastrar directamente. Desviación documentada del bloque `ARCADE TOUCH CONTROLS` reutilizado por Asteroides/Tetris — aquí simplemente no aplica.
- **Assets portados literalmente, no vectorizados.** A diferencia de Asteroides (SPEC 05, todo vectorial), el original de Rompebloques ya trae spritesheet y sonido propios y reutilizables; portarlos es menos trabajo y más fiel que redibujar. Se guardan en `public/games/rompebloques/`.
- **Selector de nivel en pausa: fuera de alcance.** Es una función de debug del original que permite saltar niveles con clic; no aporta al loop competitivo y podría inflar el puntaje sin jugar el nivel completo.
- **`class` en el motor** como excepción documentada a la convención de arrow functions de `CLAUDE.md` — entidades internas (`Block`, `Explosion`) y la clase principal `RompebloquesGame`, no componentes React.
- **`best = 0` / `plays = '0'`** tras la migración, mismo criterio que `asteroides`/`tetris`: un juego con motor real no arranca con cifras inventadas.
- **`SaveScoreForm` compartido**, no duplicado — ya vive en `app/lib/games/save-score-form.tsx` desde SPEC 07; esta spec solo lo reutiliza.
- **Dispatch: se extiende el mapa `slug -> componente`** ya existente en `page.tsx` (no cadena de `if`), agregando una entrada más.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cleanup incompleto del `useEffect`: al navegar a SALIR y volver rápido quedan dos loops de `requestAnimationFrame`, con doble velocidad y colisiones fantasma. | Guardar el id del frame y cancelarlo en la función de limpieza; verificar entrando y saliendo de la ruta varias veces (paso 13 del plan). |
| `window`/`document`/`Image`/`Audio` en el cuerpo del módulo del motor rompe el render en servidor de `page.tsx`. | Todo el acceso al DOM y a los assets dentro de la clase o del `useEffect`. Lo detecta `npm run build`. |
| Flechas y barra espaciadora hacen scroll de la página. | `preventDefault()` en los listeners, solo para las teclas del juego. |
| `setPaddleX` (mouse/touch) y `handleInput` (teclado) escribiendo la posición de la paddle al mismo tiempo pueden pisarse entre sí si el usuario usa ambos a la vez. | El último input gana (mismo comportamiento que el original, que ya mezclaba mouse y teclado sin conflicto real); no requiere lógica de prioridad adicional. |
| La imagen del spritesheet o los `.mp3` tardan en cargar y el motor intenta dibujar/reproducir antes de tiempo. | El original ya resuelve esto con `loadSpritesheet(cb)`: el loop de `requestAnimationFrame` no arranca hasta que el callback confirma la carga. Se porta igual. |
| Los `.mp3` se reproducen con `new Audio().cloneNode().play()` en cada rebote; en móviles algunos navegadores bloquean audio sin interacción previa del usuario. | Aceptado — el primer input del jugador (tecla o toque) ya cuenta como interacción antes de que ocurra el primer rebote. |
| `Intl` o `toLocaleString` en valores renderizados → hydration mismatch. | Formatear con regex (`formatScore`), como en Asteroides/Tetris. |
| `setState` desde dentro del loop puede disparar renders fuera de un evento de React. | Comparar el snapshot y actualizar solo al cambiar. |
| El catálogo se sirve con `revalidate = 60`; los puntajes no. | Ya resuelto en `queries.ts`; no se toca. |
| El navegador reporta su propio puntaje y puede mentir. | Riesgo aceptado y documentado en SPEC 06; el `CHECK` de rango acota el daño. |
| Borrar los puntajes de `bloque-buster` es irreversible una vez aplicada la migración. | Revisar el resultado del `delete` antes de aplicar (contar filas afectadas); no hay necesidad de conservarlos porque son ficticios. |
