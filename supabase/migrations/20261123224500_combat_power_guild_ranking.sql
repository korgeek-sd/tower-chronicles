-- Combat Power v1. All values are derived from existing server-authoritative
-- stats and equipped learned skills. No schema/data migration; old names and members persist.
-- Server scoring mirrors src/game/combatPower.ts.
create or replace function private.combat_power_from_stats(p_stats jsonb,p_skill_bonus numeric default 0)
returns bigint language sql immutable set search_path='' as $power$
 select least(1000000000::numeric,greatest(0::numeric,floor(
   (
    least(1000000000::numeric,greatest(0::numeric,coalesce((p_stats->>'attack')::numeric,0)))*10
    *(1+least(.6::numeric,greatest(0::numeric,coalesce((p_stats->>'critChance')::numeric,0)))
         *(greatest(1::numeric,coalesce((p_stats->>'critDamage')::numeric,1))-1))
    *(1+least(1::numeric,greatest(0::numeric,coalesce((p_stats->>'armorPenetration')::numeric,0)))*.5)
    +least(1000000000::numeric,greatest(0::numeric,coalesce((p_stats->>'hp')::numeric,0)))*.5
     *(1+least(1000000000::numeric,greatest(0::numeric,coalesce((p_stats->>'defense')::numeric,0)))/100)
   )
   *(1+least(.2::numeric,greatest(0::numeric,coalesce(p_skill_bonus,0))))
  )))::bigint;
$power$;

-- Only server-owned, equipped AND learned catalog skills contribute;
-- base heavy/guard/quick have no phantom enhancement bonus.
create or replace function private.member_skill_bonus(p_user uuid)
returns numeric language sql stable security definer set search_path='' as $skills$
 select least(.2::numeric,coalesce(sum(
    .012::numeric + least(3,greatest(0,coalesce(sk.enhancement_level,0)))*.005::numeric
 ),0))
 from (
  select distinct unnest(coalesce(h.skills,array[]::text[])) as skill_id
  from private.hunting_states h where h.user_id=p_user
 ) selected
 join private.learned_catalog_skills sk
   on sk.user_id=p_user and sk.skill_id=selected.skill_id;
$skills$;

-- Main ranking uses current equipment (not any locked expedition equipment).
-- Missing cloud saves count as 0, rather than inventing combat strength.
create or replace function private.member_combat_power(p_user uuid)
returns bigint language plpgsql stable security definer set search_path='' as $member$
declare p jsonb; combat jsonb;
begin
 select payload into p from public.game_saves where user_id=p_user;
 if p is null then return 0;end if;
 p:=jsonb_set(p,'{expedition}',jsonb_build_object('equipment',coalesce(p->'equipped','{}'::jsonb)),true);
 combat:=private.combat_equipment_stats(p_user,p);
 return private.combat_power_from_stats(combat,private.member_skill_bonus(p_user));
end
$member$;
revoke all on function private.combat_power_from_stats(jsonb,numeric) from public,anon,authenticated;
revoke all on function private.member_skill_bonus(uuid) from public,anon,authenticated;
revoke all on function private.member_combat_power(uuid) from public,anon,authenticated;

-- Extend the existing authorized character growth RPC with its real CP.
CREATE OR REPLACE FUNCTION public.get_character_growth(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;p jsonb;eq jsonb;h private.hunting_states%rowtype;
 slot text;i jsonb;b jsonb;expected text;gear jsonb:='[]';
 combat jsonb;ap jsonb;allocation jsonb;seal_level integer;guardian_level integer;v_skill_bonus numeric;
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
 v_skill_bonus:=private.member_skill_bonus(u);
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
  'combatPower',private.combat_power_from_stats(combat,v_skill_bonus),
  'combatPowerSkillBonus',v_skill_bonus,
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


-- The OVERALL ranking is computed from all current members' live CP.
CREATE OR REPLACE FUNCTION private.guild_ranking_state_json(p_user uuid, p_mode text DEFAULT 'OVERALL'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_my_guild uuid;v_rows jsonb;v_total integer;v_my_rank bigint;
begin
 if p_mode not in ('OVERALL','TERRITORY','WARS','GROWTH') then
   raise exception 'GUILD_RANKING_MODE_INVALID';
 end if;
 select m.association_id into v_my_guild
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=p_user;

 with guilds as (
  select a.association_id,a.name,a.record_number as record_number,
    a.association_level as guild_level,a.association_exp as guild_exp,
    a.member_limit,a.created_at,
    coalesce(m.members,0)::integer as members,
    coalesce(cp.combat_power,0)::bigint as combat_power,
    coalesce(cp.top_power,0)::bigint as top_power,
    coalesce(o.territories,0)::integer as territories,
    coalesce(w.victories,0)::integer as victories,
    coalesce(w.captures,0)::integer as captures,
    coalesce(w.defenses,0)::integer as defenses
  from private.online_associations a
  left join lateral (
   select count(*) as members from private.online_association_members m
    where m.association_id=a.association_id
  ) m on true
  left join lateral (
   select coalesce(sum(p.power),0)::bigint as combat_power,
     coalesce(max(p.power),0)::bigint as top_power
   from (
    select private.member_combat_power(mm.user_id) as power
    from private.online_association_members mm
    where mm.association_id=a.association_id
   ) p
  ) cp on true
  left join lateral (
   select count(*) as territories from private.village_war_owners o
    where o.association_id=a.association_id
  ) o on true
  left join lateral (
   select count(*) as victories,
     count(*) filter(where e.owner_association_id is distinct from a.association_id) as captures,
     count(*) filter(where e.owner_association_id=a.association_id) as defenses
   from private.village_war_events e
   where e.winner_association_id=a.association_id and e.settled_at is not null
  ) w on true
  where a.status='ACTIVE'
 ), ranked as (
  select g.*,row_number() over(order by
   case p_mode when 'OVERALL' then g.combat_power when 'WARS' then g.victories when 'GROWTH' then g.guild_level else g.territories end desc,
   case p_mode when 'OVERALL' then g.top_power when 'TERRITORY' then g.guild_level when 'WARS' then g.captures when 'GROWTH' then g.guild_exp else g.victories end desc,
   case p_mode when 'OVERALL' then g.members when 'TERRITORY' then g.victories when 'WARS' then g.territories when 'GROWTH' then g.members else g.guild_level end desc,
   case p_mode when 'OVERALL' then g.territories when 'WARS' then g.guild_level when 'GROWTH' then g.territories else g.members end desc,
   g.created_at asc,g.association_id asc
  ) as rank
  from guilds g
 )
 select count(*)::integer,
   max(rank) filter(where association_id=v_my_guild),
   coalesce(jsonb_agg(jsonb_build_object(
     'rank',rank,'associationId',association_id,'name',name,'recordNumber',record_number,
     'level',guild_level,'exp',guild_exp,'members',members,'memberLimit',member_limit,
     'combatPower',combat_power,'topPower',top_power,
     'territories',territories,'victories',victories,'captures',captures,'defenses',defenses,
     'createdAt',created_at,'mine',association_id=v_my_guild
   ) order by rank) filter(where rank<=100),'[]'::jsonb)
 into v_total,v_my_rank,v_rows from ranked;

 return jsonb_build_object('mode',p_mode,'totalGuilds',coalesce(v_total,0),
  'myAssociationId',v_my_guild,'myRank',v_my_rank,'entries',v_rows,
  'updatedAt',clock_timestamp());
end
$function$

