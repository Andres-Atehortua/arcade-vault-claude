## Arcade Vault

Plataforma para jugar online y competir por la mayor cantidad de puntos.

## Estado actual

- **Catálogo y salón de la fama**: leídos desde Supabase (`games`, `scores`), con landing, biblioteca filtrable y salón de la fama por juego.
- **Juegos jugables**: Asteroides, Tetris, Rompebloques y Serpentina, cada uno con su propio motor en canvas (`app/lib/games/<juego>/`) y guardado de puntaje bajo alias al terminar la partida.
- **Contacto**: formulario "Acerca de" enviado por email vía Resend (`app/actions/contacto.ts`).
- **Auth**: registro e inicio de sesión con Supabase Auth (email + contraseña con confirmación por correo, o Google/GitHub), recuperación de contraseña y perfil `profiles` con `username` único. Jugar y guardar puntaje siguen abiertos a invitados.

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

## Autenticación

El código vive en `app/actions/auth.ts`, `app/auth/*` y `app/lib/auth/`; la tabla `profiles` en `supabase/migrations/0007_profiles_auth.sql`. Además, hay que configurar a mano Supabase y los proveedores OAuth (SPEC 12):

**Supabase → Authentication**

1. **Sign In / Providers → Email:** activar "Confirm email", mínimo 8 caracteres y requisito "Lowercase, uppercase letters, digits and symbols".
2. **URL Configuration:** Site URL `http://localhost:3000` (o el dominio de producción). Redirect URLs: `http://localhost:3000/**` y `https://<dominio>/**`.
3. **Emails → Templates:** el enlace de cada plantilla debe pasar por `/auth/confirm`:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/biblioteca`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/restablecer`

**Google y GitHub**

1. Crear una app OAuth en Google Cloud (Credentials → OAuth client ID, tipo Web) y otra en GitHub (Settings → Developer settings → OAuth Apps).
2. En ambas, la URL de callback es `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Pegar client ID y secret en Supabase → Authentication → Sign In / Providers → Google / GitHub.

**Correo:** se usa el SMTP por defecto de Supabase, que solo envía unos pocos correos por hora y puede no entregar a direcciones fuera del equipo del proyecto. Para pruebas, usar correos del equipo.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs implementadas en `specs/01` a `specs/12` (visual, landing/biblioteca, contacto, Supabase, leaderboard/catálogo, los motores de Asteroides, Tetris, Rompebloques y Serpentina, controles táctiles, rendimiento de juegos y autenticación).
