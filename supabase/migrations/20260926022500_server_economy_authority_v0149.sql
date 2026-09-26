-- v0.1.49 server-authoritative economy boundary and expedition settlement.

create or replace function private.client_asset_quantity(p_payload jsonb,p_item_id text)
returns bigint language plpgsql immutable set search_path=''
as $$
declare v_kind text:=split_part(p_item_id,':',1);v_a text:=split_part(p_item_id,':',2);v_b int;v_value text;
begin
 if v_kind in ('material','ticket') then
  begin v_b:=split_part(p_item_id,':',3)::int;exception when others then return 0;end;
  if v_b<1 then return 0;end if;
  v_value:=p_payload->case when v_kind='material' then 'materials' else 'tickets' end->v_a->>(v_b-1);
  if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 elsif v_kind='skillbook' then
  v_value:=p_payload->'skillBooks'->>v_a;if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 elsif v_kind='other' then
  v_value:=p_payload->'lootItems'->>v_a;if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 end if;return 0;
end;$$;

create or replace function private.accept_client_economy_consumption(p_user uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_asset record;v_client bigint;
begin
 for v_asset in select item_id,quantity from private.market_assets where user_id=p_user and item_id not like 'gear:%' for update loop
  v_client:=private.client_asset_quantity(p_payload,v_asset.item_id);
  if v_client<v_asset.quantity then
   if v_client=0 then delete from private.market_assets where user_id=p_user and item_id=v_asset.item_id;
   else update private.market_assets set quantity=v_client,updated_at=now() where user_id=p_user and item_id=v_asset.item_id;end if;
  end if;
 end loop;
 delete from private.market_assets a where a.user_id=p_user and a.item_id like 'gear:%'
 and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) g where g->>'id'=substr(a.item_id,6));
end;$$;

create or replace function private.server_economy_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_wallet private.player_wallets%rowtype;v_payload jsonb:=p_payload;v_materials jsonb;v_tickets jsonb;v_skillbooks jsonb;v_loot_items jsonb;v_items jsonb;
begin
 select * into v_wallet from private.player_wallets where user_id=p_user;if not found then return p_payload;end if;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_materials from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='material:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_tickets from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='ticket:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(substr(item_id,11),quantity),'{}'::jsonb) into v_skillbooks from private.market_assets where user_id=p_user and item_id like 'skillbook:%' and quantity>0;
 select coalesce(jsonb_object_agg(substr(item_id,7),quantity),'{}'::jsonb) into v_loot_items from private.market_assets where user_id=p_user and item_id like 'other:%' and quantity>0;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_items from private.market_assets where user_id=p_user and item_id like 'gear:%' and quantity=1 and gear is not null;
 v_payload:=jsonb_set(v_payload,'{silver}',to_jsonb(v_wallet.silver),true);
 v_payload:=jsonb_set(v_payload,'{market,gold}',to_jsonb(v_wallet.gold),true);
 v_payload:=jsonb_set(v_payload,'{materials}',v_materials,true);v_payload:=jsonb_set(v_payload,'{tickets}',v_tickets,true);
 v_payload:=jsonb_set(v_payload,'{skillBooks}',v_skillbooks,true);v_payload:=jsonb_set(v_payload,'{lootItems}',v_loot_items,true);v_payload:=jsonb_set(v_payload,'{items}',v_items,true);
 return v_payload;
end;$$;

