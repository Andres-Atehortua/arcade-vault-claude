# SPEC 02 — Landing page y traslado de la biblioteca

> **Estado:** Approved
> **Depende de:** SPEC 01 — MVP visual: cinco pantallas del portal
> **Fecha:** 2026-07-31
> **Objetivo:** Portar la landing de `references/templates/home-about/home.jsx` a la ruta `/`, mover la biblioteca a `/biblioteca`, y verificar el resultado con capturas de Playwright en escritorio y móvil.

## Alcance

**Dentro:**

- Nueva ruta `/` (Server Component `app/page.tsx`) con las siete secciones del prototipo: hero con siluetas pixel flotantes, `// 01` características, `// 02` rail de 6 juegos, franja de estadísticas, `// 03` actividad en vivo, `// 04` precios + FAQ, y CTA final.
- Biblioteca movida de `app/page.tsx` a `app/biblioteca/page.tsx`, **sin cambios visuales**: conserva su hero `ARCADE VAULT` y `LibraryFilters` tal cual.
- `app/components/nav.tsx`: tres enlaces —`Inicio` → `/`, `Biblioteca` → `/biblioteca`, `Salón de la Fama` → `/salon`— en la barra y en el panel móvil, con la lógica de activo actualizada (`/juegos/*` sigue encendiendo Biblioteca; `/` enciende solo Inicio).
- Dos enlaces existentes repuntados a `/biblioteca`: `VOLVER AL VAULT` en `app/juegos/[id]/page.tsx` y el `router.push` tras enviar el formulario de `app/auth/page.tsx`.
- `app/data/activity.ts` nuevo: `RECENT_SCORES` (7 filas del ticker) y `TOP_PLAYERS` (5 filas del top de hoy), tipados y estáticos.
- `app/components/reveal.tsx` nuevo: Client Component que aplica la clase `.in` vía `IntersectionObserver` y respeta `prefers-reduced-motion` mostrando el contenido visible sin animar.
- Bloques de SVG inline portados como componentes en `app/components/home-icons.tsx`: siluetas del hero e iconos pixel de las tarjetas de características.
- CSS del prototipo anexado a `app/globals.css`: bloque HOME (`styles.css` 931–1070), bloque actividad/precios (1622–1725), la clase `.kicker` y los keyframes que faltan (`bounce`, `float`, `tickin`, `pulse-led`). Sin tocar reglas existentes.
- Pasada de verificación con el MCP de Playwright al terminar: capturas por sección a 1440 px y 390 px, guardadas en `.playwright-evidence/` (carpeta añadida a `.gitignore`).

**Fuera de alcance (para specs futuras):**

- La página `/acerca-de` y el formulario de contacto de `about.jsx`, junto con su cuarto enlace en el nav.
- Datos reales o en vivo en el ticker y el top de jugadores: son constantes escritas a mano, no derivadas de `seededScores`.
- Cualquier cobro, pasarela de pago o cuenta premium detrás de la sección de precios; el copy se porta tal cual, incluido el `12+ JUEGOS` que no coincide con los 8 de `GAMES`.
- Redirect de compatibilidad desde la antigua `/` (biblioteca): la home la reemplaza y no se mantiene alias.
- `metadata` por ruta (`title`/`description` propios de `/` y `/biblioteca`); sigue valiendo la del layout.
- Suite de tests de Playwright versionada. La verificación es una pasada manual asistida, no un `*.spec.ts` en el repo.
- Migración del estilado a utilidades Tailwind.

## Modelo de datos

Un archivo nuevo. Nada se persiste: son constantes en memoria, igual que `games.ts` y `scores.ts`.

### `app/data/activity.ts`

```ts
import type { GameAccent } from './games';

export interface RecentScore {
  player: string; // alias, p. ej. "NEONFOX"
  game: string; // título mostrado, p. ej. "Caída" (no es el id de la ruta)
  score: number;
  ago: string; // ya formateado: "hace 2 min"
  color: GameAccent; // acento del alias: cyan | magenta | yellow | green
}

export interface TopPlayer {
  rank: number; // 1..5
  player: string;
  score: number;
}

export const RECENT_SCORES: readonly RecentScore[]; // las 7 filas del ticker
export const TOP_PLAYERS: readonly TopPlayer[]; // las 5 filas del top de hoy
```

