-- Coupon system foundation
-- Server-side validation and reward delivery will use this schema.

create table if not exists private.game_coupons (
 coupon_id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 reward_data jsonb not null default '{}',
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 max_uses integer,
 used_count integer not null default 0,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 check(expires_at > starts_at),
 check(max_uses is null or max_uses > 0)
);

create table if not exists private.coupon_claims (
 claim_id uuid primary key default gen_random_uuid(),
 coupon_id uuid not null references private.game_coupons(coupon_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 claimed_at timestamptz not null default now(),
 unique(coupon_id,user_id)
);

create index if not exists game_coupons_code_idx on private.game_coupons(code);
create index if not exists coupon_claims_user_idx on private.coupon_claims(user_id);

-- Coupon redemption is atomic with its reward mail. Reward collection uses
-- the existing gameplay lease, economy save lock and mail claim transaction.
alter table private.game_coupons enable row level security;
alter table private.coupon_claims enable row level security;
revoke all on private.game_coupons,private.coupon_claims from public,anon,authenticated;
alter table private.game_mail add column if not exists attachment_reward jsonb not null default '{}';

create or replace function public.is_coupon_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'coupon_admin'='true');
$$;
revoke all on function public.is_coupon_admin() from public,anon;
grant execute on function public.is_coupon_admin() to authenticated;

create or replace function private.validate_coupon_reward(r jsonb)
returns void language plpgsql set search_path='' as $$
declare item jsonb;k text;
begin
 if r is null or jsonb_typeof(r)<>'object' or r='{}'::jsonb then raise exception 'COUPON_REWARD_INVALID';end if;
 if exists(select 1 from jsonb_object_keys(r) x where x not in('silver','gold','items')) then raise exception 'COUPON_REWARD_INVALID';end if;
 foreach k in array array['silver','gold'] loop
 if r ? k and (jsonb_typeof(r->k)<>'number' or (r->>k)!~'^[0-9]+$' or (r->>k)::numeric>1000000000) then raise exception 'COUPON_REWARD_INVALID';end if;
 end loop;
 if r ? 'items' then
 if jsonb_typeof(r->'items')<>'array' or jsonb_array_length(r->'items')>20 then raise exception 'COUPON_REWARD_INVALID';end if;
 for item in select value from jsonb_array_elements(r->'items') loop
 if jsonb_typeof(item)<>'object' or not(item ? 'id' and item ? 'quantity') or jsonb_typeof(item->'id')<>'string' or jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^[0-9]+$' or (item->>'quantity')::numeric not between 1 and 1000000 then raise exception 'COUPON_REWARD_INVALID';end if;
 -- Only established stackable assets, never arbitrary equipment IDs.
 if item->>'id' not in('other:enhancement_stone','other:job_draw_ticket') then raise exception 'COUPON_REWARD_INVALID';end if;
 end loop;
 end if;
 if coalesce((r->>'silver')::bigint,0)=0 and coalesce((r->>'gold')::bigint,0)=0 and jsonb_array_length(coalesce(r->'items','[]'))=0 then raise exception 'COUPON_REWARD_INVALID';end if;
end $$;
revoke all on function private.validate_coupon_reward(jsonb) from public,anon,authenticated;

create or replace function private.coupon_json(c private.game_coupons)
returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('couponId',c.coupon_id,'code',c.code,'name',c.name,'reward',c.reward_data,'startsAt',c.starts_at,'expiresAt',c.expires_at,'maxUses',c.max_uses,'usedCount',c.used_count,'enabled',c.enabled);
$$;
revoke all on function private.coupon_json(private.game_coupons) from public,anon,authenticated;

