# SPEC 13 — Medidas de seguridad básicas

> **Estado:** Implemented
> **Depende de:** SPEC 03 — Contacto por email, SPEC 06 — Leaderboard y catálogo en Supabase, SPEC 12 — Registro, login y autenticación
> **Fecha:** 2026-11-11
> **Objetivo:** Endurecer Arcade Vault con headers HTTP de seguridad y un rate limit por IP, persistido en Supabase, en todas las Server Actions de auth, puntajes y contacto.

## Alcance

**Dentro:**

- **Headers de seguridad** en `next.config.ts` (`headers()` con `source: '/(.*)'`), aplicados a todas las rutas:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `X-Permitted-Cross-Domain-Policies: none`
- **`poweredByHeader: false`** en `next.config.ts` (elimina `X-Powered-By`).
- **Rate limit por IP** persistido en Supabase:
  - tabla `public.rate_limits` con RLS activo y sin políticas (solo accesible con service role);
  - función SQL atómica `public.check_rate_limit(...)`, sin `execute` para `anon` ni `authenticated`;
  - migración versionada `supabase/migrations/0009_rate_limits.sql`, aplicada vía MCP.
- **Helper server-side** `app/lib/security/rate-limit.ts`:
  - obtiene la IP (`x-forwarded-for` primer valor → `x-real-ip` → `'unknown'`);
  - llama a la función con el cliente admin;
  - define los límites por acción en una sola constante.
- **Aplicado a 8 Server Actions**, antes de cualquier otra llamada externa:
  - `app/actions/auth.ts`: `signUp`, `signIn`, `requestPasswordReset`, `updatePassword`, `setUsername`, `signInWithOAuth`;
  - `app/actions/scores.ts`: `saveScore`;
  - `app/actions/contacto.ts`: `enviarContacto`.
- **Fail-closed:** si el check falla (error de Supabase), la acción se bloquea con error genérico.
- **Mensaje al superar el límite:** "DEMASIADOS INTENTOS. INTÉNTALO EN X MIN.", en el hueco de error existente de cada formulario.
- **Configuración manual documentada** en la spec y en el README (la hace el usuario):
  - revisar Auth → Rate Limits de Supabase como respaldo, sabiendo que ve la IP del servidor y actúa como límite global;
  - confirmar Auth → Password requirements con mínimo 8 caracteres (ya definido en SPEC 12).
- **Leaked password protection:** documentado en el README que requiere plan Pro de Supabase. No se activa ni se reemplaza.

**Fuera de alcance (para specs futuras):**

- `Content-Security-Policy` y `Cross-Origin-Embedder-Policy`.
- CAPTCHA (Turnstile / hCaptcha).
- Comprobación propia contra HaveIBeenPwned.
- Cambios en RLS de `games`, `scores` o `profiles` (ya activo y verificado).
- Despliegue y arreglo de `.github/workflows/deploy.yml`.
- Bloqueo de cuenta por intentos fallidos (lockout por email).

## Modelo de datos

**Tabla `public.rate_limits`** (migración `0009_rate_limits.sql`):

```sql
create table public.rate_limits (
  key          text        not null,  -- client IP or 'unknown'
  action       text        not null,  -- one of RateLimitAction
  window_start timestamptz not null,
  count        integer     not null default 1,
  primary key (key, action)
);
alter table public.rate_limits enable row level security;
-- No policies: only service_role can read/write.
```

**Función `public.check_rate_limit`:**

```sql
-- Returns 0 if allowed, otherwise seconds until the window resets.
public.check_rate_limit(p_key text, p_action text, p_max integer, p_window_seconds integer)
  returns integer
  language plpgsql security definer set search_path = ''
```

- Atómica con `insert ... on conflict (key, action) do update`:
  - si `window_start + window` ya pasó: reinicia `window_start = now()` y `count = 1`;
  - si no: `count = count + 1`.
- Si tras el upsert `count > p_max`, devuelve los segundos restantes de la ventana. Si no, 0.
- Borra en la misma llamada las filas con `window_start` de más de 1 día (limpieza al vuelo).
- `revoke execute ... from public, anon, authenticated`; `grant execute ... to service_role`.

