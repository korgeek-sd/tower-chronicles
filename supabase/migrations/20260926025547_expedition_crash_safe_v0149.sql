-- v0.1.49 follow-up: make online expedition start atomic with the client expedition payload
-- and make settlement idempotent after reconnect/reload.

drop function if exists public.start_online_expedition(uuid,bigint,text,text,text,integer);

create or replace function public.start_online_expedition(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_tower text,
  p_floor integer,
  p_client_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_ticket_id text;
  v_ticket private.market_assets%rowtype;
  v_rate integer:=0;
  v_assoc_id text;
  v_exp jsonb;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);

  if p_tower not in ('ore','leather','gem','kaleon') or p_floor<1 or p_floor>10 then
    raise exception 'EXPEDITION_TARGET_INVALID';
  end if;

  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then
    raise exception 'EXPEDITION_ALREADY_ACTIVE';
  end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then
    raise exception 'EXPEDITION_ALREADY_ACTIVE';
  end if;

  v_exp:=p_client_payload->'expedition';
  if jsonb_typeof(v_exp)<>'object'
     or v_exp->>'tower'<>p_tower
     or coalesce((v_exp->>'floor')::integer,0)<>p_floor then
    raise exception 'EXPEDITION_START_PAYLOAD_INVALID';
  end if;

  v_ticket_id:='ticket:'||p_tower||':'||p_floor::text;
  select * into v_ticket
  from private.market_assets
  where user_id=v_user and item_id=v_ticket_id
  for update;
  if not found or v_ticket.quantity<1 then raise exception 'EXPEDITION_TICKET_REQUIRED'; end if;

  if v_ticket.quantity=1 then
    delete from private.market_assets where user_id=v_user and item_id=v_ticket_id;
  else
    update private.market_assets
    set quantity=quantity-1,updated_at=now()
    where user_id=v_user and item_id=v_ticket_id;
  end if;

  v_assoc_id:=v_save.payload->'association'->>'currentId';
  if v_assoc_id is not null then
    select greatest(0,least(30,coalesce((a->>'revenueShareRatePercent')::integer,0)))
    into v_rate
    from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a
    where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE'
    limit 1;
    v_rate:=coalesce(v_rate,0);
  end if;

  insert into private.online_expeditions(
    user_id,run_id,tower,floor,status,starting_revision,revenue_share_rate,started_at,settled_at
  ) values(
    v_user,gen_random_uuid(),p_tower,p_floor,'ACTIVE',v_save.revision,v_rate,now(),null
  )
  on conflict(user_id) do update set
    run_id=excluded.run_id,
    tower=excluded.tower,
    floor=excluded.floor,
    status='ACTIVE',
    starting_revision=excluded.starting_revision,
    revenue_share_rate=excluded.revenue_share_rate,
    started_at=excluded.started_at,
    settled_at=null;

  perform private.persist_client_payload_with_server_economy(v_user,p_client_payload,'0.1.49');
  return private.cloud_record_json(v_user);
end;
$$;

