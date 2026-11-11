import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server';
import { safeNext } from '@/app/lib/auth/validation';

const RESET_PATH = '/auth/restablecer';
const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery'];

/**
 * Landing point of the links in the auth emails. Verifying the token hash on
 * the server opens the session in cookies, so the link works even when it is
 * opened in a different browser than the one used to sign up.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const fail = () => NextResponse.redirect(new URL('/auth?error=enlace', request.url));

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) return fail();

  const destination = type === 'recovery' ? RESET_PATH : safeNext(searchParams.get('next'));
  return NextResponse.redirect(new URL(destination, request.url));
};
