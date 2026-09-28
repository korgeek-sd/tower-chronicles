-- v0.1.64: make the seven-slot V2 equipment loadout authoritative in online combat.

create or replace function private.server_equipment_snapshot(p_user uuid,p_equipped jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  eq jsonb:=coalesce(p_equipped,'{}'::jsonb);
  w jsonb;h jsonb;a jsonb;g jsonb;b jsonb;n jsonb;r jsonb;x jsonb;
begin
  -- V2 slots are owned as equipment_v2:<instance-id>. Each slot validates the
  -- canonical item identity so a forged client loadout cannot cross-equip gear.
  select gear into w from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'weapon','') and quantity=1
    and gear is not null and gear->>'kind' in(
      'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff'
    ) limit 1;
  if w is null then
    select gear into w from private.market_assets
    where user_id=p_user and item_id='gear:'||coalesce(eq->>'weapon','') and quantity=1
      and gear is not null and gear->>'kind' in('sword','dagger','bow','staff') limit 1;
  end if;

  select gear into h from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'helmet','') and quantity=1
    and gear is not null and gear->>'kind'='expedition_iron_helmet' limit 1;

  select gear into a from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'armor','') and quantity=1
    and gear is not null and gear->>'kind'='return_corps_plate_armor' limit 1;
  if a is null then
    select gear into a from private.market_assets
    where user_id=p_user and item_id='gear:'||coalesce(eq->>'armor','') and quantity=1
      and gear is not null and gear->>'kind'='armor' limit 1;
  end if;

  select gear into g from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'gloves','') and quantity=1
    and gear is not null and gear->>'kind'='mining_detail_reinforced_gloves' limit 1;

  select gear into b from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'boots','') and quantity=1
    and gear is not null and gear->>'kind'='survey_corps_dust_boots' limit 1;
  if b is null then
    select gear into b from private.market_assets
    where user_id=p_user and item_id='gear:'||coalesce(eq->>'boots','') and quantity=1
      and gear is not null and gear->>'kind'='boots' limit 1;
  end if;

  select gear into n from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'necklace','') and quantity=1
    and gear is not null and gear->>'kind'='association_registration_tag' limit 1;

  select gear into r from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'ring','') and quantity=1
    and gear is not null and gear->>'kind'='expedition_merit_ring' limit 1;

  -- Compatibility only: old passive accessories keep their old snapshot key.
  select gear into x from private.market_assets
  where user_id=p_user and item_id='gear:'||coalesce(eq->>'accessory','') and quantity=1
    and gear is not null and gear->>'kind' in('vampire','unyielding','berserker') limit 1;

  return jsonb_build_object(
    'weapon',case when w is null then null else w->>'id' end,
    'helmet',case when h is null then null else h->>'id' end,
    'armor',case when a is null then null else a->>'id' end,
    'gloves',case when g is null then null else g->>'id' end,
    'boots',case when b is null then null else b->>'id' end,
    'necklace',case when n is null then null else n->>'id' end,
    'ring',case when r is null then null else r->>'id' end,
    'accessory',case when x is null then null else x->>'id' end
  );
end $$;
revoke all on function private.server_equipment_snapshot(uuid,jsonb) from public,anon,authenticated;

create or replace function private.v2_equipment_multiplier(p_item jsonb)
returns numeric language plpgsql immutable set search_path=''
as $$
declare
  grade_mult numeric:=1;
  enhance_mult numeric:=1;
  level integer:=greatest(0,least(10,coalesce((p_item->>'enhancement')::integer,0)));
begin
  grade_mult:=case p_item->>'grade'
    when 'common' then 1
    when 'uncommon' then 1.12
    when 'rare' then 1.26
    when 'heroic' then 1.42
    when 'legendary' then 1.60
    else 1
  end;
  enhance_mult:=case level
    when 0 then 1
    when 1 then 1.04
    when 2 then 1.08
    when 3 then 1.13
    when 4 then 1.18
    when 5 then 1.24
    when 6 then 1.31
    when 7 then 1.38
    when 8 then 1.45
    when 9 then 1.52
    when 10 then 1.60
    else 1
  end;
  return grade_mult*enhance_mult;
end $$;
revoke all on function private.v2_equipment_multiplier(jsonb) from public,anon,authenticated;

create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_eq jsonb:=coalesce(p_payload->'expedition'->'equipment','{}'::jsonb);
  v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);
  v_modern jsonb:=coalesce(p_payload->'equipmentItems','[]'::jsonb);
  v_weapon_v2 jsonb;v_armor_v2 jsonb;v_boots_v2 jsonb;
  v_weapon jsonb;v_armor jsonb;v_boots jsonb;
  v_kind text:='sword';v_mult numeric:=1;v_scale numeric:=.4;
  v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;
  v_seal_level integer:=0;v_seal_bonus jsonb;
