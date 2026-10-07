-- Independent instant hunting. Existing expeditions and save schema remain intact.
create table private.hunting_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 vitality integer not null default 100 check(vitality between 0 and 100),
 recovered_at timestamptz not null default now(),
 experience bigint not null default 0 check(experience>=0),
 mastery bigint not null default 0 check(mastery>=0),
 skills text[] not null default array['heavy','guard','quick'],
 last_result jsonb
);
create table private.hunting_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,map_id text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table private.hunting_states enable row level security;
alter table private.hunting_receipts enable row level security;
revoke all on private.hunting_states,private.hunting_receipts from public,anon,authenticated;

create function private.refresh_hunting_state(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=least(100,s.vitality+ticks);
 s.recovered_at:=case when s.vitality=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'lastResult',s.last_result);
end $$;
revoke all on function private.refresh_hunting_state(uuid) from public,anon,authenticated;

create function public.get_hunting_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $$;
revoke all on function public.get_hunting_state(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_hunting_state(uuid,bigint,text,text) to authenticated;

create function public.save_hunting_preset(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skills text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_skills is null or cardinality(p_skills)>3 or exists(select 1 from unnest(p_skills) x where x is null or x not in ('heavy','guard','quick')) or (select count(distinct x) from unnest(p_skills)x)<>cardinality(p_skills) then raise exception 'HUNT_PRESET_INVALID';end if;
 perform private.refresh_hunting_state(u);
 update private.hunting_states set skills=p_skills where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $$;
revoke all on function public.save_hunting_preset(uuid,bigint,text,text,text[]) from public,anon;
grant execute on function public.save_hunting_preset(uuid,bigint,text,text,text[]) to authenticated;

create function public.hunt_once(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_map_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'HUNT_REQUEST_REQUIRED';end if;
 if p_map_id is null or p_map_id not in ('plains','forest','mine') then raise exception 'HUNT_MAP_INVALID';end if;
 -- Match economy lock order: save -> wallet -> hunting. Account save serializes concurrent requests.
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 select * into r from private.hunting_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.map_id<>p_map_id then raise exception 'HUNT_REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.refresh_hunting_state(u),'result',r.result,'record',private.cloud_record_json(u),'replayed',true,'serverNow',stamp);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if h.vitality<1 then raise exception 'VITALITY_EMPTY';end if;
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=35;xp:=20;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=55;xp:=30;material:='material:leather:1';monster_name:='가시 자칼';
 else mh:=180;ma:=24;md:=14;reward_silver:=80;xp:=45;material:='material:ore:1';monster_name:='고블린 광부';end if;
 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 hp:=(player->>'hp')::numeric;attack:=(player->>'attack')::numeric;defense:=(player->>'defense')::numeric;
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  foreach candidate in array h.skills loop
   if coalesce((cd->>candidate)::integer,0)<=turn_no and (candidate<>'guard' or hp/(player->>'hp')::numeric<=.5) then skill:=candidate;exit;end if;
  end loop;
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  else
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=greatest(1,floor(attack*mult*(case when critical then 1.5 else 1 end)*100/(100+greatest(0,md))));
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  end if;
  if mhp>0 then hit:=greatest(1,floor(ma*(case when guard then .5 else 1 end)*100/(100+greatest(0,defense))));hp:=greatest(0,hp-hit);lines:=lines||jsonb_build_array(monster_name||'의 공격! '||hit::text||' 피해');end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp));
 end loop;
 win:=mhp=0 and hp>0;
 result:=jsonb_build_object('requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player||jsonb_build_object('speed',10),'playerHp',hp,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $$;
revoke all on function public.hunt_once(uuid,bigint,text,text,uuid,text) from public,anon;
grant execute on function public.hunt_once(uuid,bigint,text,text,uuid,text) to authenticated;
