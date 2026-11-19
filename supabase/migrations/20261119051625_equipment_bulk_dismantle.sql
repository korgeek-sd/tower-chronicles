create table if not exists private.equipment_bulk_dismantle_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 item_ids text[] not null,
 split_stones bigint not null check(split_stones>0),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.equipment_bulk_dismantle_receipts enable row level security;
revoke all on private.equipment_bulk_dismantle_receipts from public,anon,authenticated;

create or replace function public.dismantle_online_equipment_batch(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_item_ids text[]
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
 u uuid; v_save public.game_saves%rowtype;
 v_ids text[]; v_count integer; v_valid integer; v_stones bigint; v_deleted integer;
 v_receipt private.equipment_bulk_dismantle_receipts%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is null or u<>auth.uid() then raise exception 'AUTH_REQUIRED';end if;
 if p_request_id is null or p_item_ids is null or cardinality(p_item_ids) not between 1 and 10000
 or exists(select 1 from unnest(p_item_ids) as x(id) where id is null or length(id) not between 1 and 128) then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;
 select array_agg(distinct id order by id) into v_ids from unnest(p_item_ids) as x(id);
 v_count:=cardinality(v_ids);
 if v_count<>cardinality(p_item_ids) then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;
 select * into v_save from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into v_receipt from private.equipment_bulk_dismantle_receipts where user_id=u and request_id=p_request_id;
 if found then
  if v_receipt.item_ids is distinct from v_ids then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;
  return jsonb_build_object('count',v_count,'splitStones',v_receipt.split_stones,'record',private.cloud_record_json(u),'state',private.village_life_snapshot(u),'replayed',true);
 end if;
 if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'DISMANTLE_EXPEDITION_BLOCKED';end if;
 if 'starter-v2'=any(v_ids) then raise exception 'DISMANTLE_STARTER_PROTECTED';end if;
 if exists(select 1 from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) e where e.value=any(v_ids)) then raise exception 'DISMANTLE_EQUIPPED';end if;
 select count(*),coalesce(sum(case a.gear->>'grade' when 'common' then 1 when 'uncommon' then 2 when 'rare' then 4 when 'heroic' then 8 when 'legendary' then 15 else 0 end),0) into v_valid,v_stones
 from (select gear from private.market_assets where user_id=u and item_id in (select 'equipment_v2:'||id from unnest(v_ids) x(id)) and quantity=1 and gear is not null and gear->>'grade' in ('common','uncommon','rare','heroic','legendary') for update) a;
 if v_valid<>v_count then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;
 delete from private.market_assets where user_id=u and item_id in (select 'equipment_v2:'||id from unnest(v_ids) x(id));
 get diagnostics v_deleted=row_count;
 if v_deleted<>v_count then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;
 perform private.persist_market_economy_to_save(u);
 perform private.refresh_village_life(u);
 update private.village_life_players set materials=jsonb_set(materials,'{stone}',to_jsonb(coalesce((materials->>'stone')::bigint,0)+v_stones),true) where user_id=u;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 insert into private.equipment_bulk_dismantle_receipts(user_id,request_id,item_ids,split_stones) values(u,p_request_id,v_ids,v_stones);
 return jsonb_build_object('count',v_count,'splitStones',v_stones,'record',private.cloud_record_json(u),'state',private.village_life_snapshot(u),'replayed',false);
end;$function$;
revoke all on function public.dismantle_online_equipment_batch(uuid,bigint,text,text,uuid,text[]) from public,anon;
grant execute on function public.dismantle_online_equipment_batch(uuid,bigint,text,text,uuid,text[]) to authenticated;
