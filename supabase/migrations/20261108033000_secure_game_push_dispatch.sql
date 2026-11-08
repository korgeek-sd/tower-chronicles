-- Secure, retryable delivery queue. FCM secrets remain on Supabase Edge Functions,
-- never in the game bundle or public repository.
create extension if not exists pg_net with schema extensions;

alter table private.game_notifications
 add column if not exists push_claimed_at timestamptz,
 add column if not exists push_attempts integer not null default 0;

create index if not exists game_notifications_pending_push_idx
on private.game_notifications(created_at,id)
where push_sent_at is null and push_attempts<5;

-- Public schema required for the Data API, but ONLY service_role can execute.
create or replace function public.claim_game_push_batch(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'PUSH_SERVICE_ONLY' using errcode='42501';
 end if;
 with picked as (
  select n.id from private.game_notifications n
  where n.push_sent_at is null and n.created_at>now()-interval '24 hours'
    and n.push_attempts<5
    and (n.push_claimed_at is null or n.push_claimed_at<now()-interval '3 minutes')
  order by n.created_at,n.id limit least(greatest(coalesce(p_limit,20),1),50)
  for update skip locked
 ), claimed as (
  update private.game_notifications n
  set push_claimed_at=now(),push_attempts=n.push_attempts+1
  from picked p where n.id=p.id
  returning n.id,n.user_id,n.title,n.body,n.target,n.created_at
 )
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'title',c.title,'body',c.body,'target',c.target,
    'tokens',coalesce((select jsonb_agg(t.token) from private.game_push_tokens t
      where t.user_id=c.user_id and t.updated_at>now()-interval '180 days'),'[]'::jsonb)
  )),'[]'::jsonb) into v_result
 from claimed c;
 return v_result;
end;
$$;
revoke all on function public.claim_game_push_batch(integer) from public,anon,authenticated;
grant execute on function public.claim_game_push_batch(integer) to service_role;

create or replace function public.complete_game_push_delivery(p_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'PUSH_SERVICE_ONLY' using errcode='42501';
 end if;
 update private.game_notifications
 set push_sent_at=case when p_success then now() else push_sent_at end,
     push_claimed_at=null
 where id=p_id and push_sent_at is null;
end;
$$;
revoke all on function public.complete_game_push_delivery(uuid,boolean) from public,anon,authenticated;
grant execute on function public.complete_game_push_delivery(uuid,boolean) to service_role;

create or replace function public.remove_invalid_game_push_token(p_token text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'PUSH_SERVICE_ONLY' using errcode='42501';
 end if;
 delete from private.game_push_tokens where token=p_token;
end;
$$;
revoke all on function public.remove_invalid_game_push_token(text) from public,anon,authenticated;
grant execute on function public.remove_invalid_game_push_token(text) to service_role;

-- Vault secret game_push_dispatch_secret is intentionally NOT created here.
-- Until it is provisioned, the cron task exits without sending any HTTP request.
create or replace function private.dispatch_game_push()
returns void language plpgsql security definer set search_path='' as $$
declare v_secret text;
begin
 select decrypted_secret into v_secret
 from vault.decrypted_secrets where name='game_push_dispatch_secret' limit 1;
 if coalesce(length(v_secret),0)<32 then return;end if;
 perform net.http_post(
  url:='https://zecdhceihrdwdkdykxhx.supabase.co/functions/v1/send-game-push',
  headers:=jsonb_build_object('Content-Type','application/json','X-Game-Push-Secret',v_secret),
  body:='{}'::jsonb,
  timeout_milliseconds:=10000
 );
end;
$$;
revoke all on function private.dispatch_game_push() from public,anon,authenticated;
select cron.schedule('tc-game-push-dispatch','* * * * *','select private.dispatch_game_push()');
