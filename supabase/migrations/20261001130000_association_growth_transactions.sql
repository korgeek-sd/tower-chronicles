-- Complete the previously committed foundation. All economic operations are atomic.
alter table private.online_association_shop_items
 add column if not exists description text not null default '',
 add column if not exists reward_type text,
 add column if not exists reward_quantity integer not null default 1,
 add column if not exists required_level integer not null default 1;

update private.online_association_shop_items set enabled=false;
insert into private.online_association_shop_items(item_id,item_name,shop_type,contribution_cost,purchase_limit,description,reward_type,reward_quantity,required_level,enabled) values
 ('enhancement_stone_daily','강화석 ×1','DAILY',100,5,'장비 강화에 사용','STONE',1,1,true),
 ('greater_potion_daily','상급 포션 ×1','DAILY',200,3,'최대 HP의 50% 회복','POTION',1,1,true),
 ('silver_box_daily','실버 상자','DAILY',500,1,'10,000 Silver 지급','SILVER',10000,1,true),
 ('job_draw_ticket_daily','직능 뽑기권 ×5','DAILY',1000,1,'직능 기록실에서 사용','TICKET',5,2,true),
 ('job_draw_ticket_weekly','직능 뽑기권 ×30','WEEKLY',5000,1,'직능 기록실에서 사용','TICKET',30,3,true),
 ('rare_equipment_weekly','희귀 장비 상자','WEEKLY',5000,1,'공통 장비 9종 중 희귀 +0 장비 1개','EQUIPMENT',1,5,true),
 ('enhancement_stone_weekly','강화석 ×100','WEEKLY',3000,3,'장비 강화에 사용','STONE',100,3,true),
 ('gold_box_weekly','골드 보급 상자','WEEKLY',3000,1,'100 Gold 지급','GOLD',100,3,true),
 ('greater_potion_weekly','상급 포션 ×10','WEEKLY',1000,3,'고층 탐험 보급품','POTION',10,3,true)
on conflict(item_id) do update set item_name=excluded.item_name,shop_type=excluded.shop_type,
 contribution_cost=excluded.contribution_cost,purchase_limit=excluded.purchase_limit,description=excluded.description,
 reward_type=excluded.reward_type,reward_quantity=excluded.reward_quantity,required_level=excluded.required_level,enabled=true;

create table private.association_operation_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 operation text not null,
 input jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.association_operation_requests enable row level security;
revoke all on private.association_operation_requests from public,anon,authenticated;
create index if not exists association_donation_user_period_idx on private.online_association_donations(user_id,created_at,currency_type);
create index if not exists association_shop_user_item_period_idx on private.online_association_shop_purchases(user_id,item_id,purchased_at);

create or replace function private.association_level_from_exp(p_exp bigint) returns integer
language sql immutable set search_path='' as $$
 select count(*)::integer from unnest(array[0,1000,5000,15000,30000,60000,120000,250000,500000,1000000]::bigint[]) n where n<=greatest(0,p_exp)
$$;
revoke all on function private.association_level_from_exp(bigint) from public,anon,authenticated;
update private.online_associations set association_level=private.association_level_from_exp(association_exp);

