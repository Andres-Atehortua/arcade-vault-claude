import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { DEFAULT_NEXT } from '../lib/auth/validation';
import AuthCard from './auth-card';

type AuthSearchParams = { next?: string; error?: string };

const AuthPage = async ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) redirect(DEFAULT_NEXT);

  const { next, error } = await searchParams;

  return <AuthCard next={next ?? null} linkError={error ?? null} />;
};

export default AuthPage;
