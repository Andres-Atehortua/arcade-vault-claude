# SPEC 03 — About page y formulario de contacto con Resend

> **Estado:** Approved
> **Depende de:** SPEC 02 — Landing page y traslado de la biblioteca
> **Fecha:** 2026-07-31
> **Objetivo:** Portar la página About de `references/templates/home-about/about.jsx` a la ruta `/acerca-de`, con su formulario de contacto enviando correos reales vía Resend a través de una Server Action.

## Alcance

**Dentro:**

- Nueva ruta `/acerca-de` (`app/acerca-de/page.tsx`) con las dos secciones del prototipo: hero "ACERCA DE ARCADE VAULT" con misión y fila de 3 highlights (corazón/navegador/planta), separador decorativo, y sección de contacto (intro + formulario).
- Formulario de contacto (`app/components/contact-form.tsx`, Client Component) con campos Nombre, Correo electrónico y Mensaje, validación de no-vacío + formato de email antes de enviar, animación `shake` en error de validación, y cuatro estados: `idle`, `loading`, `success` (terminal `VAULT-OS // TERMINAL` del prototipo) y `error` (panel inline, mismos datos conservados, permite reintentar).
- Server Action `app/actions/contacto.ts` (`'use server'`) que recibe `{ name, email, message, honeypot }`, descarta silenciosamente si `honeypot` viene lleno, valida en servidor (nunca confiar solo en el cliente), y llama al SDK de `resend` para enviar el correo a `andres.lopez.ate@gmail.com` desde `onboarding@resend.dev`.
- Campo honeypot oculto (`display:none` + `tabIndex={-1}` + `aria-hidden`) en el formulario, ignorado si viene vacío.
- Dependencia `resend` añadida a `package.json`.
- `RESEND_API_KEY` leída de variable de entorno server-side; `.env.example` nuevo documentando la variable (sin valor real). La key real vive en `.env.local`, ya la tienes y no se versiona (`.env*` ya está en `.gitignore`).
- `app/components/nav.tsx`: cuarto enlace "Acerca de" → `/acerca-de`, al final de la lista, en la barra y en el panel móvil, con su lógica de activo (`isAbout = pathname.startsWith('/acerca-de')`).
- CSS del prototipo anexado a `app/globals.css`: bloque `ABOUT PAGE` de `styles.css` (líneas 1071–1146 aprox., incluye `.about-*`, `.highlight*`, `.contact-*`, `.terminal-success`, `.term-*`, keyframes `pxblink` y `shake`), más el estado de error que se agregue (no existe en el prototipo). Sin tocar reglas existentes.
- Pasada de verificación manual: envío real del formulario en dev, confirmando que el correo llega a `andres.lopez.ate@gmail.com`; y verificación con Playwright (capturas a 1440px y 390px) de los cuatro estados del formulario.

**Fuera de alcance (para specs futuras):**

- Autenticación real, login social (Google/GitHub) — no aplica aquí, es de `/auth`.
- Persistencia de mensajes de contacto en base de datos o backoffice para leerlos: el correo _es_ el almacenamiento.
- Rate limiting por IP/usuario más allá del honeypot (ej. Resend rate limits, Upstash, etc.).
- Dominio propio verificado en Resend (`from` con dominio del proyecto): se usa `onboarding@resend.dev` hasta que exista un dominio configurado.
- Plantillas de correo HTML ricas (logos, estilos de marca): el correo se envía en texto plano o HTML mínimo con los tres campos.
- Suite de tests automatizados (Playwright o unitarios) versionada — igual que spec 02, la verificación es manual.

## Modelo de datos

No hay persistencia ni `app/data/` nuevo (nada se guarda entre sesiones). Sí se introduce un contrato de tipos entre el formulario y la Server Action:

### `app/actions/contacto.ts`

```ts
export interface ContactoPayload {
  name: string;
  email: string;
  message: string;
  honeypot: string; // debe llegar vacío; si no, se descarta en silencio
}

export type ContactoResult = { ok: true } | { ok: false; error: string }; // mensaje ya listo para mostrar en el panel de error

export const enviarContacto = async (payload: ContactoPayload): Promise<ContactoResult> => {
  /* ... */
};
```

