-- Receipt-based authority: successful server actions only; no client progress RPC.
create table private.quest_config(id boolean primary key default true check(id),salt text not null,started_at timestamptz not null);
insert into private.quest_config values(true,gen_random_uuid()::text,now());
create table private.quest_assignments(
 user_id uuid not null references auth.users(id) on delete cascade,period text not null check(period in ('daily','weekly')),day date not null,
 quest_id text not null,target integer not null check(target>0),position integer not null,
 reward_type text,reward jsonb,claimed_at timestamptz,
 primary key(user_id,period,day,quest_id),unique(user_id,period,day,position),unique(user_id,period,day,reward_type)
);
create table private.appearance_ticket_wallets(user_id uuid primary key references auth.users(id) on delete cascade,quantity bigint not null default 0 check(quantity>=0));
alter table private.quest_config enable row level security;
alter table private.quest_assignments enable row level security;
alter table private.appearance_ticket_wallets enable row level security;
revoke all on private.quest_config,private.quest_assignments,private.appearance_ticket_wallets from public,anon,authenticated;
create index if not exists hunting_quest_period on private.hunting_receipts(user_id,created_at);
create index if not exists gathering_quest_period on private.village_life_receipts(user_id,created_at);
create index if not exists crafting_quest_period on private.village_life_action_receipts(user_id,created_at) where action='craft';
create index if not exists market_quest_period on private.market_trades(buyer_id,executed_at);

create function private.quest_period(p_period text,p_at timestamptz) returns date language sql immutable set search_path='' as $$
 select case when p_period='weekly' then date_trunc('week',p_at at time zone 'Asia/Seoul')::date else (p_at at time zone 'Asia/Seoul')::date end
$$;
create function private.ensure_quests(u uuid,p_period text,p_day date) returns void language plpgsql set search_path='' as $$
declare seed text;
begin
 select salt into seed from private.quest_config;
 if p_period='daily' then
  insert into private.quest_assignments(user_id,period,day,quest_id,target,position)
  select u,p_period,p_day,id,target,row_number() over(order by md5(seed||u::text||p_day::text||id))
  from (values('hunt',30),('craft',10),('gather',30),('market',3),('donate',3)) q(id,target)
  order by md5(seed||u::text||p_day::text||id) limit 3 on conflict do nothing;
 elsif p_period='weekly' then
  insert into private.quest_assignments(user_id,period,day,quest_id,target,position)
  select u,p_period,p_day,id,target,pos from (values('hunt',300,1),('craft',50,2),('gather',150,3),('daily',10,4),('all',4,5)) q(id,target,pos) on conflict do nothing;
 else raise exception 'QUEST_PERIOD_INVALID';end if;
end $$;
create function private.quest_counts(u uuid,p_period text,p_day date) returns jsonb language plpgsql set search_path='' as $$
declare a timestamptz;b timestamptz;start_at timestamptz;h bigint;c bigint;g bigint;m bigint;d bigint;
begin
 select started_at into start_at from private.quest_config;
 a:=greatest(p_day::timestamp at time zone 'Asia/Seoul',start_at);
 b:=(p_day+case when p_period='weekly' then 7 else 1 end)::timestamp at time zone 'Asia/Seoul';
 select count(*) into h from private.hunting_receipts where user_id=u and created_at>=a and created_at<b and result->>'outcome'='victory';
 select coalesce(sum(count),0) into c from private.village_life_action_receipts where user_id=u and created_at>=a and created_at<b and action='craft';
 select coalesce(sum(count),0) into g from private.village_life_receipts where user_id=u and created_at>=a and created_at<b;
 select count(distinct buy_order_id) into m from private.market_trades where buyer_id=u and executed_at>=a and executed_at<b;
 select count(*) into d from private.online_association_donations where user_id=u and created_at>=a and created_at<b;
 return jsonb_build_object('hunt',h,'craft',c,'gather',g,'market',m,'donate',d);
