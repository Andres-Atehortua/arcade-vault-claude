# SPEC 10 — Controles táctiles y revisión mobile

> **Estado:** Implemented
> **Depende de:** SPEC 05 — Asteroides, SPEC 07 — Tetris, SPEC 08 — Rompebloques, SPEC 09 — Serpentina
> **Fecha:** 2026-11-11
> **Objetivo:** Hacer jugables los 4 juegos en móvil vertical mediante un pad táctil propio
> bajo el canvas (shell compartido, layout por juego) y eliminar el desborde horizontal y los
> HUD/footers rotos de `/juegos/[id]/jugar` y del resto de pantallas a 360/390/768px.

## Alcance

**Dentro:**

- Pad táctil compartido: un componente "shell" genérico (zona propia bajo el `.crt`, nunca
  superpuesta al canvas) y un layout por juego que se le pasa como configuración de botones.
  Se muestra solo con `(pointer: coarse)`; en escritorio no aparece.
  - Asteroides: izquierda ◀ ▶ (rotar), derecha ▲ (empuje) + disparo grande.
  - Tetris: izquierda ◀ ▶ ▼, derecha rotar + hard drop grande.
  - Serpentina: cruz de 4 direcciones.
  - Rompebloques: sin pad; se mantiene el arrastre sobre el canvas, solo se verifica.
- Comportamiento del pad: pointer events con multitouch (mover y disparar a la vez),
  `touch-action: none` en pad y canvas (sin scroll/zoom accidental), hold-to-repeat donde el
  juego ya repite por teclado, vibración corta opcional (`navigator.vibrate`, solo si existe).
  Los botones inyectan el mismo estado que el teclado (`keys` / `justPressed`), sin tocar los
  motores.
- Corrección del desborde horizontal en `/juegos/[id]/jugar` (causa probable: `.hud-actions`
  sin `flex-wrap`, nav cortado a la derecha), confirmada midiendo `scrollWidth` vs
  `clientWidth` antes de arreglar.
- HUD compacto en pantallas estrechas: una fila con Puntos / Vidas (o Longitud) / Nivel, y
  botones PAUSA / FIN / SALIR reducidos; `JUGADOR` y `SKIN` ocultos en móvil.
- Ocultar el nav global en `/juegos/[id]/jugar` solo en pantallas estrechas (queda SALIR).
- Ocultar `.crt-bottom` (footer del CRT) en pantallas estrechas.
- Ocultar el botón `PANTALLA` cuando `document.fullscreenEnabled` es falso (iOS Safari).
- Auditoría de las demás rutas (`/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/acerca-de`,
  `/auth`) y nav a 360 / 390 / 768px; se corrigen solo desbordes y roturas de layout.
- Verificación: mediciones de overflow con Playwright (viewport + touch) como apoyo y prueba
  final del usuario en dispositivo real.

**Fuera de alcance (para specs futuras):**

- Rediseño visual de cualquier pantalla (solo se arreglan desbordes y roturas).
- Optimización de landscape en juegos (solo "no rompe"; el objetivo es portrait).
- Bloqueo de orientación o Screen Orientation API.
- Gestos sobre el canvas para Asteroides, Tetris o Serpentina (swipe, etc.).
- Gamepad API / mandos Bluetooth.
- Alternativa de pantalla completa para iOS (p. ej. PWA o "añadir a inicio").
- Sonido y vibración avanzada (solo pulso corto opcional).
- Cambios en motores, catálogo, migraciones de Supabase o `saveScore`.
- Suite de tests automatizados versionada (igual que specs 01–09).

## Modelo de datos

Sin cambios en Supabase ni en persistencia. Solo tipos de cliente nuevos, en el módulo del
pad compartido (`app/lib/games/touch-pad.tsx`, a confirmar en el plan):

