'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthError } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/server';
import { DEFAULT_NEXT, USERNAME_REGEX, isStrongPassword, normalizeUsername, safeNext } from '../lib/auth/validation';

export type AuthField = 'username' | 'email' | 'password' | 'confirm';

export type AuthResult = { ok: true } | { ok: false; error: string; field?: AuthField };

export interface SignUpPayload {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES = {
  usernameFormat: 'El usuario debe tener de 3 a 12 caracteres: letras, números o guion bajo.',
  usernameTaken: 'Ese usuario ya está en uso.',
  email: 'Introduce un correo electrónico válido.',
  weakPassword: 'La contraseña no cumple todos los requisitos.',
  mismatch: 'Las contraseñas no coinciden.',
  invalidCredentials: 'Correo o contraseña incorrectos.',
  emailNotConfirmed: 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.',
  rateLimit: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  samePassword: 'La nueva contraseña debe ser distinta de la anterior.',
  sessionExpired: 'El enlace de recuperación caducó. Pide uno nuevo desde iniciar sesión.',
  sessionMissing: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  usernameAlreadySet: 'Tu cuenta ya tiene un usuario.',
  oauth: 'No se pudo iniciar el acceso con el proveedor. Inténtalo de nuevo.',
  generic: 'Algo falló al conectar con el Vault. Inténtalo de nuevo.',
} as const;

/** Base URL of the current request, so auth links come back to the same host. */
const getOrigin = async () => {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
};

const isRateLimited = (error: AuthError) => error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit';

export const signUp = async (payload: SignUpPayload): Promise<AuthResult> => {
  const username = normalizeUsername(payload.username);
  const email = payload.email.trim();

  if (!USERNAME_REGEX.test(username)) return { ok: false, error: MESSAGES.usernameFormat, field: 'username' };
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: MESSAGES.email, field: 'email' };
  if (!isStrongPassword(payload.password)) return { ok: false, error: MESSAGES.weakPassword, field: 'password' };
  if (payload.password !== payload.confirm) return { ok: false, error: MESSAGES.mismatch, field: 'confirm' };

  const supabase = await createClient();

  // Early, friendly check. The unique constraint behind the trigger is still the
  // real guarantee if two people race for the same username.
  const { data: taken, error: lookupError } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();

  if (lookupError) return { ok: false, error: MESSAGES.generic };
  if (taken) return { ok: false, error: MESSAGES.usernameTaken, field: 'username' };

  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password: payload.password,
    options: {
      data: { username },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(DEFAULT_NEXT)}`,
    },
  });

  if (!error) return { ok: true };

  if (isRateLimited(error)) return { ok: false, error: MESSAGES.rateLimit };
  if (error.code === 'weak_password') return { ok: false, error: MESSAGES.weakPassword, field: 'password' };
  if (error.code === 'email_address_invalid') return { ok: false, error: MESSAGES.email, field: 'email' };
  // The profiles insert inside the trigger failed: with format already checked,
  // that means the username was taken between the lookup and the sign-up.
  if (error.code === 'unexpected_failure' || /database error saving new user/i.test(error.message)) {
    return { ok: false, error: MESSAGES.usernameTaken, field: 'username' };
  }

  return { ok: false, error: MESSAGES.generic };
};

/**
 * Wrong password and unknown email share one message so the form does not
 * reveal which addresses have an account. On success the caller navigates
 * to safeNext(next).
 */
export const signIn = async (payload: SignInPayload): Promise<AuthResult> => {
  const email = payload.email.trim();

  if (!EMAIL_REGEX.test(email)) return { ok: false, error: MESSAGES.email, field: 'email' };
  if (!payload.password) return { ok: false, error: MESSAGES.invalidCredentials };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: payload.password });

  if (!error) return { ok: true };

  if (error.code === 'email_not_confirmed') return { ok: false, error: MESSAGES.emailNotConfirmed };
  if (isRateLimited(error)) return { ok: false, error: MESSAGES.rateLimit };
  if (error.code === 'invalid_credentials' || error.status === 400) return { ok: false, error: MESSAGES.invalidCredentials };

  return { ok: false, error: MESSAGES.generic };
};

/** Ends the session (cookies included). The caller navigates to "/" afterwards. */
export const signOut = async (): Promise<AuthResult> => {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, error: MESSAGES.generic } : { ok: true };
};

export interface UpdatePasswordPayload {
  password: string;
  confirm: string;
}

/**
 * Always answers the same way for a well-formed email, whether or not an
 * account exists, so the form cannot be used to probe for accounts.
 */
export const requestPasswordReset = async (rawEmail: string): Promise<AuthResult> => {
  const email = rawEmail.trim();

  if (!EMAIL_REGEX.test(email)) return { ok: false, error: MESSAGES.email, field: 'email' };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/auth/restablecer')}`,
  });

  if (error && isRateLimited(error)) return { ok: false, error: MESSAGES.rateLimit };

  return { ok: true };
};

/** Sets a new password for the session opened by the recovery link. */
export const updatePassword = async (payload: UpdatePasswordPayload): Promise<AuthResult> => {
  if (!isStrongPassword(payload.password)) return { ok: false, error: MESSAGES.weakPassword, field: 'password' };
  if (payload.password !== payload.confirm) return { ok: false, error: MESSAGES.mismatch, field: 'confirm' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: payload.password });

  if (!error) return { ok: true };

  if (error.code === 'same_password') return { ok: false, error: MESSAGES.samePassword, field: 'password' };
  if (error.code === 'weak_password') return { ok: false, error: MESSAGES.weakPassword, field: 'password' };
  if (error.code === 'session_not_found' || error.status === 401) return { ok: false, error: MESSAGES.sessionExpired };

  return { ok: false, error: MESSAGES.generic };
};

export type OAuthProvider = 'google' | 'github';

export type OAuthResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Starts the OAuth dance. The PKCE verifier lands in a cookie here; the
 * browser then follows the returned URL to the provider and comes back
 * through /auth/callback.
 */
export const signInWithOAuth = async (provider: OAuthProvider, next: string | null): Promise<OAuthResult> => {
  if (provider !== 'google' && provider !== 'github') return { ok: false, error: MESSAGES.generic };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });

  if (error || !data.url) return { ok: false, error: MESSAGES.oauth };

  return { ok: true, url: data.url };
};

/**
 * Picks the username of an account that has none yet (fresh OAuth sign-ups).
 * RLS only lets the owner set it while it is still null, so this cannot
 * rename an existing username.
 *
 * On success it redirects from the server: a client-side router.replace()
 * right after this action got dropped by the router, leaving the user on the form.
 */
export const setUsername = async (rawUsername: string, next: string | null): Promise<AuthResult> => {
  const username = normalizeUsername(rawUsername);

  if (!USERNAME_REGEX.test(username)) return { ok: false, error: MESSAGES.usernameFormat, field: 'username' };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) return { ok: false, error: MESSAGES.sessionMissing };

  const { data, error } = await supabase.from('profiles').update({ username }).eq('id', userId).is('username', null).select('id');

  // 23505: unique_violation on profiles.username.
  if (error?.code === '23505') return { ok: false, error: MESSAGES.usernameTaken, field: 'username' };
  if (error) return { ok: false, error: MESSAGES.generic };
  if (!data?.length) return { ok: false, error: MESSAGES.usernameAlreadySet };

  redirect(safeNext(next));
};
