-- One stable code per registered player. Referral redemption and both reward
-- mails commit together; only the server can increment the capped bonus count.
create table private.friend_invite_codes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code text not null unique check(code ~ '^TC-[A-F0-9]{12}$'),
 rewarded_invites integer not null default 0 check(rewarded_invites between 0 and 100),
 created_at timestamptz not null default now()
);
create table private.friend_invite_claims (
 invitee_id uuid primary key references auth.users(id) on delete cascade,
 inviter_id uuid references auth.users(id) on delete set null,
 code_used text not null,
 inviter_rewarded boolean not null,
 invitee_mail_id uuid references private.game_mail(mail_id) on delete set null,
 inviter_mail_id uuid references private.game_mail(mail_id) on delete set null,
 applied_at timestamptz not null default now(),
 check(inviter_id is null or invitee_id<>inviter_id)
);
create index friend_invite_claims_inviter_idx on private.friend_invite_claims(inviter_id);
alter table private.friend_invite_codes enable row level security;
alter table private.friend_invite_claims enable row level security;
revoke all on private.friend_invite_codes,private.friend_invite_claims from public,anon,authenticated;

create function private.ensure_friend_invite_code(p_user_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_code text;attempt integer;
begin
 if not exists(select 1 from public.game_player_profiles where user_id=p_user_id) then raise exception 'INVITE_PROFILE_REQUIRED';end if;
 select code into v_code from private.friend_invite_codes where user_id=p_user_id;
 if found then return v_code;end if;
 for attempt in 1..10 loop
  v_code:='TC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  begin
   insert into private.friend_invite_codes(user_id,code) values(p_user_id,v_code) on conflict(user_id) do nothing;
   select code into v_code from private.friend_invite_codes where user_id=p_user_id;
   if found then return v_code;end if;
  exception when unique_violation then null;
  end;
 end loop;
 raise exception 'INVITE_CODE_GENERATION_FAILED';
end $$;
create function private.create_player_friend_invite_code() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.ensure_friend_invite_code(new.user_id);return new;end $$;
create trigger player_friend_invite_code after insert on public.game_player_profiles for each row execute function private.create_player_friend_invite_code();
revoke all on function private.ensure_friend_invite_code(uuid),private.create_player_friend_invite_code() from public,anon,authenticated;
-- Existing profiles receive codes without issuing any reward.
do $$ declare u uuid;begin for u in select user_id from public.game_player_profiles loop perform private.ensure_friend_invite_code(u);end loop;end $$;

create function public.get_friend_invite_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c private.friend_invite_codes%rowtype;r private.friend_invite_claims%rowtype;
begin
 if u is null then raise exception 'INVITE_AUTH_REQUIRED' using errcode='42501';end if;
 perform private.ensure_friend_invite_code(u);
 select * into c from private.friend_invite_codes where user_id=u;
 select * into r from private.friend_invite_claims where invitee_id=u;
 return jsonb_build_object('code',c.code,'rewardedInvites',c.rewarded_invites,'rewardLimit',100,'appliedCode',r.code_used,'appliedAt',r.applied_at);
end $$;

create function public.apply_friend_invite_code(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v_code text:=upper(btrim(p_code));c private.friend_invite_codes%rowtype;r private.friend_invite_claims%rowtype;v_invitee_mail uuid;v_inviter_mail uuid;v_rewarded boolean;
begin
 if u is null then raise exception 'INVITE_AUTH_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.game_player_profiles where user_id=u) then raise exception 'INVITE_PROFILE_REQUIRED';end if;
 if v_code is null or v_code !~ '^TC-[A-F0-9]{12}$' then raise exception 'INVITE_CODE_INVALID';end if;
 -- Serialize every redemption by the same account, including different codes.
 perform pg_advisory_xact_lock(hashtextextended('friend-invite-claim:'||u::text,0));
 select * into r from private.friend_invite_claims where invitee_id=u;
 if found then
  if r.code_used=v_code then return public.get_friend_invite_state()||jsonb_build_object('duplicate',true);end if;
  raise exception 'INVITE_ALREADY_APPLIED';
 end if;
 -- A single inviter row serializes the 100th/101st redemption boundary.
 select * into c from private.friend_invite_codes where code=v_code for update;
 if not found then raise exception 'INVITE_CODE_INVALID';end if;
 if c.user_id=u then raise exception 'INVITE_SELF_FORBIDDEN';end if;
 v_rewarded:=c.rewarded_invites<100;
 insert into private.game_mail(user_id,event_key,category,title,body,attachment_item_id,attachment_quantity,attachment_reward)
 values(u,'friend-invite:invitee:'||u::text,'reward','친구 초대 코드 적용 보상','친구 초대 코드를 적용하여 직능 뽑기권 50개를 받았습니다.','coupon_reward',1,'{"items":[{"id":"other:job_draw_ticket","quantity":50}]}'::jsonb) returning mail_id into v_invitee_mail;
 if v_rewarded then
  insert into private.game_mail(user_id,event_key,category,title,body,attachment_item_id,attachment_quantity,attachment_reward)
  values(c.user_id,'friend-invite:inviter:'||u::text,'reward','친구 초대 공유 보상','내 초대 코드가 적용되어 직능 뽑기권 10개를 받았습니다. 공유 보상은 최대 100회 지급됩니다.','coupon_reward',1,'{"items":[{"id":"other:job_draw_ticket","quantity":10}]}'::jsonb) returning mail_id into v_inviter_mail;
  update private.friend_invite_codes set rewarded_invites=rewarded_invites+1 where user_id=c.user_id;
 end if;
 insert into private.friend_invite_claims(invitee_id,inviter_id,code_used,inviter_rewarded,invitee_mail_id,inviter_mail_id) values(u,c.user_id,v_code,v_rewarded,v_invitee_mail,v_inviter_mail);
 return public.get_friend_invite_state()||jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.get_friend_invite_state(),public.apply_friend_invite_code(text) from public,anon;
grant execute on function public.get_friend_invite_state(),public.apply_friend_invite_code(text) to authenticated;
