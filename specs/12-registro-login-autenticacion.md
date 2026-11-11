# SPEC 12 — Registro, login y autenticación

> **Estado:** Implemented
> **Depende de:** SPEC 01 — MVP visual, SPEC 04 — Integración base con Supabase, SPEC 06 — Leaderboard y catálogo en Supabase
> **Fecha:** 2026-11-11
> **Objetivo:** Convertir `/auth` en un flujo real de Supabase Auth (registro e inicio de sesión con email y contraseña o con Google/GitHub, confirmación por correo, recuperación de contraseña y cierre de sesión) con un perfil `profiles` que asigna a cada cuenta un `username` único.

## Alcance

**Dentro:**

- **Tabla `profiles`** en `public`, 1:1 con `auth.users`, con `username` único. Migración versionada `supabase/migrations/0007_profiles_auth.sql`, aplicada vía MCP.
- **Trigger `on_auth_user_created`** que crea la fila de `profiles` al registrarse:
  - registro con email: toma `username` de `raw_user_meta_data`;
  - registro OAuth: crea el perfil con `username` nulo.
- **RLS en `profiles`:** `SELECT` público; `UPDATE` solo del propio perfil y solo si `username` aún es nulo; `INSERT` y `DELETE` denegados (el trigger corre como `security definer`).
- **Registro con email** (pestaña "CREAR CUENTA"): usuario, correo, contraseña y confirmar contraseña.
  - `username` se normaliza a mayúsculas y valida `^[A-Z0-9_]{3,12}$`.
  - La disponibilidad se comprueba solo al enviar. Si está en uso, error en el campo.
  - Tras enviar, la tarjeta muestra "REVISA TU CORREO" con el email usado.
- **Contraseña fuerte:** mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.
  - Checklist en vivo bajo el campo en registro y restablecer.
  - Validada también en la Server Action.
  - Configurada igual en Supabase (Auth → Password requirements).
- **Confirmación de email obligatoria.** Route handler `app/auth/confirm/route.ts` verifica `token_hash` + `type` con `verifyOtp`, abre sesión y redirige.
  - Enlace inválido o caducado: redirige a `/auth?error=enlace` con mensaje.
- **Inicio de sesión con email** (pestaña "INICIAR SESIÓN"): correo y contraseña. El campo "Usuario" desaparece de esta pestaña.
  - Credenciales incorrectas: un único mensaje genérico.
  - Email sin confirmar: mensaje específico.
- **OAuth Google y GitHub.** Los botones existentes lanzan `signInWithOAuth` vía Server Action.
  - Route handler `app/auth/callback/route.ts` canjea el `code` por sesión.
  - Si el perfil no tiene `username`, redirige a `/auth/alias`; si lo tiene, a `next` o `/biblioteca`.
- **`/auth/alias`:** misma tarjeta, un campo de usuario. Guarda el `username` del perfil propio. Sin sesión redirige a `/auth`.
- **Recuperar contraseña:**
  - enlace "¿OLVIDASTE TU CONTRASEÑA?" en la pestaña de login, que cambia la tarjeta a un formulario de correo;
  - siempre responde "si existe una cuenta, te hemos enviado un enlace" (no revela si el email existe);
  - el enlace pasa por `/auth/confirm` (`type=recovery`) y llega a `/auth/restablecer`;
  - `/auth/restablecer` pide nueva contraseña + confirmación. Sin sesión de recuperación redirige a `/auth`.
- **Cierre de sesión** con Server Action `signOut`, redirige a `/`.
- **Server Actions** en `app/actions/auth.ts`: `signUp`, `signIn`, `signInWithOAuth`, `signOut`, `requestPasswordReset`, `updatePassword`, `setUsername`. Usan `app/lib/supabase/server.ts`.
- **Redirecciones:**
  - usuario con sesión que entra a `/auth` → `/biblioteca`;
  - tras login correcto → parámetro `next` (solo rutas internas que empiezan por `/`) o `/biblioteca`.
  - Ninguna otra ruta se protege. Jugar y guardar puntaje con alias siguen igual sin sesión.
