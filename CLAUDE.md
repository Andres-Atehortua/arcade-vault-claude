# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: plataforma para jugar online y competir por puntaje (ver README.md). El proyecto está en etapa inicial (scaffold de `create-next-app`), sin features de dominio implementadas aún.

## Before writing code

Per AGENTS.md, this project's Next.js version may have breaking changes vs. what you know from training. Check `node_modules/next/dist/docs/` (organized into `01-app`, `02-pages`, `03-architecture`, `04-community`) for the relevant guide before implementing anything, and follow any deprecation notices found there.

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

Use always /frontend-design to design the user interface.

## Code conventions

- Always use arrow functions, never the `function` keyword — including React components, helpers and Next.js special exports. Default-export via `const Page = () => {...}; export default Page;` and declare `export const generateStaticParams = async () => {...}`.

## Architecture

- App Router (`app/`), TypeScript, path alias `@/*` -> project root (see `tsconfig.json`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`), global styles in `app/globals.css`.
- Fonts: `next/font/google` (Geist Sans/Mono), wired as CSS variables in `app/layout.tsx`.

## Spec Driven Design

This project follows spec-driven development using the `/spec` and `/spec-impl` skills from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`). Use these when adding new features rather than implementing ad hoc.