**Helper `app/lib/security/rate-limit.ts`:**

```ts
export type RateLimitAction =
  | 'sign_up' | 'sign_in' | 'password_reset' | 'update_password'
  | 'set_username' | 'oauth' | 'save_score' | 'contact';

export const RATE_LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number }> = {
  sign_up:         { max: 3,  windowSeconds: 3600 },
  sign_in:         { max: 10, windowSeconds: 900 },
  password_reset:  { max: 3,  windowSeconds: 3600 },
  update_password: { max: 5,  windowSeconds: 900 },
  set_username:    { max: 5,  windowSeconds: 900 },
  oauth:           { max: 10, windowSeconds: 900 },
  save_score:      { max: 20, windowSeconds: 600 },
  contact:         { max: 3,  windowSeconds: 3600 },
};

// Returns null if allowed, or the user-facing error message if blocked or the check failed.
export const checkRateLimit = async (action: RateLimitAction): Promise<string | null> => { /* ... */ };
```

- Mensaje bloqueado: `DEMASIADOS INTENTOS. INTÉNTALO EN ${Math.ceil(retryAfter / 60)} MIN.`
- Mensaje si el check falla (fail-closed): el `generic` existente, "Algo falló al conectar con el Vault. Inténtalo de nuevo."
- Cada Server Action hace `const limited = await checkRateLimit('...'); if (limited) return { ok: false, error: limited };` como primera línea, antes de validar el payload.
- `RateLimitRow` se añade a `app/lib/supabase/types.ts`.

**Headers** (`next.config.ts`): constante `securityHeaders: { key: string; value: string }[]` con los 7 headers del alcance.

## Plan de implementación

1. **Headers de seguridad.** En `next.config.ts`, añadir la constante `securityHeaders`, `headers: async () => [{ source: '/(.*)', headers: securityHeaders }]` y `poweredByHeader: false`.
   Prueba manual: `npm run dev` y `curl -I http://localhost:3000/` muestran los 7 headers y no `X-Powered-By`.
2. **Migración `0009_rate_limits.sql`.** Crea la tabla `rate_limits` con RLS sin políticas y la función `check_rate_limit` con sus `revoke`/`grant`. Se aplica vía MCP.
   Prueba manual con `execute_sql`: llamar 4 veces a `check_rate_limit('test', 'sign_up', 3, 3600)` devuelve `0, 0, 0, >0`; luego borrar las filas de prueba.
3. **Tipos.** Añadir `RateLimitRow` a `app/lib/supabase/types.ts`.
4. **Helper `app/lib/security/rate-limit.ts`.** Incluye `RateLimitAction`, `RATE_LIMITS`, `getClientIp()` (con `headers()` de `next/headers`) y `checkRateLimit()` con el cliente admin y fail-closed. Todavía no se usa en ninguna acción.
5. **Auth: `signUp` y `signIn`.** Llamar a `checkRateLimit` como primera línea.
   Prueba manual: el 4.º registro en una hora muestra "DEMASIADOS INTENTOS. INTÉNTALO EN X MIN.".
6. **Auth: `requestPasswordReset`, `updatePassword`, `setUsername` y `signInWithOAuth`.** El check va como primera línea. En `signInWithOAuth`, si hay bloqueo se devuelve el error en lugar de redirigir.
7. **`saveScore`** en `app/actions/scores.ts`. El check va como primera línea.
8. **`enviarContacto`** en `app/actions/contacto.ts`. El check va como primera línea.
9. **Documentación.** Nueva sección "Seguridad" en `README.md` con:
   - headers aplicados;
   - rate limits por acción;
   - Supabase Auth → Rate Limits como respaldo global (ve la IP del servidor);
   - Password requirements con mínimo 8 caracteres;
   - leaked password protection solo disponible en plan Pro;
   - cómo vaciar `rate_limits` en desarrollo.

   En `CLAUDE.md`, mencionar `app/lib/security/rate-limit.ts` y la tabla `rate_limits` en Architecture.