end $$;
create function private.quest_snapshot(u uuid,p_at timestamptz default now()) returns jsonb language plpgsql set search_path='' as $$
declare today date:=private.quest_period('daily',p_at);week date:=private.quest_period('weekly',p_at);day_cursor date;counts jsonb;weekly_counts jsonb;daily_count integer:=0;all_count integer;daily_rows jsonb;weekly_rows jsonb;
begin
 for day_cursor in select generate_series(week,today,interval '1 day')::date loop
  perform private.ensure_quests(u,'daily',day_cursor);
  counts:=private.quest_counts(u,'daily',day_cursor);
  daily_count:=daily_count+(select count(*) from private.quest_assignments q where q.user_id=u and q.period='daily' and q.day=day_cursor and coalesce((counts->>q.quest_id)::bigint,0)>=q.target);
 end loop;
 perform private.ensure_quests(u,'weekly',week);
 counts:=private.quest_counts(u,'daily',today);
 weekly_counts:=private.quest_counts(u,'weekly',week)||jsonb_build_object('daily',daily_count);
 select count(*) into all_count from private.quest_assignments q where q.user_id=u and q.period='weekly' and q.day=week and q.quest_id<>'all' and coalesce((weekly_counts->>q.quest_id)::bigint,0)>=q.target;
 weekly_counts:=weekly_counts||jsonb_build_object('all',all_count);
 select jsonb_agg(jsonb_build_object('id',q.quest_id,'target',q.target,'progress',least(q.target,coalesce((counts->>q.quest_id)::bigint,0)),'completed',coalesce((counts->>q.quest_id)::bigint,0)>=q.target,'claimed',q.claimed_at is not null,'reward',q.reward) order by q.position) into daily_rows from private.quest_assignments q where q.user_id=u and q.period='daily' and q.day=today;
 select jsonb_agg(jsonb_build_object('id',q.quest_id,'target',q.target,'progress',least(q.target,coalesce((weekly_counts->>q.quest_id)::bigint,0)),'completed',coalesce((weekly_counts->>q.quest_id)::bigint,0)>=q.target,'claimed',q.claimed_at is not null,'reward',q.reward) order by q.position) into weekly_rows from private.quest_assignments q where q.user_id=u and q.period='weekly' and q.day=week;
 return jsonb_build_object('daily',daily_rows,'weekly',weekly_rows,'dailyKey',today,'weeklyKey',week,'serverNow',extract(epoch from p_at)*1000,'dailyResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000,'weeklyResetAt',extract(epoch from ((week+7)::timestamp at time zone 'Asia/Seoul'))*1000);
end $$;
-- Server-owned ticket count is included by every economy/save reconciliation.
create function private.quest_ticket_payload(u uuid,p jsonb) returns jsonb language sql set search_path='' as $$
 select jsonb_set(p,'{cosmetics}',coalesce(p->'cosmetics','{}')||jsonb_build_object('summonTickets',coalesce((select quantity from private.appearance_ticket_wallets where user_id=u),0)),true)
$$;
do $$declare definition text;begin
 select pg_get_functiondef('private.server_economy_payload(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'return private.skill_progress_payload(p_user,p_payload);','return private.quest_ticket_payload(p_user,private.skill_progress_payload(p_user,p_payload));');
 definition:=replace(definition,'return private.skill_progress_payload(p_user,v_payload);','return private.quest_ticket_payload(p_user,private.skill_progress_payload(p_user,v_payload));');
 if position('private.quest_ticket_payload' in definition)=0 then raise exception 'QUEST_ECONOMY_PATCH_REQUIRED';end if;
 execute definition;
end $$;
create function public.get_quests(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.quest_snapshot(u);
end $$;
create function public.claim_quest(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_period text,p_day date,p_quest_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;stamp timestamptz:=now();board jsonb;q private.quest_assignments%rowtype;entry jsonb;kind text;quantity integer;item text;item_name text;reward_result jsonb:='[]';i integer;balance bigint;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_period is null or p_period not in ('daily','weekly') or p_day is null or p_quest_id is null then raise exception 'QUEST_INVALID';end if;
 -- Serialize against challenge-ticket escrow before any row locks.
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 -- Match hunting lock order: save -> wallet -> life -> quest assignment.
 perform 1 from public.game_saves where user_id=u for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_village_life(u);
 board:=private.quest_snapshot(u,stamp);
 -- Serializes all claims for this period, including distinct quests/reward selection.
 perform 1 from private.quest_assignments where user_id=u and period=p_period and day=p_day order by position for update;
 select * into q from private.quest_assignments where user_id=u and period=p_period and day=p_day and quest_id=p_quest_id;
 if not found then raise exception 'QUEST_INVALID';end if;
 if q.claimed_at is not null then return jsonb_build_object('board',board,'reward',q.reward,'record',private.cloud_record_json(u),'replayed',true);end if;
 if p_day<>private.quest_period(p_period,stamp) then raise exception 'QUEST_EXPIRED';end if;
 select value into entry from jsonb_array_elements(board->p_period) where value->>'id'=p_quest_id;
 if entry is null or not (entry->>'completed')::boolean then raise exception 'QUEST_INCOMPLETE';end if;
 select candidate into kind from unnest(array['vitality','summon','potion','food','skillbook','challenge']) candidate
 where not exists(select 1 from private.quest_assignments a where a.user_id=u and a.period=p_period and a.day=p_day and a.reward_type=candidate) order by random() limit 1;
 quantity:=case kind when 'vitality' then case when p_period='daily' then 1 else 3 end when 'summon' then case when p_period='daily' then 5 else 15 end when 'potion' then case when p_period='daily' then 100 else 300 end when 'food' then case when p_period='daily' then 3 else 10 end when 'skillbook' then case when p_period='daily' then 1 else 3 end else case when p_period='daily' then 3 else 10 end end;
 if kind='summon' then
  insert into private.appearance_ticket_wallets values(u,quantity) on conflict(user_id) do update set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
  reward_result:=jsonb_build_array(jsonb_build_object('item','summon_ticket','name','외형 소환권','quantity',quantity));
 elsif kind='skillbook' then
  for i in 1..quantity loop
   select skill_id,name into item,item_name from private.skill_book_catalog where grade in ('C','B','A') order by random() limit 1;
   if item is null then raise exception 'QUEST_BOOK_CATALOG_EMPTY';end if;
   insert into private.market_assets(user_id,item_id,quantity) values(u,'skillbook:'||item,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1;
   reward_result:=reward_result||jsonb_build_array(jsonb_build_object('item',item,'name',item_name||' 스킬북','quantity',1));
  end loop;
 else
  for i in 1..case when kind='food' then quantity else 1 end loop
   item:=case kind when 'vitality' then 'vitality_potion' when 'potion' then 'potion' when 'challenge' then 'challenge_ticket' else (array['attack_food','defense_food','experience_food'])[1+floor(random()*3)::integer] end;
   item_name:=case item when 'vitality_potion' then '활력 회복 포션' when 'potion' then '체력 포션' when 'challenge_ticket' then '점령전 도전권' when 'attack_food' then '떡볶이' when 'defense_food' then '방어 음식' else '경험치 음식' end;
   select coalesce((products->>item)::bigint,0) into balance from private.village_life_players where user_id=u;
   update private.village_life_players set products=jsonb_set(products,array[item],to_jsonb(balance+case when kind='food' then 1 else quantity end),true) where user_id=u;
   reward_result:=reward_result||jsonb_build_array(jsonb_build_object('item',item,'name',item_name,'quantity',case when kind='food' then 1 else quantity end));
  end loop;
 end if;
 update private.quest_assignments set reward_type=kind,reward=reward_result,claimed_at=stamp where user_id=u and period=p_period and day=p_day and quest_id=p_quest_id;
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('board',private.quest_snapshot(u,stamp),'reward',reward_result,'record',private.cloud_record_json(u),'replayed',false);
end $$;
revoke all on function private.quest_period(text,timestamptz),private.ensure_quests(uuid,text,date),private.quest_counts(uuid,text,date),private.quest_snapshot(uuid,timestamptz),private.quest_ticket_payload(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_quests(uuid,bigint,text,text),public.claim_quest(uuid,bigint,text,text,text,date,text) from public,anon;
grant execute on function public.get_quests(uuid,bigint,text,text),public.claim_quest(uuid,bigint,text,text,text,date,text) to authenticated;
-- Challenge tickets share one balance across crafting, rewards, war and trade escrow.
insert into private.market_assets(user_id,item_id,quantity)
select user_id,'other:challenge_ticket',(products->>'challenge_ticket')::bigint from private.village_life_players where coalesce((products->>'challenge_ticket')::bigint,0)>0
on conflict(user_id,item_id) do update set quantity=excluded.quantity;
create function private.challenge_product_to_asset() returns trigger language plpgsql set search_path='' as $$
declare quantity_now bigint:=coalesce((new.products->>'challenge_ticket')::bigint,0);asset_now bigint;
begin
 if old.products->'challenge_ticket' is not distinct from new.products->'challenge_ticket' then return new;end if;
 select coalesce(quantity,0) into asset_now from private.market_assets where user_id=new.user_id and item_id='other:challenge_ticket';
 if coalesce(asset_now,0)=quantity_now then return new;end if;
 insert into private.market_assets(user_id,item_id,quantity) values(new.user_id,'other:challenge_ticket',quantity_now) on conflict(user_id,item_id) do update set quantity=excluded.quantity;
 return new;
end $$;
create function private.challenge_asset_to_product() returns trigger language plpgsql set search_path='' as $$
declare u uuid;quantity_now bigint;item_id_now text;
begin
 if TG_OP='DELETE' then u:=old.user_id;quantity_now:=0;item_id_now:=old.item_id;else u:=new.user_id;quantity_now:=new.quantity;item_id_now:=new.item_id;end if;
 if item_id_now<>'other:challenge_ticket' then return null;end if;
 update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}',to_jsonb(quantity_now),true)
 where user_id=u and coalesce((products->>'challenge_ticket')::bigint,0)<>quantity_now;
 return null;
end $$;
create trigger challenge_product_balance after update of products on private.village_life_players for each row execute function private.challenge_product_to_asset();
create trigger challenge_asset_balance after insert or update or delete on private.market_assets for each row execute function private.challenge_asset_to_product();
revoke all on function private.challenge_product_to_asset(),private.challenge_asset_to_product() from public,anon,authenticated;

-- Product debits/grants and escrow operations take the same outer lock.
do $$declare fn regprocedure;definition text;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('village_life_action','declare_village_war') loop
  select pg_get_functiondef(fn) into definition;
  if position('tc-market-mutations' in definition)=0 then
   definition:=regexp_replace(definition,'begin','begin
 perform pg_advisory_xact_lock(hashtextextended(''tc-market-mutations'',0));');
   execute definition;
  end if;
 end loop;
end $$;