create or replace function private.sync_market_economy_from_latest_save(p_user uuid)
returns bigint language plpgsql security definer set search_path=''
as $$
declare v_revision bigint;v_payload jsonb;v_exists boolean;
begin
 select revision,payload into v_revision,v_payload from public.game_saves where user_id=p_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select exists(select 1 from private.player_wallets where user_id=p_user) into v_exists;
 if not v_exists then
  insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
  values(p_user,greatest(0,coalesce((v_payload->>'silver')::bigint,0)),greatest(0,coalesce((v_payload->'market'->>'gold')::bigint,0)),v_revision,now());
  insert into private.market_assets(user_id,item_id,quantity,gear) select p_user,'gear:'||(g->>'id'),1,g from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) g where nullif(g->>'id','') is not null;
  insert into private.market_assets(user_id,item_id,quantity) select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord) where (q.value#>>'{}')::bigint>0;
  insert into private.market_assets(user_id,item_id,quantity) select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord) where (q.value#>>'{}')::bigint>0;
  insert into private.market_assets(user_id,item_id,quantity) select p_user,'skillbook:'||kv.key,(kv.value)::bigint from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv where (kv.value)::bigint>0;
  insert into private.market_assets(user_id,item_id,quantity) select p_user,'other:'||kv.key,(kv.value)::bigint from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv where (kv.value)::bigint>0;
 else update private.player_wallets set last_synced_revision=greatest(last_synced_revision,v_revision),updated_at=now() where user_id=p_user;end if;
 return v_revision;
end;$$;

create or replace function private.persist_market_economy_to_save(p_user uuid)
returns bigint language plpgsql security definer set search_path=''
as $$
declare v_current public.game_saves%rowtype;v_payload jsonb;v_hash text;v_revision bigint;
begin
 select * into v_current from public.game_saves where user_id=p_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 v_payload:=private.server_economy_payload(p_user,v_current.payload);
 v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
 insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
 values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
 on conflict on constraint game_save_versions_user_id_revision_key do nothing;
 v_revision:=v_current.revision+1;
 update public.game_saves set revision=v_revision,app_version='0.1.49',payload=v_payload,payload_hash=v_hash,updated_at=now() where user_id=p_user;
 update private.player_wallets set last_synced_revision=v_revision,updated_at=now() where user_id=p_user;
 return v_revision;
end;$$;

create or replace function private.cloud_record_json(p_user uuid)
returns jsonb language sql security definer set search_path=''
as $$select jsonb_build_object('revision',g.revision,'saveSchema',g.save_schema,'appVersion',g.app_version,'payload',g.payload,'payloadHash',g.payload_hash,'updatedAt',g.updated_at) from public.game_saves g where g.user_id=p_user$$;

create or replace function private.persist_client_payload_with_server_economy(p_user uuid,p_payload jsonb,p_app_version text default '0.1.49')
returns bigint language plpgsql security definer set search_path=''
as $$
declare v_current public.game_saves%rowtype;v_payload jsonb;v_hash text;v_revision bigint;
begin
 select * into v_current from public.game_saves where user_id=p_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 v_payload:=private.server_economy_payload(p_user,p_payload);v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
 insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
 values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
 on conflict on constraint game_save_versions_user_id_revision_key do nothing;
 v_revision:=v_current.revision+1;
 update public.game_saves set revision=v_revision,save_schema=coalesce((v_payload->>'version')::integer,v_current.save_schema),app_version=p_app_version,payload=v_payload,payload_hash=v_hash,updated_at=now() where user_id=p_user;
 update private.player_wallets set last_synced_revision=v_revision,updated_at=now() where user_id=p_user;return v_revision;
end;$$;

create or replace function public.save_game_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_base_revision bigint,p_save_schema integer,p_app_version text,p_payload jsonb,p_payload_hash text,p_device_id text)
returns table(revision bigint,updated_at timestamptz) language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_auth_session uuid;v_session_text text:=auth.jwt()->>'session_id';v_game_session private.active_game_sessions%rowtype;v_current public.game_saves%rowtype;v_revision bigint;v_updated_at timestamptz;v_payload jsonb;v_hash text;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 begin v_auth_session:=v_session_text::uuid;exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end;
 if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end if;
 select * into v_game_session from private.active_game_sessions where user_id=v_user for update;
 if not found or v_game_session.expires_at<=now() or v_game_session.lease_id<>p_lease_id or v_game_session.generation<>p_generation or v_game_session.auth_session_id<>v_auth_session or v_game_session.device_id<>p_device_id or v_game_session.client_instance_id<>p_client_instance_id then raise exception 'GAME_SESSION_LOST';end if;
 select * into v_current from public.game_saves where user_id=v_user for update;
 if not found then
  if p_base_revision<>0 then raise exception 'SAVE_CONFLICT';end if;
  v_payload:=p_payload;v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
  insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,client_saved_at) values(v_user,1,p_save_schema,p_app_version,v_payload,v_hash,p_device_id,now())
  returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
 else
  if v_current.revision<>p_base_revision then raise exception 'SAVE_CONFLICT';end if;
  perform private.accept_client_economy_consumption(v_user,p_payload);v_payload:=private.server_economy_payload(v_user,p_payload);v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
  insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at) values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at) on conflict on constraint game_save_versions_user_id_revision_key do nothing;
  update public.game_saves set revision=v_current.revision+1,save_schema=p_save_schema,app_version=p_app_version,payload=v_payload,payload_hash=v_hash,device_id=p_device_id,client_saved_at=now(),updated_at=now() where user_id=v_user returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
 end if;return query select v_revision,v_updated_at;
