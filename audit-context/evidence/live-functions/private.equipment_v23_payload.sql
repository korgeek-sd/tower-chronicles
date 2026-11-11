CREATE OR REPLACE FUNCTION private.equipment_v23_payload(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_equipment jsonb;
  v_loadout jsonb:=jsonb_build_object(
    'weapon','starter-v2',
    'helmet',null,
    'armor',null,
    'gloves',null,
    'boots',null,
    'necklace',null,
    'ring',null
  );
  v_presets jsonb;
  v_jobs jsonb;
  v_orders jsonb;
  v_storage jsonb;
begin
  select coalesce(jsonb_agg(a.gear order by a.item_id),'[]'::jsonb)
  into v_equipment
  from private.market_assets a
  where a.user_id=p_user and a.item_id like 'equipment_v2:%'
    and a.quantity=1 and a.gear is not null;

  v_payload:=jsonb_set(v_payload,'{version}','23'::jsonb,true);
  v_payload:=jsonb_set(v_payload,'{items}','[]'::jsonb,true);
  v_payload:=jsonb_set(v_payload,'{equipmentItems}',v_equipment,true);
  v_payload:=jsonb_set(v_payload,'{equipped}',v_loadout,true);

  if jsonb_typeof(v_payload->'expeditionPresets')='array' then
    select coalesce(jsonb_agg(
      case when value='null'::jsonb then value
           else jsonb_set(value,'{equipment}',v_loadout,true) end
      order by ord
    ),'[]'::jsonb)
    into v_presets
    from jsonb_array_elements(v_payload->'expeditionPresets') with ordinality x(value,ord);
    v_payload:=jsonb_set(v_payload,'{expeditionPresets}',v_presets,true);
  end if;

  if jsonb_typeof(v_payload->'expedition')='object' then
    v_payload:=jsonb_set(v_payload,'{expedition,equipment}',v_loadout,true);
  end if;

  if jsonb_typeof(v_payload->'crafting'->'jobs')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_jobs
    from jsonb_array_elements(v_payload->'crafting'->'jobs') with ordinality x(value,ord)
    where value->>'field'='alchemy';
    v_payload:=jsonb_set(v_payload,'{crafting,jobs}',v_jobs,true);
  end if;

  if jsonb_typeof(v_payload->'market'->'orders')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_orders
    from jsonb_array_elements(v_payload->'market'->'orders') with ordinality x(value,ord)
    where coalesce(value->>'itemId','') not like 'gear:%';
    v_payload:=jsonb_set(v_payload,'{market,orders}',v_orders,true);
  end if;

  if jsonb_typeof(v_payload->'market'->'storage')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_storage
    from jsonb_array_elements(v_payload->'market'->'storage') with ordinality x(value,ord)
    where coalesce(value->>'itemId','') not like 'gear:%';
    v_payload:=jsonb_set(v_payload,'{market,storage}',v_storage,true);
  end if;

  return v_payload;
end;$function$