- **"JUGAR COMO INVITADO"** se mantiene y lleva a `/biblioteca`.
- **Nav con sesión:** el botón "Iniciar Sesión" pasa a `username` + botón "SALIR", en escritorio y en el panel móvil.
  - Con sesión OAuth sin `username`, en lugar del nombre muestra "ELIGE ALIAS" enlazado a `/auth/alias`.
  - Mientras se resuelve la sesión, un placeholder sin texto del mismo ancho evita el parpadeo.
  - La sesión se lee en cliente (`client.ts` + `onAuthStateChange` + lectura del propio perfil) para no volver dinámicas las páginas con `revalidate = 60`.
- **Diseño:** todas las vistas reutilizan la tarjeta neón actual de `/auth` y se diseñan con `/frontend-design`.
- **Tipos:** `ProfileRow` en `app/lib/supabase/types.ts`.
- **Configuración manual documentada** en la spec y en el README (la hace el usuario):
  - apps OAuth en Google Cloud y GitHub, con client id/secret en el dashboard;
  - Site URL y Redirect URLs (localhost y producción);
  - "Confirm email" activado y requisitos de contraseña;
  - plantillas de "Confirm signup" y "Reset password" apuntando a `/auth/confirm?token_hash={{ .TokenHash }}&type=...`.

**Fuera de alcance (para specs futuras):**

- Ligar puntajes a la cuenta (`user_id` en `scores`, alias prellenado o bloqueado en `save-score-form`).
- Página de perfil, cambiar `username`, avatar, cambiar email o contraseña estando logueado, borrar cuenta.
- Login por `username` (solo por email).
- Comprobación de disponibilidad de `username` en vivo mientras se escribe.
- Magic link, OTP por SMS, MFA y otros proveedores OAuth.
- Rutas protegidas o roles (admin).
- SMTP propio (Resend) y plantillas de correo personalizadas en español: se usa el SMTP por defecto de Supabase. Solo se cambia el enlace de las plantillas, obligatorio para `/auth/confirm`.
- Rate limiting o captcha propios (más allá de los límites de Supabase).
- Vincular cuentas email + OAuth del mismo correo manualmente (se deja el comportamiento por defecto de Supabase).
- Arreglar el deploy a GitHub Pages (`./out`), que ya es incompatible con Server Actions.

## Modelo de datos

### Tabla `profiles`

```sql
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique check (username ~ '^[A-Z0-9_]{3,12}$'),  -- null until chosen (OAuth)
  created_at  timestamptz not null default now()
);
```

- `username` nulo solo para cuentas OAuth que aún no pasaron por `/auth/alias`.
- `unique` admite varios nulos (comportamiento estándar de Postgres).
- Mismo formato que `scores.alias`, para que la spec futura de puntajes ligados pueda usarlo directamente.

### Trigger de alta

```sql
-- security definer: runs as owner, so it can insert despite RLS.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$ ... $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- Inserta `(new.id, upper(new.raw_user_meta_data ->> 'username'))`.
- En OAuth `raw_user_meta_data` no trae `username` (los proveedores usan otras claves), así que queda nulo.
- Si el `username` choca con `unique` o con el `check`, el insert en `auth.users` falla y Supabase devuelve error. `signUp` lo traduce a "Ese usuario ya está en uso" (cubre la carrera entre la comprobación previa y el alta).

### RLS y permisos

```sql
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select to anon, authenticated using (true);

create policy "users set their own username once"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and username is null)
  with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (username) on public.profiles to authenticated;
```

- Sin políticas de `INSERT` ni `DELETE`: denegados. El borrado llega por `on delete cascade` desde `auth.users`.
- Solo la columna `username` es actualizable, y solo mientras sea nula.

### Tipos TypeScript (`app/lib/supabase/types.ts`)

```ts
export interface ProfileRow {
  id: string;
  username: string | null;
  created_at: string;
}
```

### Resultado de las Server Actions (`app/actions/auth.ts`)

```ts
export type AuthField = 'username' | 'email' | 'password' | 'confirm';

export type AuthResult = { ok: true } | { ok: false; error: string; field?: AuthField };
```

- `field` permite marcar el input concreto (`aria-invalid`); sin `field`, el error va a nivel de formulario.
- `signInWithOAuth` devuelve `{ ok: true; url: string }` y el cliente navega a esa URL.

### Reglas compartidas (`app/lib/auth/validation.ts`)

```ts
export const USERNAME_REGEX = /^[A-Z0-9_]{3,12}$/;