Convenciones:

- `ContactoResult` es la forma de comunicar éxito/error entre Server Action y Client Component sin lanzar excepciones no controladas hacia la UI: el componente siempre recibe un objeto y decide qué panel mostrar.
- La validación de formato de email (regex simple) vive tanto en el cliente (`contact-form.tsx`, para el `shake` inmediato) como en el servidor (`contacto.ts`, porque el cliente nunca es confiable). Duplicar esta regla es intencional: son dos capas con responsabilidades distintas, no la misma validación reutilizada.
- `RESEND_API_KEY` se lee con `process.env.RESEND_API_KEY` dentro de `contacto.ts` (código server-only por el `'use server'` del archivo); si falta, `enviarContacto` devuelve `{ ok: false, error: '...' }` en lugar de lanzar, para no tumbar la Server Action en dev si alguien olvidó configurar `.env.local`.
- No se crea un tipo para la respuesta de la API de Resend: se usa tal cual la expone el SDK (`resend.emails.send(...)`), solo se envuelve el resultado en `ContactoResult`.

## Plan de implementación

0. Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` para Next 16.2.12: convenciones de Server Actions (`'use server'`, invocación desde formularios), variables de entorno server-only, y cualquier nota de Route Handlers si aplicara. Seguir esos documentos por encima de cualquier patrón previo.

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con `RESEND_API_KEY=` (sin valor) y un comentario indicando que se obtiene en resend.com/api-keys. Confirmar que `.env.local` con la key real ya existe y sigue ignorado por git. Verificación: `git status` no muestra `.env.local`; `npm run build` sigue pasando (la ausencia de uso aún no rompe nada).

2. **Server Action.** Crear `app/actions/contacto.ts` con `'use server'`, los tipos `ContactoPayload`/`ContactoResult`, validación server-side (campos no vacíos + formato de email + honeypot vacío) y la llamada a `resend.emails.send({ from: 'onboarding@resend.dev', to: 'andres.lopez.ate@gmail.com', subject: ..., text: ... })`. Verificación: `npx tsc --noEmit` pasa; probar la función aislada con un script temporal o invocándola desde una página de prueba confirma que llega un correo real.

3. **Formulario cliente.** Crear `app/components/contact-form.tsx` (Client Component) con los campos Nombre/Correo/Mensaje, el campo honeypot oculto, validación de cliente (no-vacío + formato email) con `shake`, y los cuatro estados (`idle`/`loading`/`success`/`error`) invocando `enviarContacto`. El estado `success` reutiliza el terminal `VAULT-OS // TERMINAL` del prototipo; el estado `error` es un panel nuevo con el mismo lenguaje visual (borde magenta, texto de error, botón para reintentar sin perder lo escrito). Verificación: con la Server Action ya funcional, enviar el formulario en dev completa el ciclo real.

4. **Página About.** Crear `app/acerca-de/page.tsx` como Server Component que compone el hero (misión + 3 highlights) y la sección de contacto con `<ContactForm />`. Los tres iconos de highlight (corazón/navegador/planta) van en `app/components/home-icons.tsx`, junto a los ya portados en spec 02. Verificación: `/acerca-de` responde y se ve completa.

5. **Nav.** Editar `app/components/nav.tsx`: cuarto enlace "Acerca de" → `/acerca-de` al final de la barra y del panel móvil, con `isAbout = pathname.startsWith('/acerca-de')`. Verificación: el enlace aparece y navega; el estado activo enciende solo en `/acerca-de`.

6. **CSS.** Anexar a `app/globals.css` el bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (`.about-*`, `.highlight*`, `.contact-*`, `.terminal-success`, `.term-*`, keyframes `pxblink` y `shake`), más las clases nuevas del panel de error (siguiendo el mismo lenguaje visual que `.terminal-success` pero en magenta, coherente con `.modal` de la ficha de juego). No modificar reglas existentes. Verificación: el resto de rutas no cambia visualmente.

7. **Repaso de CSS.** Contrastar toda clase usada en los componentes nuevos contra las definidas en `app/globals.css` y añadir solo lo que falte. Verificación: ninguna clase queda sin definir.

