CREATE OR REPLACE FUNCTION private.sync_market_economy_from_latest_save(p_user uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_revision bigint;
  v_payload jsonb;
  v_last bigint;
begin
  select revision,payload into v_revision,v_payload
  from public.game_saves where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  select last_synced_revision into v_last
  from private.player_wallets where user_id=p_user;

  if found then
    if v_last>=v_revision then return v_revision;end if;
    update private.player_wallets
    set last_synced_revision=v_revision,updated_at=now()
    where user_id=p_user;
    return v_revision;
  end if;

  insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
  values(
    p_user,
    greatest(0,coalesce((v_payload->>'silver')::bigint,0)),
    greatest(0,coalesce((v_payload->'market'->>'gold')::bigint,0)),
    v_revision,now()
  );

  insert into private.market_assets(user_id,item_id,quantity,gear)
  select p_user,'equipment_v2:'||(g->>'id'),1,g
  from jsonb_array_elements(coalesce(v_payload->'equipmentItems','[]'::jsonb)) g
  where nullif(g->>'id','') is not null
  on conflict(user_id,item_id) do update set quantity=1,gear=excluded.gear,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'skillbook:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'other:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  return v_revision;
end;$function$

