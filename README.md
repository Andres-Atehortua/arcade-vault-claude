## Arcade Vault

Plataforma para jugar online y competir por la mayor cantidad de puntos.

## Estado actual

- **Catálogo y salón de la fama**: leídos desde Supabase (`games`, `scores`), con landing, biblioteca filtrable y salón de la fama por juego.
- **Juegos jugables**: Asteroides, Tetris, Rompebloques y Serpentina, cada uno con su propio motor en canvas (`app/lib/games/<juego>/`) y guardado de puntaje bajo alias al terminar la partida.
- **Contacto**: formulario "Acerca de" enviado por email vía Resend (`app/actions/contacto.ts`).
- **Auth**: registro e inicio de sesión con Supabase Auth (email + contraseña con confirmación por correo, o Google/GitHub), recuperación de contraseña y perfil `profiles` con `username` único. Jugar y guardar puntaje siguen abiertos a invitados.
- **Seguridad**: headers HTTP de seguridad y rate limit por IP en las Server Actions de auth, puntajes y contacto (ver [Seguridad](#seguridad)).

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

## Seguridad

Medidas de SPEC 13. Código en `next.config.ts`, `app/lib/security/rate-limit.ts` y `supabase/migrations/0009_rate_limits.sql`.

**Headers HTTP** (`next.config.ts`, todas las rutas, y sin `X-Powered-By` gracias a `poweredByHeader: false`):

| Header | Valor |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Permitted-Cross-Domain-Policies` | `none` |

`Content-Security-Policy` y `Cross-Origin-Embedder-Policy` quedan fuera por ahora.

**Rate limit por IP** en las Server Actions:
- Ventana fija, guardada en la tabla `rate_limits` y gestionada por la función `check_rate_limit`. Ambas son accesibles solo con service role.
- El check va antes de validar el payload, así que los envíos inválidos también cuentan.
- Al superar el límite, el formulario muestra "DEMASIADOS INTENTOS. INTÉNTALO EN X MIN.".
- Si el check falla (Supabase caído, service role key inválida), la acción se bloquea con el error genérico (fail-closed).
- Los límites se ajustan en `RATE_LIMITS`, sin migración.

| Acción | Server Action | Límite |
| --- | --- | --- |
| `sign_up` | `signUp` | 3 / 1 h |
| `sign_in` | `signIn` | 10 / 15 min |
| `password_reset` | `requestPasswordReset` | 3 / 1 h |
| `update_password` | `updatePassword` | 5 / 15 min |
| `set_username` | `setUsername` | 5 / 15 min |
| `oauth` | `signInWithOAuth` | 10 / 15 min |
| `save_score` | `saveScore` | 20 / 10 min |
| `contact` | `enviarContacto` | 3 / 1 h |

La IP sale del primer valor de `x-forwarded-for`, luego de `x-real-ip` y, si no hay ninguno, se usa `'unknown'`. Sin un proxy de confianza delante, `x-forwarded-for` es falsificable. Al desplegar, hay que leer solo la cabecera del proxy real (p. ej. `x-real-ip` en Vercel).

**Configuración manual en Supabase → Authentication**

1. **Rate Limits:** déjalos como respaldo, con valores holgados. Las llamadas a Auth salen del servidor de Next, así que Supabase ve la IP del servidor y su límite "por IP" funciona como un límite global para todos los usuarios.
2. **Password requirements:** confirma un mínimo de 8 caracteres (ya exigido por SPEC 12 en cliente y servidor).
3. **Leaked password protection:** requiere el plan Pro de Supabase y no está activa. Su advisor `auth_leaked_password_protection` (WARN) es un aviso de seguridad aceptado.

**Advisors aceptados:** además del anterior, `rls_enabled_no_policy` (INFO) sobre `public.rate_limits`. Es intencionado: RLS activo sin políticas deja la tabla accesible solo con service role.

**Desarrollo:** en local todas las peticiones salen de `::1` (o `'unknown'`), así que el límite se alcanza enseguida. Para resetear los contadores, ejecuta `delete from public.rate_limits;` en el SQL editor o con `execute_sql` del MCP. La acción se vuelve a permitir al instante.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs implementadas en `specs/01` a `specs/12` (visual, landing/biblioteca, contacto, Supabase, leaderboard/catálogo, los motores de Asteroides, Tetris, Rompebloques y Serpentina, controles táctiles, rendimiento de juegos y autenticación).