Convenciones:

- `GameAccent` se reutiliza de `app/data/games.ts` en lugar de declarar un tipo de color nuevo. Es exactamente la misma paleta (`neon-cyan`, `neon-magenta`, `neon-yellow`, `neon-green`).
- `ago` es un **string precalculado**, nunca un `Date`. Cualquier cálculo contra `Date.now()` daría valores distintos en servidor y cliente y rompería la hidratación.
- `game` guarda el título tal como se muestra (`"Caída"`, `"Bloque Buster"`), no el slug. El ticker no enlaza a ninguna ficha.
- El ancho de la barra de `TopPlayer` (`tp-fill`) se deriva del índice al renderizar (`100 - i * 16`%), no se almacena.
- Las puntuaciones se formatean en pantalla con `toLocaleString('es-ES')`, como en el resto del proyecto.

### Lo que **no** va en `app/data/`

El texto de las cuatro tarjetas de características, las tres estadísticas, la lista de beneficios del plan y las tres preguntas del FAQ son **copy acoplado a la maquetación**, no datos. Viven como constantes locales dentro de `app/page.tsx`, igual que en el prototipo. Si algún día se editan desde fuera, se promueven a `app/data/` en su propia spec.

## Plan de implementación

0. Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` para esta versión de Next (16.2.12): convenciones de segmentos de ruta, frontera Server/Client y `metadata`. Seguir esos documentos por encima de cualquier patrón previo.

1. **Mover la biblioteca.** `git mv app/page.tsx app/biblioteca/page.tsx`, ajustar los imports relativos (`./components/…` → `../components/…`, `./data/games` → `../data/games`) y renombrar el componente a `Biblioteca`. En la misma pasada, actualizar `app/components/nav.tsx` (enlaces `Inicio` / `Biblioteca` / `Salón de la Fama` en barra y panel móvil, con `isHome = pathname === '/'` e `isLibrary = pathname.startsWith('/biblioteca') || pathname.startsWith('/juegos')`), el `VOLVER AL VAULT` de `app/juegos/[id]/page.tsx` y el `router.push` de `app/auth/page.tsx`. Verificación: `/biblioteca` se ve idéntica a la antigua `/`; el nav no tiene enlaces rotos. `/` devuelve 404 a propósito hasta el paso 5.

2. **Datos.** Crear `app/data/activity.ts` con `RecentScore`, `TopPlayer`, `RECENT_SCORES` (7) y `TOP_PLAYERS` (5), portados de `home.jsx`. Verificación: `npx tsc --noEmit` pasa.

3. **CSS.** Anexar a `app/globals.css`, en secciones comentadas y al final del archivo: el bloque `HOME PAGE` de `references/templates/home-about/styles.css` (líneas 931–1070), el bloque de actividad y precios (1622–1725), la clase `.kicker` y los keyframes ausentes (`bounce`, `float`, `tickin`, `pulse-led`). No modificar ninguna regla existente. Verificación: `/biblioteca`, `/salon`, `/auth` y `/juegos/caida` siguen viéndose exactamente igual.

4. **Reveal.** Crear `app/components/reveal.tsx`: Client Component que renderiza un contenedor con clase `reveal`, observa con `IntersectionObserver` (`threshold: 0.12`), añade `.in` y deja de observar. Si `matchMedia('(prefers-reduced-motion: reduce)')` coincide, aplica `.in` de entrada sin registrar el observer. Acepta `className` para componer con `home-section`, `home-stats` y `home-final`. Verificación: montado sobre un bloque de prueba, la clase `.in` aparece al hacer scroll y está presente desde el inicio con movimiento reducido activado.

5. **Hero.** Crear `app/page.tsx` como Server Component con el hero: eyebrow `▸ INSERTA UNA MONEDA`, título de tres líneas, subtítulo, los dos CTA (`▶ EXPLORAR JUEGOS` → `/biblioteca`, `✦ CREAR CUENTA` → `/auth`) como `next/link`, y el indicador `DESLIZA ▼`. Las ocho siluetas SVG van en `app/components/home-icons.tsx` junto con los iconos de características, para no inflar la página. Verificación: `/` responde, el hero ocupa la altura de la ventana y ambos CTA navegan.

6. **Secciones 01 y 02.** Añadir la rejilla de cuatro tarjetas de características (con `FeatureIcon` desde `home-icons.tsx` y el `transitionDelay` escalonado) y el rail de `GAMES.slice(0, 6)`, donde cada mini-tarjeta es un `next/link` hacia `/juegos/[id]` —igual criterio que las tarjetas de la biblioteca en la spec 01— más el botón `VER TODOS LOS JUEGOS →` hacia `/biblioteca`. Verificación: se ven 4 tarjetas y 6 mini-tarjetas; hacer clic en una lleva a su ficha.

7. **Estadísticas y actividad.** Añadir la franja de tres estadísticas y la sección `// 03` con las dos tarjetas: ticker de `RECENT_SCORES` y top de `TOP_PLAYERS` con las barras y las clases `top1`/`top2`/`top3`, más el botón `VER SALÓN →` hacia `/salon`. Verificación: 7 filas en el ticker, 5 en el top, podio con oro/plata/bronce.