```ts
/** One on-screen button. `code` is the KeyboardEvent.code the engine already reads. */
type TouchButton = {
  code: string; // 'ArrowLeft', 'ArrowUp', 'Space', 'KeyX', ...
  label: string; // glyph shown on the button: '◀', '▲', '⟳', ...
  ariaLabel: string; // Spanish copy for screen readers: 'Girar a la izquierda'
  size?: 'md' | 'lg'; // 'lg' for the primary action (fire, hard drop)
  repeat?: boolean; // hold-to-repeat, mirrors the game's keyboard behaviour
};

/** Layout per game: a group on the left (movement) and one on the right (actions). */
type TouchLayout = {
  left: TouchButton[];
  right: TouchButton[];
  variant: 'row' | 'cross'; // 'cross' for Serpentina's 4-direction pad
};

/** Props of the shared shell; it writes into the same refs the keyboard handlers use. */
type TouchPadProps = {
  layout: TouchLayout;
  keysRef: RefObject<Record<string, boolean>>;
  justPressedRef: RefObject<Record<string, boolean>>;
};
```

Mapeo inicial, usando los códigos que cada motor ya lee (`GAME_KEYS` en cada `player.tsx`):

| Juego        | left                                   | right                           | variant |
| ------------ | -------------------------------------- | ------------------------------- | ------- |
| Asteroides   | `ArrowLeft`, `ArrowRight`              | `ArrowUp`, `Space` (lg)         | row     |
| Tetris       | `ArrowLeft`, `ArrowRight`, `ArrowDown` | `ArrowUp` (rotar), `Space` (lg) | row     |
| Serpentina   | `ArrowUp/Down/Left/Right`              | (vacío)                         | cross   |
| Rompebloques | no usa pad                             | no usa pad                      | n/a     |

En Tetris `ArrowUp` = rotar y `Space` = hard drop son supuestos a confirmar al leer su motor
(paso 8). En Serpentina el pad ocupa todo el ancho con la cruz centrada, no en dos grupos.

## Plan de implementación

Cada paso deja el sistema funcional y es verificable por separado.

1. **Diagnóstico (sin código).** Con Playwright (viewport 360 / 390 / 768, `hasTouch`),
   medir `document.documentElement.scrollWidth` vs `clientWidth` y localizar el elemento más
   ancho en `/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar` (4 juegos), `/salon`,
   `/acerca-de`, `/auth`. Anotar causas confirmadas; los pasos 2 y 3 solo arreglan lo medido.

2. **Desborde en rutas no-juego.** Corregir en `app/globals.css` (y `nav` si aplica) lo
   encontrado en el paso 1 fuera de `/jugar`. Quitar `overflow-x: hidden` del `body` solo si
   deja de ser necesario, para no ocultar desbordes reales.

3. **Chrome del reproductor en móvil** (`app/globals.css`, media query estrecha):
   - `.hud-actions` con `flex-wrap`/botones reducidos; HUD en una fila con Puntos / Vidas
     (o Longitud) / Nivel; `JUGADOR` y `SKIN` ocultos.
   - `.crt-bottom` oculto.
   - Nav oculto en `/jugar` con `body:has(.av-player) .nav { display: none }` solo en pantallas
     estrechas (sin JS ni cambios en `layout.tsx`; selector exacto a confirmar al leer `nav`).
   - Tamaño del canvas calculado para que HUD + canvas + pad quepan en `100svh` en portrait.

4. **Botón `PANTALLA` condicional.** En los 4 `player.tsx`, mostrarlo solo si
   `document.fullscreenEnabled`, evaluado en un `useEffect` + estado (no en render) para no
   romper la hidratación.

5. **Pad compartido** (`app/lib/games/touch-pad.tsx` + bloque `ARCADE TOUCH CONTROLS` en
   `globals.css`): tipos de la sección de datos, zona propia bajo `.crt`, visible solo con
   `(pointer: coarse)`. Pointer events por botón con `setPointerCapture`, multitouch,
   `touch-action: none`, `user-select: none`, hold-to-repeat si `repeat`, `navigator.vibrate`
   opcional. Escribe en `keysRef` / `justPressedRef`. Sin conectar aún: el sistema sigue igual.

