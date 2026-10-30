-- Two independent archive record types; old registration ledger remains authoritative.
create table if not exists private.record_collection_sets(
 set_id text primary key,
 kind text not null check(kind in ('appearance','equipment')),
 stat text not null check(stat in ('hp','attack','defense')),
 bonus integer not null check(bonus>0 and bonus<=100),
 appearance_ids text[] not null default '{}',
 check((kind='appearance' and cardinality(appearance_ids)>=2) or (kind='equipment' and cardinality(appearance_ids)=0))
);
alter table private.record_collection_sets enable row level security;
revoke all on table private.record_collection_sets from public,anon,authenticated;
insert into private.record_collection_sets(set_id,kind,stat,bonus,appearance_ids) values
 ('record_people_knights','appearance','defense',1,ARRAY['skeleton_knight','returning_knight']::text[]),
 ('record_people_forge','appearance','hp',15,ARRAY['mechanic','blacksmith']::text[]),
 ('record_people_frontier','appearance','defense',1,ARRAY['novar_outskirts_guard','scout']::text[]),
 ('record_people_erased','appearance','hp',20,ARRAY['nameless_pilgrim','faceless_one']::text[]),
 ('record_people_heresy','appearance','defense',1,ARRAY['inquisitor','cultist']::text[]),
 ('record_people_dead','appearance','hp',15,ARRAY['grave_robber','necromancer']::text[]),
 ('record_people_road','appearance','hp',20,ARRAY['corsair','teddy']::text[]),
 ('record_people_oath','appearance','defense',1,ARRAY['knight','noble_knight']::text[]),
 ('record_people_magic','appearance','hp',20,ARRAY['apprentice_mage','advanced_mage']::text[]),
 ('record_people_plague','appearance','defense',1,ARRAY['plague_doctor','rat_king']::text[]),
 ('ashen_border_1','equipment','attack',1,ARRAY[]::text[]),
 ('record_relic_staff','equipment','hp',15,ARRAY[]::text[]),
 ('record_relic_helmet','equipment','defense',1,ARRAY[]::text[]),
 ('record_relic_armor','equipment','defense',1,ARRAY[]::text[]),
 ('record_relic_gloves','equipment','hp',15,ARRAY[]::text[]),
 ('record_relic_boots','equipment','hp',20,ARRAY[]::text[]),
 ('record_relic_tag','equipment','defense',1,ARRAY[]::text[]),
 ('record_relic_ring','equipment','attack',1,ARRAY[]::text[]),
 ('record_relic_bow_rare','equipment','attack',2,ARRAY[]::text[]),
 ('record_relic_plate_rare','equipment','hp',25,ARRAY[]::text[])
on conflict(set_id) do update set kind=excluded.kind,stat=excluded.stat,bonus=excluded.bonus,appearance_ids=excluded.appearance_ids;

insert into private.collection_equipment_requirements(set_id,kind,grade) values
 ('ashen_border_1','outer_guard_longbow','uncommon'),
 ('record_relic_staff','archive_standard_arcane_staff','common'),
 ('record_relic_helmet','expedition_iron_helmet','common'),
 ('record_relic_armor','return_corps_plate_armor','uncommon'),
 ('record_relic_gloves','mining_detail_reinforced_gloves','common'),
 ('record_relic_boots','survey_corps_dust_boots','uncommon'),
 ('record_relic_tag','association_registration_tag','common'),
 ('record_relic_ring','expedition_merit_ring','uncommon'),
 ('record_relic_bow_rare','outer_guard_longbow','rare'),
 ('record_relic_plate_rare','return_corps_plate_armor','rare')
on conflict(set_id) do update set kind=excluded.kind,grade=excluded.grade;

