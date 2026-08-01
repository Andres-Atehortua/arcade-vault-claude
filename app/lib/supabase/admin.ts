import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client with the service role key: it bypasses RLS, so it is the only
 * write path into `scores`. Import it from Server Actions only.
 */
export const createAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
