-- Independent, server-owned life inventory; never trusts the legacy client save.
create table private.village_life_towns (
 id text primary key,name text not null,kind text not null check(kind in ('herb','farm','city')),
 x integer not null check(x between 0 and 4),y integer not null check(y between 0 and 4),
 herb_capacity integer not null default 0 check(herb_capacity>=0),farm_capacity integer not null default 0 check(farm_capacity>=0),
 herb_remaining integer not null default 0 check(herb_remaining between 0 and herb_capacity),
 farm_remaining integer not null default 0 check(farm_remaining between 0 and farm_capacity),
 day date not null default (now() at time zone 'Asia/Seoul')::date
);
insert into private.village_life_towns(id,name,kind,x,y,herb_capacity,farm_capacity,herb_remaining,farm_remaining) values
 ('herb-1','달그늘','herb',1,0,30000,0,30000,0),('farm-1','황금들','farm',3,0,0,30000,0,30000),
 ('farm-2','보리뜰','farm',0,1,0,30000,0,30000),('herb-2','이슬숲','herb',2,1,30000,0,30000,0),
 ('herb-3','안개골','herb',4,1,30000,0,30000,0),('city','노바르','city',2,2,30000,30000,30000,30000),
 ('herb-4','은잎골','herb',0,3,30000,0,30000,0),('farm-3','해오름','farm',2,3,0,30000,0,30000),
 ('farm-4','풍요뜰','farm',4,3,0,30000,0,30000),('farm-5','밀바람','farm',1,4,0,30000,0,30000),
 ('herb-5','초록샘','herb',3,4,30000,0,30000,0);
create table private.village_life_players (
 user_id uuid primary key references auth.users(id) on delete cascade,
 location text not null default 'city' references private.village_life_towns(id),
 action_points integer not null default 100 check(action_points between 0 and 100),
 day date not null default (now() at time zone 'Asia/Seoul')::date,
 materials jsonb not null default '{"herb":0,"pepper":0,"potato":0,"wheat":0}'
);
create table private.village_life_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 town_id text not null references private.village_life_towns(id),resource text not null,count integer not null,
 result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table private.village_life_towns enable row level security;
alter table private.village_life_players enable row level security;
alter table private.village_life_receipts enable row level security;
revoke all on private.village_life_towns,private.village_life_players,private.village_life_receipts from public,anon,authenticated;

create function private.refresh_village_life(u uuid) returns void language plpgsql set search_path='' as $$
declare today date;
begin
 insert into private.village_life_players(user_id) values(u) on conflict(user_id) do nothing;
 perform 1 from private.village_life_players where user_id=u for update;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 update private.village_life_players set action_points=100,day=today where user_id=u and day<today;
end $$;
create function private.village_life_snapshot(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;s private.village_life_players%rowtype;towns jsonb;
begin
 select * into strict s from private.village_life_players where user_id=u;
 select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'x',t.x,'y',t.y,'owner','중립','tax',0,
 'herbCapacity',t.herb_capacity,'farmCapacity',t.farm_capacity,
 'herbRemaining',case when t.day<today then t.herb_capacity else t.herb_remaining end,
 'farmRemaining',case when t.day<today then t.farm_capacity else t.farm_remaining end) order by t.y,t.x) into towns from private.village_life_towns t;
 return jsonb_build_object('location',s.location,'actionPoints',case when s.day<today then 100 else s.action_points end,'materials',s.materials,'towns',towns,
 'serverNow',extract(epoch from clock_timestamp())*1000,'nextResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000);
end $$;
revoke all on function private.refresh_village_life(uuid),private.village_life_snapshot(uuid) from public,anon,authenticated;

create function private.village_life_user(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns uuid language plpgsql set search_path='' as $$
begin
 if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception 'GAME_SESSION_LOST';end if;
 return private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end $$;
revoke all on function private.village_life_user(uuid,bigint,text,text) from public,anon,authenticated;

create function public.get_village_life(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.refresh_village_life(u);
 return private.village_life_snapshot(u);
end $$;
create function public.travel_village(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_town_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_town_id is null or not exists(select 1 from private.village_life_towns where id=p_town_id) then raise exception 'TOWN_INVALID';end if;
 perform private.refresh_village_life(u);
 update private.village_life_players set location=p_town_id where user_id=u;
 return private.village_life_snapshot(u);
end $$;
create function public.gather_village(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_resource text,p_count integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s private.village_life_players%rowtype;t private.village_life_towns%rowtype;r private.village_life_receipts%rowtype;
 today date;gains jsonb:='{}';m jsonb;item text;i integer;total integer;result jsonb;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 if p_resource is null or p_resource not in ('herb','farm') then raise exception 'RESOURCE_INVALID';end if;
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u;
 select * into r from private.village_life_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.town_id is distinct from p_town_id or r.resource<>p_resource or r.count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'result',r.result,'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 select * into t from private.village_life_towns where id=p_town_id for update;
 if not found then raise exception 'TOWN_INVALID';end if;
 if t.kind<>p_resource and t.kind<>'city' then raise exception 'RESOURCE_INVALID';end if;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 if t.day<today then t.herb_remaining:=t.herb_capacity;t.farm_remaining:=t.farm_capacity;t.day:=today;end if;
 -- Re-evaluate the player date after waiting for shared town stock across midnight.
 if s.day<today then s.action_points:=100;s.day:=today;end if;
 if s.action_points<p_count then raise exception 'ACTION_POINTS_EMPTY';end if;
 total:=p_count*10;
 if (p_resource='herb' and t.herb_remaining<total) or (p_resource='farm' and t.farm_remaining<total) then raise exception 'TOWN_STOCK_EMPTY';end if;
 m:=s.materials;
 for i in 1..p_count loop
  item:=case when p_resource='herb' then 'herb' else (array['pepper','potato','wheat'])[floor(random()*3)::integer+1] end;
  gains:=jsonb_set(gains,array[item],to_jsonb(coalesce((gains->>item)::bigint,0)+10),true);
  m:=jsonb_set(m,array[item],to_jsonb(coalesce((m->>item)::bigint,0)+10),true);
 end loop;
 update private.village_life_players set action_points=s.action_points-p_count,materials=m,day=s.day where user_id=u;
 update private.village_life_towns set day=t.day,herb_remaining=t.herb_remaining-case when p_resource='herb' then total else 0 end,
 farm_remaining=t.farm_remaining-case when p_resource='farm' then total else 0 end where id=p_town_id;
 result:=jsonb_build_object('townId',p_town_id,'resource',p_resource,'count',p_count,'actionPointsSpent',p_count,'gains',gains);
 insert into private.village_life_receipts(user_id,request_id,town_id,resource,count,result) values(u,p_request_id,p_town_id,p_resource,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $$;
revoke all on function public.get_village_life(uuid,bigint,text,text),public.travel_village(uuid,bigint,text,text,text),public.gather_village(uuid,bigint,text,text,uuid,text,text,integer) from public,anon;
grant execute on function public.get_village_life(uuid,bigint,text,text),public.travel_village(uuid,bigint,text,text,text),public.gather_village(uuid,bigint,text,text,uuid,text,text,integer) to authenticated;