8. **Precios y cierre.** Añadir la sección `// 04` (tarjeta de plan con sello `FREE PLAY`, lista de 6 beneficios, CTA `EMPEZAR GRATIS →` hacia `/auth`, y las 3 preguntas del FAQ) y el bloque final `¿LISTO PARA JUGAR?` con `INSERTAR MONEDA →` hacia `/biblioteca`. Verificación: ambas secciones renderizan y sus CTA navegan.

9. **Animación.** Envolver en `<Reveal>` las cinco secciones posteriores al hero. El hero **no** se envuelve: debe estar visible sin JavaScript. Verificación: al cargar `/` y hacer scroll, cada sección entra con el desplazamiento; con JS deshabilitado el hero sigue visible.

10. **Repaso de CSS.** Contrastar toda clase usada en los componentes nuevos contra las definidas en `app/globals.css` y añadir solo lo que falte. Verificación: ninguna clase queda sin definir.

11. **Pasada estática.** `npm run lint` y `npm run build` sin errores ni advertencias.

12. **Carpeta de evidencias.** Crear `.playwright-evidence/` y añadir la entrada `/.playwright-evidence/` a `.gitignore`. Verificación: `git status` no muestra la carpeta.

13. **Verificación con Playwright.** Con `npm run dev` levantado, usar el MCP de Playwright para capturar `/` a 1440×900 y a 390×844: una captura por sección (hero, características, juegos, estadísticas, actividad, precios, cierre) haciendo scroll hasta cada una para que el reveal se dispare, más una captura de `/biblioteca` en ambos anchos. Nombrado `NN-seccion-<ancho>.png` dentro de `.playwright-evidence/`. Verificación: 16 archivos en la carpeta y ninguna sección aparece en blanco o a medio animar.

