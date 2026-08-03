# SPEC 04 — Integración base con Supabase

> **Estado:** Approved
> **Depende de:** SPEC 03 — About page y formulario de contacto con Resend
> **Fecha:** 2026-08-01
> **Objetivo:** Instalar y configurar los clientes de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) para navegador, Server Components/Actions y proxy, dejando la app conectada al proyecto Supabase real sin implementar ningún flujo de auth ni tablas todavía.

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` añadidas a `package.json`.
- Variables de entorno documentadas en `.env.template` (sin valores reales): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El usuario ya tiene el proyecto Supabase creado y llenará `.env.local` por su cuenta.
- Cliente de navegador `app/lib/supabase/client.ts` (`createBrowserClient`), para usar desde Client Components.
- Cliente de servidor `app/lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`), para usar desde Server Components y Server Actions.
- `proxy.ts` en la raíz del proyecto (convención actual de Next 16.2.12, reemplaza a `middleware.ts`) que refresca la sesión de Supabase en cada request vía `@supabase/ssr`, con `matcher` que excluye assets estáticos.
- Verificación de que el build y el arranque en dev no se rompen con los clientes configurados (sin necesidad de una página de diagnóstico, ya que no hay UI que los consuma todavía).

**Fuera de alcance (para specs futuras):**

- Cualquier flujo de autenticación real (signup, login, logout, OAuth con Google/GitHub): sigue siendo el formulario simulado de `app/auth/page.tsx`.
- Esquema de tablas en Postgres (`profiles`, `scores` u otras) y sus migraciones.
- Cambios en el nav, en `/salon` o en cualquier otra UI para reflejar sesión o datos reales.
- Guardado real de puntajes al terminar de jugar (no hay motor de juego todavía).
- Supabase Realtime y Edge Functions (mencionados por el usuario como uso futuro, pero no entran en esta spec).
- Script o página de verificación de conexión: se confía en que el build/dev no falla con los clientes bien tipados; no se hace una llamada real de prueba contra la base de datos.

## Modelo de datos

Esta spec no introduce tablas ni datos de dominio nuevos (no hay `profiles`, `scores` ni migraciones todavía). Sí introduce el contrato de los dos módulos cliente que specs futuras usarán:

### `app/lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

### `app/lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        /* try/catch: falla en Server Components de solo lectura, lo maneja proxy.ts */
      },
    },
  });
};
```

Convenciones:

- Ambos módulos exportan una función `createClient` (no una instancia singleton), siguiendo el patrón recomendado por Supabase para SSR: un cliente nuevo por request en servidor, y uno reutilizable por sesión de navegador en cliente. El nombre repetido es intencional — el import path (`@/app/lib/supabase/client` vs. `@/app/lib/supabase/server`) es lo que distingue cuál se usa.
- `app/lib/supabase/server.ts` es `async` porque `cookies()` de `next/headers` es asíncrono en esta versión de Next.
- El `setAll` en el cliente de servidor va envuelto en `try/catch` silencioso: escribir cookies falla si se invoca desde un Server Component (solo lectura); `proxy.ts` es quien realmente refresca la sesión en cada request.
- No se crean tipos para las respuestas de Supabase (`User`, `Session`, etc.): se reexportan tal cual del SDK cuando una spec futura los necesite.

## Plan de implementación

0. Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` para Next 16.2.12: en particular `03-api-reference/03-file-conventions/proxy.md` (convención `proxy.ts`, reemplaza a `middleware.ts`, exporta `proxy` en vez de `middleware`) y `04-functions/cookies.md` (`cookies()` es asíncrono). Seguir esos documentos por encima de cualquier patrón previo de Supabase+Next con `middleware.ts`.

1. **Dependencias.** `npm install @supabase/supabase-js @supabase/ssr`. Verificación: `package.json` lista ambas; `npm run build` sigue pasando (aún sin uso, no rompe nada).

2. **Variables de entorno.** Añadir a `.env.template` las claves `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (sin valores), con un comentario indicando que se obtienen en el dashboard de Supabase (Project Settings → API). El usuario llena `.env.local` con los valores reales por su cuenta. Verificación: `git status` no muestra `.env.local`; `.env.template` sí tiene las claves nuevas.

3. **Cliente de navegador.** Crear `app/lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`. Verificación: `npx tsc --noEmit` pasa.

4. **Cliente de servidor.** Crear `app/lib/supabase/server.ts` con `createClient()` async usando `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `cookies()` de `next/headers` (`getAll`/`setAll`, `setAll` en `try/catch`). Verificación: `npx tsc --noEmit` pasa.

5. **Proxy.** Crear `proxy.ts` en la raíz del proyecto: instancia el cliente de servidor de Supabase con las cookies de la request/response, llama a `supabase.auth.getClaims()` (o `getUser()`) para refrescar el token, y exporta `config.matcher` excluyendo `_next/static`, `_next/image`, `favicon.ico` y archivos de `public/`. Verificación: `npm run dev` arranca sin errores; navegar cualquier ruta existente (`/`, `/biblioteca`, `/salon`) sigue funcionando igual que antes, sin cambios visibles.

