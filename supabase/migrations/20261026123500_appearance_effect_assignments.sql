-- Assignment does not change owned skins, shards, summon rates, or default appearance.
alter table private.appearance_catalog add column if not exists effect_id text;
alter table private.appearance_catalog drop constraint if exists appearance_catalog_effect_id_check;
alter table private.appearance_catalog add constraint appearance_catalog_effect_id_check
 check(effect_id is null or effect_id in ('attack','defense','max_hp','max_mp','crit_chance','crit_damage','armor_penetration','skill_damage','mp_cost_reduction','skill_activation','hp_recovery','shield_generation','dot_damage','hunting_exp','hunting_silver','hunting_equipment_drop'));
update private.appearance_catalog c set effect_id=v.effect_id
from (values
 ('mechanic','hunting_equipment_drop'),
 ('skeleton_knight','defense'),
 ('association_archivist','hunting_exp'),
 ('returning_knight','shield_generation'),
 ('novar_outskirts_guard','defense'),
 ('mining_crew','hunting_silver'),
 ('slime','max_hp'),
 ('faceless_one','skill_activation'),
 ('hexer','dot_damage'),
 ('ice_mage','mp_cost_reduction'),
 ('inquisitor','armor_penetration'),
 ('nameless_pilgrim','hp_recovery'),
 ('scout','skill_activation'),
 ('arcane_archer','skill_damage'),
 ('thief','crit_chance'),
 ('pickpocket','hunting_silver'),
 ('musketeer','crit_damage'),
 ('bounty_hunter','hunting_equipment_drop'),
 ('apprentice_mage','max_mp'),
 ('lumpen','hunting_exp'),
 ('golem','max_hp'),
 ('butcher','dot_damage'),
 ('grave_robber','hunting_equipment_drop'),
 ('court_jester','crit_chance'),
 ('crossbowman','armor_penetration'),
 ('lumberjack','attack'),
 ('corsair','hunting_silver'),
 ('teddy','max_hp'),
 ('plague_doctor','dot_damage'),
 ('knight','shield_generation'),
 ('summoner','skill_damage'),
 ('cultist','mp_cost_reduction'),
 ('celestial_archer','crit_chance'),
 ('assault_gunner','crit_damage'),
 ('alchemist','hp_recovery'),
 ('blacksmith','hunting_equipment_drop'),
 ('contract_mercenary','attack'),
 ('wandering_preacher','hunting_exp'),
 ('proletaria','attack'),
 ('valkyrie','shield_generation'),
 ('seraphim','hp_recovery'),
 ('ophanim','skill_activation'),
 ('advanced_mage','max_mp'),
 ('cain','crit_damage'),
 ('rat_king','hunting_equipment_drop'),
 ('saintess','hp_recovery'),
 ('archmage','skill_damage'),
 ('nameless_sinner','max_hp'),
 ('bourgeoisie','hunting_silver'),
 ('intellectual','hunting_exp'),
 ('necromancer','dot_damage'),
 ('noble_knight','defense'),
 ('antichrist','armor_penetration'),
 ('nidhogg','dot_damage'),
 ('bahamut','max_hp'),
 ('baal','armor_penetration'),
 ('puppeteer','skill_activation'),
 ('nameless_king','attack'),
 ('first_forgotten_one','hunting_equipment_drop'),
 ('false_savior','hp_recovery')
) as v(appearance_id,effect_id) where c.appearance_id=v.appearance_id;
do $$ begin
 if (select count(*) from private.appearance_catalog where effect_id is not null)<>60 then
  raise exception 'APPEARANCE_ASSIGNMENTS_MISMATCH';
 end if;
end $$;