**Nota sobre el paso 1:** dejar `/` en 404 durante los pasos 1–4 es deliberado. Crear una home provisional para taparlo añadiría código que se borra en el paso 5.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni advertencias.
- [ ] `/` muestra el hero a pantalla completa con el eyebrow `▸ INSERTA UNA MONEDA`, el título de tres líneas y los dos botones.
- [ ] `▶ EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` navegan a `/biblioteca`.
- [ ] `✦ CREAR CUENTA` y `EMPEZAR GRATIS →` navegan a `/auth`; `VER SALÓN →` navega a `/salon`.
- [ ] La sección `// 01` muestra exactamente 4 tarjetas de características, cada una con su icono SVG y su color (cyan, amarillo, magenta, verde).
- [ ] La sección `// 02` muestra exactamente 6 mini-tarjetas y hacer clic en la primera navega a `/juegos/<id>` de ese juego.
- [ ] La franja de estadísticas muestra los tres bloques (`12+`, `MILES`, `GLOBAL`).
- [ ] La sección `// 03` muestra 7 filas en el ticker y 5 en el top, con las tres primeras del top en oro, plata y bronce.
- [ ] La sección `// 04` muestra la tarjeta de plan con 6 beneficios y las 3 preguntas del FAQ.
- [ ] Al cargar `/` y desplazarse, cada sección posterior al hero pasa de opacidad 0 a visible; ninguna se queda invisible tras el scroll.
- [ ] Con `prefers-reduced-motion: reduce` activado, todas las secciones están visibles nada más cargar, sin desplazamiento.
- [ ] `/biblioteca` renderiza el hero `ARCADE VAULT`, la búsqueda, los 5 chips y las 8 tarjetas, idéntica a como estaba en `/` antes de esta spec.
- [ ] `/` ya no muestra la biblioteca y la antigua URL no se conserva con redirect.
- [ ] El nav muestra tres enlaces: `Inicio`, `Biblioteca` y `Salón de la Fama`, en la barra y en el panel móvil.
- [ ] En `/` está activo `Inicio`; en `/biblioteca` y en `/juegos/caida` está activo `Biblioteca`; en `/salon`, `Salón de la Fama`.
- [ ] `VOLVER AL VAULT` en `/juegos/caida` navega a `/biblioteca`.
- [ ] Enviar el formulario de `/auth` navega a `/biblioteca`.
- [ ] A 390 px de ancho: las características quedan en una columna, el rail en dos, y el hero no produce scroll horizontal.
- [ ] La consola del navegador no muestra errores de hidratación en `/` ni en `/biblioteca`.
- [ ] `.playwright-evidence/` contiene 16 capturas (7 secciones × 2 anchos + `/biblioteca` × 2) y `git status` no la lista.

## Decisiones

- **Sí:** la landing ocupa `/` y la biblioteca se muda a `/biblioteca`. La raíz es lo primero que ve un visitante nuevo y debe vender el producto, no volcarle un catálogo.
- **No:** dejar la landing en `/inicio` y conservar la biblioteca en `/`. Evitaba tocar enlaces, pero deja la raíz haciendo el trabajo equivocado.
- **No:** redirect de compatibilidad desde la antigua `/`. No existe nada que redirigir: `/` sigue respondiendo, solo con otro contenido. Los enlaces externos son inexistentes en un proyecto sin desplegar.
- **Sí:** `/biblioteca` en español, coherente con `/salon` y `/juegos`, y literal respecto al texto del enlace en el nav.
- **Sí:** la biblioteca se mueve **sin retoques visuales**, hero incluido. Rediseñar su cabecera en la misma spec mezclaría un traslado mecánico con decisiones de diseño nuevas.
- **Sí:** nav con tres enlaces. `Acerca de` se añade cuando exista la ruta; un cuarto ítem deshabilitado es un elemento muerto que solo genera clics fallidos.
- **Sí:** `app/data/activity.ts` con `RECENT_SCORES` y `TOP_PLAYERS` como constantes escritas a mano. Mantiene la convención de un archivo por responsabilidad en `app/data/` y aísla el punto que habrá que sustituir cuando existan datos reales.
- **No:** generar la actividad con `seededScores`. Sería coherente con el salón, pero destruiría el copy curado (`"hace 2 min"`, nombres de juego, alias con acento de color) que es justo lo que da vida a la sección.
- **Sí:** `ago` como string precalculado. Cualquier cálculo relativo a `Date.now()` daría distinto en servidor y cliente y rompería la hidratación, exactamente el problema que la spec 01 resolvió con el LCG determinista.
- **Sí:** el copy de características, estadísticas, plan y FAQ vive en `app/page.tsx`. Es texto acoplado a su maquetación, no datos consultables; sacarlo a `app/data/` añadiría indirección sin ningún consumidor que la aproveche.
- **Sí:** `<Reveal>` como Client Component con `IntersectionObserver`, dejando el resto de la página como Server Component. Aísla el único JavaScript que la landing necesita.
- **No:** animaciones con `animation-timeline` (scroll-driven CSS). Cero JS es tentador, pero el soporte fuera de Chromium haría que el resultado dependiese del navegador del revisor.
- **Sí:** el hero queda fuera de `<Reveal>`. Lo primero que se ve no puede depender de que un observer se registre.
- **Sí:** `prefers-reduced-motion` fuerza el estado visible sin observer. Sin esa rama, quien tenga movimiento reducido vería secciones permanentemente en opacidad 0.
- **Sí:** CSS anexado a `app/globals.css`, reutilizando las clases del prototipo tal cual. Misma decisión que la spec 01: el CSS ya está escrito y probado.
- **No:** CSS Modules para la home. Obligaría a renombrar todas las clases del prototipo y dejaría el proyecto con dos convenciones de estilado conviviendo.
- **Sí:** mini-tarjetas como `next/link` en lugar del `onClick` del prototipo. Coherente con la decisión equivalente de la spec 01: prefetch y abrir en pestaña nueva.
- **Sí:** el copy de precios se porta literal, incluido `12+ JUEGOS` frente a los 8 juegos reales. Es un MVP visual con datos ficticios; retocar cifras sueltas da una falsa sensación de exactitud sobre un contenido que es íntegramente ficción.
- **Sí:** evidencias de Playwright en `.playwright-evidence/`, ignorada por git. Son artefactos de una verificación puntual, no documentación del repo, y borrarlas debe costar un `rm -rf`.
- **No:** una suite `*.spec.ts` de Playwright versionada. Introducir un runner de tests es una decisión de infraestructura que merece su propia spec, no un efecto secundario de una landing.
- **Sí:** la verificación con Playwright se limita a capturas por sección en dos anchos. La navegación de los CTA y la limpieza de consola se comprueban a mano contra los criterios de aceptación.

