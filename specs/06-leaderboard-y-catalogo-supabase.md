# SPEC 06 — Leaderboard y catálogo en Supabase

> **Estado:** Approved
> **Depende de:** SPEC 04 — Integración base con Supabase, SPEC 05 — Asteroides: motor jugable
> **Fecha:** 2026-08-01
> **Rama:** `spec/leaderboard-catalog`
> **Objetivo:** Mover el catálogo de juegos y los puntajes a las tablas `games` y `scores` de Supabase, y convertir el salón de la fama y el leaderboard por juego en vistas de datos reales, con guardado de puntaje bajo alias al terminar una partida de Asteroides.

## Alcance

**Dentro:**

- Migración SQL versionada en `supabase/migrations/` que crea las tablas `games` y `scores` en el schema `public`, con sus índices y políticas RLS.
- Seed del catálogo: las 9 entradas actuales de `app/data/games.ts` insertadas en `games` vía migración, con sus valores de `best` y `plays` copiados tal cual.
- Seed de puntajes ficticios en `scores` para los 8 juegos **sin** motor real (todos menos `asteroides`), generados con el mismo tono de alias que `PLAYERS` en `app/data/scores.ts`. `asteroides` arranca sin filas.
- RLS: `SELECT` público (rol `anon`) sobre `games` y `scores`; `INSERT`, `UPDATE` y `DELETE` denegados a `anon` y `authenticated` en ambas tablas.
- Nueva variable de entorno `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo `NEXT_PUBLIC_`) documentada en `.env.template`, y cliente admin `app/lib/supabase/admin.ts` que la usa. Solo se importa desde Server Actions.
- Interfaces TypeScript escritas a mano para las filas: `GameRow` y `ScoreRow`, en `app/lib/supabase/types.ts`.
- Capa de acceso a datos en `app/lib/supabase/queries.ts` (Server Components): `getGames()`, `getGameById(id)`, `getScoresByGame(gameId, limit)` y `getAllScores(limit)`.
- `app/data/games.ts` se elimina. El tipo de la fila de catálogo y la constante `CATS` pasan a `app/lib/supabase/types.ts`; `GAMES` y `getGameById` desaparecen y sus consumidores pasan a leer de Supabase.
- `app/data/scores.ts` se elimina por completo (`seededScores` y `PLAYERS` dejan de existir en el bundle; `PLAYERS` sobrevive solo como fuente de los alias del seed SQL).
- ISR sobre el catálogo: `export const revalidate = 60` en las páginas que leen `games` (`/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`), para no pegarle a la red en cada request.
- `/salon`: el Server Component precarga en una sola query los puntajes de los 9 juegos y se los pasa a `hall-of-fame.tsx`; el componente sigue siendo cliente y solo cambia de pestaña en memoria. Muestra 12 filas por juego.
- `/juegos/[id]`: el bloque de puntajes lee de `scores` vía `getScoresByGame(id, 10)` en vez de `seededScores`.
- Estados vacíos: cuando un juego no tiene puntajes (caso de `asteroides` al empezar), `hall-of-fame.tsx` y `/juegos/[id]` muestran "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" en lugar del podio y la tabla. Con 1 o 2 filas, el podio renderiza solo los slots que existen.
- Guardado post-partida en Asteroides: el overlay de GAME OVER pide un alias (3–12 caracteres, `[A-Z0-9_]`, forzado a mayúsculas) y lo envía junto al puntaje a la Server Action `app/actions/scores.ts`, que valida e inserta con el cliente admin.
- Confirmación tras guardar: el overlay muestra la posición obtenida en el ranking del juego (ej. "PUESTO #4") y permite reiniciar la partida.
- `CHECK` en la BD sobre el formato del alias y sobre el rango del puntaje (entero, `>= 0`, `<= 10000000`), replicando la validación de la Server Action.

**Fuera de alcance (para specs futuras):**

- Cualquier flujo de autenticación real. El alias es texto libre validado, no una identidad; dos personas pueden usar el mismo.
- Ligar puntajes a `auth.users` (columna `user_id`). Cuando exista auth, se añade en su spec.
- Recalcular `best` y `plays` de `games` desde los puntajes reales. Siguen siendo columnas estáticas, sembradas una vez.
- Guardado de puntajes en los otros 8 juegos: no tienen motor, no hay nada que guardar.
- Antifraude serio (firma del puntaje, validación de la partida en servidor, rate limiting). La Server Action sigue confiando en el puntaje que reporta el navegador.
- Panel de administración para editar el catálogo o borrar puntajes. El catálogo se modifica con nuevas migraciones.
- Supabase Realtime en el leaderboard (que se actualice solo al entrar un puntaje nuevo).
- Paginación o histórico completo de puntajes: solo se muestra el top N.
- Filtro por fecha en el salón (semanal, mensual, histórico).

## Modelo de datos

### Tabla `games`

```sql
create table public.games (
  id          text primary key,                      -- slug: 'asteroides'
  title       text not null,                         -- 'ASTEROIDES'
  short       text not null,
  long        text not null,
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                         -- clase CSS: 'cover-asteroides'
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  best        integer not null default 0,
  plays       text not null default '0',             -- preformateado: '12.4K'
  position    integer not null,                      -- orden de la biblioteca
  created_at  timestamptz not null default now()
);
```

`position` es nueva: el orden del array en `app/data/games.ts` era implícito y hay que preservarlo (la biblioteca lo muestra en ese orden y `hall-of-fame.tsx` abre en el primer juego). Todas las lecturas ordenan por `position asc`.

### Tabla `scores`

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id) on delete cascade,
  alias       text not null check (alias ~ '^[A-Z0-9_]{3,12}$'),
  score       integer not null check (score >= 0 and score <= 10000000),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

Se guardan **todas** las partidas: un mismo alias puede aparecer varias veces en el ranking. El rango del ranking no se almacena — se deriva del índice de la fila en el resultado ordenado.

### RLS

Ambas tablas con `enable row level security`. Una única política por tabla: `select` para los roles `anon` y `authenticated`. No se crea ninguna política de `insert`/`update`/`delete`, así que quedan denegadas por defecto para esos roles; el `service_role` las evita por completo y es el único camino de escritura.

### `app/lib/supabase/types.ts`

```ts
export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
export type GameAccent = 'cyan' | 'magenta' | 'yellow' | 'green';

export interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameAccent;
  best: number;
  plays: string;
  position: number;
}

export interface ScoreRow {
  id: string;
  game_id: string;
  alias: string;
  score: number;
  /** ISO 8601 desde Postgres; la UI la formatea a DD/MM/YYYY */
  created_at: string;
}

export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;
```

El tipo `Game` de `app/data/games.ts` no se "mueve": **se renombra a `GameRow`** y adopta los nombres de columna de Postgres. Los componentes que hoy importan `Game` (`game-card.tsx`, `library-filters.tsx`, `player.tsx`, `hall-of-fame.tsx`) pasan a importar `GameRow`. Un solo tipo para la fila de BD y para las props de la UI, sin capa de mapeo intermedia.

`created_at` se formatea en la UI con un helper `formatScoreDate(iso: string): string` en `app/lib/format.ts`, que devuelve `DD/MM/YYYY`. Se formatea en el Server Component antes de pasar los datos al cliente, para que no haya diferencia de zona horaria entre servidor y navegador.

### `app/actions/scores.ts` — contrato de la Server Action

```ts
export type SaveScoreResult = { ok: true; rank: number } | { ok: false; error: string };

export const saveScore = async (gameId: string, alias: string, score: number): Promise<SaveScoreResult> => { ... };
```

Valida `gameId` (debe existir en `games`), `alias` (3–12 chars, `[A-Z0-9_]` tras pasarlo a mayúsculas y recortar espacios) y `score` (entero en rango). Inserta con el cliente admin y devuelve la posición del puntaje recién guardado, contada como `count(*) where game_id = $1 and score > $2` más uno.

## Plan de implementación

0. **Antes de escribir código.** Revisar en `node_modules/next/dist/docs/01-app/`: `04-functions/revalidate.md` (o la referencia del segmento `revalidate` vigente en Next 16.2.12), la guía de Server Actions (`03-api-reference/04-functions/server-actions` o equivalente) y `generateStaticParams`. Seguir esos documentos por encima de cualquier patrón previo.

1. **Migración de esquema.** Crear `supabase/migrations/0001_games_and_scores.sql` con las tablas `games` y `scores`, el índice `scores_game_score_idx`, `enable row level security` en ambas y la política de `select` público. Aplicar con `apply_migration`. Verificación: `list_tables` muestra `public.games` y `public.scores` con `rls_enabled: true`; un `select` con la anon key devuelve 0 filas sin error; un `insert` con la anon key falla por RLS.

2. **Seed del catálogo.** Crear `supabase/migrations/0002_seed_games.sql` con los 9 `insert` derivados del array `GAMES` actual, incluyendo `position` 1..9 en el orden del archivo. Aplicar. Verificación: `select count(*) from games` devuelve 9; `select id from games order by position` devuelve el mismo orden que el array de hoy, con `asteroides` en `best = 0` y `plays = '0'`.

3. **Seed de puntajes ficticios.** Crear `supabase/migrations/0003_seed_scores.sql` con ~12 filas por cada uno de los 8 juegos que no son `asteroides` (96 filas), usando alias del conjunto `PLAYERS` actual y `created_at` repartidos en 2026. Aplicar. Verificación: `select game_id, count(*) from scores group by game_id` devuelve 8 grupos; `asteroides` no aparece.

4. **Tipos y helper de formato.** Crear `app/lib/supabase/types.ts` (`GameRow`, `ScoreRow`, `GameCategory`, `GameAccent`, `CATS`) y `app/lib/format.ts` (`formatScoreDate`). Todavía nadie los importa. Verificación: `npx tsc --noEmit` pasa.

5. **Cliente admin y variable de entorno.** Añadir `SUPABASE_SERVICE_ROLE_KEY=` a `.env.template` con un comentario de que es secreta y solo de servidor. Crear `app/lib/supabase/admin.ts` con `createAdminClient()` usando `createClient` de `@supabase/supabase-js` y la service role key, con `auth: { persistSession: false }`. Verificación: `npx tsc --noEmit` pasa; el archivo no aparece importado desde ningún Client Component.

6. **Capa de consultas.** Crear `app/lib/supabase/queries.ts` con `getGames()`, `getGameById(id)`, `getScoresByGame(gameId, limit)` y `getAllScores(limit)`, usando el cliente de servidor de SPEC 04 y devolviendo los tipos del paso 4. `getAllScores` trae los top N por juego en una sola query. Verificación: `npx tsc --noEmit` pasa; nadie las consume aún.

7. **Biblioteca desde Supabase.** `app/biblioteca/page.tsx` pasa a `async`, llama a `getGames()`, declara `export const revalidate = 60` y pasa las filas a `library-filters.tsx`, que cambia su prop de `Game[]` a `GameRow[]`. Verificación: `/biblioteca` muestra las 9 tarjetas en el mismo orden y con los mismos textos que antes; los filtros por categoría siguen funcionando.

8. **Detalle de juego: catálogo.** `app/juegos/[id]/page.tsx` reemplaza `getGameById` del archivo de datos por el de `queries.ts`, adapta `generateStaticParams` para leer de `getGames()`, y añade `revalidate = 60`. El bloque de puntajes sigue con `seededScores` de momento. Verificación: `/juegos/asteroides` y `/juegos/caida` renderizan igual; un id inexistente sigue cayendo en `not-found.tsx`.

9. **Detalle de juego: leaderboard real.** El mismo archivo pasa a usar `getScoresByGame(id, 10)`, formatea las fechas con `formatScoreDate` y añade el estado vacío "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" cuando no hay filas. Verificación: `/juegos/caida` muestra 10 filas sembradas; `/juegos/asteroides` muestra el estado vacío.

10. **Página de jugar.** `app/juegos/[id]/jugar/page.tsx` usa `getGameById` de `queries.ts` y `getGames()` en `generateStaticParams`; `player.tsx` cambia su prop de `Game` a `GameRow`. Verificación: `/juegos/asteroides/jugar` sigue arrancando la partida igual que en SPEC 05; `/juegos/caida/jugar` sigue mostrando "SIN CARTUCHO".

11. **Salón de la fama.** `app/salon/page.tsx` pasa a `async`, llama a `getGames()` y `getAllScores(12)`, formatea fechas y pasa ambos al componente. `hall-of-fame.tsx` recibe `games: GameRow[]` y `scoresByGame: Record<string, ScoreRow[]>` como props, elimina `useMemo`/`seededScores` y solo mantiene el `useState` del tab. Verificación: las 9 pestañas funcionan sin red al cambiar; los 8 juegos sembrados muestran podio y tabla.

12. **Estados vacío y parcial del podio.** En `hall-of-fame.tsx`, renderizar el podio slot a slot según cuántas filas haya, y sustituir podio + tabla por el estado vacío cuando la lista está vacía. Verificación: la pestaña ASTEROIDES muestra el estado vacío sin errores en consola; las otras 8 no cambian.

13. **Borrado de los datos mock.** Eliminar `app/data/games.ts` y `app/data/scores.ts`. Verificación: `grep -rn "data/games\|data/scores\|seededScores" app` no devuelve nada; `npm run build` pasa.

14. **Server Action de guardado.** Crear `app/actions/scores.ts` con `saveScore(gameId, alias, score)`: normaliza el alias, valida los tres campos, inserta con el cliente admin, calcula el rango y devuelve `SaveScoreResult`. Verificación: invocarla desde un formulario temporal o desde el propio overlay del paso 15 inserta la fila; con un alias inválido devuelve `{ ok: false }` y no inserta nada.

15. **Overlay de guardado en Asteroides.** En `player.tsx`, el estado de GAME OVER muestra un campo de alias (mayúsculas forzadas, `maxLength=12`) y un botón GUARDAR que llama a `saveScore`. Tras responder, el overlay muestra "PUESTO #N" y el mensaje de reinicio; el error de validación se muestra en línea sin cerrar el overlay. Reiniciar sin guardar sigue siendo posible. Si el paso se pasa de ~50 líneas, extraer el formulario a `app/lib/games/asteroides/save-score-form.tsx`. Verificación: terminar una partida, guardar con alias válido, y ver esa fila aparecer en `/juegos/asteroides` y en la pestaña ASTEROIDES del salón tras recargar.

16. **Pasada estática.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni advertencias.

## Criterios de aceptación

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni advertencias.
- [x] `supabase/migrations/` contiene los tres archivos SQL versionados y `list_migrations` los reporta aplicados en el proyecto.
- [x] `select count(*) from public.games` devuelve 9, con `position` de 1 a 9 sin huecos ni repetidos.
- [x] `select count(*) from public.scores` devuelve 96, repartidas en los 8 juegos distintos de `asteroides`.
- [x] `select count(*) from public.scores where game_id = 'asteroides'` devuelve 0 antes de jugar la primera partida.
- [x] Un `insert` en `scores` con la anon key falla por RLS; el mismo `insert` con la service role key funciona.
- [x] Un `select` sobre `games` y sobre `scores` con la anon key devuelve filas.
- [x] Un `insert` con alias `ab` (2 caracteres) o `pepe!` falla por el `CHECK` de la BD.
- [x] Un `insert` con `score = -1` o `score = 10000001` falla por el `CHECK` de la BD.
- [x] `.env.template` documenta `SUPABASE_SERVICE_ROLE_KEY` sin valor; el valor real no aparece en ningún archivo versionado.
- [x] `grep -rn "SUPABASE_SERVICE_ROLE_KEY" app` solo devuelve `app/lib/supabase/admin.ts`.
- [x] `grep -rn "supabase/admin" app` no devuelve ningún archivo con `'use client'`.
- [x] `app/data/games.ts` y `app/data/scores.ts` no existen; `grep -rn "seededScores\|data/games\|data/scores" app` no devuelve nada.
- [x] `/biblioteca` muestra las 9 tarjetas en el mismo orden y con los mismos títulos, textos y coberturas que antes de esta spec.
- [x] Los filtros por categoría de `/biblioteca` siguen funcionando sobre los datos de Supabase.
- [x] `/juegos/caida` muestra 10 filas de puntajes reales de la tabla `scores`, ordenadas de mayor a menor.
- [x] Las fechas del leaderboard se muestran como `DD/MM/YYYY` y son idénticas en el HTML del servidor y tras la hidratación (sin advertencia de hydration mismatch en consola).
- [x] `/juegos/asteroides` muestra "AÚN NO HAY PUNTAJES — SÉ EL PRIMERO" en lugar del bloque de puntajes, sin errores en consola.
- [x] `/juegos/id-inexistente` sigue mostrando la pantalla de `not-found.tsx`.
- [x] `/salon` muestra las 9 pestañas y cambiar de pestaña no dispara ninguna petición de red (verificable en la pestaña Network de DevTools).
- [x] La pestaña ASTEROIDES del salón muestra el estado vacío en vez del podio, sin errores en consola.
- [x] Con exactamente 1 puntaje guardado en `asteroides`, el podio del salón renderiza solo el slot de oro y la tabla muestra 1 fila.
- [x] `/juegos/asteroides/jugar` arranca la partida con el mismo comportamiento que en SPEC 05; `/juegos/caida/jugar` sigue mostrando "SIN CARTUCHO".
- [x] Al terminar una partida de Asteroides, el overlay de GAME OVER muestra un campo de alias y un botón GUARDAR.
- [x] El campo de alias convierte lo escrito a mayúsculas y no admite más de 12 caracteres.
- [x] Guardar con alias válido muestra "PUESTO #N" con N igual a la posición real del puntaje en el ranking del juego.
- [x] Guardar con alias de menos de 3 caracteres muestra un error en línea, no cierra el overlay y no inserta ninguna fila.
- [x] Tras guardar y recargar, ese puntaje aparece en `/juegos/asteroides` y en la pestaña ASTEROIDES de `/salon`.
- [x] Es posible reiniciar la partida sin guardar el puntaje.
- [x] Guardar dos puntajes con el mismo alias produce dos filas distintas en el ranking, no una actualización.

## Decisiones

- **Sí:** tabla `games` en Postgres como fuente única del catálogo. El leaderboard necesita una clave foránea real hacia el juego; mantener el catálogo en un archivo TS obligaría a duplicar los ids en dos sitios que se pueden desincronizar.
- **No:** conservar `app/data/games.ts` como fallback si Supabase falla. Dos fuentes de verdad para lo mismo, y el fallback silencioso oculta caídas reales en vez de exponerlas.
- **Sí:** `revalidate = 60` en las páginas que leen el catálogo. El catálogo cambia con migraciones, no en caliente; una petición por minuto es de sobra y las páginas siguen sirviéndose desde caché.
- **No:** ISR sobre los puntajes. Un leaderboard con hasta 60 segundos de retraso haría que tu propio puntaje recién guardado no apareciera al recargar, que es la primera cosa que un jugador comprueba.
- **Sí:** columna `position` en `games`. El orden del array actual era información real que se perdería en una tabla sin orden explícito; `order by title` cambiaría cómo se ve la biblioteca.
- **Sí:** `best` y `plays` como columnas estáticas, copiadas del archivo actual. Derivarlas de `scores` haría que 8 de 9 juegos mostraran cifras inventadas presentadas como reales, y que `asteroides` mostrara `0` partidas jugadas hasta que alguien guardara la primera.
- **Sí:** sembrar puntajes ficticios para los 8 juegos sin motor. Deja una sola ruta de lectura (todo sale de `scores`) y permite borrar `seededScores`; el coste es que hay datos falsos en la BD, aislados en su propia migración y fáciles de borrar más tarde.
- **No:** sembrar `asteroides`. Es el único juego con motor real y SPEC 05 ya decidió no inventarle historia (`best: 0`); un podio ficticio ahí competiría contra puntajes reales de personas.
- **No:** seguir usando `seededScores` en cliente para los juegos sin motor. Dos fuentes de verdad para el mismo bloque de UI, con dos formas distintas de calcular el rango y la fecha.
- **Sí:** escritura solo por Server Action con la service role key. Cierra el agujero trivial de insertar puntajes con `curl` y la anon key, sin necesidad de auth.
- **No:** política de `INSERT` público para `anon` con un `CHECK` de rango. Es más simple, pero deja la tabla escribible desde cualquier consola del navegador con la clave que ya viaja al cliente.
- **Sí:** `CHECK` de formato y rango en la BD **además** de la validación en la Server Action. La validación en código protege el mensaje de error para el usuario; el `CHECK` protege la integridad de los datos frente a cualquier futuro camino de escritura.
- **Sí:** alias de texto libre validado, sin identidad. Desbloquea un leaderboard real ahora; ligar puntajes a `auth.users` es aditivo (una columna `user_id` nullable) cuando exista la spec de auth.
- **Sí:** guardar todas las partidas, no solo la mejor por alias. Un alias no identifica a una persona, así que "la mejor de PX_KAI" no significa nada; además el histórico completo permite añadir después rankings por fecha sin haber perdido datos.
- **Sí:** tipos escritos a mano en `app/lib/supabase/types.ts` (elección del usuario). Menos ceremonia que generar y versionar `database.types.ts`; el riesgo es que se desincronicen del esquema y se asume.
- **Sí:** un solo tipo `GameRow` para la fila de BD y para las props de la UI. Con 10 campos y sin transformaciones, una capa de mapeo a un tipo de dominio sería ceremonia pura.
- **Sí:** precargar en `/salon` los puntajes de los 9 juegos en una sola query. Son 108 filas como máximo; cambiar de pestaña sin red es mejor UX que un spinner por pestaña, y evita meter el cliente browser de Supabase en el bundle.
- **Sí:** formatear las fechas en el servidor antes de pasarlas al cliente. Formatear en el navegador con la zona horaria local produciría un HTML distinto al del servidor y un hydration mismatch.
- **No:** Supabase Realtime en el leaderboard. No hay concurrencia real que lo justifique todavía; entra en su propia spec si alguna vez hace falta.
- **No:** antifraude serio (firmar el puntaje, validar la partida en servidor). El navegador sigue reportando su propio puntaje y puede mentir; se acepta y se documenta como riesgo.

## Riesgos

| Riesgo                                                                                                                                                             | Mitigación                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` termina en el bundle del navegador por importar `app/lib/supabase/admin.ts` desde un Client Component. La clave evita RLS por completo. | Sin prefijo `NEXT_PUBLIC_`, así que Next no la inyecta en cliente y el import fallaría en build. Dos criterios de aceptación lo verifican con `grep` explícito.                          |
| El puntaje lo reporta el navegador: cualquiera puede llamar a la Server Action con un valor inventado.                                                             | Riesgo aceptado y documentado. El `CHECK` de rango acota el daño a valores plausibles; el antifraude real está fuera de alcance.                                                         |
| `hall-of-fame.tsx` revienta con `rows[0]` indefinido en cuanto un juego no tiene puntajes — exactamente el caso de `asteroides` desde el primer día.                | Pasos 11 y 12 rehacen el podio slot a slot con estado vacío; hay criterios de aceptación para 0 y para 1 fila.                                                                           |
| Borrar `app/data/games.ts` en el paso 13 rompe imports que quedaron sin migrar y solo se descubre en runtime.                                                       | El paso 13 incluye un `grep` de los tres símbolos y `npm run build`; TypeScript falla en compilación ante cualquier import huérfano.                                                     |
| Los tipos a mano se desincronizan del esquema si una migración futura añade o renombra columnas, y TypeScript no lo detecta.                                        | Decisión consciente del usuario. Los tipos viven en un único archivo (`app/lib/supabase/types.ts`) junto a `queries.ts`, para que la actualización sea un solo sitio.                    |
| Las páginas del catálogo pasan de estáticas a depender de la red; una caída de Supabase deja `/biblioteca` y `/juegos/[id]` sin contenido.                           | `revalidate = 60` hace que Next siga sirviendo la última versión cacheada mientras revalida, así que una caída breve no se nota. Una caída larga sí rompe la página: se acepta.          |
| El seed de puntajes ficticios queda indistinguible de los reales si algún día se quieren purgar.                                                                    | Viven aislados en `supabase/migrations/0003_seed_scores.sql` y ninguno pertenece a `asteroides`; borrarlos es un `delete from scores where game_id <> 'asteroides'`.                     |

## Lo que **no** está en esta spec

- Autenticación real y puntajes ligados a un usuario (`user_id`).
- Antifraude: firma del puntaje, validación de la partida en servidor, rate limiting.
- Recalcular `best` y `plays` desde los puntajes reales.
- Guardado de puntajes en los 8 juegos sin motor.
- Panel de administración del catálogo o moderación de puntajes.
- Realtime en el leaderboard.
- Paginación, histórico completo o filtros por fecha (semanal, mensual) en el salón.

Cada una, si llega, va en su propia spec.
