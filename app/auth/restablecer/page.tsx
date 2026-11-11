import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import ResetPasswordForm from './reset-password-form';

/** Reached through /auth/confirm with type=recovery, which opens the session first. */
const ResetPasswordPage = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect('/auth');

  return <ResetPasswordForm />;
};

export default ResetPasswordPage;