10. **Verificación de advisors.** Ejecutar `get_advisors` (security). El único aviso permitido es `auth_leaked_password_protection`.

## Criterios de aceptación

**Headers**

- [ ] `curl -I http://localhost:3000/` devuelve `X-Content-Type-Options: nosniff`.
- [ ] Devuelve `X-Frame-Options: DENY`.
- [ ] Devuelve `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Devuelve `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- [ ] Devuelve `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- [ ] Devuelve `Cross-Origin-Opener-Policy: same-origin`.
- [ ] Devuelve `X-Permitted-Cross-Domain-Policies: none`.
- [ ] La respuesta no incluye `X-Powered-By`.
- [ ] Los mismos headers aparecen en `/juegos/<id>/jugar` y en `/auth`.
- [ ] El login con Google y con GitHub sigue funcionando con `Cross-Origin-Opener-Policy` activo.
- [ ] La pantalla completa en `/juegos/<id>/jugar` sigue funcionando.

**Base de datos**

- [ ] La migración `0009_rate_limits.sql` existe en `supabase/migrations/` y figura aplicada en `list_migrations`.
- [ ] `rate_limits` tiene `relrowsecurity = true` y ninguna fila en `pg_policies`.
- [ ] Llamar a `check_rate_limit` con la clave publishable (rol `anon`) devuelve error de permisos.
- [ ] 4 llamadas seguidas a `check_rate_limit('test', 'x', 3, 3600)` devuelven `0, 0, 0` y un valor `> 0`.
- [ ] `get_advisors` (security) solo devuelve `auth_leaked_password_protection`.

**Rate limit en Server Actions**

- [ ] Las 8 acciones (`signUp`, `signIn`, `requestPasswordReset`, `updatePassword`, `setUsername`, `signInWithOAuth`, `saveScore`, `enviarContacto`) llaman a `checkRateLimit` como primera instrucción.
- [ ] El 4.º `signUp` desde la misma IP en una hora muestra "DEMASIADOS INTENTOS. INTÉNTALO EN X MIN." en el formulario, con X entre 1 y 60.
- [ ] El 11.º `signIn` desde la misma IP en 15 min muestra el mensaje de límite.
- [ ] El 4.º envío de contacto en una hora muestra el mensaje de límite y no envía el correo.
- [ ] Al superar el límite de `signInWithOAuth`, el botón muestra el error y no redirige al proveedor.
- [ ] Si la llamada RPC falla (p. ej. `SUPABASE_SERVICE_ROLE_KEY` inválida), la acción devuelve el mensaje genérico y no ejecuta la operación.
- [ ] Al vaciar `rate_limits` se vuelve a permitir la acción de inmediato.

**Documentación y calidad**

- [ ] `README.md` tiene una sección "Seguridad" con headers, límites por acción, configuración manual de Supabase y la nota sobre el plan Pro.
- [ ] `CLAUDE.md` menciona `app/lib/security/rate-limit.ts` y la tabla `rate_limits`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** rate limit propio en las Server Actions, por IP. `signUp` y el resto corren en el servidor de Next, así que Supabase solo ve la IP del servidor y su límite "por IP" actúa como límite global.
- **Sí:** mantener el rate limit nativo de Supabase Auth como respaldo. Es configuración del dashboard, sin coste de código.
- **Sí:** persistir los contadores en una tabla de Supabase (`rate_limits`) con una función SQL atómica. Sobrevive a reinicios y funcionaría con varias instancias.
- **No:** contador en memoria en Node. Se pierde al reiniciar y no se comparte entre instancias.
- **No:** Upstash/Redis u otro servicio externo. Añade una dependencia y otra clave cuando Supabase ya está disponible.
- **Sí:** ventana fija con clave `(key, action)`. Es simple y basta para frenar abuso básico. La ventana deslizante sería más precisa, pero no compensa la complejidad.
- **Sí:** la función devuelve los segundos restantes, no un `boolean`. Así el mensaje puede decir "EN X MIN".
- **Sí:** limitar las 8 acciones (auth, puntajes y contacto). El usuario pidió máxima seguridad, y contacto (Resend) y `saveScore` son vectores claros de spam.
- **Sí:** el check se hace antes de validar el payload. Los envíos inválidos también consumen intentos y frenan más a los bots.
- **Sí:** fail-closed si el check falla. Se prioriza la seguridad aunque una caída de Supabase bloquee las acciones, que de todos modos dependen de Supabase.
- **Sí:** IP desde `x-forwarded-for` (primer valor) → `x-real-ip` → `'unknown'`. Detrás de un proxy desconocido, la cabecera es falsificable. Se acepta hasta que haya un despliegue definido.
- **Sí:** limpieza al vuelo de filas con más de 1 día dentro de la propia función. Evita depender de `pg_cron`.
- **Sí:** 7 headers + `poweredByHeader: false`. No requieren configuración adicional ni rompen OAuth, Supabase ni Resend.
- **No:** `Content-Security-Policy` en esta spec. Con OAuth, Supabase y los scripts inline de Next es fácil romper la app. Merece su propia spec.
- **No:** `Cross-Origin-Embedder-Policy`. Puede bloquear recursos de terceros sin un beneficio claro aquí.
- **No:** CAPTCHA. Añade UI, otra clave y fricción. Queda para otra spec si el rate limit no basta.
- **No:** comprobación propia contra HaveIBeenPwned. Leaked password protection requiere el plan Pro de Supabase. Se documenta y se acepta el warning del advisor.
- **No:** cambios en RLS. `games`, `scores` y `profiles` ya tienen RLS activo, con solo `SELECT` público (y el `UPDATE` propio en `profiles`).
- **No:** cambios en la longitud mínima de la contraseña. SPEC 12 ya exige 8 caracteres en cliente y servidor.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `x-forwarded-for` falsificable sin un proxy de confianza delante: un atacante rota IPs falsas y evade el límite. | Aceptado mientras no haya despliegue. Al desplegar, leer solo la cabecera del proxy real (p. ej. `x-real-ip` de Vercel). Queda anotado en el README. |
| Usuarios tras la misma IP (NAT, oficina, red móvil) comparten el contador y se bloquean entre sí. | Límites holgados en acciones frecuentes (`sign_in` 10/15 min, `save_score` 20/10 min). Ajustables en `RATE_LIMITS` sin migración. |
| En local todas las peticiones salen de `::1` o `'unknown'`: al probar se llega al límite enseguida. | Vaciar `rate_limits` con `execute_sql` durante el desarrollo. Documentado en el README. |
| Fail-closed: si Supabase cae o la service role key es inválida, se bloquean login, registro, puntajes y contacto. | Esas acciones ya dependen de Supabase (salvo contacto). Se muestra el mensaje genérico existente. |
| El límite nativo de Supabase Auth, al ver solo la IP del servidor, puede bloquear a todos los usuarios a la vez. | Revisarlo en el dashboard y dejarlo en un valor holgado. Documentado en el README. |
| `X-Frame-Options: DENY` o `Cross-Origin-Opener-Policy` rompen algún flujo (OAuth, pantalla completa). | Hay criterios de aceptación específicos para OAuth y pantalla completa. Si fallan, se ajusta el header concreto. |
| `Strict-Transport-Security` con `preload` es difícil de revertir si el dominio se registra en la lista de preload. | No se envía el dominio a hstspreload.org en esta spec. El header solo tiene efecto sobre HTTPS. |
| La tabla `rate_limits` crece si la limpieza al vuelo no se ejecuta. | La limpieza corre en cada llamada. La clave primaria `(key, action)` limita a una fila por IP y acción. |

## Qué **no** entra en esta spec

- `Content-Security-Policy` ni `Cross-Origin-Embedder-Policy`.
- CAPTCHA (Turnstile / hCaptcha).
- Comprobación propia contra HaveIBeenPwned (leaked password protection requiere plan Pro).
- Cambios en RLS de `games`, `scores` o `profiles`.
- Despliegue y arreglo de `.github/workflows/deploy.yml`.
- Bloqueo de cuenta por intentos fallidos (lockout por email).

Cada uno de esos puntos, si llega, va en su propia spec.
