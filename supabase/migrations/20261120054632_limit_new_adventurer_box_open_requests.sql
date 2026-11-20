create table private.box_open_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 attempts timestamptz[] not null
);
alter table private.box_open_limits enable row level security;
revoke all on private.box_open_limits from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_adventurer_boxes(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid; previous private.adventurer_box_receipts%rowtype;
 recent timestamptz[];
 checked_at timestamptz;
 gear jsonb; rewards jsonb:='[]'::jsonb; gear_id text; kind text; grade text;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 u:=auth.uid();
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_request_id is null or p_quantity is null or p_quantity not between 1 and 10 then raise exception 'BOX_COUNT_INVALID';end if;
 -- Serialize admission for this account before taking the shared economy lock.
 perform pg_advisory_xact_lock(hashtextextended('box-admission:'||u::text,0));
 if not exists(select 1 from private.adventurer_box_receipts where user_id=u and request_id=p_request_id) then
  checked_at:=clock_timestamp();
  select array(select stamp from unnest(l.attempts) stamp
               where stamp > checked_at - interval '60 seconds' order by stamp)
  into recent from private.box_open_limits l where l.user_id=u;
  if cardinality(recent)>=30 then
   raise exception 'BOX_RATE_LIMITED' using errcode='PT429';
  end if;
  insert into private.box_open_limits(user_id,attempts)
  values(u,array_append(coalesce(recent,'{}'::timestamptz[]),checked_at))
  on conflict(user_id) do update set attempts=excluded.attempts;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is null or u<>auth.uid() then raise exception 'AUTH_REQUIRED';end if;
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into previous from private.adventurer_box_receipts where user_id=u and request_id=p_request_id;
 if found then
  if previous.quantity<>p_quantity then raise exception 'BOX_REQUEST_CONFLICT';end if;
  perform private.refresh_village_life(u);
  return jsonb_build_object('replayed',true,'rewards',previous.rewards,'state',private.village_life_snapshot(u),'record',private.cloud_record_json(u));
 end if;
 begin
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'BOX_EXPEDITION_BLOCKED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform private.refresh_village_life(u);
 update private.village_life_players set products=jsonb_set(products,array['adventurer_box'],
  to_jsonb(coalesce((products->>'adventurer_box')::bigint,0)-p_quantity),true)
 where user_id=u and coalesce((products->>'adventurer_box')::bigint,0)>=p_quantity;
 if not found then raise exception 'BOX_INSUFFICIENT';end if;
 for i in 1..p_quantity loop
  gear_id:=gen_random_uuid()::text;
  kind:=kinds[1+floor(private.job_registration_secure_unit()*9)::integer];
  grade:=private.adventurer_box_grade(floor(private.job_registration_secure_unit()*1000)::integer);
  gear:=jsonb_build_object('id',gear_id,'kind',kind,'grade',grade,'enhancement',0);
  insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||gear_id,1,gear);
  rewards:=rewards||jsonb_build_array(gear);
 end loop;
 insert into private.adventurer_box_receipts(user_id,request_id,quantity,rewards) values(u,p_request_id,p_quantity,rewards);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('replayed',false,'rewards',rewards,'state',private.village_life_snapshot(u),'record',private.cloud_record_json(u));
 exception when raise_exception then
  -- Roll back gameplay changes while retaining admission for rejected attempts.
  if sqlerrm not in ('BOX_INSUFFICIENT','BOX_EXPEDITION_BLOCKED') then raise;end if;
  perform set_config('response.status','400',true);
  return jsonb_build_object('code','P0001','message',sqlerrm,'details',null,'hint',null);
 end;
end
$function$;