create or replace function private.appearance_effect_base(p_effect text,p_rarity text)
returns numeric language sql immutable set search_path='' as $$
 select case p_effect
 when 'attack' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'defense' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 when 'max_hp' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 when 'max_mp' then case p_rarity when 'C' then 10 when 'B' then 20 when 'A' then 30 when 'SR' then 40 when 'SSR' then 50 else 0 end
 when 'crit_chance' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'crit_damage' then case p_rarity when 'C' then 4 when 'B' then 8 when 'A' then 12 when 'SR' then 16 when 'SSR' then 20 else 0 end
 when 'armor_penetration' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'skill_damage' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 5 when 'SSR' then 7 else 0 end
 when 'mp_cost_reduction' then case p_rarity when 'C' then 2 when 'B' then 3 when 'A' then 4 when 'SR' then 6 when 'SSR' then 8 else 0 end
 when 'skill_activation' then case p_rarity when 'C' then 0.5 when 'B' then 1 when 'A' then 1.5 when 'SR' then 2 when 'SSR' then 3 else 0 end
 when 'hp_recovery' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'shield_generation' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'dot_damage' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'hunting_exp' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'hunting_silver' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'hunting_equipment_drop' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 else 0 end
$$;
revoke all on function private.appearance_effect_base(text,text) from public,anon,authenticated;

-- Only the selected, server-owned, unlocked level can produce a battle/reward bonus.
create or replace function private.appearance_equipped_effect(p_user uuid,p_payload jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.effect_id,'value',
  case when c.effect_id='max_mp' then round(private.appearance_effect_base(c.effect_id,c.rarity)*case o.enhancement_level when 1 then 1 when 2 then 1.1 when 3 then 1.2 when 4 then 1.35 when 5 then 1.5 else 0 end)
       else round(private.appearance_effect_base(c.effect_id,c.rarity)*case o.enhancement_level when 1 then 1 when 2 then 1.1 when 3 then 1.2 when 4 then 1.35 when 5 then 1.5 else 0 end,2) end)
 from private.appearance_ownership o join private.appearance_catalog c on c.appearance_id=o.appearance_id
 where o.user_id=p_user and o.appearance_id=p_payload->'cosmetics'->>'selectedAppearanceId'
   and o.enhancement_level between 1 and 5 and c.effect_id is not null
$$;
revoke all on function private.appearance_equipped_effect(uuid,jsonb) from public,anon,authenticated;

