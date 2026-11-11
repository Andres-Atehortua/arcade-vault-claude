-- Spec 13: per-IP rate limiting for Server Actions (auth, scores, contact).
-- Counters live in Postgres so they survive restarts and are shared across instances.
-- Only service_role can touch the table (RLS on, no policies) or call the function.

create table public.rate_limits (
  key          text        not null,  -- client IP or 'unknown'
  action       text        not null,  -- one of RateLimitAction
  window_start timestamptz not null,
  count        integer     not null default 1,
  primary key (key, action)
);

alter table public.rate_limits enable row level security;
-- No policies: only service_role can read/write.

-- Fixed-window counter. Returns 0 if allowed, otherwise seconds until the window resets.
create or replace function public.check_rate_limit(p_key text, p_action text, p_max integer, p_window_seconds integer)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_window interval := make_interval(secs => p_window_seconds);
  v_count integer;
  v_start timestamptz;
begin
  -- On-the-fly cleanup of stale rows (avoids depending on pg_cron).
  delete from public.rate_limits where window_start < now() - interval '1 day';

  insert into public.rate_limits as rl (key, action, window_start, count)
  values (p_key, p_action, now(), 1)
  on conflict (key, action) do update
    set window_start = case when rl.window_start + v_window <= now() then now() else rl.window_start end,
        count        = case when rl.window_start + v_window <= now() then 1 else rl.count + 1 end
  returning rl.count, rl.window_start into v_count, v_start;

  if v_count > p_max then
    return greatest(1, ceil(extract(epoch from (v_start + v_window - now())))::integer);
  end if;

  return 0;
end;
$$;

revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