create or replace function public.create_game_coupon(p_code text,p_name text,p_reward jsonb,p_starts_at timestamptz,p_expires_at timestamptz,p_max_uses integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.game_coupons%rowtype;code text:=upper(btrim(p_code));
begin
 if not public.is_coupon_admin() then raise exception 'COUPON_ADMIN_REQUIRED' using errcode='42501';end if;
 if code is null or code!~'^[A-Z0-9_-]{3,40}$' or p_name is null or length(btrim(p_name)) not between 1 and 80 or p_starts_at is null or p_expires_at is null or not isfinite(p_starts_at) or not isfinite(p_expires_at) or p_expires_at<=p_starts_at or(p_max_uses is not null and p_max_uses<=0) then raise exception 'COUPON_CONFIG_INVALID';end if;
 perform private.validate_coupon_reward(p_reward);
 insert into private.game_coupons(code,name,reward_data,starts_at,expires_at,max_uses) values(code,btrim(p_name),p_reward,p_starts_at,p_expires_at,p_max_uses) returning * into c;
 return private.coupon_json(c);
 exception when unique_violation then raise exception 'COUPON_DUPLICATE';
end $$;
revoke all on function public.create_game_coupon(text,text,jsonb,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.create_game_coupon(text,text,jsonb,timestamptz,timestamptz,integer) to authenticated;

create or replace function public.list_game_coupons()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_coupon_admin() then raise exception 'COUPON_ADMIN_REQUIRED' using errcode='42501';end if;
 return coalesce((select jsonb_agg(private.coupon_json(c) order by created_at desc) from (select * from private.game_coupons order by created_at desc limit 200)c),'[]');
end $$;
revoke all on function public.list_game_coupons() from public,anon;
grant execute on function public.list_game_coupons() to authenticated;

create or replace function public.set_game_coupon_enabled(p_coupon_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_coupon_admin() then raise exception 'COUPON_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_enabled is null then raise exception 'COUPON_CONFIG_INVALID';end if;
 update private.game_coupons set enabled=p_enabled where coupon_id=p_coupon_id;
 if not found then raise exception 'COUPON_INVALID';end if;
end $$;
revoke all on function public.set_game_coupon_enabled(uuid,boolean) from public,anon;
grant execute on function public.set_game_coupon_enabled(uuid,boolean) to authenticated;

create or replace function public.redeem_game_coupon(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c private.game_coupons%rowtype;m uuid;t timestamptz;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_code is null or length(p_code)>100 then raise exception 'COUPON_INVALID';end if;
 select * into c from private.game_coupons where code=upper(btrim(p_code)) for update;
 t:=clock_timestamp();
 if not found or not c.enabled then raise exception 'COUPON_INVALID';end if;
 if exists(select 1 from private.coupon_claims where coupon_id=c.coupon_id and user_id=u) then raise exception 'COUPON_ALREADY_USED';end if;
 if t<c.starts_at then raise exception 'COUPON_NOT_STARTED';end if;
 if t>=c.expires_at then raise exception 'COUPON_EXPIRED';end if;
 if c.max_uses is not null and c.used_count>=c.max_uses then raise exception 'COUPON_EXHAUSTED';end if;
 perform private.validate_coupon_reward(c.reward_data);
 insert into private.coupon_claims(coupon_id,user_id) values(c.coupon_id,u);
 insert into private.game_mail(user_id,event_key,category,title,body,attachment_item_id,attachment_quantity,attachment_reward)
 values(u,'coupon:'||c.coupon_id,'reward','쿠폰 보상',c.name||E'\n쿠폰 보상이 도착했습니다. 받기 버튼으로 수령해 주세요.','coupon_reward',1,c.reward_data) returning mail_id into m;
 update private.game_coupons set used_count=used_count+1 where coupon_id=c.coupon_id;
 return jsonb_build_object('ok',true,'mailId',m,'name',c.name);
end $$;
revoke all on function public.redeem_game_coupon(text) from public,anon;
grant execute on function public.redeem_game_coupon(text) to authenticated;

create or replace function private.deliver_coupon_reward(u uuid,r jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 perform private.validate_coupon_reward(r);
 update private.player_wallets set silver=silver+coalesce((r->>'silver')::bigint,0),gold=gold+coalesce((r->>'gold')::bigint,0),updated_at=now() where user_id=u;
 if not found then raise exception 'COUPON_WALLET_MISSING';end if;
 for item in select value from jsonb_array_elements(coalesce(r->'items','[]')) loop
 perform private.deliver_market_asset(u,item->>'id',(item->>'quantity')::bigint,null);
 end loop;
end $$;
revoke all on function private.deliver_coupon_reward(uuid,jsonb) from public,anon,authenticated;

create or replace function public.get_game_mail()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object('mails',coalesce((select jsonb_agg(jsonb_build_object(
 'mailId',mail_id,'title',title,'category',category,'body',body,'details',details,'read',read_at is not null,'claimed',claimed_at is not null,
 'createdAt',extract(epoch from created_at)*1000,'expiresAt',extract(epoch from expires_at)*1000,
 'attachment',case when attachment_item_id is not null then jsonb_build_object('itemId',attachment_item_id,'quantity',attachment_quantity,'gear',attachment_gear,'reward',nullif(attachment_reward,'{}'::jsonb)) end
 ) order by created_at desc,mail_id) from private.game_mail where user_id=u and expires_at>now()),'[]'::jsonb));
end $$;
revoke all on function public.get_game_mail() from public,anon;
grant execute on function public.get_game_mail() to authenticated;


create or replace function public.manage_game_mail(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action text,p_mail_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;m private.game_mail%rowtype;v_changed boolean:=false;g jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_action not in('read','claim','claim_all','delete','delete_read') or p_action is null then raise exception 'MAIL_ACTION_INVALID';end if;
 if p_action in('claim','claim_all') then
 perform 1 from public.game_saves where user_id=u for update;
 perform private.sync_market_economy_from_latest_save(u);
 if exists(select 1 from public.game_saves where user_id=u and jsonb_typeof(payload->'expedition') is distinct from 'null') or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'MAIL_EXPEDITION_BLOCKED';end if;
 -- Lock canonical save before assets, matching other player economy operations.
 perform 1 from public.game_saves where user_id=u for update;
 end if;
 if p_action in('read','claim','delete') and not exists(select 1 from private.game_mail where mail_id=p_mail_id and user_id=u and expires_at>now()) then raise exception 'MAIL_NOT_FOUND';end if;
 for m in select * from private.game_mail where user_id=u and expires_at>now() and (mail_id=p_mail_id or p_action in('claim_all','delete_read')) order by mail_id for update loop
 if p_action='read' then update private.game_mail set read_at=coalesce(read_at,now()) where mail_id=m.mail_id;
 elsif p_action in('claim','claim_all') then
 if m.attachment_item_id is not null and m.claimed_at is null then
 if m.attachment_reward<>'{}'::jsonb then perform private.deliver_coupon_reward(u,m.attachment_reward);
 elsif jsonb_array_length(m.attachment_assets)>0 then
   for g in select value from jsonb_array_elements(m.attachment_assets) loop perform private.deliver_market_asset(u,'equipment_v2:'||(g->>'id'),1,g);end loop;
 else perform private.deliver_market_asset(u,m.attachment_item_id,m.attachment_quantity,m.attachment_gear);end if;
 update private.game_mail set claimed_at=now(),read_at=coalesce(read_at,now()) where mail_id=m.mail_id;v_changed:=true;
 end if;
 elsif p_action='delete' then
 if m.attachment_item_id is not null and m.claimed_at is null then raise exception 'MAIL_UNCLAIMED';end if;
 delete from private.game_mail where mail_id=m.mail_id;
 elsif p_action='delete_read' and m.read_at is not null and (m.attachment_item_id is null or m.claimed_at is not null) then delete from private.game_mail where mail_id=m.mail_id;
 end if;
 end loop;
 if v_changed then perform private.persist_market_economy_to_save(u);end if;
 return public.get_game_mail()||jsonb_build_object('economy',case when p_action in('claim','claim_all') then private.market_state_json(u) end);
end $$;