-- No player-supplied save value can count towards a permanent combat bonus.
create or replace function private.record_collection_bonus(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
 with completed as (
  select s.stat,s.bonus from private.record_collection_sets s
  where (s.kind='appearance' and not exists (
   select 1 from unnest(s.appearance_ids) as needed(appearance_id)
   where not exists(select 1 from private.appearance_ownership o
     where o.user_id=p_user and o.appearance_id=needed.appearance_id and o.enhancement_level>=1)
  )) or (s.kind='equipment' and exists (
   select 1 from private.collection_equipment_registrations reg
   where reg.user_id=p_user and reg.set_id=s.set_id
  ))
 )
 select jsonb_build_object(
  'hp',coalesce(sum(bonus) filter(where stat='hp'),0),
  'attack',coalesce(sum(bonus) filter(where stat='attack'),0),
  'defense',coalesce(sum(bonus) filter(where stat='defense'),0)
 ) from completed
$function$;
revoke all on function private.record_collection_bonus(uuid) from public,anon,authenticated;

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
 seal_level integer:=0;bonus jsonb; guardian_level integer:=0;guardian_bonus jsonb; allocated jsonb;
 ap jsonb;collection_bonus jsonb;
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
 select level into guardian_level from private.player_guardian_seals where user_id=p_user;
 guardian_bonus:=private.guardian_seal_bonus_json(coalesce(guardian_level,0));
 hp:=hp*(1+coalesce((guardian_bonus->>'hpPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((guardian_bonus->>'defensePercent')::numeric,0)/100);
 ap:=coalesce(private.appearance_equipped_effect(p_user,p_payload),'{}'::jsonb);
 if ap->>'id'='attack' then attack:=attack*(1+(case when ap->>'id'='attack' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='defense' then defense:=defense*(1+(case when ap->>'id'='defense' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='max_hp' then hp:=hp*(1+(case when ap->>'id'='max_hp' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='crit_chance' then crit:=crit+(case when ap->>'id'='crit_chance' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='crit_damage' then crit_damage:=crit_damage+(case when ap->>'id'='crit_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='armor_penetration' then pen:=pen+(case when ap->>'id'='armor_penetration' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 collection_bonus:=private.record_collection_bonus(p_user);
 hp:=hp+coalesce((collection_bonus->>'hp')::numeric,0);
 attack:=attack+coalesce((collection_bonus->>'attack')::numeric,0);
 defense:=defense+coalesce((collection_bonus->>'defense')::numeric,0);
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon,'appearanceEffect',ap,'collectionBonus',collection_bonus);
end $function$
;
CREATE OR REPLACE FUNCTION public.get_character_growth(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;p jsonb;eq jsonb;h private.hunting_states%rowtype;
 slot text;i jsonb;b jsonb;expected text;gear jsonb:='[]';
 combat jsonb;ap jsonb;allocation jsonb;seal_level integer;guardian_level integer;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select payload into p from public.game_saves where user_id=u;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 -- Overview uses current equipment, not a previously locked expedition loadout.
 eq:=coalesce(p->'equipped','{}'::jsonb);
 p:=jsonb_set(p,'{expedition}',jsonb_build_object('equipment',eq),true);
 select * into h from private.hunting_states where user_id=u;
 allocation:=coalesce(h.stat_allocation,'{}'::jsonb);
 combat:=private.combat_equipment_stats(u,p);
 ap:=coalesce(combat->'appearanceEffect','{}'::jsonb);
 foreach slot in array array['weapon','helmet','armor','gloves','boots','necklace','ring'] loop
  select a.gear into i from private.market_assets a where a.user_id=u and a.item_id='equipment_v2:'||(eq->>slot) and a.quantity=1;
  if i is null then continue;end if;
  expected:=case i->>'kind' when 'association_supply_iron_sword' then 'weapon' when 'outer_guard_longbow' then 'weapon' when 'archive_standard_arcane_staff' then 'weapon' when 'expedition_iron_helmet' then 'helmet' when 'return_corps_plate_armor' then 'armor' when 'mining_detail_reinforced_gloves' then 'gloves' when 'survey_corps_dust_boots' then 'boots' when 'association_registration_tag' then 'necklace' when 'expedition_merit_ring' then 'ring' else null end;
  if expected is distinct from slot then continue;end if;
  b:=private.fixed_equipment_stats(i->>'kind',i->>'grade');
  gear:=gear||jsonb_build_array(jsonb_build_object('slot',slot,'item',i,'stats',b));
 end loop;
 select level into seal_level from private.player_association_seals where user_id=u;
 select level into guardian_level from private.player_guardian_seals where user_id=u;
 return jsonb_build_object(
  'experience',coalesce(h.experience,0),'allocation',allocation,
  'baseStats',jsonb_build_object('hp',180,'attack',8,'defense',3,'critChance',.05,'critDamage',1.5,'armorPenetration',0),
  'stats',combat,'equipment',gear,
  'maxMp',100+10*coalesce((allocation->>'mp')::integer,0)+case when ap->>'id'='max_mp' then coalesce((ap->>'value')::numeric,0) else 0 end,
  'currentJobId',p->>'currentJobId','selectedAppearanceId',coalesce(p->'cosmetics'->>'selectedAppearanceId','default'),
  'seals',jsonb_build_object(
   'association',jsonb_build_object('level',coalesce(seal_level,0),'bonus',private.association_seal_bonus_json(coalesce(seal_level,0))),
   'guardian',jsonb_build_object('level',coalesce(guardian_level,0),'bonus',private.guardian_seal_bonus_json(coalesce(guardian_level,0)))),
  'collection',jsonb_build_object('applied',true,'bonuses',private.record_collection_bonus(u),
   'registeredSetIds',coalesce((select jsonb_agg(set_id order by set_id) from private.collection_equipment_registrations where user_id=u),'[]'::jsonb),
   'unlockedAppearanceIds',coalesce((select jsonb_agg(appearance_id order by appearance_id) from private.appearance_ownership where user_id=u),'[]'::jsonb)),
  'foodTurns',coalesce((select food_turns from private.village_life_players where user_id=u),'{}'::jsonb)
 );
end;
$function$
;
notify pgrst,'reload schema';
