'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '../supabase/client';

export type SessionProfile = { status: 'loading' } | { status: 'guest' } | { status: 'user'; username: string | null };

const resolveSession = async (): Promise<SessionProfile> => {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) return { status: 'guest' };

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  return { status: 'user', username: profile?.username ?? null };
};

/**
 * Session state for client chrome (the nav). Read in the browser on purpose:
 * reading cookies in the root layout would make every page dynamic and drop
 * the catalog's ISR.
 *
 * Sign-in, sign-out and username changes happen in Server Actions, which set
 * cookies without firing onAuthStateChange here, so the state is also
 * re-resolved on every navigation and on demand via refresh().
 */
export const useSessionProfile = () => {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionProfile>({ status: 'loading' });

  const refresh = useCallback(() => resolveSession().then(setSession), []);

  useEffect(() => {
    let active = true;
    resolveSession().then((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return { session, refresh };
};
