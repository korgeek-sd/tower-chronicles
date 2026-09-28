-- v0.1.64: server-authoritative Iron Vein Spire V2 equipment drops.

create or replace function private.server_iron_equipment_drop(
 p_run private.online_expeditions,p_kill bigint,p_monster_id text
) returns jsonb
language plpgsql stable set search_path=''
as $$
declare
 boss boolean:=false;chance numeric:=0;drop_roll numeric;item_roll numeric;grade_roll numeric;
 kinds text[]:=array[
  'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
  'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
  'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
 ];
 weights int[]:=array[0,0,0,0,0,0,0,0,0];allowed boolean[]:=array[false,false,false,false,false,false,false,false,false];
 total int:=0;point numeric;idx int:=null;kind text;grade text;
begin
 if p_run.tower<>'ore' or p_run.floor<1 or p_run.floor>10 then return null;end if;
 boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_monster_id;
 if boss then
   chance:=case p_run.floor when 6 then 0.60 when 7 then 0.70 when 8 then 0.80 when 9 then 0.90 when 10 then 1.00 else 0 end;
 else
   chance:=case p_run.floor
     when 1 then 0.08 when 2 then 0.09 when 3 then 0.10 when 4 then 0.11 when 5 then 0.12
     when 6 then 0.14 when 7 then 0.16 when 8 then 0.18 when 9 then 0.20 when 10 then 0.25 else 0 end;
 end if;
 drop_roll:=private.server_roll(p_run.reward_seed,p_kill,6401,1);
 if drop_roll>=chance then return null;end if;
 item_roll:=private.server_roll(p_run.reward_seed,p_kill,6402,2);
 grade_roll:=private.server_roll(p_run.reward_seed,p_kill,6403,3);

 if boss then
   idx:=least(9,floor(item_roll*9)::int+1);
 else
   if p_monster_id='goblin_miner' then weights:=array[18,7,7,7,7,22,18,7,7];
   elsif p_monster_id='goblin_carrier' then weights:=array[8,8,8,8,21,8,8,21,10];
   elsif p_monster_id='goblin_overseer' then weights:=array[18,7,7,18,7,7,7,7,22];
   elsif p_monster_id='cave_rat' then weights:=array[7,7,7,7,7,7,26,26,6];
   elsif p_monster_id='mine_bat' then weights:=array[7,26,26,7,7,7,7,7,6];
   else return null;end if;

   if p_run.floor=1 then allowed[1]:=true;allowed[4]:=true;allowed[7]:=true;
   elsif p_run.floor=2 then allowed[2]:=true;allowed[5]:=true;allowed[6]:=true;
   elsif p_run.floor=3 then allowed[3]:=true;allowed[8]:=true;allowed[9]:=true;
   else for i in 1..9 loop allowed[i]:=true;end loop;end if;

   for i in 1..9 loop if allowed[i] then total:=total+weights[i];end if;end loop;
   if total<=0 then return null;end if;
   point:=item_roll*total;
   for i in 1..9 loop
     if allowed[i] then
       point:=point-weights[i];
       if point<0 then idx:=i;exit;end if;
     end if;
   end loop;
 end if;
 if idx is null then return null;end if;
 kind:=kinds[idx];

 if boss then
   grade:=case p_run.floor
     when 6 then case when grade_roll<0.55 then 'uncommon' when grade_roll<0.90 then 'rare' else 'heroic' end
     when 7 then case when grade_roll<0.45 then 'uncommon' when grade_roll<0.85 then 'rare' else 'heroic' end
     when 8 then case when grade_roll<0.35 then 'uncommon' when grade_roll<0.78 then 'rare' when grade_roll<0.99 then 'heroic' else 'legendary' end
     when 9 then case when grade_roll<0.25 then 'uncommon' when grade_roll<0.70 then 'rare' when grade_roll<0.97 then 'heroic' else 'legendary' end
     when 10 then case when grade_roll<0.55 then 'rare' when grade_roll<0.93 then 'heroic' else 'legendary' end
     else null end;
 else
   grade:=case
     when p_run.floor<=2 then case when grade_roll<0.85 then 'common' else 'uncommon' end
     when p_run.floor<=5 then case when grade_roll<0.70 then 'common' when grade_roll<0.94 then 'uncommon' else 'rare' end
     when p_run.floor<=7 then case when grade_roll<0.55 then 'common' when grade_roll<0.85 then 'uncommon' when grade_roll<0.97 then 'rare' else 'heroic' end
     when p_run.floor=8 then case when grade_roll<0.65 then 'uncommon' when grade_roll<0.92 then 'rare' else 'heroic' end
     when p_run.floor=9 then case when grade_roll<0.55 then 'uncommon' when grade_roll<0.87 then 'rare' when grade_roll<0.99 then 'heroic' else 'legendary' end
     when p_run.floor=10 then case when grade_roll<0.48 then 'uncommon' when grade_roll<0.82 then 'rare' when grade_roll<0.98 then 'heroic' else 'legendary' end
     else null end;
 end if;
 if grade is null then return null;end if;
 return jsonb_build_object(
   'id','equipment-'||p_run.run_id::text||'-'||p_kill::text,
   'kind',kind,'grade',grade,'enhancement',0
 );
