# SPEC 01 — MVP visual: cinco pantallas del portal

> **Estado:** Approved
> **Depende de:** —
> **Fecha:** 2026-07-30
> **Objetivo:** Portar las cinco pantallas del prototipo de `references/templates/` a rutas reales del App Router, con datos ficticios y sin lógica de juego, autenticación ni backend.

## Alcance

**Dentro:**

- Cinco rutas del App Router: `/` (biblioteca), `/juegos/[id]` (detalle), `/juegos/[id]/jugar` (reproductor), `/auth`, `/salon`.
- `Nav` y footer movidos a `app/layout.tsx`, visibles en todas las rutas.
- Datos ficticios tipados en `app/data/games.ts` y `app/data/scores.ts`.
- Interactividad puramente visual como Client Components: búsqueda + chips de categoría (biblioteca), tabs por juego (salón), menú hamburguesa (nav), tabs iniciar sesión / crear cuenta (auth).
- Página `not-found` para `/juegos/[id]` cuando el `id` no existe en `GAMES`.
- Reutilización del CSS ya presente en `app/globals.css`; solo se añaden reglas si falta alguna clase del prototipo.

**Fuera de alcance (para specs futuras):**

- Cualquier motor de juego o canvas jugable. `/juegos/[id]/jugar` es una pantalla estática.
- Autenticación real, sesión, `localStorage` o React Context de usuario. El formulario de `/auth` es decorativo.
- Persistencia de puntuaciones. `seededScores()` genera datos deterministas en cada render.
- Base de datos, API routes y cualquier `fetch` a servidor.
- Botones `PAUSA` y `FIN` del HUD operativos; van `disabled` en esta spec.
- Reescritura del estilado a utilidades Tailwind.
- Contador de créditos funcional y login social (Google / GitHub): botones decorativos.

## Modelo de datos

Dos archivos nuevos. Ninguna estructura se persiste: todo vive en memoria y se regenera en cada render.

### `app/data/games.ts`

```ts
export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
export type GameAccent = 'cyan' | 'magenta' | 'yellow' | 'green';

export interface Game {
  id: string;          // slug de la URL: /juegos/bloque-buster
  title: string;       // en mayúsculas, como se muestra
  short: string;       // una línea, para la tarjeta de la biblioteca
  long: string;        // párrafo, para la ficha de detalle
  cat: GameCategory;
  cover: string;       // clase CSS del degradado de portada, p. ej. "cover-bricks"
  color: GameAccent;   // acento del botón JUGAR
  best: number;        // mejor puntuación global
  plays: string;       // ya formateado: "12.4K"
}

export const GAMES: Game[];                      // los 8 juegos del prototipo
export const CATS: readonly ['TODOS', ...GameCategory[]];
export function getGameById(id: string): Game | undefined;
```

### `app/data/scores.ts`

```ts
export interface ScoreRow {
  rank: number;
  name: string;   // alias del jugador, p. ej. "PX_KAI"
  score: number;
  date: string;   // "DD/MM/YYYY", ya formateado
}

export const PLAYERS: readonly string[];         // los 18 alias del prototipo
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Convenciones:

- `seededScores` usa un LCG (`s = (s * 9301 + 49297) % 233280`) y es determinista: mismo `seed` ⇒ mismas filas en servidor y cliente. Esto evita desajustes de hidratación.
- Semilla de la ficha de detalle: `id.length * 17 + 3`, `count = 10`. Semilla del salón: `id.length * 23 + 7`, `count = 12`. Iguales al prototipo.
- Las puntuaciones se formatean en pantalla con `toLocaleString('es-ES')`.
- `cover` y `color` guardan nombres de clase / token CSS, no valores de color. La paleta vive en `app/globals.css`.

## Plan de implementación

0. Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` para las convenciones de esta versión de Next (16.2.12): firma de `params` en rutas dinámicas, `generateStaticParams`, `not-found` y frontera Server/Client. Seguir lo que digan esos documentos por encima de cualquier patrón previo.

1. Crear `app/data/games.ts` con los tipos `Game`, `GameCategory`, `GameAccent`, el array `GAMES` (8 juegos portados de `references/templates/data.jsx`), `CATS` y `getGameById`. Verificación: `npx tsc --noEmit` pasa.

2. Crear `app/data/scores.ts` con `ScoreRow`, `PLAYERS` y `seededScores`. Verificación: `seededScores(20, 12)` devuelve 12 filas ordenadas de mayor a menor `score`, con `rank` de 1 a 12.

3. Crear `app/components/nav.tsx` como Client Component: logo, enlaces con `next/link` a `/` y `/salon`, contador de créditos decorativo, botón "Iniciar Sesión" que enlaza a `/auth`, y panel móvil con `useState`. El estado activo se calcula con `usePathname()`. Verificación: al navegar entre rutas el enlace activo cambia y el panel móvil abre y cierra.