export const PASSWORD_RULES = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Una minúscula', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'Un número', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', label: 'Un símbolo', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;
```

- Lo importan el checklist del cliente y las Server Actions, así ambas validan con las mismas reglas.

### Parámetros de URL

- `/auth?next=/ruta` — destino tras login. Solo se acepta si empieza por `/` y no por `//`.
- `/auth?error=enlace` — enlace de confirmación o recuperación inválido/caducado.
- `/auth?error=oauth` — fallo en el callback de OAuth.
- `/auth/confirm?token_hash=...&type=signup|recovery&next=...` — enlace de los correos.
- `/auth/callback?code=...&next=...` — retorno de Google/GitHub.

## Plan de implementación

1. **Configuración manual en Supabase (usuario).** Activar "Confirm email", fijar requisitos de contraseña (mín. 8, mayúsculas, minúsculas, números y símbolos), Site URL y Redirect URLs (`http://localhost:3000/**` y producción). Cambiar las plantillas "Confirm signup" y "Reset password" para enlazar a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup|recovery`. La app sigue igual.
2. **Migración `0007_profiles_auth.sql`.** Tabla `profiles`, función `handle_new_user`, trigger, RLS y grants. Aplicar vía MCP. Verificar con el MCP que existe y que un `select` anónimo funciona.
3. **Tipos y reglas compartidas.** `ProfileRow` en `app/lib/supabase/types.ts` y `app/lib/auth/validation.ts` con `USERNAME_REGEX`, `PASSWORD_RULES` y helper `safeNext(next)`. Sin consumidores todavía; `npm run lint` pasa.
4. **Server Actions de registro e inicio de sesión.** `app/actions/auth.ts` con `signUp` (valida, comprueba `username` libre, `auth.signUp` con `options.data.username` y `emailRedirectTo`, traduce errores) y `signIn` (traduce credenciales incorrectas y email sin confirmar).
5. **Route handler `app/auth/confirm/route.ts`.** `verifyOtp({ type, token_hash })`; si va bien redirige a `next` (`signup` → `/biblioteca`, `recovery` → `/auth/restablecer`); si falla, a `/auth?error=enlace`.
6. **`/auth` real con email.** Convertir `page.tsx` en Server Component que redirige a `/biblioteca` si hay sesión y renderiza un nuevo cliente `app/auth/auth-card.tsx`. Pestaña login: correo + contraseña. Pestaña registro: usuario, correo, contraseña con checklist en vivo y confirmar. Estado "REVISA TU CORREO". Errores por campo y de `?error=`. Manual: registrarse, confirmar desde el correo, cerrar pestaña, entrar con login.
7. **Cierre de sesión y nav.** `signOut` en `app/actions/auth.ts`. Hook cliente `app/lib/auth/use-session-profile.ts` (`getUser` + `onAuthStateChange` + lectura de `profiles`). `nav.tsx` muestra `username` (o "ELIGE ALIAS") + "SALIR" en escritorio y panel móvil, con placeholder mientras carga; sin sesión, "Iniciar Sesión" como hoy. Manual: entrar, ver el nombre, salir y volver a ver el botón.
8. **Recuperar contraseña.** Vista "¿OLVIDASTE TU CONTRASEÑA?" en `auth-card.tsx` + `requestPasswordReset` (respuesta neutra). Página `app/auth/restablecer/page.tsx` (redirige a `/auth` sin sesión) con nueva contraseña + checklist + confirmar, y `updatePassword`. Tras éxito, redirige a `/biblioteca`. Manual: pedir enlace, abrirlo, cambiar la contraseña y entrar con la nueva.
9. **Configuración OAuth (usuario).** Crear las apps en Google Cloud y GitHub con callback `https://<proyecto>.supabase.co/auth/v1/callback` y pegar client id/secret en el dashboard de Supabase.
10. **OAuth en la app.** `signInWithOAuth(provider, next)` devuelve la URL con `redirectTo` a `/auth/callback`. Route handler `app/auth/callback/route.ts` con `exchangeCodeForSession`; si el perfil no tiene `username` → `/auth/alias`, si no → `next`/`/biblioteca`; si falla → `/auth?error=oauth`. Conectar los botones GOOGLE/GITHUB.
11. **`/auth/alias`.** `app/auth/alias/page.tsx` (sin sesión → `/auth`; con `username` ya puesto → `/biblioteca`) con un campo usuario y `setUsername` (valida, actualiza el propio perfil, traduce conflicto de `unique` a "EN USO"). Manual: entrar con GitHub por primera vez, elegir alias, verlo en el nav.
12. **Documentación.** Sección "Autenticación" en `README.md` con la configuración manual de los pasos 1 y 9. Actualizar `CLAUDE.md` (rutas `/auth/*`, `app/actions/auth.ts`, `profiles`) y marcar la spec como `Implemented`.

