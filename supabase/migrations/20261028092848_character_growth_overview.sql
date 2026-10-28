-- Read-only character overview. Existing combat calculations remain authoritative.
-- No wallet, progression, equipment, ownership or collection reward mutations.
create or replace function public.get_character_growth(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
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
  'collection',jsonb_build_object('applied',false,
   'registeredSetIds',coalesce((select jsonb_agg(set_id order by set_id) from private.collection_equipment_registrations where user_id=u),'[]'::jsonb),
   'unlockedAppearanceIds',coalesce((select jsonb_agg(appearance_id order by appearance_id) from private.appearance_ownership where user_id=u),'[]'::jsonb)),
  'foodTurns',coalesce((select food_turns from private.village_life_players where user_id=u),'{}'::jsonb)
 );
end;
$$;
revoke all on function public.get_character_growth(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_character_growth(uuid,bigint,text,text) to authenticated;
