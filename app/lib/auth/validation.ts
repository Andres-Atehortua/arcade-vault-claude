/**
 * Auth rules shared by the client forms (live feedback) and the Server Actions
 * (enforcement). Supabase enforces the same password policy on its side.
 */

/** Same format as scores.alias and the profiles.username check. */
export const USERNAME_REGEX = /^[A-Z0-9_]{3,12}$/;

export const PASSWORD_RULES = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Una minúscula', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'Un número', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', label: 'Un símbolo', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const DEFAULT_NEXT = '/biblioteca';

export const normalizeUsername = (value: string) => value.trim().toUpperCase();

export const isStrongPassword = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));

/**
 * Only same-origin paths are allowed as post-login destinations: "/salon" is
 * fine, "//evil.com", "/\evil.com" and "https://evil.com" fall back to the default.
 */
export const safeNext = (next: string | null | undefined) => {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return DEFAULT_NEXT;
  return next;
};
