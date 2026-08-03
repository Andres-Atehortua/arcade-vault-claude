# Esqueleto de una spec de juego

Los pasos y criterios que se repiten en todo juego nuevo del Vault. Instancia los
marcadores `<slug>`, `<Juego>`, `<TÍTULO>`, `<N>` y ajusta según la mecánica: quita lo que
no aplique y añade lo propio del juego. El objetivo no es rellenar una plantilla a ciegas,
sino que el juego número 5 se integre igual que el número 2 y que nadie tenga que
redescubrir el orden correcto.

## Header

```markdown
# SPEC NN — <Juego>: motor jugable en el Vault

> **Estado:** Draft
> **Depende de:** SPEC 05 — Asteroides: motor jugable, SPEC 06 — Leaderboard y catálogo en Supabase
> **Fecha:** YYYY-MM-DD
> **Objetivo:** Añadir "<Juego>" al catálogo y a `/juegos/<slug>/jugar` con motor propio, HUD sincronizado, controles de teclado y táctiles, y guardado de puntaje en el leaderboard.
```

Toda spec de juego depende de esas dos: SPEC 05 fijó el contrato de motor y reproductor,
SPEC 06 dejó catálogo y leaderboard listos para cualquier `gameId`.

## Plan de implementación — pasos canónicos

Cada paso deja el repo compilando y trae su propia verificación.

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/` la guía
   vigente sobre la frontera Server/Client Component y `'use client'`. Seguir esos
   documentos por encima de cualquier patrón previo.

1. **Entrada de catálogo.** `supabase/migrations/000N_add_game_<slug>.sql` con el `insert`
   en `public.games`, `position` = máximo actual + 1, `best = 0`, `plays = '0'`. Aplicar
   con `apply_migration`.
   *Verificación:* `select id, position from games order by position` muestra la fila nueva
   al final; `/biblioteca` renderiza la tarjeta.

2. **Cover.** `.cover-<slug>` en la sección de covers de `app/globals.css`, con la técnica
   gradiente + pseudo-elementos, visualmente distinta de las existentes.
   *Verificación:* la tarjeta de `/biblioteca` se ve con su portada propia.

3. **Motor.** `app/lib/games/<slug>/engine.ts` con las entidades y la clase `<Juego>Game`
   según el contrato de `architecture.md`: `update`/`draw`/`handleInput`/`pause`/`resume`/
   `end`/`restart`/`getSnapshot`, paleta neon, sin HUD dibujado en el canvas.
   *Verificación:* `npx tsc --noEmit` pasa; el archivo no importa nada de `react` ni `next`
   y no toca `window`/`document` en el cuerpo del módulo.

4. **Reproductor.** `app/lib/games/<slug>/player.tsx` (`'use client'`): canvas dentro de
   `.crt-screen`, instancia del motor en un `useEffect` con limpieza, loop de
   `requestAnimationFrame`, captura de teclado y sincronización del snapshot con el
   `player-hud`.
   *Verificación:* en `/juegos/<slug>/jugar` la partida arranca sola, los controles
   responden, y el HUD refleja el estado real en vivo.

5. **Controles táctiles.** Botones del layout acordado, escribiendo en los mismos
   `keys`/`justPressed` que consume el motor, visibles solo bajo `pointer: coarse` o el
   breakpoint móvil.
   *Verificación:* con emulación táctil de DevTools se juega sin teclado; en escritorio no
   se muestran.

6. **PAUSA / FIN / PANTALLA / SALIR.** Botones del HUD conectados a `pause()`/`resume()`,
   `end()`, fullscreen sobre el `.crt`, y `Link` a `/juegos/<slug>`.
   *Verificación:* PAUSA congela y cambia su texto a REANUDAR; FIN muestra el overlay de
   game over con el puntaje acumulado.

7. **Dispatch de la ruta.** `app/juegos/[id]/jugar/page.tsx` enruta `<slug>` a su
   reproductor (mapa `slug -> componente`), conservando el fallback "SIN CARTUCHO" para los
   juegos sin motor.
   *Verificación:* `/juegos/caida/jugar` no cambia; `/juegos/<slug>/jugar` muestra el canvas
   jugable.

8. **Guardado de puntaje.** El overlay de game over monta `SaveScoreForm` con
   `{ gameId, score }`; reiniciar sin guardar sigue siendo posible.
   *Verificación:* terminar una partida, guardar con un alias válido, ver `PUESTO #N`, y
   encontrar esa fila en `/juegos/<slug>` y en la pestaña del salón tras recargar.