8. **Pasada estática.** `npm run lint` y `npm run build` sin errores ni advertencias.

9. **Verificación con Playwright.** Con `npm run dev` levantado, usar el MCP de Playwright para: (a) capturar `/acerca-de` completa a 1440px y 390px; (b) completar y enviar el formulario con datos reales, confirmar el estado `success` y que el correo llega a `andres.lopez.ate@gmail.com`; (c) forzar el estado `error` (ej. `RESEND_API_KEY` inválida temporalmente) y capturar el panel de error; (d) intentar enviar con un campo vacío y capturar el `shake`. Guardar capturas en `.playwright-evidence/` con nombre `03-<estado>-<ancho>.png`.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni advertencias.
- [ ] `/acerca-de` muestra el hero con el kicker `▸ ACERCA DE`, el título, el texto de misión y los 3 highlights con sus iconos y colores (magenta, cyan, verde).
- [ ] El separador decorativo entre hero y contacto se renderiza con sus píxeles animados.
- [ ] La sección de contacto muestra el título `CONTÁCTANOS`, el subtítulo, los 3 tips, y el formulario con campos Nombre/Correo electrónico/Mensaje.
- [ ] Enviar el formulario con algún campo vacío dispara el `shake` y no llama a la Server Action.
- [ ] Enviar el formulario con un correo de formato inválido muestra el error correspondiente y no llama a la Server Action.
- [ ] Enviar el formulario con datos válidos muestra el estado `loading`, luego `success` con el terminal `VAULT-OS // TERMINAL` y el nombre en mayúsculas.
- [ ] El envío válido genera un correo real recibido en `andres.lopez.ate@gmail.com` con los tres campos del formulario.
- [ ] Si la Server Action devuelve error (ej. Resend caído o API key inválida), el formulario muestra el panel de error sin perder los datos escritos, y permite reintentar.
- [ ] El campo honeypot es invisible y no interactuable por teclado o mouse en uso normal; si se rellena programáticamente, el envío se descarta en silencio (no llega correo, pero la UI puede mostrar éxito para no delatar la trampa al bot).
- [ ] El nav muestra 4 enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de — en ese orden, en la barra y en el panel móvil.
- [ ] En `/acerca-de` está activo el enlace "Acerca de"; en el resto de rutas no lo está.
- [ ] A 390px de ancho: los highlights quedan en una columna, el formulario y la intro de contacto se apilan verticalmente, sin scroll horizontal.
- [ ] La consola del navegador no muestra errores de hidratación en `/acerca-de`.
- [ ] `RESEND_API_KEY` no aparece en ningún archivo versionado; `.env.example` documenta la variable sin valor real.
- [ ] `.playwright-evidence/` contiene las capturas de los 4 estados del formulario en ambos anchos, y `git status` no la lista.

## Decisiones

