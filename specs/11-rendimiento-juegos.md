# SPEC 11 — Rendimiento en ejecución de los juegos

> **Estado:** Implemented
> **Depende de:** SPEC 05 — Asteroides, SPEC 07 — Tetris, SPEC 08 — Rompebloques, SPEC 09 — Serpentina, SPEC 10 — Controles táctiles y mobile
> **Fecha:** 2026-11-11
> **Objetivo:** Medir y reducir el coste por frame de `/juegos/[id]/jugar` (motores, reproductores y
> CSS global visible en esa ruta) hasta un p95 ≤ 16,7 ms con CPU throttling 4x en los 4 juegos,
> sin cambiar su aspecto visual.

## Alcance

**Dentro:**

- **Línea base antes de tocar código.** Se mide en los 4 juegos con Playwright/Chrome de escritorio,
  CPU throttling 4x y 30 s de partida activa por juego. Se registran FPS medio, p95 de tiempo de
  frame, % de frames > 33 ms y nº de renders de React del reproductor. Los resultados van a la
  sección "Línea base" de esta spec, junto a una tabla "Después".
- **Medidor de rendimiento oculto**, activable con `?debug=perf` en `/jugar`. Muestra FPS, p95 y
  % de frames > 33 ms en una esquina, fuera del canvas. Sin el parámetro no se monta ni tiene coste.
- **Hook compartido `useGameLoop`** (`app/lib/games/use-game-loop.ts`). Agrupa lo que hoy repiten
  los 4 `player.tsx`:
  - rAF con `dt` acotado a 0,05 s;
  - sincronización de snapshot solo al cambiar;
  - integración del medidor;
  - pausa del loop con `document.hidden`;
  - omisión de `draw()` cuando el frame no cambia.
- **Motores** (`engine.ts` de los 4 juegos):
  - sustituir `shadowBlur` en tiempo real por glow pre-renderizado en canvas offscreen (caché por
    forma y color), con aspecto equivalente;
  - exponer si el frame necesita redibujarse (pausa o game over estáticos);
  - eliminar asignaciones por frame evitables (objetos, arrays, strings de `font`/estilos) donde la
    línea base las señale.
- **Reproductores.** Migrar los 4 `player.tsx` a `useGameLoop`. Evitar re-renders de React que no
  correspondan a un cambio real de HUD.
- **CSS global visible en `/jugar`** (`app/globals.css`, con `body:has(.av-player)`):
  - pausar o simplificar `.av-bg` (`gridscroll`, `perspective`, `mask-image`) y `.av-noise`;
  - revisar el `mix-blend-mode` de scanlines y el `backdrop-filter` del nav mientras el reproductor
    está montado.

  Sin cambio perceptible en el área de juego.
- **`prefers-reduced-motion`** respetado en las animaciones decorativas visibles en `/jugar`.
- **Orden de optimización:** Asteroides, Serpentina, Tetris y Rompebloques.
- **Verificación:** segunda medición en las mismas condiciones que la línea base, más prueba manual
  en dispositivo real por el usuario.

**Fuera de alcance (para specs futuras):**

- Rendimiento de carga: bundle JS, LCP/CLS/TBT, fuentes, imágenes, covers, Supabase, `revalidate`
  y Client Components innecesarios. Va en una SPEC 12 aparte.
- Rendimiento de `/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/acerca-de` y `/auth`. Sus
  animaciones y su scroll no cambian.
- Resolución del canvas según `devicePixelRatio`. El canvas sigue siendo 800×600 fijo.
- Cambios visuales, de jugabilidad, de controles o de reglas de cualquier juego.
- Web Workers, `OffscreenCanvas` transferido a worker y WebGL.
- Suite de tests o benchmarks automatizados versionados en CI.
- Cambios en catálogo, migraciones de Supabase o `saveScore`.

## Modelo de datos

Sin cambios en Supabase, catálogo, `scores` ni persistencia. Solo tipos de cliente.

