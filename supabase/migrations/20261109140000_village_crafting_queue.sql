-- Three-slot, offline-safe crafting queue. Only server RPCs can read/mutate jobs.
create table private.village_craft_queue (
 user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null,
 town_id text not null,
 item text not null check (item in ('potion','attack_food','defense_food','experience_food','challenge_ticket')),
 material text not null,
 mastery_track text not null check (mastery_track in ('herb','farm','ticket')),
 craft_count integer not null check (craft_count between 1 and 100),
 material_cost integer not null check (material_cost between 10 and 1000),
 vitality_cost integer not null check (vitality_cost between 1 and 100),
 quantity bigint not null check (quantity > 0),
 duration_seconds integer not null check (duration_seconds > 0),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'ACTIVE' check (status in ('ACTIVE','CLAIMED','CANCELLED')),
 created_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz,
 primary key (user_id,job_id),
 check (ends_at > starts_at)
);
create index village_craft_queue_active on private.village_craft_queue(user_id,starts_at,ends_at) where status='ACTIVE';
alter table private.village_craft_queue enable row level security;
revoke all on private.village_craft_queue from public,anon,authenticated;
-- No direct Data API access to this private table.

create function private.village_craft_queue_snapshot(p_user uuid) returns jsonb
language sql set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',q.job_id,'item',q.item,'count',q.craft_count,'quantity',q.quantity,
  'startsAt',(extract(epoch from q.starts_at)*1000)::bigint,
  'endsAt',(extract(epoch from q.ends_at)*1000)::bigint,
  'durationSeconds',q.duration_seconds,
  'status',case when clock_timestamp()>=q.ends_at then 'complete'
                when clock_timestamp()>=q.starts_at then 'crafting' else 'waiting' end
 ) order by q.starts_at,q.created_at,q.job_id),'[]'::jsonb)
 from private.village_craft_queue q where q.user_id=p_user and q.status='ACTIVE';
$$;
revoke all on function private.village_craft_queue_snapshot(uuid) from public,anon,authenticated;