end $$;
revoke all on function private.server_iron_equipment_drop(private.online_expeditions,bigint,text)
 from public,anon,authenticated;

create or replace function private.server_kill_loot(p_run private.online_expeditions,p_kill bigint)
returns jsonb language plpgsql stable set search_path=''
as $$
declare
 s bigint:=10+p_run.floor*3;m bigint:=2;t bigint:=0;monster_id text;equipment jsonb;
begin
 if p_run.floor<10 and private.expedition_ticket_drop(p_run.reward_seed,p_kill) then t:=1;end if;
 select k.monster_id into monster_id
 from private.online_expedition_kills k
 where k.user_id=p_run.user_id and k.run_id=p_run.run_id and k.kill_index=p_kill;
 equipment:=private.server_iron_equipment_drop(p_run,p_kill,monster_id);
 return jsonb_build_object('silver',s,'material',m,'tickets',t,'equipment',equipment);
end $$;
revoke all on function private.server_kill_loot(private.online_expeditions,bigint)
 from public,anon,authenticated;


create or replace function private.finish_server_player_action(
 p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 direct_damage bigint:=greatest(0,p_damage);monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;
 heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;reactive_damage bigint:=0;
 kill_no bigint;inserted_kill bigint;next_phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;
 reaction_id text;drop jsonb;tl jsonb;boss boolean:=false;step jsonb;
begin
 -- Legacy single-hit skill path. Basic/job multihits already use server_apply_player_hit.
 if direct_damage>0 then
   if p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
   else
     step_absorb:=least(p_combat.monster_shield,direct_damage);monster_absorb:=step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;direct_damage:=direct_damage-step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
   if p_combat.accessory_passive='vampire' and direct_damage>0 then
     heal:=floor(direct_damage*p_combat.accessory_value);
     p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);
   end if;
 end if;

 if direct_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then
   reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;
   step:=private.server_apply_monster_hit(p_combat,private.server_reactive_multiplier(reaction_id),p_nonce,900);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,step->'state');
   reactive_damage:=coalesce((step->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((step->>'absorbed')::numeric,0);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
   if player_delta<0 and p_combat.player_shield_hits>0 then
     p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;
   elsif player_delta<0 and p_combat.player_shield>0 then
     step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;
     p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;
   end if;
   p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));
   p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   turn_result:=private.resolve_server_monster_turn_v2(p_combat,p_nonce);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');
   monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);
   monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
   if monster_delta<0 and p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=monster_absorb-monster_delta;monster_delta:=0;
   elsif monster_delta<0 and p_combat.monster_shield>0 then
     step_absorb:=least(p_combat.monster_shield,-monster_delta);monster_absorb:=monster_absorb+step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;monster_delta:=monster_delta+step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));
   p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);
 end if;

 if p_combat.monster_hp=0 then
   kill_no:=p_run.confirmed_kills+1;boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_combat.monster_id;
   insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
   values(p_user,p_run.run_id,kill_no,p_combat.monster_id)
   on conflict do nothing returning kill_index into inserted_kill;
   if inserted_kill is not null then
     drop:=private.server_kill_loot(p_run,kill_no);
     tl:=jsonb_set(
       jsonb_set(
         jsonb_set(coalesce(p_run.temporary_loot,'{}'::jsonb),'{silver}',
           to_jsonb(coalesce((p_run.temporary_loot->>'silver')::bigint,0)+coalesce((drop->>'silver')::bigint,0)),true),
         '{material}',to_jsonb(coalesce((p_run.temporary_loot->>'material')::bigint,0)+coalesce((drop->>'material')::bigint,0)),true),
       '{tickets}',to_jsonb(coalesce((p_run.temporary_loot->>'tickets')::bigint,0)+coalesce((drop->>'tickets')::bigint,0)),true);
     if drop->'equipment' is not null and jsonb_typeof(drop->'equipment')='object' then
       tl:=jsonb_set(
         tl,'{equipment}',
         coalesce(tl->'equipment','[]'::jsonb)||jsonb_build_array(drop->'equipment'),true
       );
     end if;
     update private.online_expeditions set
       confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),temporary_loot=tl,
       boss_progress=case when boss then 0 else boss_progress+1 end,
       boss_defeated=case when boss then true else boss_defeated end,
       run_version=run_version+1
     where user_id=p_user returning * into p_run;
   else
     select * into p_run from private.online_expeditions where user_id=p_user;
   end if;
   next_phase:='DEFEATED';
 elsif p_combat.player_hp=0 then
   next_phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else
   p_combat.player_turn:=p_combat.player_turn+1;next_phase:='PLAYER_TURN';
 end if;

 update private.online_combat_states set
   monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,
   player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,
   player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,
   player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,
   monster_cooldowns=p_combat.monster_cooldowns,monster_prepared_action=p_combat.monster_prepared_action,
   monster_reactive_action=p_combat.monster_reactive_action,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,
   job_resource=p_combat.job_resource,job_flags=p_combat.job_flags,
   turn_no=turn_no+1,phase=next_phase,pending_revival=p_combat.pending_revival,
   action_nonce=p_nonce,return_authorized=false,state_version=state_version+1,updated_at=now()
 where user_id=p_user returning * into p_combat;

 return jsonb_build_object(
   'damage',direct_damage,'absorbed',monster_absorb,'healing',heal,
   'monsterReaction',case when reaction_id is null then null else jsonb_build_object('id',reaction_id,'damage',reactive_damage) end,
   'monsterAction',monster_action,'retaliation',ret,'playerAbsorbed',player_absorb,
   'periodicPlayer',player_delta,'periodicMonster',monster_delta,
   'monsterId',p_combat.monster_id,'monsterHp',p_combat.monster_hp,'monsterMaxHp',p_combat.monster_max_hp,
   'playerHp',p_combat.player_hp,'playerMaxHp',p_combat.player_max_hp,
   'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,
   'playerShieldHits',p_combat.player_shield_hits,'monsterShieldHits',p_combat.monster_shield_hits,
   'playerEffects',p_combat.player_effects,'monsterEffects',p_combat.monster_effects,
   'playerCooldowns',p_combat.cooldowns,'monsterCooldowns',p_combat.monster_cooldowns,
   'monsterPreparedAction',p_combat.monster_prepared_action,'monsterReactiveAction',p_combat.monster_reactive_action,
   'jobId',p_combat.job_id,'jobResource',p_combat.job_resource,'jobFlags',p_combat.job_flags,
   'playerTurn',p_combat.player_turn,'monsterTurn',p_combat.monster_turn,'turnNo',p_combat.turn_no,
   'phase',next_phase,'pendingRevival',p_combat.pending_revival,
   'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'drop',drop,
   'actionNonce',p_nonce,'stateVersion',p_combat.state_version,'runVersion',p_run.run_version
 );