### Contrato mínimo de motor que consume el hook — `app/lib/games/use-game-loop.ts`

Lo cumplen ya los 4 motores, más un método nuevo, `needsRedraw()`:

```ts
/** What useGameLoop needs from any engine. Each engine keeps its own GameSnapshot type. */
export interface LoopEngine<S> {
  update(dt: number): void;
  draw(): void;
  getSnapshot(): S;
  /** false when the last drawn frame is still valid (static pause / game over). */
  needsRedraw(): boolean;
}

export type UseGameLoopOptions<S> = {
  /** Engine instance; null until the player's setup effect creates it. */
  engine: LoopEngine<S> | null;
  /** HUD equality, so React only re-renders on real changes (existing sameSnapshot). */
  sameSnapshot: (a: S, b: S) => boolean;
  initialSnapshot: S;
};

/** Returns the live HUD snapshot; owns rAF, dt clamp (0.05 s), visibility pause and perf sampling. */
export type UseGameLoop = <S>(options: UseGameLoopOptions<S>) => S;
```

El teclado (`GAME_KEYS`, `keysRef`, `justPressedRef`) se queda en cada `player.tsx`: varía por juego
y ya lo comparte con `TouchPad`.

### Medidor — `app/lib/games/perf-meter.tsx`

```ts
/** Rolling window of frame times, fed by useGameLoop only when ?debug=perf is present. */
export type PerfStats = {
  fps: number; // mean over the window
  p95Ms: number; // 95th percentile frame time
  over33Pct: number; // % of frames > 33 ms
  frames: number; // samples in the window
};

export const PERF_WINDOW_FRAMES = 600; // ~10 s at 60 fps
export const PERF_QUERY_PARAM = 'debug'; // ?debug=perf
```

`window.__avPerf` (solo con `?debug=perf`) expone el último `PerfStats` para que Playwright lo lea
sin parsear el DOM.

### Caché de glow — `app/lib/games/glow-cache.ts`

```ts
/** Key: shape id + color + blur radius. Value: pre-blurred offscreen canvas drawn with drawImage. */
export type GlowSpriteKey = `${string}|${string}|${number}`;
export type GlowCache = Map<GlowSpriteKey, HTMLCanvasElement>;
```

Se crea dentro de cada motor (en el constructor), nunca en el cuerpo del módulo, por SSR.

### Condiciones de medición

Chrome de escritorio en modo headless vía Playwright (rAF fijo a 60 Hz) sobre un build de producción,
CPU throttling 4x, viewport 1280×800, 30 s de partida activa,
sin `?debug=perf` durante la traza (el medidor se valida aparte). Los renders de React se cuentan
con el Profiler de React DevTools o un contador temporal que no se commitea.

## Línea base

Medida el 2026-11-11 sobre `main` (b5143c1) con un build de producción (`next build` +
`next start`) y Google Chrome 157 **headless** (Playwright `channel: 'chrome'`). Condiciones: CPU
throttling 4x, 1280×800, 2 s de calentamiento y 30 s con input simulado determinista. El frame es el
intervalo entre callbacks de rAF consecutivos.

Headless da un rAF fijo de 60 Hz. Con interfaz, la frecuencia dependía del monitor en que se abriera
la ventana: el equipo de medición tiene 3 pantallas, que daban 60, 115 o 165 Hz. Eso hacía las
mediciones no comparables entre ejecuciones (decisión del usuario, opción A del paso 8).

| Juego        | FPS medio | p95 frame (ms) | % frames > 33 ms | Renders React / 30 s |
| ------------ | --------- | -------------- | ---------------- | -------------------- |
| Asteroides   | 60,0      | 16,8           | 0,00             | 22 (22 cambios de snapshot) |
| Serpentina   | 60,0      | 16,7           | 0,00             | 0 (0 cambios de snapshot)   |
| Tetris       | 60,0      | 16,7           | 0,00             | 17 (17 cambios de snapshot) |
| Rompebloques | 60,0      | 16,7           | 0,00             | 29 (27 cambios de snapshot + 2 reinicios) |

