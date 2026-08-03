## Arcade Vault

Plataforma para jugar online y competir por la mayor cantidad de puntos.

## Estado actual

- **Catálogo y salón de la fama**: leídos desde Supabase (`games`, `scores`), con landing, biblioteca filtrable y salón de la fama por juego.
- **Juegos jugables**: Asteroides, Tetris, Rompebloques y Serpentina, cada uno con su propio motor en canvas (`app/lib/games/<juego>/`) y guardado de puntaje bajo alias al terminar la partida.
- **Contacto**: formulario "Acerca de" enviado por email vía Resend (`app/actions/contacto.ts`).
- **Auth**: página `/auth` en construcción (aún sin flujo real de autenticación).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + `@supabase/ssr`) para catálogo y puntajes
- Resend para el envío de emails de contacto

## Desarrollo

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # correr el build de producción
npm run lint     # eslint
```

Variables de entorno: ver `.env.template` (claves de Supabase y de Resend).

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs implementadas en `specs/01` a `specs/09` (visual, landing/biblioteca, contacto, Supabase, leaderboard/catálogo, y los motores de Asteroides, Tetris, Rompebloques y Serpentina).