## Riesgos

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El `IntersectionObserver` no se dispara (JS deshabilitado, error de hidratación, sección ya en viewport al cargar) y media página queda en opacidad 0.                                         | El hero queda fuera de `<Reveal>`; el observer usa `threshold: 0.12` y se registra en el primer efecto, de modo que las secciones ya visibles reciben `.in` inmediatamente. El paso 13 captura cada sección tras hacer scroll, justo para detectar este fallo. |
| Anexar 250 líneas a `app/globals.css` puede colisionar con selectores existentes y romper pantallas ya aprobadas. Hay nombres genéricos en juego (`.stat-block`, `.top-row`, `.reveal`).       | El paso 3 solo añade al final y no modifica nada previo; su verificación es revisar que `/biblioteca`, `/salon`, `/auth` y `/juegos/caida` no cambian. `.stat-strip` (existente) y `.stat-block` (nuevo) son selectores distintos.                             |
| Mover `app/page.tsx` deja imports relativos rotos que TypeScript detecta, pero también enlaces `href='/'` esparcidos que **no** da ningún error: apuntarían a la landing en silencio.          | El paso 1 concentra los tres puntos conocidos (nav, `VOLVER AL VAULT`, `router.push` de auth) y se cierra con un `grep` de `href='/'` y `push('/')` sobre `app/` antes de dar el paso por hecho.                                                               |
| El hero usa `min-height: calc(100vh - 60px)`. Si la altura real del nav no es 60 px, aparece una franja sobrante o un recorte.                                                                 | Se comprueba en la captura de escritorio y en la de móvil del paso 13; si no cuadra, se ajusta el `calc` a la altura real de `.av-nav`.                                                                                                                        |
| La landing suma un tercer origen de puntuaciones ficticias (`activity.ts`) junto a `games.ts` y `seededScores`. Los números pueden contradecirse entre pantallas.                              | Es una inconsistencia asumida y documentada: el copy se porta tal cual. Cuando existan datos reales, `app/data/` es el único lugar donde tocar.                                                                                                                |
| `home.jsx` es JSX suelto para navegador: atributos y estructuras que TypeScript o el compilador de React rechazan (`rows="5"`, `strokeWidth` numérico en SVG, claves de `style` en camelCase). | Se porta sección por sección (pasos 5–8) con `npx tsc --noEmit` como red, no de un solo copiar y pegar.                                                                                                                                                        |

## Lo que **no** entra en esta spec

- La página `/acerca-de` y su formulario de contacto.
- Datos reales o en vivo en el ticker y el ranking de la home.
- Pasarela de pago o cuentas premium.
- Suite de tests automatizados con Playwright.
- Migración del estilado a utilidades Tailwind.

Cada una de esas, si llega, va en su propia spec.
