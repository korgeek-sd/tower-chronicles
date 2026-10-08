-- Six-stat hunting. Equipment remains server authoritative; no client-supplied combat options.
create or replace function private.hunting_damage(attack numeric,defense numeric,multiplier numeric,penetration numeric)
returns numeric language sql immutable set search_path='' as $$
 select greatest(1,floor(greatest(0,attack)*multiplier*100/(100+greatest(0,defense)*(1-greatest(0,least(1,penetration))))))
$$;
revoke all on function private.hunting_damage(numeric,numeric,numeric,numeric) from public,anon,authenticated;
create or replace function public.hunt_once(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_map_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;l private.village_life_players%rowtype;potions_used bigint;potions_before bigint;next_hp numeric;start_hp numeric;food text;remaining bigint;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
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
 perform private.refresh_village_life(u);select * into strict l from private.village_life_players where user_id=u;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if h.vitality<1 then raise exception 'VITALITY_EMPTY';end if;
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=35;xp:=20;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=55;xp:=30;material:='material:leather:1';monster_name:='가시 자칼';
 else mh:=180;ma:=24;md:=14;reward_silver:=80;xp:=45;material:='material:ore:1';monster_name:='고블린 광부';end if;
 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 player:=jsonb_build_object('hp',greatest(1,(player->>'hp')::numeric),'attack',greatest(0,(player->>'attack')::numeric),'defense',greatest(0,(player->>'defense')::numeric),'critChance',greatest(0,least(1,coalesce((player->>'critChance')::numeric,.05))),'critDamage',greatest(1,coalesce((player->>'critDamage')::numeric,1.5)),'armorPenetration',greatest(0,least(1,coalesce((player->>'armorPenetration')::numeric,0))));
 hp:=greatest(1,least((player->>'hp')::numeric,coalesce(h.current_hp,(player->>'hp')::numeric)));
 potions_before:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 hp:=least((player->>'hp')::numeric,hp+potions_before);start_hp:=hp;
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_before),true);
 attack:=(player->>'attack')::numeric*case when coalesce((l.food_turns->>'attack_food')::bigint,0)>0 then 1.1 else 1 end;
 defense:=(player->>'defense')::numeric*case when coalesce((l.food_turns->>'defense_food')::bigint,0)>0 then 1.1 else 1 end;
 player:=player||jsonb_build_object('attack',attack,'defense',defense);
 if coalesce((l.food_turns->>'experience_food')::bigint,0)>0 then xp:=floor(xp*1.1);end if;
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  foreach candidate in array h.skills loop
   if candidate in ('heavy','guard','quick') and coalesce((cd->>candidate)::integer,0)<=turn_no and (candidate<>'guard' or hp/(player->>'hp')::numeric<=.5) then skill:=candidate;exit;end if;
  end loop;
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  elsif skill is not null then
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=private.hunting_damage(attack,md,mult*(case when critical then (player->>'critDamage')::numeric else 1 end),(player->>'armorPenetration')::numeric);
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  else lines:=lines||jsonb_build_array('탐사자의 대기 · 사용 가능한 스킬 없음');
  end if;
  if mhp>0 then hit:=private.hunting_damage(ma,defense,case when guard then .5 else 1 end,0);hp:=greatest(0,hp-hit);lines:=lines||jsonb_build_array(monster_name||'의 공격! '||hit::text||' 피해');end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp));
 end loop;
 win:=mhp=0 and hp>0;
 potions_used:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 next_hp:=greatest(1,least((player->>'hp')::numeric,hp+potions_used));
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_used),true);
 potions_used:=potions_used+potions_before;
 foreach food in array array['attack_food','defense_food','experience_food'] loop
  remaining:=coalesce((l.food_turns->>food)::bigint,0);l.food_turns:=jsonb_set(l.food_turns,array[food],to_jsonb(greatest(0,remaining-1)),true);
 end loop;
 update private.village_life_players set products=l.products,food_turns=l.food_turns where user_id=u;
 result:=jsonb_build_object('requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player,'playerHp',hp,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $$;
