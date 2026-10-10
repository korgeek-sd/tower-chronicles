
-- Level-up points: one per level from Lv.2 to Lv.100, credited automatically for existing saves.
-- All allocations, spending and reset receipts live in private server-authoritative tables.
alter table private.hunting_states
 add column if not exists stat_allocation jsonb not null default '{"hp":0,"attack":0,"defense":0,"crit":0}'::jsonb,
 add column if not exists stat_resets integer not null default 0 check(stat_resets>=0);

create or replace function private.hunting_level(p_experience bigint)
returns integer language plpgsql immutable set search_path='' as $$
declare lvl integer:=1;total bigint:=0;needed bigint;
begin
 if p_experience is null or p_experience<=0 then return 1;end if;
 for lvl in 1..99 loop
  needed:=case when lvl<20 then 100+(lvl-1)*280 when lvl<40 then 15000+(lvl-20)*1700 when lvl<60 then 120000+(lvl-40)*12600 when lvl<80 then 800000+(lvl-60)*63000 when lvl<90 then 5000000+(lvl-80)*550000 else 10000000+(lvl-90)*700000 end;
  total:=total+needed;
  if p_experience<total then return lvl;end if;
 end loop;
 return 100;
end $$;
revoke all on function private.hunting_level(bigint) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.combat_equipment_stats(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 eq jsonb:=coalesce(p_payload->'expedition'->'equipment',p_payload->'equipped','{}');
 i jsonb;b jsonb;slot text;expected text;weapon text:='sword';
 hp numeric:=180;attack numeric:=8;defense numeric:=3;crit numeric:=.05;crit_damage numeric:=1.5;pen numeric:=0;
 seal_level integer:=0;bonus jsonb; allocated jsonb;
begin
 foreach slot in array array['weapon','helmet','armor','gloves','boots','necklace','ring'] loop
  select gear into i from private.market_assets where user_id=p_user and item_id='equipment_v2:'||(eq->>slot) and quantity=1;
  if i is null then continue;end if;
  expected:=case i->>'kind' when 'association_supply_iron_sword' then 'weapon' when 'outer_guard_longbow' then 'weapon' when 'archive_standard_arcane_staff' then 'weapon' when 'expedition_iron_helmet' then 'helmet' when 'return_corps_plate_armor' then 'armor' when 'mining_detail_reinforced_gloves' then 'gloves' when 'survey_corps_dust_boots' then 'boots' when 'association_registration_tag' then 'necklace' when 'expedition_merit_ring' then 'ring' else null end;
  if expected is distinct from slot then continue;end if;
  b:=private.fixed_equipment_stats(i->>'kind',i->>'grade');
  hp:=hp+coalesce((b->>'hp')::numeric,0);attack:=attack+coalesce((b->>'attack')::numeric,0);defense:=defense+coalesce((b->>'defense')::numeric,0);
  crit:=crit+coalesce((b->>'critChance')::numeric,0);crit_damage:=crit_damage+coalesce((b->>'critDamage')::numeric,0);pen:=pen+coalesce((b->>'armorPenetration')::numeric,0);
  if slot='weapon' then weapon:=case i->>'kind' when 'outer_guard_longbow' then 'bow' when 'archive_standard_arcane_staff' then 'staff' else 'sword' end;end if;
 end loop;
 select stat_allocation into allocated from private.hunting_states where user_id=p_user;
 hp:=hp+12*coalesce((allocated->>'hp')::integer,0);
 attack:=attack+coalesce((allocated->>'attack')::integer,0);
 defense:=defense+2*coalesce((allocated->>'defense')::integer,0);
 crit:=least(.6,crit+.02*coalesce((allocated->>'crit')::integer,0));
 select level into seal_level from private.player_association_seals where user_id=p_user;
 bonus:=private.association_seal_bonus_json(coalesce(seal_level,0));
 hp:=hp*(1+coalesce((bonus->>'hpPercent')::numeric,0)/100);
 attack:=attack*(1+coalesce((bonus->>'attackPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((bonus->>'defensePercent')::numeric,0)/100);
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon);
end $function$;
CREATE OR REPLACE FUNCTION private.refresh_hunting_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=least(100,s.vitality+ticks);
 s.recovered_at:=case when s.vitality=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'lastResult',s.last_result,'combatStats',private.combat_equipment_stats(u,(select jsonb_set(payload,'{expedition}',jsonb_build_object('equipment',payload->'equipped'),true) from public.game_saves where user_id=u)),'statAllocation',s.stat_allocation,'statResets',s.stat_resets,'statPoints',greatest(0,private.hunting_level(s.experience)-1-coalesce((s.stat_allocation->>'hp')::integer,0)-coalesce((s.stat_allocation->>'attack')::integer,0)-coalesce((s.stat_allocation->>'defense')::integer,0)-coalesce((s.stat_allocation->>'crit')::integer,0)),'currentHp',s.current_hp,'maxHp',s.max_hp,'potions',coalesce((select (l.products->>'potion')::bigint from private.village_life_players l where l.user_id=u),0),'foodTurns',coalesce((select l.food_turns from private.village_life_players l where l.user_id=u),'{}'::jsonb));
end $function$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.refresh_hunting_state(uuid) from public,anon,authenticated;

-- Repeated reset requests cannot charge twice.
create table if not exists private.hunting_stat_reset_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 cost bigint not null check(cost>=0),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.hunting_stat_reset_receipts enable row level security;

create or replace function public.allocate_hunting_stats(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_allocation jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; s public.game_saves%rowtype; h private.hunting_states%rowtype; k text; v jsonb;
 old_stats jsonb;new_stats jsonb;total integer:=0;old_total integer:=0;lvl integer;alloc jsonb:='{}'::jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'STAT_COMBAT_ACTIVE';end if;
 if p_allocation is null or jsonb_typeof(p_allocation)<>'object' then raise exception 'STAT_ALLOCATION_INVALID';end if;
 for k,v in select key,value from jsonb_each(p_allocation) loop
  if k not in ('hp','attack','defense','crit') or jsonb_typeof(v)<>'number' or v::text !~ '^(0|[1-9][0-9]?)$' then raise exception 'STAT_ALLOCATION_INVALID';end if;
 end loop;
 for k in select unnest(array['hp','attack','defense','crit']) loop
  if not p_allocation ? k then raise exception 'STAT_ALLOCATION_INVALID';end if;
  if (p_allocation->>k)::integer<coalesce((h.stat_allocation->>k)::integer,0) then raise exception 'STAT_MUST_RESET';end if;
  total:=total+(p_allocation->>k)::integer;
  old_total:=old_total+coalesce((h.stat_allocation->>k)::integer,0);
 end loop;
 if (p_allocation->>'crit')::integer>10 then raise exception 'STAT_CRIT_LIMIT';end if;
 lvl:=private.hunting_level(h.experience);
 if total>lvl-1 then raise exception 'STAT_POINTS_EMPTY';end if;
 if total>old_total then
  old_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
  update private.hunting_states set stat_allocation=p_allocation where user_id=u;
  new_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
  update private.hunting_states set max_hp=(new_stats->>'hp')::numeric,
    current_hp=least((new_stats->>'hp')::numeric,coalesce(h.current_hp,(old_stats->>'hp')::numeric)+greatest(0,(new_stats->>'hp')::numeric-(old_stats->>'hp')::numeric))
   where user_id=u;
 end if;
 return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u));
end $$;
revoke all on function public.allocate_hunting_stats(uuid,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.allocate_hunting_stats(uuid,bigint,text,text,jsonb) to authenticated;

create or replace function public.reset_hunting_stats(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s public.game_saves%rowtype;h private.hunting_states%rowtype;
 charged bigint;old_stats jsonb;new_stats jsonb;oldhp numeric;newhp numeric;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 select cost into charged from private.hunting_stat_reset_receipts where user_id=u and request_id=p_request_id;
 if found then return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u),'cost',charged,'replayed',true);end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'STAT_COMBAT_ACTIVE';end if;
 if coalesce((h.stat_allocation->>'hp')::integer,0)+coalesce((h.stat_allocation->>'attack')::integer,0)+coalesce((h.stat_allocation->>'defense')::integer,0)+coalesce((h.stat_allocation->>'crit')::integer,0)=0 then raise exception 'STAT_NOT_ALLOCATED';end if;
 charged:=case when h.stat_resets=0 then 0 else 10000+private.hunting_level(h.experience)*1000 end;
 if charged>0 then
  update private.player_wallets set silver=silver-charged,updated_at=now() where user_id=u and silver>=charged;
  if not found then raise exception 'STAT_SILVER_SHORTAGE';end if;
 end if;
 old_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
 update private.hunting_states set stat_allocation='{"hp":0,"attack":0,"defense":0,"crit":0}'::jsonb,stat_resets=stat_resets+1 where user_id=u;
 new_stats:=private.combat_equipment_stats(u,jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true));
 oldhp:=(old_stats->>'hp')::numeric;newhp:=(new_stats->>'hp')::numeric;
 update private.hunting_states set max_hp=newhp,current_hp=least(newhp,greatest(1,coalesce(h.current_hp,oldhp))) where user_id=u;
 insert into private.hunting_stat_reset_receipts(user_id,request_id,cost) values(u,p_request_id,charged);
 if charged>0 then perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');end if;
 return jsonb_build_object('state',private.refresh_hunting_state(u),'record',private.cloud_record_json(u),'cost',charged,'replayed',false);
end $$;
revoke all on function public.reset_hunting_stats(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reset_hunting_stats(uuid,bigint,text,text,uuid) to authenticated;
