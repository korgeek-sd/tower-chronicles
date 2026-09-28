-- v0.1.64: server-authoritative +0 through +10 V2 equipment enhancement.
-- Each attempt consumes Silver + universal Enhancement Stones before the outcome is rolled.

create or replace function public.enhance_online_equipment(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_item_id text
) returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_asset private.market_assets%rowtype;
  v_stones private.market_assets%rowtype;
  v_payload jsonb;
  v_presets jsonb;
  v_kind text;
  v_grade text;
  v_slot text;
  v_level integer;
  v_target integer;
  v_base numeric;
  v_factor numeric;
  v_silver_cost bigint;
  v_stone_cost bigint;
  v_roll numeric;
  v_outcome text;
  v_after integer;
begin
  v_user:=private.require_active_game_session(
    p_lease_id,p_generation,p_client_instance_id,p_device_id
  );
  perform private.sync_market_economy_from_latest_save(v_user);

  select * into v_save
  from public.game_saves
  where user_id=v_user
  for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
     or exists(
       select 1 from private.online_expeditions e
       where e.user_id=v_user and e.status='ACTIVE'
     ) then
    raise exception 'ENHANCE_EXPEDITION_BLOCKED';
  end if;

  if p_item_id='starter-v2' then raise exception 'ENHANCE_STARTER_PROTECTED';end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id
    and quantity=1
    and gear is not null
  for update;
  if not found then raise exception 'ENHANCE_ITEM_NOT_FOUND';end if;

  v_kind:=v_asset.gear->>'kind';
  v_grade:=v_asset.gear->>'grade';
  begin
    v_level:=(v_asset.gear->>'enhancement')::integer;
  exception when others then
    raise exception 'ENHANCE_ITEM_INVALID';
  end;

  if v_kind not in(
    'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
    'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
    'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
  ) then raise exception 'ENHANCE_ITEM_INVALID';end if;
  if v_grade not in('common','uncommon','rare','heroic','legendary') then raise exception 'ENHANCE_ITEM_INVALID';end if;
  if v_level<0 or v_level>10 then raise exception 'ENHANCE_ITEM_INVALID';end if;
  if v_level=10 then raise exception 'ENHANCE_MAX_LEVEL';end if;

  v_target:=v_level+1;

  v_base:=case v_grade
    when 'common' then 500
    when 'uncommon' then 750
    when 'rare' then 1100
    when 'heroic' then 1600
    when 'legendary' then 2500
  end;

  v_factor:=case v_target
    when 1 then 1.0
    when 2 then 1.5
    when 3 then 2.2
    when 4 then 3.2
    when 5 then 4.5
    when 6 then 6.5
    when 7 then 9.5
    when 8 then 14
    when 9 then 21
    when 10 then 32
  end;

  v_stone_cost:=case v_target
    when 1 then 1
    when 2 then 1
    when 3 then 2
    when 4 then 2
    when 5 then 3
    when 6 then 4
    when 7 then 5
    when 8 then 7
    when 9 then 10
    when 10 then 15
  end;

  v_silver_cost:=greatest(1,round(v_base*v_factor)::bigint);

  if (select silver from private.player_wallets where user_id=v_user for update)<v_silver_cost then
    raise exception 'ENHANCE_SILVER_SHORTAGE';
  end if;

  select * into v_stones
  from private.market_assets
  where user_id=v_user and item_id='other:enhancement_stone'
  for update;
  if not found or v_stones.quantity<v_stone_cost then
    raise exception 'ENHANCE_STONE_SHORTAGE';
  end if;

  update private.player_wallets
  set silver=silver-v_silver_cost,updated_at=now()
  where user_id=v_user;

  if v_stones.quantity=v_stone_cost then
    delete from private.market_assets
    where user_id=v_user and item_id='other:enhancement_stone';
  else
    update private.market_assets
    set quantity=quantity-v_stone_cost,updated_at=now()
    where user_id=v_user and item_id='other:enhancement_stone';
  end if;

  v_roll:=random();

  if v_level=0 then
    v_outcome:=case when v_roll<0.50 then 'SUCCESS' else 'FAIL_KEEP' end;
  elsif v_level=1 then
    v_outcome:=case when v_roll<0.65 then 'SUCCESS' when v_roll<0.970 then 'FAIL_KEEP' when v_roll<0.998 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=2 then
    v_outcome:=case when v_roll<0.60 then 'SUCCESS' when v_roll<0.940 then 'FAIL_KEEP' when v_roll<0.997 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=3 then
    v_outcome:=case when v_roll<0.55 then 'SUCCESS' when v_roll<0.890 then 'FAIL_KEEP' when v_roll<0.995 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=4 then
    v_outcome:=case when v_roll<0.48 then 'SUCCESS' when v_roll<0.820 then 'FAIL_KEEP' when v_roll<0.993 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=5 then
    v_outcome:=case when v_roll<0.40 then 'SUCCESS' when v_roll<0.730 then 'FAIL_KEEP' when v_roll<0.990 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=6 then
    v_outcome:=case when v_roll<0.32 then 'SUCCESS' when v_roll<0.630 then 'FAIL_KEEP' when v_roll<0.990 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=7 then
    v_outcome:=case when v_roll<0.24 then 'SUCCESS' when v_roll<0.510 then 'FAIL_KEEP' when v_roll<0.985 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  elsif v_level=8 then
    v_outcome:=case when v_roll<0.19 then 'SUCCESS' when v_roll<0.430 then 'FAIL_KEEP' when v_roll<0.980 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  else
    v_outcome:=case when v_roll<0.10 then 'SUCCESS' when v_roll<0.330 then 'FAIL_KEEP' when v_roll<0.975 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  end if;

  v_payload:=v_save.payload;

  if v_outcome='SUCCESS' then
    v_after:=v_target;
    update private.market_assets
    set gear=jsonb_set(gear,'{enhancement}',to_jsonb(v_after),true),updated_at=now()
    where user_id=v_user and item_id='equipment_v2:'||p_item_id;
  elsif v_outcome='FAIL_KEEP' then
    v_after:=v_level;
  elsif v_outcome='FAIL_DOWNGRADE' then
    v_after:=greatest(0,v_level-1);
    update private.market_assets
    set gear=jsonb_set(gear,'{enhancement}',to_jsonb(v_after),true),updated_at=now()
    where user_id=v_user and item_id='equipment_v2:'||p_item_id;
  else
    v_after:=null;
    delete from private.market_assets
    where user_id=v_user and item_id='equipment_v2:'||p_item_id;

    v_slot:=case v_kind
      when 'association_supply_iron_sword' then 'weapon'
      when 'outer_guard_longbow' then 'weapon'
      when 'archive_standard_arcane_staff' then 'weapon'
      when 'expedition_iron_helmet' then 'helmet'
      when 'return_corps_plate_armor' then 'armor'
      when 'mining_detail_reinforced_gloves' then 'gloves'
      when 'survey_corps_dust_boots' then 'boots'
      when 'association_registration_tag' then 'necklace'
      when 'expedition_merit_ring' then 'ring'
    end;

    if v_payload->'equipped'->>v_slot=p_item_id then
      v_payload:=jsonb_set(v_payload,array['equipped',v_slot],'null'::jsonb,true);
    end if;

    if jsonb_typeof(v_payload->'expeditionPresets')='array' then
      select coalesce(jsonb_agg(
        case
          when value='null'::jsonb then value
          when value->'equipment'->>v_slot=p_item_id then jsonb_set(value,array['equipment',v_slot],'null'::jsonb,true)
          else value
        end
        order by ord
      ),'[]'::jsonb)
      into v_presets
      from jsonb_array_elements(v_payload->'expeditionPresets') with ordinality x(value,ord);
      v_payload:=jsonb_set(v_payload,'{expeditionPresets}',v_presets,true);
    end if;
  end if;

  perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.64');

  return jsonb_build_object(
    'outcome',v_outcome,
    'before',v_level,
    'after',v_after,
    'silverCost',v_silver_cost,
    'stoneCost',v_stone_cost,
    'record',private.cloud_record_json(v_user)
  );
end;$$;

revoke all on function public.enhance_online_equipment(uuid,bigint,text,text,text)
from public,anon;
grant execute on function public.enhance_online_equipment(uuid,bigint,text,text,text)
to authenticated;
