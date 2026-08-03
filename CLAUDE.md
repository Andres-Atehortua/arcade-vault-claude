# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: plataforma para jugar online y competir por puntaje (ver README.md). Catálogo y puntajes viven en Supabase; hay juegos jugables con motor propio en canvas , landing, biblioteca filtrable, salón de la fama, formulario de contacto por email y un `/auth` aún sin flujo real.

## Before writing code

Per AGENTS.md, this project's Next.js version (16.2.x, React 19.2) may have breaking changes vs. what you know from training. Check `node_modules/next/dist/docs/` (organized into `01-app`, `02-pages`, `03-architecture`, `04-community`) for the relevant guide before implementing anything, and follow any deprecation notices found there. Notable: middleware ahora se declara como `proxy.ts` en la raíz (`export const proxy = async (request) => {...}`), no como `middleware.ts`.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet.

Node version is pinned via `.nvmrc` (26.5).

## Skills

- Use always `/frontend-design` to design the user interface.
- Para **añadir un juego nuevo** usa la skill local `/arcade-game-spec` (`.claude/skills/arcade-game-spec/`): ya conoce el contrato de motor + reproductor + catálogo + leaderboard y escribe `specs/NN-<slug>.md`. Su `references/architecture.md` es la fuente de verdad de ese contrato.
- Para features que **no** son un juego (páginas, auth, filtros, formularios) usa `/spec` y luego `/spec-impl`.

## Code conventions

- Always use arrow functions, never the `function` keyword — including React components, helpers and Next.js special exports. Default-export via `const Page = () => {...}; export default Page;` and declare `export const generateStaticParams = async () => {...}`.
- Prettier (`.prettierrc`): comillas simples, punto y coma, `printWidth` 140, `trailingComma: es5`, 2 espacios.
- Código y comentarios siempre en inglés; el copy de la UI (y las specs) en español.

## Architecture

- App Router (`app/`), TypeScript, path alias `@/*` -> project root (see `tsconfig.json`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`), global styles in `app/globals.css`.
- Fonts: `next/font/google` (Geist Sans/Mono), wired as CSS variables in `app/layout.tsx`.
- Rutas: `/` (landing), `/biblioteca` (catálogo filtrable), `/juegos/[id]` (detalle + leaderboard, con `not-found.tsx`), `/juegos/[id]/jugar` (partida), `/salon` (salón de la fama), `/acerca-de` (contacto), `/auth` (placeholder sin flujo real).
- Componentes compartidos en `app/components/` (`nav`, `game-card`, `library-filters`, `hall-of-fame`, `empty-scores`, `contact-form`, `reveal`, `home-icons`); helpers en `app/lib/format.ts`.
- Data: catálogo (`games`) y puntajes (`scores`) en Supabase Postgres, migraciones versionadas en `supabase/migrations/` (aplicadas vía el MCP de Supabase configurado en `.mcp.json`). Lecturas vía `app/lib/supabase/queries.ts` (`getGames`, `getGameById`, `getScoresByGame`, `getAllScores`) desde Server Components, catálogo con `revalidate = 60`; escrituras (guardar puntaje, contacto) vía Server Actions en `app/actions/` usando el cliente admin (`app/lib/supabase/admin.ts`, solo server-side, nunca importado desde un Client Component).
- Clientes Supabase: `client.ts` (browser), `server.ts` (RSC/Server Actions), `admin.ts` (service role), tipos en `types.ts`. `proxy.ts` en la raíz refresca la sesión con `@supabase/ssr` en cada request.
- Juegos: cada juego jugable tiene su propio motor en canvas y componente reproductor en `app/lib/games/<juego>/` (`engine.ts` + `player.tsx`, más assets propios como `levels.ts`, `spritesheet.ts` o `sprites.ts`). El mapa `gameId -> player` vive en `app/juegos/[id]/jugar/page.tsx`; al terminar la partida `app/lib/games/save-score-form.tsx` pide un alias y guarda el puntaje vía `saveScore` en `app/actions/scores.ts`.
- Email: envío de contacto con Resend desde `app/actions/contacto.ts` (`RESEND_API_KEY`).
- Variables de entorno: ver `.env.template` (`RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- CI: `.github/workflows/deploy.yml` construye y publica en GitHub Pages en cada push a `main`.

## Spec Driven Design

This project follows spec-driven development using the `/spec` and `/spec-impl` skills from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`, pinned in `skills-lock.json`). Use these when adding new features rather than implementing ad hoc.

Las specs aprobadas viven en `specs/NN-<slug>.md` (01 MVP visual → 09 Serpentina) y cada una se implementó en su propia rama `spec-NN-*` mergeada por PR. Lee la spec más reciente antes de tocar un área ya especificada. `references/started-games/` guarda juegos de referencia (HTML/JS/assets) que sirven de punto de partida para portar un juego nuevo.
