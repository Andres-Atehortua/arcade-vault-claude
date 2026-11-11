import { headers } from 'next/headers';

import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Per-IP rate limiting for Server Actions (spec 13), backed by public.rate_limits and the
 * atomic public.check_rate_limit() function. Server-side only: it uses the service role client.
 */

export type RateLimitAction =
  'sign_up' | 'sign_in' | 'password_reset' | 'update_password' | 'set_username' | 'oauth' | 'save_score' | 'contact';

/** Fixed-window limits per action. Tunable here without a migration. */
export const RATE_LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number }> = {
  sign_up: { max: 3, windowSeconds: 3600 },
  sign_in: { max: 10, windowSeconds: 900 },
  password_reset: { max: 3, windowSeconds: 3600 },
  update_password: { max: 5, windowSeconds: 900 },
  set_username: { max: 5, windowSeconds: 900 },
  oauth: { max: 10, windowSeconds: 900 },
  save_score: { max: 20, windowSeconds: 600 },
  contact: { max: 3, windowSeconds: 3600 },
};

/** Same copy as the generic error in app/actions/auth.ts. */
const GENERIC_ERROR = 'Algo falló al conectar con el Vault. Inténtalo de nuevo.';

const blockedMessage = (retryAfterSeconds: number) => `DEMASIADOS INTENTOS. INTÉNTALO EN ${Math.ceil(retryAfterSeconds / 60)} MIN.`;

/**
 * Client IP: first x-forwarded-for value, then x-real-ip, then 'unknown'.
 * Note: x-forwarded-for is spoofable without a trusted proxy in front (accepted until deployment is defined).
 */
export const getClientIp = async (): Promise<string> => {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = h.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
};

/**
 * Counts one hit for the current IP and action.
 * Returns null if allowed, or the user-facing error message if blocked or the check failed (fail-closed).
 */
export const checkRateLimit = async (action: RateLimitAction): Promise<string | null> => {
  const { max, windowSeconds } = RATE_LIMITS[action];

  try {
    const ip = await getClientIp();
    const { data, error } = await createAdminClient().rpc('check_rate_limit', {
      p_key: ip,
      p_action: action,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (error || typeof data !== 'number') return GENERIC_ERROR;
    return data > 0 ? blockedMessage(data) : null;
  } catch {
    return GENERIC_ERROR;
  }
};