begin
  select i into v_weapon_v2 from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'weapon'
     and i->>'kind' in('association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff')
   limit 1;
  select i into v_armor_v2 from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'armor' and i->>'kind'='return_corps_plate_armor' limit 1;
  select i into v_boots_v2 from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'boots' and i->>'kind'='survey_corps_dust_boots' limit 1;

  if v_weapon_v2 is not null then
    v_kind:=case v_weapon_v2->>'kind'
      when 'outer_guard_longbow' then 'bow'
      when 'archive_standard_arcane_staff' then 'staff'
      else 'sword'
    end;
    v_mult:=private.v2_equipment_multiplier(v_weapon_v2);
    v_attack:=v_attack+(case v_kind when 'bow' then 12 when 'staff' then 6 else 10 end)*v_mult;
    v_def:=v_def+(case v_kind when 'bow' then 1 when 'sword' then 4 else 0 end)*v_mult;
  else
    select i into v_weapon from jsonb_array_elements(v_items)i
     where i->>'id'=v_eq->>'weapon' and i->>'kind' in('sword','dagger','bow','staff') limit 1;
    if v_weapon is not null then
      v_kind:=v_weapon->>'kind';
      v_mult:=1+greatest(0,least(3,coalesce((v_weapon->>'enhancement')::int,0)))*0.1;
      v_scale:=case when v_weapon->>'id'='starter' then .55
        else greatest(1,least(5,coalesce((v_weapon->>'tier')::int,1))) end;
    end if;
    v_attack:=v_attack+(case v_kind when 'sword' then 10 when 'dagger' then 7 when 'bow' then 12 else 6 end)*v_scale*v_mult;
    v_def:=v_def+(case v_kind when 'sword' then 4 when 'bow' then 1 else 0 end)*v_scale*v_mult;
  end if;

  if v_armor_v2 is not null then
    v_mult:=private.v2_equipment_multiplier(v_armor_v2);
    v_hp:=v_hp+55*v_mult;
    v_def:=v_def+7*v_mult;
  else
    select i into v_armor from jsonb_array_elements(v_items)i
     where i->>'id'=v_eq->>'armor' and i->>'kind'='armor' limit 1;
    if v_armor is not null then
      v_mult:=1+greatest(0,least(3,coalesce((v_armor->>'enhancement')::int,0)))*0.1;
      v_hp:=v_hp+55*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
      v_def:=v_def+7*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
    end if;
  end if;

  if v_boots_v2 is not null then
    v_mult:=private.v2_equipment_multiplier(v_boots_v2);
    v_hp:=v_hp+15*v_mult;
  else
    select i into v_boots from jsonb_array_elements(v_items)i
     where i->>'id'=v_eq->>'boots' and i->>'kind'='boots' limit 1;
    if v_boots is not null then
      v_mult:=1+greatest(0,least(3,coalesce((v_boots->>'enhancement')::int,0)))*0.1;
      v_hp:=v_hp+15*greatest(1,least(5,coalesce((v_boots->>'tier')::int,1)))*v_mult;
    end if;
  end if;

  -- Helmet, gloves, necklace and ring are already authoritative loadout slots.
  -- Their V2 base stats are intentionally empty until their balance values are finalized.

  select level into v_seal_level
  from private.player_association_seals
  where user_id=p_user;
  v_seal_bonus:=private.association_seal_bonus_json(coalesce(v_seal_level,0));

  v_hp:=v_hp*(1+coalesce((v_seal_bonus->>'hpPercent')::numeric,0)/100);
  v_attack:=v_attack*(1+coalesce((v_seal_bonus->>'attackPercent')::numeric,0)/100);
  v_def:=v_def*(1+coalesce((v_seal_bonus->>'defensePercent')::numeric,0)/100);

  return jsonb_build_object('attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

create or replace function private.combat_skill_power(p_payload jsonb)
returns numeric language plpgsql security definer set search_path=''
as $$
declare
  v_eq jsonb:=coalesce(p_payload->'expedition'->'equipment','{}'::jsonb);
  v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);
  v_modern jsonb:=coalesce(p_payload->'equipmentItems','[]'::jsonb);
  v_weapon_v2 jsonb;v_weapon jsonb;v_kind text:='sword';
begin
  select i into v_weapon_v2 from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'weapon'
     and i->>'kind' in('association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff')
   limit 1;
  if v_weapon_v2 is not null then
    return case when v_weapon_v2->>'kind'='archive_standard_arcane_staff' then 1.3 else 1 end;
  end if;

  select i into v_weapon from jsonb_array_elements(v_items)i
   where i->>'id'=v_eq->>'weapon' limit 1;
  if v_weapon is not null and v_weapon->>'kind' in('sword','dagger','bow','staff') then
    v_kind:=v_weapon->>'kind';
  end if;
  return case when v_kind='staff' then 1.3 else 1 end;
end $$;
revoke all on function private.combat_skill_power(jsonb) from public,anon,authenticated;
