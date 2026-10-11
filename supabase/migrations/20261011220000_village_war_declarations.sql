-- Village war declarations: guild leader spends 100 crafted challenge tickets for one town per week.
-- This is the declaration/registration phase only. Five-front battles are a separate release.
create table if not exists private.village_war_declarations (
 cycle_key date not null,
 town_id text not null references private.village_life_towns(id),
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 declared_by uuid not null references auth.users(id),
 declared_at timestamptz not null default now(),
 primary key(cycle_key,town_id,association_id)
);
create index if not exists village_war_declarations_guild_week_idx on private.village_war_declarations(association_id,cycle_key);
alter table private.village_war_declarations enable row level security;
revoke all on private.village_war_declarations from public,anon,authenticated;

create table if not exists private.village_war_declaration_receipts (
 user_id uuid not null references auth.users(id),
 request_id uuid not null,
 cycle_key date not null,
 town_id text not null,
 association_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.village_war_declaration_receipts enable row level security;
revoke all on private.village_war_declaration_receipts from public,anon,authenticated;

create or replace function public.get_village_war_declarations(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;
 w jsonb;
 cycle date;
 aid uuid;
 my_role text;
 tickets bigint := 0;
 items jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 w:=private.occupation_window(clock_timestamp());
 cycle:=(w->>'cycleKey')::date;
 select m.association_id,m.role into aid,my_role
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u limit 1;
 select coalesce((l.products->>'challenge_ticket')::bigint,0) into tickets
 from private.village_life_players l where l.user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object(
   'townId',d.town_id,
   'associationId',d.association_id,
   'associationName',a.name
 ) order by d.town_id,d.declared_at), '[]'::jsonb) into items
 from private.village_war_declarations d
 join private.online_associations a on a.association_id=d.association_id
 where d.cycle_key=cycle;
 return jsonb_build_object(
   'cycleKey',w->>'cycleKey','phase',w->>'phase',
   'bidClosesAt',w->>'bidClosesAt','battleStartsAt',w->>'battleStartsAt',
   'myAssociationId',aid,'myRole',my_role,
   'tickets',coalesce(tickets,0),'declarations',items);
end;
$$;
revoke all on function public.get_village_war_declarations(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_village_war_declarations(uuid,bigint,text,text) to authenticated;

create or replace function public.declare_village_war(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_town_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;
 w jsonb;
 cycle date;
 aid uuid;
 my_role text;
 existing private.village_war_declaration_receipts%rowtype;
 affected int;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_town_id is null then raise exception 'WAR_REQUEST_INVALID';end if;
 select m.association_id,m.role into aid,my_role
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=u limit 1;
 if aid is null then raise exception 'WAR_GUILD_REQUIRED';end if;
 if my_role<>'LEADER' then raise exception 'WAR_LEADER_REQUIRED';end if;
 -- Serialize a guild's declarations before debiting a leader's ticket balance.
 perform 1 from private.online_associations a where a.association_id=aid for update;
 select * into existing from private.village_war_declaration_receipts r
 where r.user_id=u and r.request_id=p_request_id;
 if found then
   if existing.town_id<>p_town_id or existing.association_id<>aid then
     raise exception 'WAR_REQUEST_CONFLICT';
   end if;
   return jsonb_build_object('replayed',true,'state',
     public.get_village_war_declarations(p_lease_id,p_generation,p_client_instance_id,p_device_id));
 end if;
 w:=private.occupation_window(clock_timestamp());
 if w->>'phase'<>'BIDDING' then raise exception 'WAR_DECLARATION_CLOSED';end if;
 cycle:=(w->>'cycleKey')::date;
 if not exists(select 1 from private.village_life_towns t where t.id=p_town_id) then
   raise exception 'WAR_TOWN_INVALID';
 end if;
 if exists(select 1 from private.village_war_declarations d
  where d.cycle_key=cycle and d.town_id=p_town_id and d.association_id=aid) then
  raise exception 'WAR_ALREADY_DECLARED';
 end if;
 update private.village_life_players l set
   products=jsonb_set(l.products,'{challenge_ticket}',
      to_jsonb(((l.products->>'challenge_ticket')::bigint-100)),true)
 where l.user_id=u and coalesce((l.products->>'challenge_ticket')::bigint,0)>=100;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'WAR_TICKETS_SHORT';end if;
 insert into private.village_war_declarations(cycle_key,town_id,association_id,declared_by)
 values(cycle,p_town_id,aid,u);
 insert into private.village_war_declaration_receipts(user_id,request_id,cycle_key,town_id,association_id)
 values(u,p_request_id,cycle,p_town_id,aid);
 return jsonb_build_object('replayed',false,'state',
   public.get_village_war_declarations(p_lease_id,p_generation,p_client_instance_id,p_device_id));
end;
$$;
revoke all on function public.declare_village_war(uuid,bigint,text,text,uuid,text) from public,anon;
grant execute on function public.declare_village_war(uuid,bigint,text,text,uuid,text) to authenticated;
