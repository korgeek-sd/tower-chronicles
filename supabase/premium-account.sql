-- Canonical membership is private; save payloads cannot grant entitlement.
create table private.premium_accounts(user_id uuid primary key references auth.users(id) on delete cascade,expires_at timestamptz not null,next_reward_at timestamptz not null);
create table private.premium_purchase_receipts(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,expires_at timestamptz not null,primary key(user_id,request_id));
alter table private.premium_accounts enable row level security;
alter table private.premium_purchase_receipts enable row level security;
revoke all on private.premium_accounts,private.premium_purchase_receipts from public,anon,authenticated;
create function private.premium_active(u uuid) returns boolean language sql stable set search_path='' as $$select exists(select 1 from private.premium_accounts where user_id=u and expires_at>now())$$;
create function private.premium_fee_bps(u uuid) returns integer language sql stable set search_path='' as $$select case when private.premium_active(u) then 500 else 1000 end$$;
create function private.settle_premium_rewards(u uuid) returns integer language plpgsql set search_path='' as $$
declare p private.premium_accounts%rowtype;n integer;
begin
 select * into p from private.premium_accounts where user_id=u for update;if not found then return 0;end if;
 n:=greatest(0,1+floor(extract(epoch from (least(now(),p.expires_at-interval '1 microsecond')-p.next_reward_at))/86400)::integer);
 if n>0 then
  insert into private.appearance_ticket_wallets(user_id,quantity) values(u,n*5) on conflict(user_id) do update set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
  update private.premium_accounts set next_reward_at=next_reward_at+n*interval '1 day' where user_id=u;
 end if;return n*5;
end $$;
create function private.premium_snapshot(u uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('active',private.premium_active(u),'expiresAt',(select extract(epoch from expires_at)*1000 from private.premium_accounts where user_id=u),'gold',coalesce((select gold from private.player_wallets where user_id=u),0),'serverNow',extract(epoch from now())*1000,'bankEligible',private.premium_active(u))
$$;
create function public.get_premium_account(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform 1 from public.game_saves where user_id=u for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 n:=private.settle_premium_rewards(u);if n>0 then perform private.persist_market_economy_to_save(u);end if;
 return private.premium_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));