A 60 Hz con vsync, el p95 se queda pegado al intervalo de vsync (16,7 ± 0,1 ms). Por eso esta tabla
solo detecta frames perdidos, no el margen. El ahorro real se mide además como tiempo ocupado por
hilo en la traza: hilo principal del renderer (`CrRendererMain`) y proceso GPU (`CrGpuMain`).

- Asteroides en `main`, 3 trazas de 30 s: `CrRendererMain` entre 2732 y 3129 ms, `CrGpuMain` entre
  2306 y 2419 ms.

<details><summary>Primera medición descartada (Chrome con interfaz, pantalla a 165 Hz)</summary>

| Juego        | FPS medio | p95 frame (ms) | % frames > 33 ms | Renders React / 30 s |
| ------------ | --------- | -------------- | ---------------- | -------------------- |
| Asteroides   | 164,5     | 6,7            | 0,02             | 23 |
| Serpentina   | 165,0     | 6,7            | 0,00             | 0  |
| Tetris       | 165,0     | 6,7            | 0,00             | 18 |
| Rompebloques | 124,1     | 16,9           | 0,00             | 30 |

</details>

**Hotspots principales (self time en el hilo principal del renderer, traza de 30 s, primera
medición; el reparto se mantiene en headless con valores absolutos menores):**

- Asteroides: `FunctionCall` 1317 ms (JS del loop: `draw` 218 ms, `stroke`, `save`/`translate`),
  `Commit` 1030 ms, `UpdateLayoutTree` 805 ms (+ `PrePaint` 707, `Paint` 653).
- Serpentina: `Commit` 1043 ms, `PrePaint` 716 ms, `UpdateLayoutTree` 706 ms (JS: `drawImage` 127 ms).
- Tetris: `Commit` 935 ms, `Paint` 669 ms, `UpdateLayoutTree` 599 ms (JS: `fillRect` 49 ms,
  `drawBlock` 31 ms).
- Rompebloques: `Commit` 652 ms, `FunctionCall` 533 ms (`drawImage` 151 ms, chunk de React 52 ms,
  `drawOverlay` 21 ms), `UpdateLayoutTree` 397 ms.
- Común a los 4: `IntersectionObserverController::computeIntersections` de 100 a 225 ms cada 30 s.
  La pipeline de estilo/pintado (`UpdateLayoutTree` + `PrePaint` + `Paint` + `Layerize` + `Commit`)
  pesa entre 2 y 4 veces más que el JS de los motores.
- El coste de `shadowBlur` no se ve en CPU: con canvas acelerado se ejecuta en la GPU, fuera del
  hilo principal.

## Después

Medida el 2026-11-11 sobre la rama `spec-11-rendimiento-juegos`, en las mismas condiciones que la
línea base (headless, build de producción, throttling 4x). Son 3 ejecuciones por juego; los rangos
cubren las 3. En las mismas sesiones se repitieron 2 mediciones de `main`, que dieron los mismos
rangos de FPS, p95 y % > 33 ms.

| Juego        | FPS medio | p95 frame (ms) | % frames > 33 ms | Renders React / 30 s |
| ------------ | --------- | -------------- | ---------------- | -------------------- |
| Asteroides   | 60,0      | 16,7–16,8      | 0,00             | 20–29 (= cambios de snapshot) |
| Serpentina   | 60,0      | 16,7–16,8      | 0,00             | 0 (= cambios de snapshot)     |
| Tetris       | 60,0      | 16,7–16,8      | 0,00             | 17–18 (= cambios de snapshot) |
| Rompebloques | 59,9–60,0 | 16,7           | 0,00–0,06 (1 frame en 1 de 3 ejecuciones) | 25–27 (= cambios de snapshot) |

**Tiempo ocupado por hilo cada 30 s (ms, traza), `main` → rama:**