create or replace function public.settle_online_expedition(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_client_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_run private.online_expeditions%rowtype;
  v_receipt jsonb;
  v_loot jsonb;
  v_outcome text;
  v_tower text;
  v_floor integer;
  v_kills bigint;
  v_gross_silver bigint;
  v_max_silver bigint;
  v_net_silver bigint;
  v_share bigint;
  v_material_q bigint;
  v_material_cap bigint;
  v_ticket_q bigint;
  v_tower_key text;
  v_i integer;
  v_q bigint;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);

  select * into v_run
  from private.online_expeditions
  where user_id=v_user
  for update;

  if not found then return private.cloud_record_json(v_user); end if;
  if v_run.status in ('RETURNED','DEAD') then return private.cloud_record_json(v_user); end if;
  if v_run.status<>'ACTIVE' then return private.cloud_record_json(v_user); end if;

  if jsonb_typeof(p_client_payload->'expedition') is distinct from 'null' then
    raise exception 'EXPEDITION_SETTLEMENT_PAYLOAD_INVALID';
  end if;

  v_receipt:=p_client_payload->'lastExpedition';
  if jsonb_typeof(v_receipt)<>'object' then raise exception 'EXPEDITION_RECEIPT_REQUIRED'; end if;
  v_outcome:=v_receipt->>'outcome';
  v_tower:=v_receipt->>'tower';
  begin v_floor:=(v_receipt->>'floor')::integer;
  exception when others then raise exception 'EXPEDITION_RECEIPT_INVALID'; end;
  begin v_kills:=(v_receipt->>'kills')::bigint;
  exception when others then raise exception 'EXPEDITION_RECEIPT_INVALID'; end;

  if v_outcome not in ('returned','dead')
     or v_tower<>v_run.tower
     or v_floor<>v_run.floor
     or v_kills<0
     or v_kills>5000 then
    raise exception 'EXPEDITION_RECEIPT_INVALID';
  end if;

  v_loot:=v_receipt->'loot';
  if jsonb_typeof(v_loot)<>'object' then raise exception 'EXPEDITION_LOOT_INVALID'; end if;

  if v_outcome='returned' then
    begin v_gross_silver:=(v_loot->>'silver')::bigint;
    exception when others then raise exception 'EXPEDITION_LOOT_INVALID'; end;
    if v_gross_silver<0 then raise exception 'EXPEDITION_LOOT_INVALID'; end if;

    v_max_silver:=v_kills*((10+v_floor*3)+50);
    if v_gross_silver>v_max_silver then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP'; end if;

    v_material_cap:=v_kills*(2+5+(6+v_floor*2));
    for v_tower_key in select jsonb_object_keys(coalesce(v_loot->'materials','{}'::jsonb))
    loop
      if jsonb_typeof(v_loot->'materials'->v_tower_key)<>'array' then
        raise exception 'EXPEDITION_LOOT_INVALID';
      end if;
      for v_i in 0..jsonb_array_length(v_loot->'materials'->v_tower_key)-1
      loop
        begin v_q:=((v_loot->'materials'->v_tower_key)->>v_i)::bigint;
        exception when others then raise exception 'EXPEDITION_LOOT_INVALID'; end;
        if v_q<0 then raise exception 'EXPEDITION_LOOT_INVALID'; end if;
        if v_tower_key=v_run.tower and v_i=0 then
          v_material_q:=v_q;
          if v_q>v_material_cap then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP'; end if;
        elsif v_q<>0 then
          raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';
        end if;
      end loop;
    end loop;

    for v_tower_key in select jsonb_object_keys(coalesce(v_loot->'tickets','{}'::jsonb))
    loop
      if jsonb_typeof(v_loot->'tickets'->v_tower_key)<>'array' then
        raise exception 'EXPEDITION_LOOT_INVALID';
      end if;
      for v_i in 0..jsonb_array_length(v_loot->'tickets'->v_tower_key)-1
      loop
        begin v_q:=((v_loot->'tickets'->v_tower_key)->>v_i)::bigint;
        exception when others then raise exception 'EXPEDITION_LOOT_INVALID'; end;
        if v_q<0 then raise exception 'EXPEDITION_LOOT_INVALID'; end if;
        if v_tower_key=v_run.tower and v_run.floor<10 and v_i=v_run.floor then
          v_ticket_q:=v_q;
          if v_q>v_kills then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP'; end if;
        elsif v_q<>0 then
          raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';
        end if;
      end loop;
    end loop;

    if coalesce((select sum((value)::bigint)
                 from jsonb_each_text(coalesce(v_loot->'skillBooks','{}'::jsonb))),0)<>0
       or coalesce((select sum((value)::bigint)
                    from jsonb_each_text(coalesce(v_loot->'items','{}'::jsonb))),0)<>0 then
      raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';
    end if;

    v_share:=floor(v_gross_silver*v_run.revenue_share_rate/100.0);
    v_net_silver:=v_gross_silver-v_share;
    update private.player_wallets
    set silver=silver+v_net_silver,updated_at=now()
    where user_id=v_user;

    if coalesce(v_material_q,0)>0 then
      insert into private.market_assets(user_id,item_id,quantity,updated_at)
      values(v_user,'material:'||v_run.tower||':1',v_material_q,now())
      on conflict(user_id,item_id) do update
      set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;

    if coalesce(v_ticket_q,0)>0 then
      insert into private.market_assets(user_id,item_id,quantity,updated_at)
      values(v_user,'ticket:'||v_run.tower||':'||(v_run.floor+1)::text,v_ticket_q,now())
      on conflict(user_id,item_id) do update
      set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;

    update private.online_expeditions
    set status='RETURNED',settled_at=now()
    where user_id=v_user;
  else
    update private.online_expeditions
    set status='DEAD',settled_at=now()
    where user_id=v_user;
  end if;

  perform private.persist_client_payload_with_server_economy(v_user,p_client_payload,'0.1.49');
  return private.cloud_record_json(v_user);
end;
$$;

revoke all on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb)
from public,anon,authenticated;
revoke all on function public.settle_online_expedition(uuid,bigint,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb)
to authenticated;
grant execute on function public.settle_online_expedition(uuid,bigint,text,text,jsonb)
to authenticated;