6. **Serpentina.** Conectar el pad con `variant: 'cross'`. Primer juego por tener un solo
   grupo y sin acción secundaria; valida el shell.

7. **Asteroides.** Conectar pad `row`: ◀ ▶ a la izquierda, ▲ y disparo (`lg`) a la derecha.
   Probar giro + disparo simultáneos.

8. **Tetris.** Leer el motor para confirmar el mapeo (rotar, hard drop, auto-repeat de
   movimiento, `ArrowDown`) y conectar el pad `row` con `repeat` en ◀ ▶ ▼.

9. **Rompebloques.** Sin pad. Verificar arrastre táctil, `touch-action: none` en el canvas
   (que arrastrar no haga scroll de página) y reinicio por tap.

10. **Cierre.** Segunda pasada de medición del paso 1 en todas las rutas, `npm run lint` y
    `npm run build`, y entrega para prueba manual en dispositivo real.

## Criterios de aceptación

**Desborde y layout (360, 390 y 768px, portrait):**

- [x] En todas las rutas (`/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar` x4,
      `/salon`, `/acerca-de`, `/auth`), `scrollWidth <= clientWidth` del documento.
- [x] El nav no queda cortado en ninguna ruta (el icono del extremo derecho es visible y
      pulsable).
- [x] En `/jugar` a 390px de ancho y 844px de alto, HUD + canvas + pad se ven completos sin
      scroll vertical.
- [x] En `/jugar` en pantalla estrecha: HUD en una fila de stats, sin `JUGADOR` ni `SKIN`;
      `.crt-bottom` y el nav global no se muestran; `SALIR` sigue accesible.
- [x] En escritorio (>= 1024px) el aspecto de `/jugar` no cambia respecto a `main`.

**Fullscreen:**

- [x] Con `document.fullscreenEnabled === false` (iOS Safari) el botón `PANTALLA` no se
      renderiza; en Chrome Android y escritorio sigue funcionando.
- [x] No hay warning de hidratación en consola por ese botón.

**Pad táctil (dispositivo real, Android):**

- [x] El pad aparece bajo el canvas, sin tapar ningún píxel del juego, en los 3 juegos con pad.
- [x] En escritorio con ratón el pad no aparece.
- [x] Asteroides: ◀ ▶ rotan, ▲ empuja, el botón grande dispara; girar y disparar a la vez
      funciona (multitouch).
- [x] Tetris: ◀ ▶ ▼ mueven con repetición al mantener; rotar y hard drop funcionan.
- [x] Serpentina: la cruz cambia de dirección; no permite giro de 180° (regla del motor).
- [x] Rompebloques: arrastrar sobre el canvas mueve la paleta y no hace scroll de la página.
- [x] Mantener pulsado un botón del pad no dispara menú contextual, selección de texto ni zoom.
- [x] Al soltar el dedo fuera del botón, la tecla virtual se libera (no queda "pegada").
- [x] Al terminar la partida, el formulario de alias y el reinicio por tap siguen funcionando
      con el pad visible.
- [x] `PAUSA` y `FIN` del HUD siguen funcionando por tap en los 4 juegos.

**Regresión:**

- [x] El teclado sigue funcionando igual en los 4 juegos en escritorio.
- [x] No se modificó ningún `engine.ts`.
- [x] `npm run lint` y `npm run build` pasan sin errores nuevos.

## Decisiones tomadas y descartadas

**Tomadas:**

