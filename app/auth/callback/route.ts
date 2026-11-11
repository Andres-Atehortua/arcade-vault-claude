import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { safeNext } from '@/app/lib/auth/validation';

/**
 * Return point from Google/GitHub. Swaps the code for a session, then sends
 * accounts without a username to /auth/alias before anything else.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  const fail = () => NextResponse.redirect(new URL('/auth?error=oauth', request.url));

  // Cancelling on the provider screen comes back with ?error=access_denied and no code.
  if (!code) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) return fail();

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();

  if (!profile?.username) {
    return NextResponse.redirect(new URL(`/auth/alias?next=${encodeURIComponent(next)}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
};