| Juego        | Hilo principal (`CrRendererMain`) | GPU (`CrGpuMain`)         | Compositor   |
| ------------ | --------------------------------- | ------------------------- | ------------ |
| Asteroides   | 2732–3129 → 1811–1912 (−35 %)     | 2205–2419 → 758–790 (−66 %) | 659–724 → 395–405 |
| Serpentina   | 2124–2192 → 1245 (−42 %)          | 1184–1207 → 648 (−46 %)   | 645–651 → 392 |
| Tetris       | 1899–2120 → 1269–1324 (−36 %)     | 1124–1178 → 655–663 (−43 %) | 605–665 → 399–406 |
| Rompebloques | 2618–2773 → 1827 (−32 %)          | 1200–1299 → 718 (−42 %)   | 629–664 → 406 |

- Repintado fuera del canvas, en 5 s de partida: `main` hace 600 `Paint` del viewport completo y
  300 `UpdateLayoutTree`; la rama, 0 y 0.
- Los renders de React coinciden con los cambios de snapshot. En `main`, Rompebloques sumaba además
  un render por cada reinicio: los botones hacían `setSnapshot` directo.
- El p95 de 16,8 ms aparece en las dos versiones: es el cuantizado del vsync a 60 Hz, no un frame
  lento. Ninguna ejecución pierde frames de forma sostenida.