create function public.get_village_craft_queue(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return jsonb_build_object('jobs',private.village_craft_queue_snapshot(u),'serverNow',(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;
revoke all on function public.get_village_craft_queue(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_village_craft_queue(uuid,bigint,text,text) to authenticated;

create function public.enqueue_village_craft(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_town_id text,p_item text,p_count integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;s private.village_life_players%rowtype;old private.village_craft_queue%rowtype;
 v_kind text;v_track text;v_material text;v_base integer;v_carry integer;
 v_bonus integer;v_mastery bigint;v_qty bigint:=0;v_start timestamptz;
 v_duration integer;v_now timestamptz:=clock_timestamp();i integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_item is null or p_item not in ('potion','attack_food','defense_food','experience_food','challenge_ticket') then raise exception 'RECIPE_INVALID';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 perform private.refresh_hunting_state(u);
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u for update;
 select * into old from private.village_craft_queue where user_id=u and job_id=p_request_id;
 if found then
  if old.town_id is distinct from p_town_id or old.item<>p_item or old.craft_count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'queue',private.village_craft_queue_snapshot(u),
    'result',jsonb_build_object('action','craft','item',old.item,'count',old.craft_count,'quantity',old.quantity,'queued',true),'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 select t.kind into v_kind from private.village_life_towns t where t.id=s.location and t.is_active;
 if v_kind is null then raise exception 'TOWN_INVALID';end if;
 v_track:=case when p_item='potion' then 'herb' when p_item='challenge_ticket' then 'ticket' else 'farm' end;
 if v_kind<>'city' and v_kind<>case when p_item='potion' then 'herb' when p_item='challenge_ticket' then 'city' else 'farm' end then raise exception 'RECIPE_LOCATION';end if;
 if (select count(*) from private.village_craft_queue where user_id=u and status='ACTIVE')>=3 then raise exception 'CRAFT_QUEUE_FULL';end if;
 if (select vitality from private.hunting_states where user_id=u)<p_count then raise exception 'VITALITY_EMPTY';end if;
 v_material:=case p_item when 'potion' then 'herb' when 'attack_food' then 'pepper' when 'defense_food' then 'potato' when 'experience_food' then 'wheat' else 'stone' end;
 if coalesce((s.materials->>v_material)::bigint,0)<p_count*10 then raise exception 'MATERIALS_EMPTY';end if;
 v_base:=case when p_item='potion' then 1000 else 1 end;
 v_carry:=coalesce((s.craft_carry->>p_item)::integer,0);
 select coalesce(sum(q.craft_count),0)::bigint into v_mastery
 from private.village_craft_queue q where q.user_id=u and q.status='ACTIVE' and q.mastery_track=v_track;
 v_mastery:=coalesce((s.life_masteries->>v_track)::bigint,0)+v_mastery;
 for i in 1..p_count loop
  v_bonus:=private.life_mastery_bonus(least(3200,v_mastery));
  v_carry:=v_carry+v_base*v_bonus;
  v_qty:=v_qty+v_base+(v_carry/100);
  v_carry:=v_carry%100;
  v_mastery:=v_mastery+1;
 end loop;
 v_duration:=(case when p_item='potion' then 180 when p_item='challenge_ticket' then 1200 else 300 end)*p_count;
 select greatest(v_now,coalesce(max(q.ends_at),v_now)) into v_start
 from private.village_craft_queue q where q.user_id=u and q.status='ACTIVE' and q.ends_at>v_now;
 insert into private.village_craft_queue(user_id,job_id,town_id,item,material,mastery_track,craft_count,material_cost,vitality_cost,quantity,duration_seconds,starts_at,ends_at)
 values(u,p_request_id,p_town_id,p_item,v_material,v_track,p_count,p_count*10,p_count,v_qty,v_duration,v_start,v_start+make_interval(secs=>v_duration));
 update private.village_life_players set
  materials=jsonb_set(materials,array[v_material],to_jsonb((materials->>v_material)::bigint-p_count*10),true),
  craft_carry=jsonb_set(craft_carry,array[p_item],to_jsonb(v_carry),true)
 where user_id=u;
 update private.hunting_states set vitality=vitality-p_count where user_id=u;
 return jsonb_build_object('state',private.village_life_snapshot(u),'queue',private.village_craft_queue_snapshot(u),
  'result',jsonb_build_object('action','craft','item',p_item,'count',p_count,'quantity',v_qty,'vitalitySpent',p_count,'queued',true),'replayed',false);
end $$;
revoke all on function public.enqueue_village_craft(uuid,bigint,text,text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.enqueue_village_craft(uuid,bigint,text,text,uuid,text,text,integer) to authenticated;

create function public.claim_village_craft(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_job_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;j private.village_craft_queue%rowtype;v_replayed boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_job_id is null then raise exception 'CRAFT_JOB_NOT_FOUND';end if;
 perform private.refresh_village_life(u);
 select * into j from private.village_craft_queue where user_id=u and job_id=p_job_id for update;
 if not found then raise exception 'CRAFT_JOB_NOT_FOUND';end if;
 if j.status='CANCELLED' then raise exception 'CRAFT_JOB_CANCELLED';end if;
 if j.status='CLAIMED' then
  v_replayed:=true;
 else
  if clock_timestamp()<j.ends_at then raise exception 'CRAFT_NOT_READY';end if;
  update private.village_life_players set
   products=jsonb_set(products,array[j.item],to_jsonb(coalesce((products->>j.item)::bigint,0)+j.quantity),true),
   life_masteries=jsonb_set(life_masteries,array[j.mastery_track],to_jsonb(least(3200,coalesce((life_masteries->>j.mastery_track)::bigint,0)+j.craft_count)),true),
   craft_mastery=craft_mastery+j.craft_count
  where user_id=u;
  update private.village_craft_queue set status='CLAIMED',resolved_at=clock_timestamp() where user_id=u and job_id=p_job_id;
 end if;
 return jsonb_build_object('state',private.village_life_snapshot(u),'queue',private.village_craft_queue_snapshot(u),
  'result',jsonb_build_object('item',j.item,'quantity',j.quantity,'count',j.craft_count),'replayed',v_replayed);
end $$;
revoke all on function public.claim_village_craft(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_village_craft(uuid,bigint,text,text,uuid) to authenticated;

create function public.cancel_village_craft(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_job_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;j private.village_craft_queue%rowtype;future private.village_craft_queue%rowtype;
 v_cursor timestamptz;v_now timestamptz:=clock_timestamp();v_replayed boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_job_id is null then raise exception 'CRAFT_JOB_NOT_FOUND';end if;
 perform private.refresh_hunting_state(u);
 perform private.refresh_village_life(u);
 select * into j from private.village_craft_queue where user_id=u and job_id=p_job_id for update;
 if not found then raise exception 'CRAFT_JOB_NOT_FOUND';end if;
 if j.status='CLAIMED' then raise exception 'CRAFT_ALREADY_CLAIMED';end if;
 if j.status='CANCELLED' then
  v_replayed:=true;
 else
  if v_now>=j.ends_at then raise exception 'CRAFT_ALREADY_COMPLETE';end if;
  update private.village_life_players
    set materials=jsonb_set(materials,array[j.material],to_jsonb(coalesce((materials->>j.material)::bigint,0)+j.material_cost),true)
  where user_id=u;
  update private.hunting_states set vitality=least(1000,vitality+j.vitality_cost) where user_id=u;
  update private.village_craft_queue set status='CANCELLED',resolved_at=v_now where user_id=u and job_id=p_job_id;
  v_cursor:=v_now;
  for future in select * from private.village_craft_queue
                where user_id=u and status='ACTIVE' and ends_at>v_now
                order by starts_at,created_at,job_id for update loop
   if future.starts_at<=v_now then
    v_cursor:=greatest(v_cursor,future.ends_at);
   else
    update private.village_craft_queue
     set starts_at=v_cursor,ends_at=v_cursor+make_interval(secs=>future.duration_seconds)
     where user_id=u and job_id=future.job_id;
    v_cursor:=v_cursor+make_interval(secs=>future.duration_seconds);
   end if;
  end loop;
 end if;
 return jsonb_build_object('state',private.village_life_snapshot(u),'queue',private.village_craft_queue_snapshot(u),
  'result',jsonb_build_object('item',j.item,'count',j.craft_count,'cancelled',true),'replayed',v_replayed);
end $$;
revoke all on function public.cancel_village_craft(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.cancel_village_craft(uuid,bigint,text,text,uuid) to authenticated;

-- Disable the previous instant-craft path, preserving well and food RPC behavior.
do $$
declare v_definition text;v_target text:='if p_action=''craft'' then';
begin
 v_definition:=pg_get_functiondef('public.village_life_action(uuid,bigint,text,text,uuid,text,text,text,integer)'::regprocedure);
 if position('CRAFT_QUEUE_REQUIRED' in v_definition)=0 then
  if position(v_target in v_definition)=0 then raise exception 'CRAFT_MIGRATION_SOURCE_CHANGED';end if;
  execute replace(v_definition,v_target,'if p_action=''craft'' then raise exception ''CRAFT_QUEUE_REQUIRED''; end if; '||v_target);
 end if;
end $$;