end $$;
revoke all on function private.finish_server_player_action(uuid,private.online_expeditions,private.online_combat_states,bigint,bigint)
 from public,anon,authenticated;

create or replace function private.server_economy_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_wallet private.player_wallets%rowtype;v_payload jsonb:=p_payload;v_materials jsonb;v_tickets jsonb;v_skillbooks jsonb;v_loot_items jsonb;v_items jsonb;v_equipment_items jsonb;
begin
 select * into v_wallet from private.player_wallets where user_id=p_user;if not found then return p_payload;end if;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_materials from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='material:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_tickets from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='ticket:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(substr(item_id,11),quantity),'{}'::jsonb) into v_skillbooks from private.market_assets where user_id=p_user and item_id like 'skillbook:%' and quantity>0;
 select coalesce(jsonb_object_agg(substr(item_id,7),quantity),'{}'::jsonb) into v_loot_items from private.market_assets where user_id=p_user and item_id like 'other:%' and quantity>0;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_items
 from private.market_assets where user_id=p_user and item_id like 'gear:%' and quantity=1 and gear is not null;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_equipment_items
 from private.market_assets where user_id=p_user and item_id like 'equipment_v2:%' and quantity=1 and gear is not null;
 v_payload:=jsonb_set(v_payload,'{silver}',to_jsonb(v_wallet.silver),true);
 v_payload:=jsonb_set(v_payload,'{market,gold}',to_jsonb(v_wallet.gold),true);
 v_payload:=jsonb_set(v_payload,'{materials}',v_materials,true);v_payload:=jsonb_set(v_payload,'{tickets}',v_tickets,true);
 v_payload:=jsonb_set(v_payload,'{skillBooks}',v_skillbooks,true);v_payload:=jsonb_set(v_payload,'{lootItems}',v_loot_items,true);v_payload:=jsonb_set(v_payload,'{items}',v_items,true);v_payload:=jsonb_set(v_payload,'{equipmentItems}',v_equipment_items,true);
 return v_payload;
