-- Additive setup for private feedback. Does not modify encrypted sync tables.
create table if not exists public.feedback_submissions (
  id uuid primary key,
  request_hash text not null check (length(request_hash) = 64),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  email text check (email is null or length(email) <= 254),
  image_path text,
  submission_state text not null default 'processing' check (submission_state in ('processing', 'submitted', 'failed')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_submissions_created_at_idx on public.feedback_submissions (created_at desc);
alter table public.feedback_submissions enable row level security;
revoke all on public.feedback_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.feedback_submissions to service_role;
drop policy if exists feedback_submissions_deny_clients on public.feedback_submissions;
create policy feedback_submissions_deny_clients on public.feedback_submissions
  as restrictive for all to anon, authenticated using (false) with check (false);

create table if not exists public.feedback_rate_limits (
  key text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (key, window_start)
);
create index if not exists feedback_rate_limits_window_idx on public.feedback_rate_limits (window_start);
alter table public.feedback_rate_limits enable row level security;
revoke all on public.feedback_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.feedback_rate_limits to service_role;
drop policy if exists feedback_rate_limits_deny_clients on public.feedback_rate_limits;
create policy feedback_rate_limits_deny_clients on public.feedback_rate_limits
  as restrictive for all to anon, authenticated using (false) with check (false);

create or replace function public.claim_video_feedback(
  p_id uuid, p_hash text, p_content text, p_email text, p_ip_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  existing public.feedback_submissions%rowtype;
  count_value integer;
  token uuid := gen_random_uuid();
  feedback_now timestamptz := clock_timestamp();
  window_ip timestamptz := to_timestamp(floor(extract(epoch from feedback_now) / 600) * 600);
  window_global timestamptz := date_trunc('hour', feedback_now);
begin
  if char_length(p_content) > 500 or char_length(btrim(p_content)) = 0
    or length(p_hash) <> 64 or length(p_ip_hash) <> 64
    or (p_email is not null and length(p_email) > 254) then
    raise exception 'Invalid feedback';
  end if;
  -- Serializes attempts for a request id without holding a transaction over HTTP upload.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into existing from public.feedback_submissions where id = p_id;
  if found then
    if existing.request_hash <> p_hash then return jsonb_build_object('result', 'conflict'); end if;
    if existing.submission_state = 'submitted' then return jsonb_build_object('result', 'duplicate'); end if;
    if existing.submission_state = 'processing' and existing.lease_until > feedback_now then
      return jsonb_build_object('result', 'busy');
    end if;
  end if;
  insert into public.feedback_rate_limits as limits (key, window_start, attempts)
    values ('ip:' || p_ip_hash, window_ip, 1)
    on conflict (key, window_start) do update set attempts = limits.attempts + 1
    where limits.attempts < 5 returning attempts into count_value;
  if count_value is null then return jsonb_build_object('result', 'rate_limited'); end if;
  count_value := null;
  insert into public.feedback_rate_limits as limits (key, window_start, attempts)
    values ('global', window_global, 1)
    on conflict (key, window_start) do update set attempts = limits.attempts + 1
    where limits.attempts < 200 returning attempts into count_value;
  if count_value is null then return jsonb_build_object('result', 'rate_limited'); end if;
  delete from public.feedback_rate_limits where window_start < feedback_now - interval '1 day';
  insert into public.feedback_submissions (id, request_hash, content, email, lease_token, lease_until)
    values (p_id, p_hash, p_content, nullif(p_email, ''), token, feedback_now + interval '3 minutes')
    on conflict (id) do update set submission_state = 'processing', lease_token = token,
      lease_until = feedback_now + interval '3 minutes', updated_at = feedback_now;
  return jsonb_build_object('result', 'claimed', 'lease_token', token);
end;
$$;
revoke all on function public.claim_video_feedback(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_video_feedback(uuid,text,text,text,text) to service_role;

create or replace function public.complete_video_feedback(p_id uuid, p_token uuid, p_image_path text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare completed uuid;
begin
  update public.feedback_submissions set submission_state = 'submitted', image_path = p_image_path,
    lease_token = null, lease_until = null, updated_at = now()
    where id = p_id and lease_token = p_token and submission_state = 'processing'
    returning id into completed;
  return completed is not null;
end;
$$;
revoke all on function public.complete_video_feedback(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.complete_video_feedback(uuid,uuid,text) to service_role;

create or replace function public.fail_video_feedback(p_id uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare failed uuid;
begin
  update public.feedback_submissions set submission_state = 'failed', lease_token = null,
    lease_until = null, updated_at = now()
    where id = p_id and lease_token = p_token and submission_state = 'processing'
    returning id into failed;
  return failed is not null;
end;
$$;
revoke all on function public.fail_video_feedback(uuid,uuid) from public, anon, authenticated;
grant execute on function public.fail_video_feedback(uuid,uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];
-- No client storage policies: uploads and reads are restricted to the backend/admin.