-- Keep the authoritative combat code unchanged except the equip-only effect hooks.
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
 ap jsonb;
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
 ap:=coalesce(private.appearance_equipped_effect(p_user,p_payload),'{}'::jsonb);
 if ap->>'id'='attack' then attack:=attack*(1+(case when ap->>'id'='attack' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='defense' then defense:=defense*(1+(case when ap->>'id'='defense' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='max_hp' then hp:=hp*(1+(case when ap->>'id'='max_hp' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='crit_chance' then crit:=crit+(case when ap->>'id'='crit_chance' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='crit_damage' then crit_damage:=crit_damage+(case when ap->>'id'='crit_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='armor_penetration' then pen:=pen+(case when ap->>'id'='armor_penetration' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon,'appearanceEffect',ap);
end $function$
;
CREATE OR REPLACE FUNCTION public.hunt_once(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_map_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;l private.village_life_players%rowtype;potions_used bigint;potions_before bigint;next_hp numeric;start_hp numeric;food text;remaining bigint;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 monster jsonb;monster_action jsonb;effects jsonb:='{}';dot_kind text;dot_hit numeric;reflect_hit numeric;previous_monster text;drop_item jsonb;p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;guild_tax bigint:=0;guild_balance bigint;guild_id uuid;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
 ap jsonb;
 mp_now numeric;mp_max numeric;spec jsonb;family text;weapon text;enhance_level integer;
 skill_power numeric;chance numeric;penetration numeric;bonus numeric;heal_amount numeric;
 shield_pts numeric:=0;shield_until integer:=0;oath_available boolean:=false;
 passive_bonus numeric:=0;passive_accuracy numeric:=0;sixth_mark boolean:=false;sixth_bonus numeric:=.15;oath_shield_bonus numeric:=.15;active_count integer:=0;
 prep_bonus numeric:=0;prep_until integer:=0;dot_pct numeric:=0;monster_dot numeric:=0;monster_dot_until integer:=0;
 monster_def_down numeric:=0;monster_def_until integer:=0;incoming numeric;absorbed numeric;
 grade_index integer;cd_interval integer;hit_count integer;hit_index integer;
 slot_cursor integer:=1;slot_index integer;slot_offset integer;active_slots text[];
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'HUNT_REQUEST_REQUIRED';end if;
 if p_map_id is null or p_map_id not in ('plains','forest','mine','fortress','ruins') then raise exception 'HUNT_MAP_INVALID';end if;
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
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=1000+floor(random()*201)::bigint;xp:=100;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=1600+floor(random()*401)::bigint;xp:=250;material:='material:leather:1';monster_name:='가시 자칼';
 elsif p_map_id='mine' then mh:=180;ma:=24;md:=14;reward_silver:=2500+floor(random()*601)::bigint;xp:=600;material:='material:ore:1';monster_name:='고블린 광부';
 elsif p_map_id='fortress' then mh:=250;ma:=32;md:=20;reward_silver:=3800+floor(random()*801)::bigint;xp:=1400;material:='material:leather:1';monster_name:='무리 선봉';
 else mh:=340;ma:=42;md:=28;reward_silver:=5500+floor(random()*1001)::bigint;xp:=3000;material:='material:leather:1';monster_name:='송곳니 둥지';end if;
 previous_monster:=h.last_result->'monster'->>'id';
 monster:=private.choose_hunting_monster(p_map_id,previous_monster,random());
 mh:=(monster->>'hp')::numeric;ma:=(monster->>'attack')::numeric;md:=(monster->>'defense')::numeric;
 monster_name:=monster->>'name';

 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 ap:=coalesce(player->'appearanceEffect','{}'::jsonb);
 weapon:=coalesce(player->>'weapon','sword');
 player:=jsonb_build_object('hp',greatest(1,(player->>'hp')::numeric),'attack',greatest(0,(player->>'attack')::numeric),'defense',greatest(0,(player->>'defense')::numeric),'critChance',greatest(0,least(1,coalesce((player->>'critChance')::numeric,.05))),'critDamage',greatest(1,coalesce((player->>'critDamage')::numeric,1.5)),'armorPenetration',greatest(0,least(1,coalesce((player->>'armorPenetration')::numeric,0))));

 -- Passive effects come from learned, equipped skill IDs; neither client data nor a forged preset can grant one.
 mp_max:=100+10*coalesce((h.stat_allocation->>'mp')::integer,0)+(case when ap->>'id'='max_mp' then coalesce((ap->>'value')::numeric,0) else 0 end);
 mp_now:=mp_max; -- every new hunt begins at full MP, regardless of the last battle.
 foreach candidate in array h.skills loop
  spec:=private.hunting_skill_spec(candidate);
  if spec is null or spec->>'type'<>'passive' or spec->>'weapon' not in ('any',weapon)
   or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate) then continue;end if;
  select enhancement_level into enhance_level from private.learned_catalog_skills where user_id=u and skill_id=candidate;
  bonus:=(spec->>'power')::numeric*(1+coalesce(enhance_level,0)*.05)/100;
  if spec->>'family'='return_oath' then
   player:=jsonb_set(player,'{hp}',to_jsonb(round((player->>'hp')::numeric*(1+bonus))),true);oath_available:=true;oath_shield_bonus:=bonus;
  elsif spec->>'family'='sixth_mark' then sixth_mark:=true;sixth_bonus:=bonus;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then passive_bonus:=passive_bonus+bonus;if spec->>'family'='bow_mastery' then passive_accuracy:=passive_accuracy+bonus;end if;
  end if;
 end loop;
 hp:=greatest(1,least((player->>'hp')::numeric,coalesce(h.current_hp,(player->>'hp')::numeric)));
 potions_before:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 hp:=least((player->>'hp')::numeric,hp+potions_before);start_hp:=hp;
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_before),true);
 attack:=(player->>'attack')::numeric*case when coalesce((l.food_turns->>'attack_food')::bigint,0)>0 then 1.1 else 1 end;
 defense:=(player->>'defense')::numeric*case when coalesce((l.food_turns->>'defense_food')::bigint,0)>0 then 1.1 else 1 end;
 player:=player||jsonb_build_object('attack',attack,'defense',defense);
 if coalesce((l.food_turns->>'experience_food')::bigint,0)>0 then xp:=floor(xp*1.1);end if; if private.premium_active(u) then xp:=floor(xp*1.1);end if; xp:=floor(xp*(1+(case when ap->>'id'='hunting_exp' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
 select coalesce(array_agg(x order by ord),array[]::text[]) into active_slots from unnest(h.skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  if shield_until<turn_no then shield_pts:=0;end if;
  if prep_until<turn_no then prep_bonus:=0;end if;
  if monster_dot_until>=turn_no and monster_dot>0 then
   mhp:=greatest(0,mhp-monster_dot);
   lines:=lines||jsonb_build_array(monster_name||'이(가) 지속 피해 '||monster_dot::text||' 받음');
   if mhp=0 then turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));exit;end if;
  end if;
  foreach dot_kind in array array['bleed','poison','burn'] loop
   if coalesce((effects->>(dot_kind||'Until'))::integer,0)>=turn_no then
    dot_hit:=greatest(1,floor(ma*coalesce((effects->>dot_kind)::numeric,0)));
    hp:=greatest(0,hp-dot_hit);
    lines:=lines||jsonb_build_array('탐사자가 '||case dot_kind when 'bleed' then '출혈' when 'burn' then '화상' else '중독' end||'로 '||dot_hit::text||' 피해');
   end if;
  end loop;
  if hp<=0 then turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));exit;end if;

  for slot_offset in 0..greatest(0,coalesce(cardinality(active_slots),0)-1) loop
   exit when coalesce(cardinality(active_slots),0)=0;
   slot_index:=1+(slot_cursor-1+slot_offset)%cardinality(active_slots);
   candidate:=active_slots[slot_index];
   if not private.hunting_conditions_match(h.skill_setup->'conditions'->candidate,jsonb_build_object(
    'hp',hp,'hp_pct',hp/(player->>'hp')::numeric*100,'mp',mp_now,'mp_pct',mp_now/mp_max*100,
    'enemy_hp_pct',mhp/mh*100,'turn',turn_no,'shield',shield_pts>0,'buff',prep_bonus>0,
    'bleed',coalesce((effects->>'bleedUntil')::integer,0)>=turn_no,
    'poison',coalesce((effects->>'poisonUntil')::integer,0)>=turn_no,
    'burn',coalesce((effects->>'burnUntil')::integer,0)>=turn_no,
    'enemy_dot',monster_dot>0 and monster_dot_until>=turn_no,
    'enemy_defense',monster_def_down>0 and monster_def_until>=turn_no)) then continue;end if;
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or ceil((spec->>'mp')::numeric*(1-(case when ap->>'id'='mp_cost_reduction' then coalesce((ap->>'value')::numeric,0) else 0 end)/100))>mp_now then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then slot_cursor:=1+slot_index%cardinality(active_slots);end if;
  spec:=case when skill in ('heavy','guard','quick') then null else private.hunting_skill_spec(skill) end;
  if spec is not null then
   select enhancement_level into enhance_level from private.learned_catalog_skills where user_id=u and skill_id=skill;
   family:=spec->>'family';grade_index:=(spec->>'gradeIndex')::integer;
   skill_power:=(spec->>'power')::numeric*(1+coalesce(enhance_level,0)*.05);
   mp_now:=mp_now-ceil((spec->>'mp')::numeric*(1-(case when ap->>'id'='mp_cost_reduction' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));active_count:=active_count+1;
   cd_interval:=case family when 'restore' then 3 when 'heal' then 4 when 'shield' then 4 when 'prepare' then 3 else 1 end;
   cd:=cd||jsonb_build_object(skill,turn_no+cd_interval);
   if random()*100 >= least(100,(spec->>'chance')::numeric+
      case when family like 'bow_%' then passive_accuracy*100 else 0 end+
      case when family='bow_shot' and grade_index=0 then 5 when family='bow_shot' and grade_index=1 then 8 else 0 end+(case when ap->>'id'='skill_activation' then coalesce((ap->>'value')::numeric,0) else 0 end)) then
    lines:=lines||jsonb_build_array('탐사자의 '||((select name from private.skill_book_catalog where skill_id=skill))||'! 발동 실패');
   elsif family='restore' then
    heal_amount:=least(mp_max-mp_now,round(skill_power));mp_now:=mp_now+heal_amount;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! MP +'||heal_amount::text);
   elsif family='heal' then
    heal_amount:=least((player->>'hp')::numeric-hp,floor((player->>'hp')::numeric*skill_power/100*(1+(case when ap->>'id'='hp_recovery' then coalesce((ap->>'value')::numeric,0) else 0 end)/100)));
    hp:=hp+heal_amount;lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! HP +'||heal_amount::text);
   elsif family='shield' then
    shield_pts:=floor((player->>'hp')::numeric*skill_power/100*(1+(case when ap->>'id'='shield_generation' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));shield_until:=turn_no+2;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! 보호막 '||shield_pts::text);
   elsif family='prepare' then
    prep_bonus:=skill_power/100;prep_until:=turn_no+2;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||'! 다음 공격 +'||round(skill_power)::text||'%');
   else
    critical:=random()<coalesce((player->>'critChance')::numeric,.05);
    penetration:=coalesce((player->>'armorPenetration')::numeric,0);
    if family in ('sword_strike','bow_shot') then
     penetration:=least(1,penetration+case grade_index when 2 then .05 when 3 then .10 when 4 then .15 when 5 then .20 else 0 end);
    end if;
    mult:=skill_power/100*(1+passive_bonus)*(1+case when prep_until>=turn_no then prep_bonus else 0 end)*
     (case when critical then (player->>'critDamage')::numeric else 1 end)*(1+(case when ap->>'id'='skill_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);
    hit_count:=case when family='bow_volley' then case when grade_index>=5 then 4 when grade_index>=3 then 3 else 2 end else 1 end;
    hit:=0;
    for hit_index in 1..hit_count loop
     hit:=hit+private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no
      then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),
      md*(1-case when monster_def_until>=turn_no then monster_def_down else 0 end),mult/hit_count,penetration);
    end loop;
    if coalesce((effects->>'shield')::numeric,0)>0 then hit:=greatest(1,floor(hit*(1-(effects->>'shield')::numeric)));end if;
    reflect_hit:=floor(hit*coalesce((effects->>'reflect')::numeric,0));
    hp:=greatest(0,hp-reflect_hit);effects:=effects||jsonb_build_object('shield',0,'reflect',0);
    mhp:=greatest(0,mhp-hit);prep_bonus:=0;prep_until:=0;
    if family in ('sword_wound','bow_volley','staff_flame') then
     dot_pct:=case family
      when 'sword_wound' then (array[8,10,12,15,18,22])[grade_index+1]
      when 'bow_volley' then (array[0,8,10,12,15,18])[grade_index+1]
      else (array[0,10,12,15,18,22])[grade_index+1] end;
     monster_dot:=floor(attack*dot_pct*(1+coalesce(enhance_level,0)*.05)/100*(1+(case when ap->>'id'='dot_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
     monster_dot_until:=turn_no+2;
    end if;
    if family='sword_wound' then
     hp:=least((player->>'hp')::numeric,hp+floor(hit*(array[0,.05,.07,.10,.12,.15])[grade_index+1]*(1+(case when ap->>'id'='hp_recovery' then coalesce((ap->>'value')::numeric,0) else 0 end)/100)));
    end if;
    if family='staff_rift' then monster_def_down:=(array[3,5,8,11,15,20])[grade_index+1]*(1+coalesce(enhance_level,0)*.05)/100;monster_def_until:=turn_no+2;end if;
    lines:=lines||jsonb_build_array('탐사자의 '||(select name from private.skill_book_catalog where skill_id=skill)||
     '! '||hit::text||' 피해'||case when hit_count>1 then ' · '||hit_count::text||'연타' else '' end||case when critical then ' · 치명타' else '' end);
   end if;
   if sixth_mark and active_count%6=0 then
    mp_now:=least(mp_max,mp_now+80);prep_bonus:=greatest(prep_bonus,sixth_bonus);prep_until:=turn_no+2;
    lines:=lines||jsonb_build_array('여섯 번째 각인! MP +80');
   end if;
  else
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  elsif skill is not null then
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),md,mult*(case when critical then (player->>'critDamage')::numeric else 1 end),(player->>'armorPenetration')::numeric);
   if coalesce((effects->>'shield')::numeric,0)>0 then hit:=greatest(1,floor(hit*(1-(effects->>'shield')::numeric)));end if;
   reflect_hit:=floor(hit*coalesce((effects->>'reflect')::numeric,0));
   hp:=greatest(0,hp-reflect_hit);
   effects:=effects||jsonb_build_object('shield',0,'reflect',0);
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  else lines:=lines||jsonb_build_array(case when coalesce((effects->>'silenceUntil')::integer,0)>=turn_no or coalesce((effects->>'delayUntil')::integer,0)>=turn_no then '탐사자의 스킬이 봉인·지연되어 행동할 수 없음' else '탐사자의 대기 · 사용 가능한 스킬 없음' end);
  end if;
  end if;
  if mhp>0 and hp>0 then
   monster_action:=private.hunting_monster_action(monster,turn_no,defense*(case when coalesce((effects->>'defense_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'defense_down')::numeric,0) else 1 end),guard,mhp,effects);
   incoming:=(monster_action->>'damage')::numeric;
   if shield_until>=turn_no and shield_pts>0 then
    absorbed:=least(incoming,shield_pts);shield_pts:=shield_pts-absorbed;incoming:=incoming-absorbed;
   end if;
   hp:=greatest(0,hp-incoming);
   if hp<=0 and oath_available then
    hp:=1;oath_available:=false;
    shield_pts:=greatest(shield_pts,floor((player->>'hp')::numeric*oath_shield_bonus));shield_until:=turn_no+2;
    lines:=lines||jsonb_build_array('귀환자의 맹세! HP 1로 생존');
   end if;
   mhp:=least(mh,mhp+coalesce((monster_action->>'heal')::numeric,0));
   effects:=monster_action->'effects';
   lines:=lines||jsonb_build_array(monster_action->>'line');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp,'playerMp',mp_now));
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
 if win then
  drop_item:=private.hunting_equipment_drop(p_map_id,floor(random()*1000000/(1+(case when ap->>'id'='hunting_equipment_drop' then coalesce((ap->>'value')::numeric,0) else 0 end)/100))::integer,floor(random()*9)::integer);
  reward_silver:=floor(reward_silver*(1+(case when ap->>'id'='hunting_silver' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
 end if;
 if win then
  select a.association_id,floor(reward_silver*greatest(0,least(30,a.revenue_share_rate_percent))/100.0)::bigint
  into guild_id,guild_tax from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
  where m.user_id=u;
  guild_tax:=greatest(0,coalesce(guild_tax,0));
  if guild_id is not null and guild_tax>0 then
   update private.online_associations set treasury_silver=treasury_silver+guild_tax,updated_at=now()
   where association_id=guild_id and status='ACTIVE' returning treasury_silver into guild_balance;
   if found then
    insert into private.association_warehouse_ledger(association_id,actor_user_id,operation,currency_type,amount,balance_after,detail)
    values(guild_id,u,'HUNT_TAX','SILVER',guild_tax,guild_balance,'즉시 사냥 수익 분담 · '||p_map_id);
    perform private.association_activity(guild_id,u,'TREASURY_SHARE','사냥 수익 분담 '||guild_tax::text||' Silver 적립');
   else guild_tax:=0;
   end if;
  end if;
  reward_silver:=reward_silver-guild_tax;
 end if;
 result:=jsonb_build_object('monster',monster,'equipment',drop_item,'requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player,'playerHp',hp,'playerMp',mp_now,'playerMaxMp',mp_max,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'guildTax',guild_tax,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  if drop_item is not null then insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||(drop_item->>'id'),1,drop_item);end if;
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,current_mp=mp_now,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $function$
;
CREATE OR REPLACE FUNCTION private.guild_boss_combat(p_user uuid, p_boss private.guild_boss_encounters, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare hero jsonb; hs private.hunting_states%rowtype;
 preset text[]:=array[]::text[]; skill text; candidate text; spec jsonb; family text; weapon text;
 max_hp numeric; hp numeric; attack numeric; defense numeric; crit numeric; crit_multiplier numeric; penetration numeric;
 mp_max numeric; mp numeric; bonus numeric:=0; preparatory numeric:=0; shield numeric:=0; dots numeric:=0;
 passive_hp numeric:=0; hit numeric; dealt bigint:=0; damage_taken numeric; threshold numeric;
 skill_power numeric; skill_chance numeric; skill_mp numeric; enhancement integer; cooldown jsonb:='{}';
 turn_number integer; turns jsonb:='[]'; lines jsonb; label text; guard boolean; active_count integer:=0;
 ap jsonb;
 begin_hp numeric; action_limit integer:=12;
begin
 select * into hs from private.hunting_states where user_id=p_user;
 preset:=coalesce(hs.skills,array[]::text[]);
 hero:=private.combat_equipment_stats(p_user,jsonb_set(p_payload,'{expedition}',jsonb_build_object('equipment',p_payload->'equipped'),true));
 ap:=coalesce(hero->'appearanceEffect','{}'::jsonb);
 weapon:=coalesce(hero->>'weapon','sword');
 max_hp:=greatest(1,(hero->>'hp')::numeric);hp:=max_hp;begin_hp:=max_hp;
 attack:=greatest(0,(hero->>'attack')::numeric);
 defense:=greatest(0,(hero->>'defense')::numeric);
 crit:=greatest(0,least(1,coalesce((hero->>'critChance')::numeric,.05)));
 crit_multiplier:=greatest(1,coalesce((hero->>'critDamage')::numeric,1.5));
 penetration:=greatest(0,least(1,coalesce((hero->>'armorPenetration')::numeric,0)));
 mp_max:=100+10*coalesce((hs.stat_allocation->>'mp')::integer,0)+(case when ap->>'id'='max_mp' then coalesce((ap->>'value')::numeric,0) else 0 end);mp:=mp_max;
 -- Validate every passive server-side and apply the player's enhancement level.
 foreach candidate in array preset loop
  spec:=private.hunting_skill_spec(candidate);
  if spec is null or spec->>'type'<>'passive' or spec->>'weapon' not in ('any',weapon) then continue;end if;
  select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=candidate;
  if not found then continue;end if;
  bonus:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05)/100;
  if spec->>'family'='return_oath' then
   max_hp:=max_hp*(1+bonus);hp:=max_hp;begin_hp:=max_hp;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then
   passive_hp:=passive_hp+bonus;
  end if;
 end loop;
 for turn_number in 1..action_limit loop
  exit when hp<=0 or dealt>=p_boss.remaining_hp;
  lines:='[]';skill:=null;spec:=null;guard:=false;hit:=0;label:='기본 공격';
  if dots>0 then
   hit:=least(dots,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array('지속 피해 '||hit::bigint::text);
   dots:=0;
  end if;
  exit when dealt>=p_boss.remaining_hp;
  foreach candidate in array preset loop
   if coalesce((cooldown->>candidate)::integer,0)>turn_number then continue;end if;
   if candidate in ('heavy','quick','guard') then
    if candidate<>'guard' or hp/max_hp<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon) then continue;end if;
   if not exists(select 1 from private.learned_catalog_skills where user_id=p_user and skill_id=candidate) then continue;end if;
   if ceil((spec->>'mp')::numeric*(1-(case when ap->>'id'='mp_cost_reduction' then coalesce((ap->>'value')::numeric,0) else 0 end)/100))>mp then continue;end if;
   if (spec->>'family'='restore' and mp>=mp_max)
    or (spec->>'family'='heal' and hp>=max_hp*.95)
    or (spec->>'family'='shield' and shield>max_hp*.1)
    or (spec->>'family'='prepare' and preparatory>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then
   if skill='guard' then
    guard:=true;label:='방어';cooldown:=cooldown||jsonb_build_object(skill,turn_number+4);
   elsif skill in ('heavy','quick') then
    label:=case skill when 'heavy' then '강타' else '속공' end;
    hit:=private.hunting_damage(attack,p_boss.defense_power,
     (case skill when 'heavy' then 1.8 else 1.2 end)*(1+passive_hp)*(case when random()<crit then crit_multiplier else 1 end),
     penetration);
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+case when skill='heavy' then 3 else 2 end);
   else
    select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=skill;
    family:=spec->>'family';skill_power:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05);
    skill_chance:=least(100,coalesce((spec->>'chance')::numeric,100)+(case when ap->>'id'='skill_activation' then coalesce((ap->>'value')::numeric,0) else 0 end));skill_mp:=ceil((spec->>'mp')::numeric*(1-(case when ap->>'id'='mp_cost_reduction' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
    mp:=mp-skill_mp;active_count:=active_count+1;
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+
      case when family in ('heal','shield') then 4 when family in ('restore','prepare') then 3 else 1 end);
    label:=coalesce((select name from private.skill_book_catalog where skill_id=skill),'스킬');
    if random()*100>=skill_chance then lines:=lines||jsonb_build_array(label||' · 발동 실패');
    elsif family='heal' then
     hit:=0;hp:=least(max_hp,hp+floor(max_hp*skill_power/100*(1+(case when ap->>'id'='hp_recovery' then coalesce((ap->>'value')::numeric,0) else 0 end)/100)));
     lines:=lines||jsonb_build_array(label||' · HP 회복');
    elsif family='restore' then
     mp:=least(mp_max,mp+skill_power);
     lines:=lines||jsonb_build_array(label||' · MP 회복');
    elsif family='shield' then
     shield:=floor(max_hp*skill_power/100*(1+(case when ap->>'id'='shield_generation' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
     lines:=lines||jsonb_build_array(label||' · 보호막');
    elsif family='prepare' then
     preparatory:=skill_power/100;
     lines:=lines||jsonb_build_array(label||' · 위력 증가 준비');
    else
     hit:=private.hunting_damage(attack,p_boss.defense_power,
      skill_power/100*(1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end)*(1+(case when ap->>'id'='skill_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100),
      least(1,penetration+case when family in ('sword_strike','bow_shot') then .05*greatest(0,(spec->>'gradeIndex')::integer-1) else 0 end));
     if family in ('sword_wound','bow_volley','staff_flame') then
      dots:=floor(attack*.1*(1+coalesce(enhancement,0)*.05)*(1+(case when ap->>'id'='dot_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100));
     end if;
     if family='sword_wound' then hp:=least(max_hp,hp+floor(hit*.05*(1+(case when ap->>'id'='hp_recovery' then coalesce((ap->>'value')::numeric,0) else 0 end)/100)));end if;
     if family='staff_rift' then hit:=hit+floor(hit*.05);end if;
     preparatory:=0;
    end if;
   end if;
  else
   hit:=private.hunting_damage(attack,p_boss.defense_power,
    (1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end),penetration);
   preparatory:=0;
  end if;
  if hit>0 then
   hit:=least(hit,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array(label||' · '||hit::bigint::text||' 피해');
  elsif jsonb_array_length(lines)=0 then lines:=lines||jsonb_build_array(label);
  end if;
  if dealt<p_boss.remaining_hp then
   threshold:=case when p_boss.kind='WEEKLY' and turn_number%4=0 then 1.35 else 1 end;
   damage_taken:=private.hunting_damage(p_boss.attack_power,defense,threshold*(case when guard then .5 else 1 end),0);
   if shield>0 then
    damage_taken:=greatest(0,damage_taken-shield);
    shield:=greatest(0,shield-private.hunting_damage(p_boss.attack_power,defense,threshold,0));
   end if;
   hp:=greatest(0,hp-damage_taken);
   lines:=lines||jsonb_build_array(p_boss.boss_name||'의 반격 · '||damage_taken::bigint::text||' 피해');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_number,'lines',lines,'playerHp',hp,'playerMp',mp,'damageTotal',dealt));
 end loop;
 return jsonb_build_object('damage',dealt,'turns',turns,'playerHp',hp,'maxPlayerHp',begin_hp,'playerMp',mp,'maxPlayerMp',mp_max,
  'outcome',case when hp<=0 then 'defeated' else 'survived' end,'attackStat',attack,'defenseStat',defense,'weapon',weapon);
end;$function$
;