end;$;
revoke all on function private.server_economy_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function public.settle_online_expedition_v2(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_outcome text,p_client_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;s public.game_saves%rowtype;
  gross bigint:=0;share bigint:=0;net bigint:=0;mat bigint:=0;tickets bigint:=0;asset text;
  remaining jsonb;loot jsonb;receipt jsonb;payload jsonb;tier_idx int;elapsed bigint;equipment jsonb:='[]'::jsonb;eq jsonb;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into r from private.online_expeditions where user_id=u for update;
  if not found then return private.cloud_record_json(u);end if;
  if r.status in('RETURNED','DEAD') then return private.cloud_record_json(u);end if;
  if p_outcome not in('returned','dead') then raise exception 'EXPEDITION_RECEIPT_INVALID';end if;
  select * into c from private.online_combat_states where user_id=u and run_id=r.run_id for update;
  if not found then raise exception 'EXPEDITION_COMBAT_STATE_MISSING';end if;
  if r.stronghold is not null and r.stronghold->>'status' in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_ACTIVE';end if;

  if p_outcome='returned' then
    if not coalesce(c.return_authorized,false) or c.player_hp<=0 then raise exception 'EXPEDITION_RETURN_NOT_AUTHORIZED';end if;
  elsif p_outcome='dead' then
    if c.phase<>'PLAYER_DEAD' or c.player_hp<>0 or coalesce(c.pending_revival,false) then raise exception 'EXPEDITION_DEATH_NOT_CONFIRMED';end if;
  end if;

  gross:=coalesce((r.temporary_loot->>'silver')::bigint,0);
  mat:=coalesce((r.temporary_loot->>'material')::bigint,0);
  tickets:=coalesce((r.temporary_loot->>'tickets')::bigint,0);
  equipment:=coalesce(r.temporary_loot->'equipment','[]'::jsonb);
  if jsonb_typeof(equipment)<>'array' then raise exception 'EXPEDITION_EQUIPMENT_LOOT_INVALID';end if;
  remaining:=jsonb_build_object(
    'healing_lesser',greatest(0,coalesce(r.potion_lesser,0)),
    'healing_standard',greatest(0,coalesce(r.potion_standard,0)),
    'healing_greater',greatest(0,coalesce(r.potion_greater,0)),
    'healing_supreme',greatest(0,coalesce(r.potion_supreme,0)),
    'revival',greatest(0,coalesce(r.revival_count,0))
  );

  if p_outcome='returned' then
    share:=floor(gross*r.revenue_share_rate/100.0);net:=gross-share;
    update private.player_wallets set silver=silver+net,updated_at=now() where user_id=u;
    if mat>0 then
      asset:='material:'||r.tower||':'||(case when r.floor<=3 then 1 when r.floor<=6 then 2 else 3 end)::text;
      insert into private.market_assets(user_id,item_id,quantity,updated_at) values(u,asset,mat,now())
      on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;
    if tickets>0 and r.floor<10 then
      insert into private.market_assets(user_id,item_id,quantity,updated_at)
      values(u,'ticket:'||r.tower||':'||(r.floor+1)::text,tickets,now())
      on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;
    for eq in select value from jsonb_array_elements(equipment) loop
      if jsonb_typeof(eq)<>'object'
         or coalesce(eq->>'id','')=''
         or eq->>'kind' not in(
           'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
           'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
           'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
         )
         or eq->>'grade' not in('common','uncommon','rare','heroic','legendary')
         or coalesce((eq->>'enhancement')::int,-1)<>0
      then raise exception 'EXPEDITION_EQUIPMENT_LOOT_INVALID';end if;
      insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
      values(u,'equipment_v2:'||(eq->>'id'),1,eq,now())
      on conflict(user_id,item_id) do nothing;
    end loop;

    insert into private.player_consumables(user_id,item_id,quantity,updated_at) values
      (u,'healing_lesser',coalesce(r.potion_lesser,0),now()),
      (u,'healing_standard',coalesce(r.potion_standard,0),now()),
      (u,'healing_greater',coalesce(r.potion_greater,0),now()),
      (u,'healing_supreme',coalesce(r.potion_supreme,0),now()),
      (u,'revival',coalesce(r.revival_count,0),now())
    on conflict(user_id,item_id) do update
      set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();

    update private.online_expeditions set status='RETURNED',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0,"equipment":[]}'::jsonb,
      potion_lesser=0,potion_standard=0,potion_greater=0,potion_supreme=0,revival_count=0,run_version=run_version+1
    where user_id=u returning * into r;
  elsif p_outcome='dead' then
    update private.online_expeditions set status='DEAD',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0,"equipment":[]}'::jsonb,
      potion_lesser=0,potion_standard=0,potion_greater=0,potion_supreme=0,revival_count=0,run_version=run_version+1
    where user_id=u returning * into r;
  end if;

  update private.online_combat_states set return_authorized=false,state_version=state_version+1,updated_at=now()
    where user_id=u and run_id=r.run_id;

  select * into s from public.game_saves where user_id=u for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  payload:=private.server_authoritative_payload(u,s.payload);
  payload:=jsonb_set(payload,'{expedition}','null'::jsonb,true);

  loot:=jsonb_build_object(
    'silver',gross,
    'materials',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0),'leather',jsonb_build_array(0,0,0,0,0),
      'gem',jsonb_build_array(0,0,0,0,0),'kaleon',jsonb_build_array(0,0,0,0,0)),
    'tickets',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),
      'leather',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),'gem',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),
      'kaleon',jsonb_build_array(0,0,0,0,0,0,0,0,0,0)),
    'skillBooks','{}'::jsonb,'items','{}'::jsonb,'equipment',equipment
  );
  tier_idx:=(case when r.floor<=3 then 1 when r.floor<=6 then 2 else 3 end)-1;
  if mat>0 then loot:=jsonb_set(loot,array['materials',r.tower,tier_idx::text],to_jsonb(mat),true);end if;
  if tickets>0 and r.floor<10 then loot:=jsonb_set(loot,array['tickets',r.tower,r.floor::text],to_jsonb(tickets),true);end if;
  elapsed:=greatest(0,floor(extract(epoch from (coalesce(r.settled_at,now())-r.started_at)))::bigint);
  receipt:=jsonb_build_object('outcome',p_outcome,'tower',r.tower,'floor',r.floor,'time',elapsed,
    'kills',r.confirmed_kills,'loot',loot,'remainingPotions',remaining);
  payload:=jsonb_set(payload,'{lastExpedition}',receipt,true);

  if p_outcome='returned' then
    payload:=jsonb_set(payload,array['exploration','highestReturned',r.tower],
      to_jsonb(greatest(coalesce((payload->'exploration'->'highestReturned'->>r.tower)::int,0),r.floor)),true);
    payload:=jsonb_set(payload,array['progress',r.tower],
      to_jsonb(greatest(coalesce((payload->'progress'->>r.tower)::int,1),r.floor)),true);
    if r.floor=10 and r.boss_defeated then payload:=jsonb_set(payload,'{market,traderCertified}','true'::jsonb,true);end if;
  end if;

  perform private.persist_client_payload_with_server_economy(u,payload,'0.1.51');
  return private.cloud_record_json(u);
end $$;
revoke all on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) to authenticated;