end;$$;

create table if not exists private.online_expeditions(
 user_id uuid primary key references auth.users(id) on delete cascade,run_id uuid not null default gen_random_uuid(),tower text not null check(tower in('ore','leather','gem','kaleon')),floor integer not null check(floor between 1 and 10),status text not null check(status in('ACTIVE','RETURNED','DEAD')),starting_revision bigint not null,revenue_share_rate integer not null default 0 check(revenue_share_rate between 0 and 30),started_at timestamptz not null default now(),settled_at timestamptz
);
alter table private.online_expeditions enable row level security;revoke all on private.online_expeditions from public,anon,authenticated;

create or replace function public.start_online_expedition(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_save public.game_saves%rowtype;v_ticket_id text;v_ticket private.market_assets%rowtype;v_rate integer:=0;v_assoc_id text;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);perform private.sync_market_economy_from_latest_save(v_user);
 if p_tower not in('ore','leather','gem','kaleon') or p_floor<1 or p_floor>10 then raise exception 'EXPEDITION_TARGET_INVALID';end if;
 select * into v_save from public.game_saves where user_id=v_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;
 if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;
 v_ticket_id:='ticket:'||p_tower||':'||p_floor::text;select * into v_ticket from private.market_assets where user_id=v_user and item_id=v_ticket_id for update;
 if not found or v_ticket.quantity<1 then raise exception 'EXPEDITION_TICKET_REQUIRED';end if;
 if v_ticket.quantity=1 then delete from private.market_assets where user_id=v_user and item_id=v_ticket_id;else update private.market_assets set quantity=quantity-1,updated_at=now() where user_id=v_user and item_id=v_ticket_id;end if;
 v_assoc_id:=v_save.payload->'association'->>'currentId';
 if v_assoc_id is not null then select greatest(0,least(30,coalesce((a->>'revenueShareRatePercent')::integer,0))) into v_rate from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE' limit 1;v_rate:=coalesce(v_rate,0);end if;
 insert into private.online_expeditions(user_id,run_id,tower,floor,status,starting_revision,revenue_share_rate,started_at,settled_at)
 values(v_user,gen_random_uuid(),p_tower,p_floor,'ACTIVE',v_save.revision,v_rate,now(),null)
 on conflict(user_id) do update set run_id=excluded.run_id,tower=excluded.tower,floor=excluded.floor,status='ACTIVE',starting_revision=excluded.starting_revision,revenue_share_rate=excluded.revenue_share_rate,started_at=excluded.started_at,settled_at=null;
 perform private.persist_market_economy_to_save(v_user);return private.cloud_record_json(v_user);
end;$$;