create or replace function private.association_period_start(p_period text,p_at timestamptz default now()) returns timestamptz
language sql stable set search_path='' as $$
 select date_trunc(case when p_period='WEEKLY' then 'week' else 'day' end,p_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$$;
revoke all on function private.association_period_start(text,timestamptz) from public,anon,authenticated;

create or replace function private.association_progression_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a private.online_associations%rowtype; p private.online_association_member_progression%rowtype; s bigint; g bigint;
begin
 select x.* into a from private.online_associations x join private.online_association_members m using(association_id)
 where m.user_id=p_user and x.status='ACTIVE';
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into p from private.online_association_member_progression where association_id=a.association_id and user_id=p_user;
 select coalesce(sum(amount) filter(where currency_type='SILVER'),0),coalesce(sum(amount) filter(where currency_type='GOLD'),0)
 into s,g from private.online_association_donations where user_id=p_user and created_at>=private.association_period_start('DAILY');
 return jsonb_build_object('associationLevel',a.association_level,'associationExp',a.association_exp,
  'associationExpNext',(array[0,1000,5000,15000,30000,60000,120000,250000,500000,1000000]::bigint[])[least(10,a.association_level+1)],
  'contributionPoint',coalesce(p.contribution_point,0),'totalSilverDonation',coalesce(p.total_silver_donation,0),
  'totalGoldDonation',coalesce(p.total_gold_donation,0),'dailySilverDonation',s,'dailyGoldDonation',g,
  'dailySilverLimit',50000,'dailyGoldLimit',1000,'dailyResetAt',private.association_period_start('DAILY')+interval '1 day');
end;$$;
revoke all on function private.association_progression_json(uuid) from public,anon,authenticated;

create or replace function private.association_shop_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p jsonb; daily jsonb; weekly jsonb;
begin
 p:=private.association_progression_json(p_user);
 select coalesce(jsonb_agg(j order by item_id) filter(where shop_type='DAILY'),'[]'),
        coalesce(jsonb_agg(j order by item_id) filter(where shop_type='WEEKLY'),'[]') into daily,weekly from (
 select i.item_id,i.shop_type,jsonb_build_object('itemId',i.item_id,'name',i.item_name,'description',i.description,
  'reset',i.shop_type,'contributionCost',i.contribution_cost,'purchaseLimit',i.purchase_limit,'requiredLevel',i.required_level,
  'purchased',(select count(*) from private.online_association_shop_purchases b where b.user_id=p_user and b.item_id=i.item_id
   and b.purchased_at>=private.association_period_start(i.shop_type))) j
 from private.online_association_shop_items i where i.enabled) x;
 return jsonb_build_object('contribution',(p->>'contributionPoint')::bigint,'level',(p->>'associationLevel')::integer,
  'daily',daily,'weekly',weekly,'dailyResetAt',private.association_period_start('DAILY')+interval '1 day',
  'weeklyResetAt',private.association_period_start('WEEKLY')+interval '7 days');
end;$$;
revoke all on function private.association_shop_json(uuid) from public,anon,authenticated;

create or replace function public.get_association_progression(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin return private.association_progression_json(private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id));end;$$;
revoke all on function public.get_association_progression(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_association_progression(uuid,bigint,text,text) to authenticated;

create or replace function public.get_online_association_shop(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin return private.association_shop_json(private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id));end;$$;
revoke all on function public.get_online_association_shop(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_online_association_shop(uuid,bigint,text,text) to authenticated;

create or replace function public.donate_to_association(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_currency text,p_amount bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; a uuid; gain bigint; used bigint; unit bigint; lim bigint; w private.player_wallets%rowtype; previous private.association_operation_requests%rowtype; result jsonb; input jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'ASSOCIATION_REQUEST_REQUIRED';end if;
 if p_currency is null or p_currency not in('silver','gold') or p_amount is null or p_amount<=0 then raise exception 'ASSOCIATION_DONATION_INVALID';end if;
 unit:=case when p_currency='silver' then 10000 else 100 end;lim:=case when p_currency='silver' then 50000 else 1000 end;
 if p_amount%unit<>0 or p_amount>lim then raise exception 'ASSOCIATION_DONATION_INVALID';end if;
 input:=jsonb_build_object('currency',p_currency,'amount',p_amount);
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'DONATE' or previous.input<>input then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return jsonb_build_object('progression',private.association_progression_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into w from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id into a from private.online_association_members m join private.online_associations x using(association_id)
 where m.user_id=u and x.status='ACTIVE' for share of m;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 perform 1 from private.online_associations where association_id=a for update;
 select coalesce(sum(amount),0) into used from private.online_association_donations
 where user_id=u and currency_type=upper(p_currency) and created_at>=private.association_period_start('DAILY');
 if used+p_amount>lim then raise exception 'ASSOCIATION_DONATION_LIMIT';end if;
 if (p_currency='silver' and w.silver<p_amount) or (p_currency='gold' and w.gold<p_amount) then raise exception 'ASSOCIATION_BALANCE_SHORTAGE';end if;
 gain:=p_amount/unit*case when p_currency='silver' then 100 else 200 end;
 update private.player_wallets set silver=silver-case when p_currency='silver' then p_amount else 0 end,
 gold=gold-case when p_currency='gold' then p_amount else 0 end,updated_at=now() where user_id=u;
 update private.online_associations set association_exp=association_exp+gain,
 association_level=private.association_level_from_exp(association_exp+gain),total_donation=total_donation+gain,updated_at=now() where association_id=a;
 insert into private.online_association_member_progression(association_id,user_id,contribution_point,total_silver_donation,total_gold_donation)
 values(a,u,gain,case when p_currency='silver' then p_amount else 0 end,case when p_currency='gold' then p_amount else 0 end)
 on conflict(association_id,user_id) do update set contribution_point=private.online_association_member_progression.contribution_point+excluded.contribution_point,
 total_silver_donation=private.online_association_member_progression.total_silver_donation+excluded.total_silver_donation,
 total_gold_donation=private.online_association_member_progression.total_gold_donation+excluded.total_gold_donation,updated_at=now();
 insert into private.online_association_donations(association_id,user_id,currency_type,amount,association_exp_gain,contribution_gain)
 values(a,u,upper(p_currency),p_amount,gain,gain);
 perform private.association_activity(a,u,'DONATION',p_amount::text||' '||upper(p_currency)||' 기부 · 경험치 +'||gain::text);
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('progression',private.association_progression_json(u),'record',private.cloud_record_json(u),'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'DONATE',input,'{}');
 perform private.broadcast_association_change(a);
 return result;
end;$$;
revoke all on function public.donate_to_association(uuid,bigint,text,text,uuid,text,bigint) from public,anon;
grant execute on function public.donate_to_association(uuid,bigint,text,text,uuid,text,bigint) to authenticated;

create or replace function public.buy_online_association_shop_item(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; a uuid; level integer; points bigint; bought integer; item private.online_association_shop_items%rowtype;
 previous private.association_operation_requests%rowtype; result jsonb; gear jsonb; gear_id text; kind text;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'ASSOCIATION_REQUEST_REQUIRED';end if;
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'BUY' or previous.input<>jsonb_build_object('itemId',p_item_id) then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return previous.result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id,x.association_level into a,level from private.online_association_members m join private.online_associations x using(association_id)
 where m.user_id=u and x.status='ACTIVE' for share of m,x;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into item from private.online_association_shop_items where item_id=p_item_id and enabled;
 if not found then raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 if level<item.required_level then raise exception 'ASSOCIATION_LEVEL_REQUIRED';end if;
 select contribution_point into points from private.online_association_member_progression where association_id=a and user_id=u for update;
 if coalesce(points,0)<item.contribution_cost then raise exception 'ASSOCIATION_CONTRIBUTION_SHORTAGE';end if;
 select count(*) into bought from private.online_association_shop_purchases where user_id=u and item_id=p_item_id and purchased_at>=private.association_period_start(item.shop_type);
 if bought>=item.purchase_limit then raise exception 'ASSOCIATION_PURCHASE_LIMIT';end if;
 update private.online_association_member_progression set contribution_point=contribution_point-item.contribution_cost,updated_at=now() where association_id=a and user_id=u;
 if item.reward_type in('SILVER','GOLD') then
  update private.player_wallets set silver=silver+case when item.reward_type='SILVER' then item.reward_quantity else 0 end,
  gold=gold+case when item.reward_type='GOLD' then item.reward_quantity else 0 end,updated_at=now() where user_id=u;
 elsif item.reward_type='POTION' then
  insert into private.player_consumables(user_id,item_id,quantity,updated_at) values(u,'healing_greater',item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();
 elsif item.reward_type in('STONE','TICKET') then
  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(u,case when item.reward_type='STONE' then 'other:enhancement_stone' else 'other:job_draw_ticket' end,item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
 elsif item.reward_type='EQUIPMENT' then
  gear_id:=gen_random_uuid()::text;kind:=kinds[1+floor(private.job_registration_secure_unit()*9)::integer];
  gear:=jsonb_build_object('id',gear_id,'kind',kind,'grade','rare','enhancement',0);
  insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||gear_id,1,gear);
 else raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 insert into private.online_association_shop_purchases(association_id,user_id,item_id,cost) values(a,u,p_item_id,item.contribution_cost);
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('reward',jsonb_build_object('name',item.item_name,'type',item.reward_type,'quantity',item.reward_quantity,'equipment',gear),'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'BUY',jsonb_build_object('itemId',p_item_id),result);
 return result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u));
end;$$;
revoke all on function public.buy_online_association_shop_item(uuid,bigint,text,text,uuid,text) from public,anon;
grant execute on function public.buy_online_association_shop_item(uuid,bigint,text,text,uuid,text) to authenticated;

create or replace function public.register_online_job_with_tickets(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_rolls integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; tickets bigint; v_gold bigint; results jsonb:='[]'; previous private.association_operation_requests%rowtype; result jsonb; i integer; rarity text; job text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_rolls is null or p_rolls not in(1,10) then raise exception 'ASSOCIATION_DRAW_INVALID';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select gold into v_gold from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'DRAW' or previous.input<>jsonb_build_object('rolls',p_rolls) then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return previous.result||jsonb_build_object('state',private.job_registration_state_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 select quantity into tickets from private.market_assets where user_id=u and item_id='other:job_draw_ticket' for update;
 if coalesce(tickets,0)<p_rolls then raise exception 'ASSOCIATION_TICKET_SHORTAGE';end if;
 update private.market_assets set quantity=quantity-p_rolls,updated_at=now() where user_id=u and item_id='other:job_draw_ticket';
 for i in 1..p_rolls loop
  rarity:=private.job_registration_draw_rarity();job:=private.job_registration_pick_job(u,rarity);
  results:=results||jsonb_build_array(private.apply_job_registration_record(u,job)||jsonb_build_object('index',i,'pickup',false));
 end loop;
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('requestId',p_request_id,'paidRolls',p_rolls,'resultCount',p_rolls,'goldCost',0,'goldBefore',v_gold,'goldAfter',v_gold,
  'ticketCost',p_rolls,'results',results,'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'DRAW',jsonb_build_object('rolls',p_rolls),result);
 return result||jsonb_build_object('state',private.job_registration_state_json(u),'record',private.cloud_record_json(u));
end;$$;
revoke all on function public.register_online_job_with_tickets(uuid,bigint,text,text,uuid,integer) from public,anon;
grant execute on function public.register_online_job_with_tickets(uuid,bigint,text,text,uuid,integer) to authenticated;