end $$;
create function public.buy_premium_account(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;until_at timestamptz;old_until timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 perform 1 from public.game_saves where user_id=u for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if exists(select 1 from private.premium_purchase_receipts where user_id=u and request_id=p_request_id) then return private.premium_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u),'replayed',true);end if;
 if exists(select 1 from public.game_saves where user_id=u and jsonb_typeof(payload->'expedition') is distinct from 'null') then raise exception 'PREMIUM_EXPEDITION_ACTIVE';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform private.settle_premium_rewards(u);
 update private.player_wallets set gold=gold-1000,updated_at=now() where user_id=u and gold>=1000;
 if not found then raise exception 'PREMIUM_GOLD_SHORTAGE';end if;
 select expires_at into old_until from private.premium_accounts where user_id=u;
 until_at:=greatest(now(),coalesce(old_until,now()))+interval '30 days';
 insert into private.premium_accounts(user_id,expires_at,next_reward_at) values(u,until_at,((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul')
 on conflict(user_id) do update set expires_at=excluded.expires_at,next_reward_at=case when private.premium_accounts.expires_at<=now() then excluded.next_reward_at else private.premium_accounts.next_reward_at end;
 insert into private.premium_purchase_receipts values(u,p_request_id,until_at);
 perform private.persist_market_economy_to_save(u);
 return private.premium_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u),'replayed',false);
end $$;
revoke all on function private.premium_active(uuid),private.premium_fee_bps(uuid),private.settle_premium_rewards(uuid),private.premium_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.get_premium_account(uuid,bigint,text,text),public.buy_premium_account(uuid,bigint,text,text,uuid) from public,anon;
grant execute on function public.get_premium_account(uuid,bigint,text,text),public.buy_premium_account(uuid,bigint,text,text,uuid) to authenticated;
-- Integration: patch only checked anchors in the currently installed game engine.
alter table private.market_trades add column seller_fee_silver bigint not null default 0 check(seller_fee_silver>=0);
do $patch$
declare d text;needle text;
begin
 select pg_get_functiondef('public.hunt_once(uuid,bigint,text,text,uuid,text)'::regprocedure) into d;
 needle:='if coalesce((l.food_turns->>''experience_food'')::bigint,0)>0 then xp:=floor(xp*1.1);end if;';
 if position(needle in d)=0 then raise exception 'PREMIUM_XP_ANCHOR';end if;
 execute replace(d,needle,needle||' if private.premium_active(u) then xp:=floor(xp*1.1);end if;');
 select pg_get_functiondef('public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint)'::regprocedure) into d;
 needle:='silver=silver+v_price*v_qty,updated_at=now() where user_id=v_sell.user_id;';
 if position(needle in d)=0 then raise exception 'PREMIUM_MARKET_ANCHOR';end if;
 d:=replace(d,'returning trade_id into v_trade_id;','returning trade_id into v_trade_id; update private.market_trades set seller_fee_silver=floor(v_price::numeric*v_qty*private.premium_fee_bps(v_sell.user_id)/10000)::bigint where trade_id=v_trade_id;');
 execute replace(d,needle,'silver=silver+v_price*v_qty-floor(v_price::numeric*v_qty*private.premium_fee_bps(v_sell.user_id)/10000)::bigint,updated_at=now() where user_id=v_sell.user_id;');
 select pg_get_functiondef('public.buy_online_equipment_listing(uuid,bigint,text,text,uuid)'::regprocedure) into d;
 needle:='v_listing.list_price::numeric*500/10000';if position(needle in d)=0 then raise exception 'PREMIUM_EQUIPMENT_ANCHOR';end if;
 execute replace(d,needle,'v_listing.list_price::numeric*private.premium_fee_bps(v_listing.seller_id)/10000');
 select pg_get_functiondef('public.save_hunting_skill_sets(uuid,bigint,text,text,jsonb,integer)'::regprocedure) into d;
 needle:='chosen:=p_sets->p_active;';if position(needle in d)=0 then raise exception 'PREMIUM_SET_ANCHOR';end if;
 execute replace(d,needle,'if not private.premium_active(u) then if p_active>0 then raise exception ''PREMIUM_REQUIRED'';end if; for i in 1..2 loop p_sets:=jsonb_set(p_sets,array[i::text],coalesce((select skill_sets->i from private.hunting_states where user_id=u),''{"skills":[],"setup":{"slots":[null,null,null,null,null,null],"conditions":{}}}''::jsonb));end loop;end if; '||needle);
 select pg_get_functiondef('private.refresh_hunting_state(uuid)'::regprocedure) into d;
 needle:='select * into s from private.hunting_states where user_id=u for update;';
 if position(needle in d)=0 then raise exception 'PREMIUM_REFRESH_ANCHOR';end if;
 d:=replace(d,needle,needle||' if s.active_skill_set>0 and not private.premium_active(u) then s.skill_sets:=private.hunting_skill_set_bank(s.skills,s.skill_setup,s.skill_sets,s.active_skill_set);s.active_skill_set:=0;s.skill_setup:=s.skill_sets->0->''setup'';select coalesce(array_agg(value order by ord),array[]::text[]) into s.skills from jsonb_array_elements_text(s.skill_sets->0->''skills'') with ordinality x(value,ord);update private.hunting_states set skill_sets=s.skill_sets,active_skill_set=0,skills=s.skills,skill_setup=s.skill_setup where user_id=u;end if;');
 execute replace(d,'return jsonb_build_object(', 'return jsonb_build_object(''premiumActive'',private.premium_active(u),');
 select pg_get_functiondef('private.market_state_json(uuid)'::regprocedure) into d;
 needle:='''sellerFeeBps'',500';if position(needle in d)=0 then raise exception 'PREMIUM_POLICY_ANCHOR';end if;
 execute replace(d,needle,'''sellerFeeBps'',private.premium_fee_bps(p_user)');
 select pg_get_functiondef('private.market_order_mail(uuid,text)'::regprocedure) into d;
 needle:='''fee'',0';if position(needle in d)=0 then raise exception 'PREMIUM_MAIL_ANCHOR';end if;
 execute replace(d,needle,'''fee'',case when o.side=''SELL'' then coalesce((select sum(seller_fee_silver) from private.market_trades where sell_order_id=p_id),0) else 0 end');
end $patch$;
create or replace function private.gold_exchange_seller_fee_bps(p_user uuid) returns integer language sql stable set search_path='' as $$select private.premium_fee_bps(p_user)$$;
revoke all on function private.gold_exchange_seller_fee_bps(uuid) from public,anon,authenticated;
create function private.run_premium_daily() returns void language plpgsql security definer set search_path='' as $$
declare u uuid;n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 for u in select user_id from private.premium_accounts where next_reward_at<=now() and next_reward_at<expires_at order by user_id loop
  perform 1 from public.game_saves where user_id=u for update;
  n:=private.settle_premium_rewards(u);if n>0 then perform private.persist_market_economy_to_save(u);end if;
 end loop;
end $$;
revoke all on function private.run_premium_daily() from public,anon,authenticated;
select cron.schedule('tower-premium-daily','0 15 * * *','select private.run_premium_daily()');