create or replace function public.settle_online_expedition(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_client_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_receipt jsonb;v_loot jsonb;v_outcome text;v_tower text;v_floor integer;v_kills bigint;v_gross_silver bigint;v_max_silver bigint;v_net_silver bigint;v_share bigint;v_material_q bigint;v_material_cap bigint;v_ticket_q bigint;v_tower_key text;v_i integer;v_q bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if jsonb_typeof(p_client_payload->'expedition') is distinct from 'null' then raise exception 'EXPEDITION_SETTLEMENT_PAYLOAD_INVALID';end if;
 v_receipt:=p_client_payload->'lastExpedition';if jsonb_typeof(v_receipt)<>'object' then raise exception 'EXPEDITION_RECEIPT_REQUIRED';end if;
 v_outcome:=v_receipt->>'outcome';v_tower:=v_receipt->>'tower';begin v_floor:=(v_receipt->>'floor')::integer;exception when others then raise exception 'EXPEDITION_RECEIPT_INVALID';end;begin v_kills:=(v_receipt->>'kills')::bigint;exception when others then raise exception 'EXPEDITION_RECEIPT_INVALID';end;
 if v_outcome not in('returned','dead') or v_tower<>v_run.tower or v_floor<>v_run.floor or v_kills<0 or v_kills>5000 then raise exception 'EXPEDITION_RECEIPT_INVALID';end if;
 v_loot:=v_receipt->'loot';if jsonb_typeof(v_loot)<>'object' then raise exception 'EXPEDITION_LOOT_INVALID';end if;
 if v_outcome='returned' then
  begin v_gross_silver:=(v_loot->>'silver')::bigint;exception when others then raise exception 'EXPEDITION_LOOT_INVALID';end;if v_gross_silver<0 then raise exception 'EXPEDITION_LOOT_INVALID';end if;
  v_max_silver:=v_kills*((10+v_floor*3)+50);if v_gross_silver>v_max_silver then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;
  v_material_cap:=v_kills*(2+5+(6+v_floor*2));
  for v_tower_key in select jsonb_object_keys(coalesce(v_loot->'materials','{}'::jsonb)) loop
   if jsonb_typeof(v_loot->'materials'->v_tower_key)<>'array' then raise exception 'EXPEDITION_LOOT_INVALID';end if;
   for v_i in 0..jsonb_array_length(v_loot->'materials'->v_tower_key)-1 loop begin v_q:=((v_loot->'materials'->v_tower_key)->>v_i)::bigint;exception when others then raise exception 'EXPEDITION_LOOT_INVALID';end;if v_q<0 then raise exception 'EXPEDITION_LOOT_INVALID';end if;if v_tower_key=v_run.tower and v_i=0 then v_material_q:=v_q;if v_q>v_material_cap then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;elsif v_q<>0 then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;end loop;
  end loop;
  for v_tower_key in select jsonb_object_keys(coalesce(v_loot->'tickets','{}'::jsonb)) loop
   if jsonb_typeof(v_loot->'tickets'->v_tower_key)<>'array' then raise exception 'EXPEDITION_LOOT_INVALID';end if;
   for v_i in 0..jsonb_array_length(v_loot->'tickets'->v_tower_key)-1 loop begin v_q:=((v_loot->'tickets'->v_tower_key)->>v_i)::bigint;exception when others then raise exception 'EXPEDITION_LOOT_INVALID';end;if v_q<0 then raise exception 'EXPEDITION_LOOT_INVALID';end if;if v_tower_key=v_run.tower and v_run.floor<10 and v_i=v_run.floor then v_ticket_q:=v_q;if v_q>v_kills then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;elsif v_q<>0 then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;end loop;
  end loop;
  if coalesce((select sum((value)::bigint) from jsonb_each_text(coalesce(v_loot->'skillBooks','{}'::jsonb))),0)<>0 or coalesce((select sum((value)::bigint) from jsonb_each_text(coalesce(v_loot->'items','{}'::jsonb))),0)<>0 then raise exception 'EXPEDITION_LOOT_EXCEEDS_SERVER_CAP';end if;
  v_share:=floor(v_gross_silver*v_run.revenue_share_rate/100.0);v_net_silver:=v_gross_silver-v_share;update private.player_wallets set silver=silver+v_net_silver,updated_at=now() where user_id=v_user;
  if coalesce(v_material_q,0)>0 then insert into private.market_assets(user_id,item_id,quantity,updated_at) values(v_user,'material:'||v_run.tower||':1',v_material_q,now()) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
  if coalesce(v_ticket_q,0)>0 then insert into private.market_assets(user_id,item_id,quantity,updated_at) values(v_user,'ticket:'||v_run.tower||':'||(v_run.floor+1)::text,v_ticket_q,now()) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
  update private.online_expeditions set status='RETURNED',settled_at=now() where user_id=v_user;
 else update private.online_expeditions set status='DEAD',settled_at=now() where user_id=v_user;end if;
 perform private.persist_client_payload_with_server_economy(v_user,p_client_payload,'0.1.49');return private.cloud_record_json(v_user);
end;$$;

revoke all on function private.client_asset_quantity(jsonb,text) from public,anon,authenticated;
revoke all on function private.accept_client_economy_consumption(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.server_economy_payload(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.cloud_record_json(uuid) from public,anon,authenticated;
revoke all on function private.persist_client_payload_with_server_economy(uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) from public,anon;
revoke all on function public.start_online_expedition(uuid,bigint,text,text,text,integer) from public,anon;
revoke all on function public.settle_online_expedition(uuid,bigint,text,text,jsonb) from public,anon;
grant execute on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) to authenticated;
grant execute on function public.start_online_expedition(uuid,bigint,text,text,text,integer) to authenticated;
grant execute on function public.settle_online_expedition(uuid,bigint,text,text,jsonb) to authenticated;