4. Montar `Nav` y el footer en `app/layout.tsx`, dentro del wrapper `av-app` y envolviendo `children` en `<main className="av-main">`. Verificación: `npm run dev` muestra nav y footer en todas las rutas.

5. Crear `app/components/game-card.tsx` como Client Component con el efecto tilt de `onMouseMove`, envuelto en `next/link` hacia `/juegos/[id]`. Verificación: la tarjeta se inclina con el cursor y navega al hacer clic.

6. Reescribir `app/page.tsx` como Server Component que renderiza el hero y delega a `app/components/library-filters.tsx` (Client Component con `useState` para búsqueda y categoría, que recibe `GAMES` por props). Incluir el estado vacío "NO HAY RESULTADOS". Verificación: escribir "cai" deja una tarjeta; el chip PUZZLE filtra a los juegos de esa categoría.

7. Crear `app/juegos/[id]/page.tsx` como Server Component: portada, tags, descripción larga, `stat-strip`, botones (`JUGAR AHORA` → `/juegos/[id]/jugar`, `VOLVER AL VAULT` → `/`) y tabla lateral de mejores puntuaciones con `seededScores(id.length * 17 + 3, 10)`. Llamar a `notFound()` si `getGameById` devuelve `undefined`. Verificación: `/juegos/caida` renderiza la ficha; `/juegos/xxx` muestra el 404.

8. Añadir `generateStaticParams` en `app/juegos/[id]/page.tsx` y un `app/juegos/[id]/not-found.tsx` con estética arcade y enlace de vuelta a `/`. Verificación: `npm run build` prerrenderiza las 8 fichas.

9. Crear `app/juegos/[id]/jugar/page.tsx` como Server Component estático: HUD con jugador `INVITADO`, puntuación `0`, 3 vidas y nivel `01`; botones `PAUSA` y `FIN` con `disabled`; `SALIR` enlazando a `/juegos/[id]`; marco CRT con la arena decorativa y la barra inferior. Sin timers, sin modal de fin de partida. Verificación: la pantalla no muestra actividad ni errores de hidratación en consola.

10. Crear `app/auth/page.tsx` como Client Component: tabs iniciar sesión / crear cuenta que muestran u ocultan el campo de correo, inputs controlados, botón de envío que llama a `router.push('/')`, y botones decorativos de invitado, Google y GitHub. Verificación: al cambiar de tab aparece y desaparece el campo de correo; el envío navega a `/` sin recargar la página.

11. Crear `app/salon/page.tsx` con la cabecera y el Client Component `app/components/hall-of-fame.tsx`: chips por juego, podio de tres puestos y tabla de 12 filas usando `seededScores(id.length * 23 + 7, 12)`. Sin la fila "TU MEJOR MARCA". Verificación: cambiar de chip reemplaza podio y tabla.

12. Repasar `app/globals.css` y añadir únicamente las reglas del prototipo que falten. No modificar las existentes. Verificación: ninguna clase usada en los componentes queda sin definir.

13. Pasada final: `npm run lint` y `npm run build` sin errores ni advertencias.