- **Sí:** ruta `/acerca-de` en español, coherente con `/biblioteca`, `/salon`, `/auth`.
- **No:** `/about`. Rompería la única convención de idioma que el proyecto ha mantenido consistente desde spec 01/02.
- **Sí:** Server Action (`'use server'`) en lugar de Route Handler. El formulario es una única mutación simple invocada desde un solo Client Component; una API route añadiría una capa HTTP (fetch, manejo de status codes, CORS implícito) sin ningún consumidor externo que la necesite.
- **No:** Route Handler `app/api/contacto/route.ts`. Se reconsiderará si en el futuro algo más que este formulario necesita disparar el envío (ej. un webhook), pero hoy sería indirección sin uso.
- **Sí:** `onboarding@resend.dev` como remitente. No hay dominio propio verificado en Resend todavía; es el remitente de pruebas oficial de Resend y funciona sin configuración adicional, con la limitación de solo poder enviar al correo dueño de la cuenta — que es justamente `andres.lopez.ate@gmail.com`, el destino elegido.
- **Sí:** destino fijo `andres.lopez.ate@gmail.com`, escrito literal en `contacto.ts` (no en variable de entorno). Es un solo destinatario conocido de antemano, no una lista configurable; una env var añadiría un punto de configuración para un valor que no va a cambiar por ambiente.
- **Sí:** validación de email duplicada en cliente y servidor. El cliente da feedback inmediato (`shake`); el servidor es la única validación que realmente importa, porque el cliente es manipulable.
- **Sí:** honeypot simple en vez de reCAPTCHA/hCaptcha. Cero fricción para usuarios reales, bloquea bots básicos sin dependencias externas ni claves adicionales. Suficiente para un formulario de contacto de bajo volumen.
- **No:** rate limiting por IP. Añadir Upstash o similar es infraestructura nueva que no se justifica todavía para un formulario de contacto de un proyecto sin desplegar.
- **Sí:** `ContactoResult` como objeto `{ ok, error? }` en vez de lanzar excepciones desde la Server Action. Permite que el Client Component maneje el error como un estado de UI predecible, no como un `try/catch` alrededor de una llamada que puede fallar por mil razones de red.
- **Sí:** el panel de error reutiliza el lenguaje visual del `.modal` de game-over (borde/sombra magenta) en vez de un `alert()` del navegador o un toast genérico. Mantiene la estética "terminal/arcade" consistente con el resto del sitio.
- **Sí:** CSS anexado a `app/globals.css`, mismo patrón que spec 01 y 02. El estilo del panel de error es la única regla realmente nueva (no existe en el prototipo, que no contempla fallos de red).
- **No:** CSS Modules. Mantiene una sola convención de estilado en todo el proyecto.
- **Sí:** `.env.example` nuevo documentando `RESEND_API_KEY` sin valor. Da a cualquiera que clone el repo la señal de qué variable falta, sin exponer la key real.
- **Sí:** verificación con Playwright cubre los 4 estados del formulario (vacío, email inválido, éxito, error de servidor), no solo el layout estático. Es la única spec hasta ahora con lógica server-side real (envío de correo), así que el criterio de "terminado" incluye confirmar que el correo efectivamente llega.

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` termina commiteada por accidente (ej. alguien la pega directo en `contacto.ts` en vez de leerla de `process.env`).                                                                                                                                                                                                         | El paso 2 exige leerla vía `process.env.RESEND_API_KEY`; `.env*` ya está en `.gitignore` desde el scaffold inicial. El criterio de aceptación de "no aparece en archivos versionados" se revisa con `git grep` antes de dar el paso por terminado. |
| El remitente de prueba `onboarding@resend.dev` tiene límites más estrictos que un dominio verificado (solo puede enviar al correo dueño de la cuenta, y Resend puede aplicar rate limits agresivos en el plan free). Si se prueba muchas veces seguidas durante el desarrollo, algún envío puede fallar por rate limit, no por un bug real. | El estado `error` del formulario ya está diseñado para este caso; el paso 9 de verificación distingue explícitamente "forzar error con API key inválida" de un fallo real de rate limit, para no confundir ambos durante las pruebas.              |
| La Server Action se invoca sin que `RESEND_API_KEY` esté definida en `.env.local` (ej. en un checkout nuevo del repo).                                                                                                                                                                                                                      | `enviarContacto` verifica la variable al inicio y devuelve `{ ok: false, error: '...' }` en vez de lanzar una excepción no controlada que tumbaría toda la request en dev.                                                                         |
| El honeypot puede ser rellenado por autocompletado agresivo del navegador si no se marca correctamente `autoComplete='off'` y se posiciona fuera del flujo visual con un método que algunos lectores de pantalla no respetan (`display:none` es correcto, pero conviene no depender solo de CSS inline).                                    | Se usa `aria-hidden='true'` + `tabIndex={-1}` + `autoComplete='off'` juntos, no solo ocultamiento visual, siguiendo la práctica estándar de honeypots accesibles.                                                                                  |
| El correo enviado con `resend.emails.send` puede caer en spam del destinatario si el contenido es muy simple (sin dominio verificado, sin SPF/DKIM propios).                                                                                                                                                                                | Aceptado como limitación conocida del remitente de pruebas; se revisa manualmente en el paso 9 que el correo llegue (aunque sea a spam). Pasar a un dominio verificado es la mitigación real, fuera de alcance de esta spec.                       |