## Criterios de aceptación

**Base de datos**

- [ ] La tabla `public.profiles` existe con RLS activado y la migración `0007_profiles_auth.sql` está versionada.
- [ ] Un usuario anónimo puede leer `profiles` con `select`, pero no hacer `insert`, `update` ni `delete`.
- [ ] Un usuario autenticado con `username` ya definido no puede cambiarlo (el `update` no afecta a ninguna fila).
- [ ] Un usuario autenticado no puede actualizar el perfil de otro.
- [ ] Borrar un usuario en `auth.users` borra su fila en `profiles`.

**Registro con email**

- [ ] Registrarse con usuario válido, correo y contraseña fuerte muestra "REVISA TU CORREO" con el email usado y crea una fila en `profiles` con el `username` en mayúsculas.
- [ ] Escribir `px_kai` como usuario guarda `PX_KAI`.
- [ ] Un usuario con formato inválido (p. ej. `ab` o `hola!`) muestra error en el campo usuario y no llama a Supabase.
- [ ] Un usuario ya existente muestra "Ese usuario ya está en uso" en el campo usuario y no crea cuenta.
- [ ] Cada regla del checklist de contraseña se marca en verde al cumplirse mientras se escribe.
- [ ] Una contraseña que incumple alguna regla bloquea el envío y la Server Action también la rechaza si se llama directamente.
- [ ] Si "Confirmar contraseña" no coincide, se muestra error en ese campo y no se envía.
- [ ] Iniciar sesión antes de confirmar el correo muestra el mensaje de email sin confirmar.
- [ ] Abrir el enlace del correo de confirmación deja la sesión abierta y lleva a `/biblioteca`.
- [ ] Abrir un enlace de confirmación ya usado o alterado lleva a `/auth` con el mensaje de enlace inválido.

**Inicio y cierre de sesión**

- [ ] Login con credenciales correctas lleva a `/biblioteca` y el nav muestra el `username` y "SALIR".
- [ ] Login con contraseña incorrecta o email inexistente muestra el mismo mensaje genérico.
- [ ] `/auth?next=/salon` lleva a `/salon` tras un login correcto.
- [ ] `/auth?next=//evil.com` y `/auth?next=https://evil.com` llevan a `/biblioteca`.
- [ ] Con sesión abierta, entrar a `/auth` redirige a `/biblioteca`.
- [ ] "SALIR" cierra la sesión, lleva a `/` y el nav vuelve a mostrar "Iniciar Sesión" sin recargar manualmente.
- [ ] El estado del nav (con y sin sesión) es correcto también en el panel móvil.
- [ ] La sesión sobrevive a recargar la página y a cerrar y abrir la pestaña.
- [ ] "JUGAR COMO INVITADO" lleva a `/biblioteca` sin crear sesión.

**Recuperar contraseña**

- [ ] Pedir recuperación con un email existente y con uno inexistente muestra el mismo mensaje neutro.
- [ ] El enlace del correo lleva a `/auth/restablecer` con sesión de recuperación.
- [ ] Entrar a `/auth/restablecer` sin sesión redirige a `/auth`.
- [ ] Tras cambiar la contraseña, se llega a `/biblioteca` y la contraseña antigua ya no permite entrar.

**OAuth**

- [ ] "GOOGLE" y "GITHUB" llevan a la pantalla de consentimiento del proveedor.
- [ ] El primer login OAuth lleva a `/auth/alias`; tras elegir un alias válido y libre, se llega a `/biblioteca` y el nav lo muestra.
- [ ] En `/auth/alias`, un alias en uso muestra "EN USO" en el campo y no se guarda.
- [ ] Un segundo login OAuth con la misma cuenta va directo a `/biblioteca` sin pasar por `/auth/alias`.
- [ ] Entrar a `/auth/alias` sin sesión redirige a `/auth`; con `username` ya definido redirige a `/biblioteca`.
- [ ] Con sesión OAuth sin `username`, el nav muestra "ELIGE ALIAS" enlazado a `/auth/alias` y "SALIR".
- [ ] Cancelar en la pantalla del proveedor lleva a `/auth` con el mensaje de error OAuth.