6. **Pasada estática.** `npm run lint` y `npm run build` sin errores ni advertencias.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores ni advertencias.
- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [x] `.env.template` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` sin valores reales; ninguna de las dos aparece con valor en ningún archivo versionado.
- [x] `app/lib/supabase/client.ts` exporta `createClient()` que retorna un cliente de `createBrowserClient`.
- [x] `app/lib/supabase/server.ts` exporta un `createClient()` async que retorna un cliente de `createServerClient`, usando `cookies()` de `next/headers`.
- [x] `proxy.ts` existe en la raíz del proyecto (no `middleware.ts`), exporta la función `proxy` y un `config.matcher` que excluye assets estáticos.
- [x] Con `.env.local` configurado con credenciales reales, `npm run dev` arranca sin errores en consola relacionados con Supabase.
- [x] Navegar `/`, `/biblioteca`, `/salon`, `/auth` y `/juegos/caida` se comporta exactamente igual que antes de esta spec (sin cambios visuales ni funcionales).
- [x] `npx tsc --noEmit` pasa sin errores.

## Decisiones

- **Sí:** `@supabase/ssr` además de `@supabase/supabase-js`. Es el paquete oficial de Supabase para manejar cookies/sesión correctamente en el modelo de Server Components + Server Actions de Next.js App Router; usar solo `@supabase/supabase-js` obligaría a reimplementar ese manejo de cookies a mano.
- **No:** solo `@supabase/supabase-js` con un cliente único compartido. Rompe en SSR porque no hay forma limpia de sincronizar la sesión vía cookies entre servidor y navegador sin `@supabase/ssr`.
- **Sí:** `proxy.ts`, no `middleware.ts`. Next 16.2.12 (versión real del proyecto, confirmada en `node_modules/next/dist/docs`) deprecó `middleware.ts` en favor de `proxy.ts`; toda la documentación y tutoriales de Supabase+Next.js anteriores a este cambio usan el nombre viejo, que ya no es la convención vigente aquí.
- **Sí:** `app/lib/supabase/` como ubicación, coherente con `app/data/`, `app/actions/`, `app/components/` — todo el código vive bajo `app/`, sin una carpeta `lib/` o `utils/` en la raíz.
- **No:** `utils/supabase/` en la raíz. Es la convención que usa la documentación oficial de Supabase, pero rompería con el patrón de este proyecto de mantener todo bajo `app/`.
- **Sí:** dos funciones `createClient` (una por archivo), no una función con parámetro `context: 'browser' | 'server'`. Es el patrón que documenta Supabase y mantiene cada archivo importable solo desde su entorno correcto (el de servidor nunca se importa por error en un Client Component).
- **Sí:** variables de entorno con prefijo `NEXT_PUBLIC_`. La URL y la anon key de Supabase están pensadas para ser públicas (se usan desde el navegador); no son secretos como `RESEND_API_KEY`.
- **Sí:** sin script ni página de verificación de conexión. El único chequeo real posible sin auth ni tablas sería una llamada trivial (`supabase.auth.getSession()`) que no prueba nada más que "las credenciales tienen el formato correcto"; se prefiere que la primera prueba real de conexión ocurra en la spec que implemente auth o el esquema, donde sí hay algo concreto que verificar.
- **No:** esquema de tablas (`profiles`, `scores`) en esta spec. El usuario confirmó que el alcance es solo la integración base; el esquema depende de decisiones de auth (spec futura) que aún no se toman.
- **No:** Realtime ni Edge Functions. Mencionados como uso futuro por el usuario, pero no hay ningún consumidor todavía — se abordan en la spec que los necesite.

## Riesgos

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copiar un tutorial de Supabase+Next.js que use `middleware.ts` (la convención vieja) en vez de `proxy.ts`. El archivo simplemente no se ejecutaría y el error pasaría desapercibido.           | El paso 0 exige leer `node_modules/next/dist/docs/.../proxy.md` antes de escribir código; el criterio de aceptación verifica explícitamente que existe `proxy.ts` y no `middleware.ts`.                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` termina commiteada con su valor real por accidente (ej. alguien la pega directo en `.env.template` en vez de dejarla vacía).                                   | El paso 2 deja `.env.template` sin valores, igual que con `RESEND_API_KEY` en spec 03; el criterio de aceptación revisa que ningún archivo versionado tenga el valor real.                              |
| El `setAll` del cliente de servidor lanza una excepción no controlada al invocarse desde un Server Component de solo lectura (comportamiento documentado de Next/Supabase), tumbando el render. | El paso 4 exige envolver `setAll` en `try/catch` silencioso, dejando que `proxy.ts` sea el único responsable real de escribir cookies de sesión.                                                        |