Nota sobre el paso 6: el prototipo abre el detalle desde la tarjeta con un `onClick`; aquí se usa `next/link` para tener prefetch y clic derecho → abrir en pestaña nueva.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/` muestra el hero, la barra de búsqueda, los 5 chips de categoría y 8 tarjetas de juego.
- [ ] Escribir "cai" en la búsqueda deja visible solo la tarjeta de CAÍDA.
- [ ] Pulsar el chip PUZZLE deja visible solo CAÍDA; pulsar TODOS restaura las 8 tarjetas.
- [ ] Una búsqueda sin resultados muestra el bloque "NO HAY RESULTADOS".
- [ ] Hacer clic en una tarjeta navega a `/juegos/<id>` de ese juego.
- [ ] `/juegos/caida` muestra título, descripción larga, los tres bloques de `stat-strip` y 10 filas de puntuaciones ordenadas de mayor a menor.
- [ ] `/juegos/id-inexistente` muestra la página `not-found` con enlace de vuelta a `/`.
- [ ] `JUGAR AHORA` en la ficha navega a `/juegos/<id>/jugar`.
- [ ] En `/juegos/caida/jugar` la puntuación se queda en `0` durante al menos 10 segundos y no aparece ningún modal.
- [ ] En `/juegos/caida/jugar` los botones `PAUSA` y `FIN` están `disabled` y `SALIR` vuelve a `/juegos/caida`.
- [ ] En `/auth`, la tab CREAR CUENTA muestra el campo de correo y la tab INICIAR SESIÓN lo oculta.
- [ ] Enviar el formulario de `/auth` navega a `/` y el Nav sigue mostrando "Iniciar Sesión".
- [ ] `/salon` muestra el podio de tres puestos y una tabla de 12 filas, sin ninguna fila "TU MEJOR MARCA".
- [ ] Cambiar de chip en `/salon` reemplaza el contenido del podio y de la tabla.
- [ ] El Nav marca como activo el enlace correspondiente a la ruta actual, incluidas `/juegos/<id>` y `/juegos/<id>/jugar` (que activan Biblioteca).
- [ ] A 390 px de ancho, el botón hamburguesa abre el panel lateral y navegar por él lo cierra.
- [ ] La consola del navegador no muestra errores de hidratación en ninguna de las cinco rutas.
- [ ] Recargar `/juegos/caida` y `/salon` produce exactamente las mismas puntuaciones que antes de recargar.

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon`). URLs compartibles, prefetch y prerrenderizado gratis.
- **No:** replicar el router por hash del prototipo en un único `page.tsx`. Sería fiel al original pero desperdicia el framework.
- **Sí:** consumir las clases de `app/globals.css` tal cual (`.card`, `.crt`, `.av-nav`…). El CSS ya está commiteado y probado; reescribirlo a utilidades Tailwind es riesgo sin beneficio en un MVP visual.
- **No:** reescribir el estilado con utilidades Tailwind. Queda para una spec futura si alguna vez hace falta.
- **Sí:** Server Components por defecto; `'use client'` solo en Nav, tarjeta, filtros, auth y salón. Reduce el JS enviado al navegador.
- **Sí:** pantalla de juego completamente estática. Sin motor no hay nada que simular, y un contador falso confunde sobre el estado real del producto.
- **No:** el simulador del prototipo (puntuación autoincremental, modal de fin de partida, guardado). Llega con la spec del primer juego jugable.
- **Sí:** cero estado de sesión. Sin `localStorage`, sin Context, sin cookies. El formulario de `/auth` es decorativo y navega a `/`.
- **No:** persistir el usuario en `localStorage` como hacía el prototipo. Obliga a lidiar con hidratación para simular algo que no existe.
- **No:** la fila "▸ TU MEJOR MARCA" del salón. Dependía del usuario en sesión, que ya no existe.
- **Sí:** datos ficticios en `app/data/`, separados en `games.ts` y `scores.ts`. Un archivo por responsabilidad; migrar a base de datos afectará solo a esa carpeta.
- **Sí:** `seededScores` determinista con LCG. Servidor y cliente generan las mismas filas, lo que evita desajustes de hidratación sin necesidad de `useEffect`.
- **No:** `Math.random()` para las puntuaciones. Rompería la hidratación y haría los criterios de aceptación no verificables.
- **Sí:** `next/link` en las tarjetas de juego en lugar del `onClick` del prototipo. Habilita prefetch y abrir en pestaña nueva.
- **Sí:** `PAUSA` y `FIN` visibles pero `disabled`. Conserva la composición del HUD y comunica que aún no hay juego.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Next 16 cambió la firma de `params` en rutas dinámicas respecto a lo conocido (ahora es un `Promise`). Un port hecho de memoria falla en build. | Paso 0 del plan: leer `node_modules/next/dist/docs/01-app/` antes de escribir la primera ruta dinámica. |
| El efecto tilt de `GameCard` escribe en `el.style.transform` directamente. Si el componente se marca por error como Server Component, el build rompe. | `app/components/game-card.tsx` lleva `'use client'` explícito y no exporta nada que un Server Component pueda renderizar sin él. |
| `seededScores` se ejecuta en servidor (ficha de detalle) y en cliente (salón). Cualquier dependencia de `Date.now()` o del locale rompe la hidratación. | La función solo depende del `seed`. Las fechas vienen precalculadas dentro del propio LCG y el formato numérico se fija con `toLocaleString('es-ES')`. |
| `app/globals.css` fue portado antes de existir los componentes. Puede faltar alguna clase del prototipo o sobrar otra. | Paso 12: repaso de clases usadas contra las definidas, añadiendo solo lo que falte y sin tocar lo existente. |
| Una carpeta `app/data/` dentro del directorio de rutas puede confundirse con un segmento de ruta. | No contiene `page.tsx` ni `route.ts`, así que Next no genera ninguna ruta. Documentado en la sección de modelo de datos. |
| La pantalla estática de juego puede leerse como un bug ("el juego no arranca"). | La barra inferior del CRT y el HUD deshabilitado comunican el estado; el texto exacto se decide durante la implementación con `/frontend-design`. |

## Lo que **no** entra en esta spec

- Motores de juego, canvas o cualquier lógica jugable.
- Autenticación real, sesión persistente y login social.
- Persistencia de puntuaciones y base de datos.
- API routes y llamadas a servidor.
- Migración del estilado a utilidades Tailwind.

Cada una de esas, si llega, va en su propia spec.