9. **Pasada estática.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni
   advertencias.

10. **Verificación manual.** Con `npm run dev`: partida completa de principio a fin,
    PAUSA/FIN/SALIR, entrar y salir de la ruta varias veces (para descartar loops
    duplicados), y consola del navegador sin errores ni warnings de hidratación.

## Criterios de aceptación recurrentes

Copia los que apliquen y añade los propios de la mecánica del juego — esos son los que de
verdad prueban que el motor funciona.

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni advertencias.
- [ ] `supabase/migrations/` contiene la migración nueva y `list_migrations` la reporta aplicada.
- [ ] `select count(*) from public.games` devuelve `<N>`, con `position` consecutivo sin huecos ni repetidos.
- [ ] `/biblioteca` muestra la tarjeta de `<TÍTULO>` con su cover propio, distinto de los demás.
- [ ] Los filtros por categoría de `/biblioteca` incluyen el juego nuevo en su categoría.
- [ ] `/juegos/<slug>` renderiza la ficha completa (portada, tags, descripción, stat-strip, botón `JUGAR AHORA`).
- [ ] `/juegos/<slug>` muestra "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" antes de la primera partida guardada.
- [ ] `/juegos/<slug>/jugar` arranca la partida automáticamente al cargar.
- [ ] `engine.ts` no importa `react` ni `next` y no accede a `window`/`document` en el cuerpo del módulo.
- [ ] El HUD externo refleja en vivo el estado real de la partida, sin duplicarse dentro del canvas.
- [ ] Botón `PAUSA`: congela el juego, cambia su texto a `REANUDAR`, y al pulsarlo de nuevo la partida sigue donde quedó.
- [ ] Botón `FIN`: termina la partida de inmediato con el puntaje acumulado.
- [ ] Botón `SALIR` navega a `/juegos/<slug>`.
- [ ] Al terminar la partida aparece el formulario de alias; guardar con alias válido muestra `PUESTO #N` con la posición real.
- [ ] Guardar con alias de menos de 3 caracteres muestra un error en línea y no inserta ninguna fila.
- [ ] Es posible reiniciar la partida sin guardar el puntaje.
- [ ] En ventana angosta o con emulación táctil aparecen los controles táctiles y permiten jugar sin teclado; en escritorio no se muestran.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/<slug>/jugar`.
- [ ] Los juegos sin motor (`/juegos/caida/jugar` y compañía) siguen mostrando "SIN CARTUCHO" sin cambios.

## Decisiones que toda spec de juego debe cerrar

Aunque la respuesta sea la misma que en Asteroides, escríbela: la sección Decisiones es lo
que evita reabrir el debate dentro de seis meses.

- Slug en español y su coexistencia con juegos parecidos ya en el catálogo.
- `best = 0` / `plays = '0'` frente a cifras inventadas.
- `class` en el motor como excepción documentada a la convención de arrow functions.
- Motor separado del reproductor, framework-agnostic.
- HUD fuera del canvas.
- Paleta neon en vez de la del original.
- Overlay de game over dentro del canvas frente a un modal HTML.
- Dispatch: mapa `slug -> componente` frente a cadena de `if`.
- `SaveScoreForm`: mover a ubicación compartida frente a duplicar.
- CSS táctil: renombrar el bloque de Asteroides y compartirlo frente a uno propio.
- Assets del original: portar, sustituir por vectorial neón, o dejar fuera de alcance.
- Qué queda explícitamente para specs futuras.