**Pendiente para otra spec (medido, fuera del alcance de esta):** el `drawImage` que recorta y escala
desde la hoja de sprites en cada frame (fruta de Serpentina; bloques, pala y bola de Rompebloques) es
el hotspot JS principal de esos dos juegos. Además, el `IntersectionObserver` presente en `/jugar`
consume entre 61 y 225 ms cada 30 s.

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable por separado.

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/` la guía vigente
   sobre Client Components y `useSearchParams` / lectura de query en cliente (para `?debug=perf`).

1. **Línea base (sin código commiteado).** Con Playwright + CDP (`Emulation.setCPUThrottlingRate`
   = 4), viewport 1280×800, 30 s de partida activa por juego (input simulado para mantener la
   partida viva), capturar la traza de Performance. Calcular FPS medio, p95 y % > 33 ms. Contar
   renders de React del reproductor con un contador temporal. Rellenar la tabla "Línea base" y
   anotar los 3 hotspots principales por juego (Bottom-Up de la traza).
   _Verificación:_ tabla completa para los 4 juegos y hotspots anotados.

2. **Medidor `?debug=perf`.** `app/lib/games/perf-meter.tsx`: ventana deslizante de
   `PERF_WINDOW_FRAMES`, cálculo de `PerfStats`, overlay en esquina fuera del canvas y
   `window.__avPerf`. Aún sin conectar.
   _Verificación:_ `npx tsc --noEmit` pasa; sin el parámetro nada cambia.

3. **Hook `useGameLoop`.** `app/lib/games/use-game-loop.ts`:
   - rAF con `dt` acotado a 0,05 s, `update`, `draw` y snapshot con `sameSnapshot`;
   - muestreo del medidor si `?debug=perf`;
   - pausa con `visibilitychange` / `document.hidden`, reseteando `lastTime` al volver para no
     inyectar un `dt` gigante;
   - omisión de `draw()` cuando `needsRedraw()` es `false`.

   Aún sin usar.
   _Verificación:_ `npx tsc --noEmit` pasa.

4. **`needsRedraw()` en los 4 motores.** Devuelve `false` solo en pausa o game over cuando el
   último frame dibujado ya refleja ese estado. Cualquier cambio de fase, input o reinicio lo pone
   a `true`.
   _Verificación:_ los 4 juegos siguen igual (aún no se consume).

5. **Migrar Asteroides a `useGameLoop`.** Sustituir el loop inline de `player.tsx`. Teclado,
   `TouchPad`, HUD y fullscreen sin cambios.
   _Verificación:_ partida completa, PAUSA/FIN/reinicio y overlay del medidor con `?debug=perf`.

6. **Migrar Serpentina, Tetris y Rompebloques a `useGameLoop`.** Un commit por juego, misma
   verificación que el paso 5.

7. **Caché de glow.** `app/lib/games/glow-cache.ts`: genera en canvas offscreen el sprite con
   `shadowBlur` aplicado una sola vez por clave y lo devuelve para `drawImage`.
   _Verificación:_ `npx tsc --noEmit` pasa.

8. **Asteroides: motor.** Sustituir `shadowBlur` por frame (nave, asteroides, balas, power-ups,
   partículas) por sprites de `glow-cache`. Las formas que rotan se dibujan rotando el sprite
   cacheado. Eliminar las asignaciones por frame señaladas en el paso 1.
   _Verificación:_ comparación visual con captura de `main` en las mismas posiciones; medidor
   con p95 menor que la línea base.

9. **Serpentina: motor.** Glow del segmento cacheado como un único sprite reutilizado (hoy aplica
   `shadowBlur` a cada segmento). Además, asignaciones evitables.
   _Verificación:_ igual que el paso 8.

10. **Tetris: motor.** Aplicar caché de glow y quitar asignaciones solo donde el paso 1 haya
    señalado hotspots. Si no los hay, este paso solo verifica.
    _Verificación:_ igual que el paso 8.

11. **Rompebloques: motor.** Mismo criterio que el paso 10.
    _Verificación:_ igual que el paso 8.

12. **CSS global en `/jugar`.** En `app/globals.css`, bajo `body:has(.av-player)`:
    - detener `gridscroll` en `.av-bg::before`;
    - ocultar o congelar `.av-noise`;
    - sustituir el `backdrop-filter` del nav por fondo opaco equivalente;
    - revisar el `mix-blend-mode` de `.av-bg::after` y `.crt-screen::after` (sustituir por
      opacidad equivalente si la traza los señala).

    _Verificación:_ con Paint flashing / Layers de DevTools no hay repaint continuo fuera del
    canvas en `/jugar`; el área del `.crt` se ve igual.

13. **`prefers-reduced-motion`.** Bloque `@media (prefers-reduced-motion: reduce)` que desactiva
    las animaciones decorativas visibles en `/jugar` (`flicker`, `pulse`, `blink`, `gridscroll`).
    _Verificación:_ con la emulación de DevTools no queda ninguna animación decorativa activa en
    `/jugar`.

14. **Medición "Después" y cierre.** Repetir el paso 1 en las mismas condiciones y rellenar la
    tabla "Después". Ejecutar `npm run lint` y `npm run build`. Entregar para prueba manual en el
    dispositivo real del usuario.

Si el paso 1 revela que el problema real está en otro sitio, los pasos 8 a 12 se ajustan a lo
medido, sin ampliar el alcance.

## Criterios de aceptación

**Rendimiento (Chrome escritorio vía Playwright, CPU throttling 4x, 1280×800, 30 s de partida):**

- [ ] La tabla "Línea base" está completa para los 4 juegos antes de cualquier cambio de código.
- [ ] La tabla "Después" está completa en las mismas condiciones.
- [ ] En los 4 juegos, p95 de tiempo de frame ≤ 16,7 ms.
- [ ] En los 4 juegos, frames > 33 ms < 1 %.
- [ ] Ningún juego empeora respecto a su línea base en ninguna de las métricas de la tabla.
- [ ] El reproductor solo re-renderiza cuando cambia un valor del HUD: renders React / 30 s ≤ nº
      de cambios de snapshot + 1.
- [ ] En pausa y en game over estáticos, `draw()` no se ejecuta (comprobado con contador o traza).
- [ ] Con la pestaña oculta no se ejecutan frames del juego; al volver, la partida continúa sin
      saltos (sin `dt` gigante).
- [ ] En `/jugar`, Paint flashing no muestra repaint continuo fuera del canvas.

**Fidelidad visual:**

- [ ] Las capturas de los 4 juegos en estados equivalentes (partida, pausa, game over) son
      indistinguibles a simple vista de las de `main`, glow incluido.
- [ ] El área del `.crt` y el HUD de `/jugar` se ven igual que en `main`; el fondo puede quedar
      estático.
- [ ] Ninguna otra ruta (`/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/acerca-de`, `/auth`)
      cambia de aspecto ni de animación (salvo con `prefers-reduced-motion`).

**Medidor:**

- [ ] Con `?debug=perf`, `/jugar` muestra FPS, p95 y % > 33 ms fuera del canvas, y
      `window.__avPerf` devuelve un `PerfStats` válido.
- [ ] Sin `?debug=perf`, el medidor no se monta y `window.__avPerf` es `undefined`.

**Accesibilidad:**

- [ ] Con `prefers-reduced-motion: reduce`, `/jugar` no tiene animaciones decorativas activas.

**Estructura:**

- [ ] Los 4 `player.tsx` usan `useGameLoop` y ninguno contiene un loop de `requestAnimationFrame`
      propio.
- [ ] Ningún motor usa `shadowBlur` dentro del loop de partida. Solo puede quedar en la
      generación de sprites de `glow-cache` y en los overlays estáticos.
- [ ] `glow-cache.ts`, `perf-meter.tsx` y los motores no acceden a `window`/`document` en el
      cuerpo del módulo.

**Regresión:**

- [ ] Teclado, pad táctil, PAUSA/FIN/PANTALLA/SALIR, reinicio y `SaveScoreForm` funcionan igual
      en los 4 juegos.
- [ ] La consola no muestra errores ni warnings de hidratación en `/juegos/[id]/jugar`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores nuevos.
- [ ] Prueba manual del usuario en dispositivo real: los 4 juegos se juegan sin tirones
      perceptibles.

## Decisiones tomadas y descartadas

**Tomadas:**

- **Medir antes de optimizar.** El usuario sospecha de Asteroides, pero sin una medición fiable.
  La línea base decide dónde se actúa; los hotspots del código (`shadowBlur`, fondo animado) son
  hipótesis hasta confirmarlos.
- **Métrica numérica y entorno reproducible.** Chrome vía Playwright con CPU throttling 4x en
  lugar de "se nota fluido". Umbral: p95 ≤ 16,7 ms y < 1 % de frames > 33 ms. El dispositivo real
  queda como prueba final, no como métrica.
- **Mismo aspecto visual (opción a).** El glow se pre-renderiza en canvas offscreen en lugar de
  reducirse o eliminarse. El rendimiento no se paga con estética.
- **Hook compartido `useGameLoop`** en lugar de parchear 4 loops. Las optimizaciones de loop
  (visibilidad, omitir `draw()`, medidor) viven en un solo sitio y las heredan los juegos futuros.
- **Teclado fuera del hook.** `GAME_KEYS` y el mapeo varían por juego y ya los comparte `TouchPad`
  vía refs. Meterlo en el hook acoplaría cosas que hoy funcionan.
- **`needsRedraw()` como única API nueva del motor.** Omitir `draw()` en pausa y game over
  estáticos sin que el hook conozca las fases de cada juego.
- **Pausa del loop con `document.hidden`.** Coste cero en pestaña oculta, sin efecto visible.
- **Medidor oculto `?debug=perf` versionado.** Reutilizable para juegos futuros; sin el parámetro
  no se monta.
- **Mediciones registradas en la propia spec** (tablas "Línea base" y "Después"), en lugar de
  `references/perf/` o el PR. La spec queda como registro.
- **CSS global solo en `/jugar`** con `body:has(.av-player)`, mismo patrón que la spec 10. El
  resto de rutas no cambia.
- **Respetar `prefers-reduced-motion`** en las animaciones decorativas visibles en `/jugar`.
- **Orden: Asteroides, Serpentina, Tetris, Rompebloques.** Primero el sospechoso; Serpentina
  después por su `shadowBlur` por segmento.
- **Se permite modificar `engine.ts`**, a diferencia de la spec 10. Es una mejora de rendimiento
  y el coste está en el dibujo.

**Descartadas:**

- **Rendimiento de carga (bundle, LCP, fuentes, imágenes, Supabase).** Problema distinto con
  métricas y herramientas distintas. Va en una SPEC 12.
- **Rendimiento de rutas no-juego.** El usuario acotó esta spec a juegos.
- **Reducir o quitar el glow en móvil (opciones b/c).** Cambia el aspecto; el usuario eligió
  fidelidad.
- **Canvas a `devicePixelRatio`.** Aumenta el coste por frame y cambia el aspecto. El canvas
  sigue en 800×600.
- **Web Workers, `OffscreenCanvas` en worker y WebGL.** Desproporcionado para 4 juegos 2D
  sencillos; se reconsidera solo si Canvas 2D no alcanza el umbral tras esta spec.
- **Parchear cada loop por separado.** Más rápido de escribir, pero repite la lógica 4 veces.
- **Medir solo con DevTools sin dejar nada en el repo.** Obligaría a repetir el montaje en cada
  revisión futura.
- **Benchmarks automatizados en CI.** Fuera de alcance, igual que en las specs 01 a 10.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La línea base no confirma las hipótesis y el coste está en otro sitio (p. ej. compositing del `.crt`, layout del HUD). | El paso 1 manda: los pasos 8 a 12 se ajustan a los hotspots medidos. Si el problema queda fuera del alcance, se anota y va a otra spec. |
| El throttling 4x en escritorio no representa el móvil real (GPU distinta, compositing distinto). | Es la métrica reproducible, no la única: el criterio final incluye la prueba en dispositivo real del usuario. |
| Los sprites de glow cacheados no se ven idénticos al `shadowBlur` en vivo (bordes, mezcla al solaparse, rotación). | Comparación visual con capturas de `main` en estados equivalentes. Margen de padding en el sprite igual a 2× el radio de blur para no recortar el halo. |
| Formas con muchas variantes (asteroides con vértices aleatorios, partículas) hacen crecer la caché sin límite. | Clave por forma + color + blur. Si la línea base muestra muchas variantes, se cachea por tipo y tamaño, no por instancia; tamaño de caché vigilado en el medidor. |
| `needsRedraw()` mal implementado deja un frame obsoleto (p. ej. pausa sin overlay, reinicio sin repintar). | Cualquier cambio de fase, input o reinicio fuerza `true`. Hay criterios de regresión específicos para PAUSA/FIN/reinicio. |
| Al volver de pestaña oculta, el primer `dt` es enorme y el juego "salta". | El hook resetea `lastTime` en `visibilitychange`; además el `dt` sigue acotado a 0,05 s. |
| `useSearchParams` / lectura de `?debug=perf` provoca warning de hidratación o fuerza render dinámico. | Leer el parámetro en `useEffect` (cliente) y montar el medidor solo después; confirmar el patrón en la doc de Next 16 (paso 0). |
| `body:has(.av-player)` no se aplica en algún navegador y el fondo sigue animado. | Soporte amplio en navegadores actuales; si falla, el juego sigue funcionando igual que hoy (degradación sin rotura). |
| Migrar 4 reproductores al hook rompe teclado, pad o fullscreen. | Un commit por juego (pasos 5 y 6) con verificación completa antes de pasar al siguiente. |
| El contador temporal de renders acaba commiteado. | Se usa solo durante la medición; criterio implícito en la revisión del PR. |

## Qué **no** entra en esta spec

- Rendimiento de carga (bundle, LCP/CLS/TBT, fuentes, imágenes, Supabase): SPEC 12.
- Rendimiento o cambios en rutas que no sean `/juegos/[id]/jugar`.
- Canvas a `devicePixelRatio`, Web Workers, `OffscreenCanvas` en worker o WebGL.
- Cambios visuales, de jugabilidad, de controles o de reglas.
- Benchmarks automatizados en CI.
- Cambios en catálogo, migraciones o `saveScore`.

Cada uno de esos puntos, si llega, va en su propia spec.