- **Pad en zona propia bajo el `.crt`, no superpuesto.** El pad anterior (PR #19 `remove/pad`)
  era "muy rudimentario" y se quitó; esta vez se rehace con un shell compartido. Al no tapar
  el canvas, el área de juego no pierde píxeles en pantallas pequeñas.
- **Un shell compartido + layout por juego** (`TouchLayout`), en lugar de un pad por reproductor.
  Evita repetir CSS y lógica de pointer events 3 veces.
- **El pad escribe en `keysRef` / `justPressedRef`, no llama al motor.** Los motores ya se
  alimentan de ahí; así no se toca ningún `engine.ts` y teclado y táctil comparten camino.
- **Pad visible solo con `(pointer: coarse)`.** Una ventana de escritorio estrecha no muestra
  un pad inútil. Se descartó el criterio anterior `(pointer: coarse), (max-width: 720px)`.
- **Rompebloques sin pad.** Su único control es el arrastre continuo, que ya existe; un pad
  de ◀ ▶ sería peor que arrastrar.
- **Medir antes de arreglar el scroll horizontal.** La causa (`.hud-actions` sin wrap, nav
  cortado) es hipótesis; el paso 1 la confirma o la corrige.
- **Nav oculto en `/jugar` con `body:has(.av-player)` en CSS**, sin JS ni cambios en
  `layout.tsx`. Solo en pantallas estrechas.
- **`PANTALLA` se oculta si no hay Fullscreen API** (iOS Safari), sin alternativa.
- **Portrait como objetivo; landscape solo "no rompe".**
- **Verificación final en dispositivo real por el usuario**; Playwright solo para medir
  overflow.

**Descartadas:**

- **Pad como overlay translúcido sobre el canvas.** Tapa el juego en pantallas de ~360px.
- **Gestos swipe/tap en Asteroides, Tetris y Serpentina.** Más limpios, pero difíciles de
  afinar por juego; si hace falta, spec futura.
- **Rediseño del HUD o de otras pantallas.** Solo se arreglan desbordes y roturas.
- **Gamepad API, bloqueo de orientación y fullscreen alternativo para iOS.** Fuera de alcance.

## Riesgos identificados

- **Acceso desde el teléfono en desarrollo.** `next.config.ts` (cambio local sin commitear)
  lista `169.254.10.29` y `192.168.1.108` en `allowedDevOrigins`, pero la captura de pantalla
  del usuario muestra `192.168.50.34`. Si la IP no está en la lista, Next bloquea recursos de
  dev (HMR, chunks) y la prueba falla sin relación con el código. Mitigación: añadir la IP
  actual solo en local; no commitear IPs personales en el PR.
- **Teclas "pegadas".** Si el dedo sale del botón, llega `pointercancel`, la pestaña pierde
  foco o suena una llamada, el `keyup` virtual puede no llegar. Mitigación: `setPointerCapture`,
  liberar en `pointerup` / `pointercancel` / `lostpointercapture` y en `visibilitychange`.
- **Pantallas bajas.** Los criterios fijan 390x844. En 360x640 (Android básico) HUD + canvas +
  pad pueden no caber. Mitigación: el canvas se escala por altura disponible (`svh`) con un
  mínimo; si aun así no cabe, se permite scroll vertical, nunca horizontal.
- **Barra de URL del navegador móvil.** `100vh` no coincide con el viewport visible; usar `svh`
  (ya usado en `.crt`) y no `vh`.
- **`overflow-x: hidden` en `body` oculta desbordes reales.** Mitigación: medir sobre
  `documentElement` y, tras el paso 2, retirar el `hidden` si ya no hace falta.
- **Mapeo de Tetris sin verificar.** Rotar y hard drop (`ArrowUp` / `Space`) son supuestos;
  se confirman leyendo el motor en el paso 8. Si el motor usa otras teclas, solo cambia el
  `TouchLayout`, no el shell.
- **Hidratación.** Cualquier valor leído de `window`/`document` en render (fullscreen,
  `pointer: coarse`) debe resolverse en `useEffect` o por CSS, para no desajustar SSR y cliente.
- **Scroll de página mientras se juega.** Si el pad o el canvas no declaran `touch-action: none`,
  un arrastre puede mover la página. Cubierto por criterios de aceptación.
