# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: plataforma para jugar online y competir por puntaje (ver README.md). Catálogo y puntajes viven en Supabase; hay 4 juegos jugables con motor propio en canvas (Asteroides, Tetris, Rompebloques, Serpentina), con pad táctil para móvil, landing, biblioteca filtrable, salón de la fama, formulario de contacto por email y autenticación con Supabase Auth (email + contraseña o Google/GitHub).

## Before writing code

Per AGENTS.md, this project's Next.js version (16.2.x, React 19.2) may have breaking changes vs. what you know from training. Check `node_modules/next/dist/docs/` (organized into `01-app`, `02-pages`, `03-architecture`, `04-community`) for the relevant guide before implementing anything, and follow any deprecation notices found there. Notable: middleware ahora se declara como `proxy.ts` en la raíz (`export const proxy = async (request) => {...}`), no como `middleware.ts`.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet. Node version is pinned via `.nvmrc` (26.5).

## Skills

- `/frontend-design`: úsala siempre para diseñar la UI.
- `/arcade-game-spec` (local, `.claude/skills/arcade-game-spec/`): spec de un juego nuevo (`specs/NN-<slug>.md`). Conoce el contrato motor + reproductor + catálogo + leaderboard; su `references/architecture.md` es la fuente de verdad de ese contrato y `references/spec-skeleton.md` la plantilla.
- `/spec` y `/spec-impl` (de `Klerith/fernando-skills`, instaladas con `npx skills@latest add Klerith/fernando-skills` y fijadas en `skills-lock.json`): features que **no** son un juego (páginas, auth, filtros, formularios). `/spec` escribe la spec, `/spec-impl` la implementa.

## Agents

- `@game-planner`: decide qué juego añadir al catálogo cuando aún no está claro; registra la propuesta en `references/games-suggestions/` y su salida alimenta `/arcade-game-spec`. Definición: `.claude/agents/game-planner.md`.

## Code conventions

- Always use arrow functions, never the `function` keyword — including React components, helpers and Next.js special exports. Default-export via `const Page = () => {...}; export default Page;` and declare `export const generateStaticParams = async () => {...}`.
- Prettier (`.prettierrc`): comillas simples, punto y coma, `printWidth` 140, `trailingComma: es5`, 2 espacios.
- Código y comentarios siempre en inglés; el copy de la UI (y las specs) en español.

## Architecture

- App Router (`app/`), TypeScript, path alias `@/*` -> project root (see `tsconfig.json`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`), global styles in `app/globals.css`.
- Fonts: `next/font/google` (Press Start 2P + JetBrains Mono), wired as CSS variables `--font-press-start` / `--font-jetbrains-mono` in `app/layout.tsx`.
- Rutas: `/` (landing), `/biblioteca` (catálogo filtrable), `/juegos/[id]` (detalle + leaderboard, con `not-found.tsx`), `/juegos/[id]/jugar` (partida), `/salon` (salón de la fama), `/acerca-de` (contacto), `/auth` (login/registro/recuperar contraseña), `/auth/alias` (elegir `username` tras el primer login OAuth), `/auth/restablecer` (nueva contraseña), y los route handlers `/auth/confirm` (enlaces de correo, `verifyOtp`) y `/auth/callback` (OAuth).
- Componentes compartidos en `app/components/` (`nav`, `game-card`, `library-filters`, `hall-of-fame`, `empty-scores`, `contact-form`, `reveal`, `home-icons`); helpers en `app/lib/format.ts`. La actividad reciente / top jugadores de la landing es mock estático en `app/data/activity.ts`.
- Auth (spec 12): Server Actions en `app/actions/auth.ts` (`signUp`, `signIn`, `signOut`, `signInWithOAuth`, `requestPasswordReset`, `updatePassword`, `setUsername`); reglas compartidas cliente/servidor en `app/lib/auth/validation.ts` (`USERNAME_REGEX`, `PASSWORD_RULES`, `safeNext`). Tabla `profiles` (`username` único, nulo hasta elegirlo en OAuth, inmutable una vez puesto) creada por el trigger `on_auth_user_created`. El nav lee la sesión en cliente con `app/lib/auth/use-session-profile.ts`: no leer cookies en `layout.tsx`, volvería dinámicas todas las páginas y rompería el ISR del catálogo. Los puntajes siguen sin ligarse a la cuenta.
- Data: catálogo (`games`) y puntajes (`scores`) en Supabase Postgres, migraciones versionadas en `supabase/migrations/` (aplicadas vía el MCP de Supabase configurado en `.mcp.json`). Lecturas vía `app/lib/supabase/queries.ts` (`getGames`, `getGameById`, `getScoresByGame`, `getAllScores`) desde Server Components, catálogo con `revalidate = 60`; escrituras (guardar puntaje, contacto) vía Server Actions en `app/actions/` usando el cliente admin (`app/lib/supabase/admin.ts`, solo server-side, nunca importado desde un Client Component).
- Clientes Supabase: `client.ts` (browser), `server.ts` (RSC/Server Actions), `admin.ts` (service role), tipos en `types.ts`. `proxy.ts` en la raíz refresca la sesión con `@supabase/ssr` en cada request.
- Juegos: cada juego jugable tiene su motor en canvas y reproductor en `app/lib/games/<juego>/` (`engine.ts` + `player.tsx`, más assets propios como `levels.ts`, `spritesheet.ts` o `sprites.ts`). El mapa `gameId -> player` vive en `app/juegos/[id]/jugar/page.tsx`. Piezas compartidas en `app/lib/games/`:
  - `use-game-loop.ts`: loop rAF común que alimenta el snapshot del motor al reproductor (spec 11).
  - `glow-cache.ts`: sprites de glow pre-renderizados para evitar `shadowBlur` por frame (spec 11).
  - `touch-pad.tsx`: gamepad táctil compartido con layout por juego (spec 10); referencia visual en `references/gamepad-assets/`.
  - `perf-meter.tsx`: overlay de rendimiento activable con `?debug=perf`.
  - `use-can-fullscreen.ts`: detecta soporte de pantalla completa.
  - `save-score-form.tsx`: al terminar la partida pide alias y guarda vía `saveScore` en `app/actions/scores.ts`.
- Email: envío de contacto con Resend desde `app/actions/contacto.ts` (`RESEND_API_KEY`).
- Variables de entorno: ver `.env.template` (`RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- CI: `.github/workflows/deploy.yml` construye y publica `./out` en GitHub Pages en cada push a `main`. Ojo: `next.config.ts` no define `output: 'export'` (y las Server Actions no son compatibles con export estático), así que ese paso de upload no tiene `./out` que publicar.

## Spec Driven Design

This project follows spec-driven development using the `/spec` and `/spec-impl` skills (see Skills). Use these (or `/arcade-game-spec` for games) when adding new features rather than implementing ad hoc.

Las specs aprobadas viven en `specs/NN-<slug>.md` (01 MVP visual → 12 Registro, login y autenticación) y cada una se implementó en su propia rama `spec-NN-*` mergeada por PR. Lee la spec más reciente antes de tocar un área ya especificada.

Referencias en `references/`:
- `started-games/`: juegos de referencia (HTML/JS/assets) como punto de partida para portar uno nuevo.
- `games-suggestions/`: propuestas de juegos de `@game-planner`, con índice en su `README.md`.
- `gamepad-assets/`: diseño standalone del gamepad neón (base de `touch-pad.tsx`).
