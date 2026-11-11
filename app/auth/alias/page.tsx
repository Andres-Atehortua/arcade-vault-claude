import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { DEFAULT_NEXT } from '../../lib/auth/validation';
import AliasForm from './alias-form';

/** First stop after an OAuth sign-up: providers do not hand us a username. */
const AliasPage = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect('/auth');

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();

  if (profile?.username) redirect(DEFAULT_NEXT);

  const { next } = await searchParams;

  return <AliasForm next={next ?? null} />;
};

export default AliasPage;
