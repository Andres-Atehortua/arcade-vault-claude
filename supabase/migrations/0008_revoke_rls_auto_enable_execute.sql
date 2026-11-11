-- Security hardening flagged by the Supabase linter (0028/0029).
-- rls_auto_enable() backs the `ensure_rls` event trigger, which enables RLS on
-- every new public table. It is SECURITY DEFINER and was exposed through
-- /rest/v1/rpc to anon and authenticated. The event trigger does not need
-- those grants, so it keeps working after the revoke.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
