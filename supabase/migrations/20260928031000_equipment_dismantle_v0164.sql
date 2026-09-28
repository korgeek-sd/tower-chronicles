-- v0.1.64: universal enhancement stones and server-authoritative equipment dismantling.

create or replace function public.dismantle_online_equipment(
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
  v_grade text;
  v_yield bigint;
begin
  v_user:=private.require_active_game_session(
    p_lease_id,p_generation,p_client_instance_id,p_device_id
  );

  if nullif(p_item_id,'') is null then
    raise exception 'DISMANTLE_ITEM_NOT_FOUND';
  end if;
  if p_item_id='starter-v2' then
    raise exception 'DISMANTLE_STARTER_PROTECTED';
  end if;

  select * into v_save
  from public.game_saves
  where user_id=v_user
  for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
     or exists(
       select 1
       from private.online_expeditions e
       where e.user_id=v_user and e.status='ACTIVE'
     ) then
    raise exception 'DISMANTLE_EXPEDITION_BLOCKED';
  end if;

  if exists(
    select 1
    from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) equipped
    where equipped.value=p_item_id
  ) then
    raise exception 'DISMANTLE_EQUIPPED';
  end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id
    and quantity=1
    and gear is not null
  for update;
  if not found then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;

  v_grade:=v_asset.gear->>'grade';
  v_yield:=case v_grade
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 4
    when 'heroic' then 8
    when 'legendary' then 15
    else 0
  end;
  if v_yield<=0 then raise exception 'DISMANTLE_GRADE_INVALID';end if;

  delete from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id;

  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(v_user,'other:enhancement_stone',v_yield,now())
  on conflict(user_id,item_id) do update
  set quantity=private.market_assets.quantity+excluded.quantity,
      updated_at=now();

  perform private.persist_market_economy_to_save(v_user);

  return jsonb_build_object(
    'itemId',p_item_id,
    'stones',v_yield,
    'record',private.cloud_record_json(v_user)
  );
end;$$;

revoke all on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
from public,anon;
grant execute on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
to authenticated;