**No regresión**

- [ ] La salida de `npm run build` no cambia respecto a `main` salvo `/auth` (ahora dinámica) y las rutas nuevas `/auth/*`: `/`, `/biblioteca` y `/juegos/[id]/jugar` siguen con revalidate 1m. (`/juegos/[id]` y `/salon` ya eran dinámicas antes de esta spec.)
- [ ] Jugar y guardar un puntaje con alias funciona igual con y sin sesión.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en ninguna vista de `/auth/*`.
- [ ] `README.md` documenta la configuración manual de Supabase, Google y GitHub.

## Decisiones tomadas y descartadas

- **Sí:** email + contraseña y OAuth Google/GitHub en la misma spec. Los botones ya existen en la UI y comparten callback, perfil y nav.
- **No:** magic link u OTP. Otro flujo de correo más sin necesidad real; un método sin contraseña ya lo dan Google y GitHub.
- **Sí:** confirmación de email obligatoria. Evita cuentas con correos ajenos o falsos.
- **No:** cuentas activas al instante. Más rápido de probar, pero deja crear cuentas con cualquier correo.
- **Sí:** login solo por email. Es lo que Supabase Auth soporta de forma nativa.
- **No:** login por `username`. Exigiría buscar el email por alias en servidor y revela qué usuarios existen.
- **Sí:** tabla `profiles` con `username` único creado por trigger. Es la identidad pública que firmará puntajes en una spec futura, y el trigger garantiza que toda cuenta tenga perfil.
- **No:** guardar el alias en `user_metadata`. Sin unicidad ni consultas desde otras tablas, y el usuario puede editarlo desde el cliente.
- **Sí:** mismo formato que `scores.alias` (`^[A-Z0-9_]{3,12}$`). Permite ligar puntajes a la cuenta sin migrar datos.
- **Sí:** `username` inmutable una vez definido (RLS + grant solo de la columna). Cambiarlo es parte de una futura página de perfil.
- **Sí:** OAuth sin `username` pasa por `/auth/alias`. Respeta formato y unicidad igual que el registro con email.
- **No:** generar un alias automático (`PLAYER_4F2A`). Dejaría a la mayoría con nombres que no eligieron y sin forma de cambiarlos en esta spec.
- **Sí:** disponibilidad de `username` comprobada solo al enviar, con la restricción `unique` como garantía final. Menos estados y menos llamadas.
- **No:** comprobación en vivo con debounce. Añade una Server Action y estados de carga extra por poco valor.
- **Sí:** contraseña fuerte (8+, mayúscula, minúscula, número, símbolo) validada en cliente, Server Action y Supabase. El cliente da feedback, el servidor y Supabase impiden saltársela.
- **Sí:** campo "Confirmar contraseña" en registro y restablecer. Con reglas estrictas, un error de tecleo es más probable.
- **Sí:** recuperación de contraseña dentro del alcance. Reutiliza `/auth/confirm`, y sin ella una cuenta olvidada se pierde.
- **Sí:** mensaje neutro al pedir recuperación y mensaje genérico en credenciales incorrectas. No revela qué correos tienen cuenta.
- **Sí:** lógica en Server Actions (`app/actions/auth.ts`) y route handlers para `confirm` y `callback`. Sigue el patrón de `app/actions/` y mantiene la validación en servidor.
- **No:** llamadas a Supabase Auth directamente desde el cliente para login y registro. Duplicaría validación y dispersaría la lógica.
- **Sí:** enlaces de correo con `token_hash` + `verifyOtp` en `/auth/confirm`. Funciona con `@supabase/ssr` aunque el correo se abra en otro navegador que el del registro.
- **Sí:** sesión del nav leída en cliente (`client.ts` + `onAuthStateChange`). Leer cookies en `layout.tsx` volvería dinámicas todas las páginas y rompería el `revalidate = 60` del catálogo.
- **Sí:** "ELIGE ALIAS" en el nav para cuentas OAuth sin `username`. Da una salida visible si el usuario abandonó `/auth/alias`.
- **No:** proteger rutas. Jugar y guardar puntaje siguen abiertos a invitados; nada requiere cuenta todavía.
- **Sí:** `next` restringido a rutas internas (`/` sin `//`). Evita open redirect.
- **Sí:** SMTP por defecto de Supabase. Permite avanzar sin configurar nada más; su límite de envío queda como riesgo.
- **No:** SMTP propio con Resend y plantillas en español. Va en otra spec; solo se cambia el enlace de las plantillas porque es obligatorio para `/auth/confirm`.
- **No:** ligar puntajes a la cuenta. Haría la spec demasiado grande; `profiles.username` ya deja preparada esa spec.
- **Sí:** configuración de Supabase, Google y GitHub como pasos manuales documentados. Son secretos y paneles externos que el código no puede ni debe tocar; la migración sí se aplica vía MCP.
- **Sí (durante la implementación):** `setUsername(username, next)` redirige desde el servidor al guardar. Con `router.replace` en el cliente tras la acción, el alias se guardaba pero el router descartaba la navegación y el usuario se quedaba en el formulario.
- **Sí (durante la implementación):** `revoke execute` sobre `handle_new_user()` para `public`, `anon` y `authenticated`. El linter de Supabase lo marcaba como invocable vía `/rest/v1/rpc`; el trigger no necesita ese permiso.
- **Sí (fuera de alcance, pedido explícitamente):** migración `0008_revoke_rls_auto_enable_execute.sql`, mismo `revoke` sobre `rls_auto_enable()`, función previa del event trigger `ensure_rls`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El SMTP por defecto de Supabase limita a pocos correos por hora y puede no entregar a direcciones fuera del equipo del proyecto. | Documentado en el README. Para pruebas, usar correos del equipo. Si bloquea, la spec de SMTP propio con Resend pasa a ser prioritaria. |
| Las plantillas de correo no se actualizan a `token_hash` y los enlaces apuntan al flujo por defecto, que no abre sesión en el servidor. | Paso 1 del plan, antes de escribir código. El criterio de aceptación de confirmación lo detecta. |
| Redirect URLs mal configuradas: Supabase redirige al Site URL en lugar de `/auth/callback` o `/auth/confirm`. | Incluir `http://localhost:3000/**` y el dominio de producción en la lista. Documentado en el README. |
| El trigger `handle_new_user` falla (alias duplicado o formato inválido) y Supabase devuelve un error genérico "Database error saving new user". | Comprobación previa de disponibilidad en `signUp`, validación de formato antes de llamar a Supabase y traducción de ese error a "Ese usuario ya está en uso". |
| Un error en el trigger bloquea **todos** los registros, incluidos los OAuth. | Probar registro con email y con OAuth justo tras aplicar la migración. El trigger solo hace un `insert` sin lógica adicional. |
| Mismo correo usado con email y con Google/GitHub: Supabase puede vincular identidades o crear cuentas distintas según la configuración. | Se deja el comportamiento por defecto de Supabase (vincula si el correo está verificado). Documentado como fuera de alcance. |
| Usuario OAuth abandona `/auth/alias` y queda con `username` nulo. | El callback lo vuelve a mandar a `/auth/alias` en el siguiente login. El nav muestra "ELIGE ALIAS", enlazado a `/auth/alias`, mientras sea nulo. |
| El nav en cliente parpadea entre "Iniciar Sesión" y el `username` al cargar. | Estado inicial de carga sin texto (placeholder del mismo ancho) hasta que el hook resuelve la sesión. |
| Las Server Actions y `/auth/*` dinámicas no funcionan en el deploy a GitHub Pages. | Problema previo y ya conocido (el deploy no tiene `./out`). Fuera de alcance; la verificación se hace en `npm run dev` y `npm run build && npm run start`. |

## Qué **no** entra en esta spec

- Puntajes ligados a la cuenta (`user_id` en `scores`, alias prellenado).
- Página de perfil, cambio de `username`, email o contraseña con sesión, borrado de cuenta.
- Login por `username`, magic link, OTP, MFA u otros proveedores OAuth.
- Comprobación de `username` en vivo.
- Rutas protegidas y roles.
- SMTP propio y plantillas de correo personalizadas en español.
- Rate limiting o captcha propios.
- Arreglo del deploy a GitHub Pages.

Cada una de esas, si llega, va en su propia spec.
