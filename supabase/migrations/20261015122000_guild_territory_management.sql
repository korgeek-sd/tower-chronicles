-- Guild territory operations: authoritative 11-town ownership, actual tax yield,
-- and previous concluded wars. No synthetic gains or ownership are created.
create index if not exists guild_material_tax_town_daily_idx
  on private.guild_material_ledger(association_id,town_id,created_at desc)
  where operation='GATHER_TAX';

create or replace function private.guild_territory_state_json(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_guild uuid;
 v_leader boolean;
 v_now timestamptz:=clock_timestamp();
 v_today timestamptz;
 v_week timestamptz;
 v_towns jsonb;
 v_history jsonb;
 v_today_total bigint:=0;
 v_week_total bigint:=0;
 v_stock_total bigint:=0;
 v_owned_count integer:=0;
 v_total_count integer:=0;
begin
 select m.association_id, (m.role='LEADER' and a.leader_user_id=p_user and a.status='ACTIVE')
 into v_guild,v_leader
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=p_user and a.status='ACTIVE';
 if v_guild is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;

 v_today:=(date_trunc('day',v_now at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
 v_week:=v_today-interval '6 days';

 select count(*),count(*) filter (where o.association_id=v_guild)
 into v_total_count,v_owned_count
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id;

 select coalesce(sum(e.amount) filter (where e.created_at>=v_today),0),
        coalesce(sum(e.amount) filter (where e.created_at>=v_week),0)
 into v_today_total,v_week_total
 from private.guild_material_ledger e
 where e.association_id=v_guild and e.operation='GATHER_TAX' and e.created_at>=v_week;

 select coalesce(sum(quantity),0) into v_stock_total
 from private.guild_material_stock where association_id=v_guild;

 select coalesce(jsonb_agg(jsonb_build_object(
  'townId',t.id,'name',t.name,'kind',t.kind,
  'ownerAssociationId',case when a.status='ACTIVE' then o.association_id else null end,
  'ownerName',coalesce(case when a.status='ACTIVE' then a.name end,'중립'),
  'owned',o.association_id=v_guild,
  'occupiedAt',o.occupied_at,
  'rate',case when o.association_id is null or a.status<>'ACTIVE' then 0
     when rate.owner_association_id=o.association_id then rate.tax_rate else 10 end,
  'changedAt',case when rate.owner_association_id=o.association_id then rate.changed_at else null end,
  'todayTax',coalesce(y.today_tax,0),
  'weekTax',coalesce(y.week_tax,0),
  'todayMaterials',coalesce(y.today_materials,'{}'::jsonb),
  'weekMaterials',coalesce(y.week_materials,'{}'::jsonb)
 ) order by t.y,t.x),'[]'::jsonb)
 into v_towns
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id
 left join private.online_associations a on a.association_id=o.association_id
 left join private.guild_village_tax rate on rate.town_id=t.id
 left join lateral (
   select coalesce(sum(s.amount) filter (where s.created_at>=v_today),0) as today_tax,
          coalesce(sum(s.amount),0) as week_tax,
          coalesce(jsonb_object_agg(s.material,s.today_amount)
                   filter (where s.today_amount>0),'{}'::jsonb) as today_materials,
          coalesce(jsonb_object_agg(s.material,s.amount),'{}'::jsonb) as week_materials
   from (
     select e.material,sum(e.amount) as amount,
        coalesce(sum(e.amount) filter(where e.created_at>=v_today),0) as today_amount,
        max(e.created_at) as last_at
     from private.guild_material_ledger e
     where e.association_id=v_guild and e.operation='GATHER_TAX'
       and e.town_id=t.id and e.created_at>=v_week
     group by e.material
   ) s
 ) y on true;

 select coalesce(jsonb_agg(jsonb_build_object(
   'eventId',h.event_id,'townId',h.town_id,'townName',coalesce(t.name,h.town_id),
   'settledAt',h.settled_at,
   'previousOwner',coalesce(prev.name,'중립'),
   'winner',coalesce(winner.name,'없음'),
   'outcome',case when h.winner_association_id is null then 'UNDECIDED'
    when h.winner_association_id=h.owner_association_id then 'DEFENDED'
    else 'CAPTURED' end,
   'ourWar',h.owner_association_id=v_guild or h.winner_association_id=v_guild
 ) order by h.settled_at desc),'[]'::jsonb)
 into v_history
 from (
  select event_id,town_id,settled_at,owner_association_id,winner_association_id
  from private.village_war_events
  where settled_at is not null
  order by settled_at desc limit 20
 ) h
 left join private.village_life_towns t on t.id=h.town_id
 left join private.online_associations prev on prev.association_id=h.owner_association_id
 left join private.online_associations winner on winner.association_id=h.winner_association_id;

 return jsonb_build_object('associationId',v_guild,'isLeader',v_leader,
   'ownedCount',v_owned_count,'totalCount',v_total_count,
   'todayTax',v_today_total,'weekTax',v_week_total,'stockTotal',v_stock_total,
   'todayStart',v_today,'serverNow',extract(epoch from v_now)*1000,
   'towns',v_towns,'history',v_history);
end
$function$;

revoke all on function private.guild_territory_state_json(uuid) from public,anon,authenticated;

create or replace function public.get_guild_territory_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_user uuid;
begin
 v_user:=private.require_active_game_session(
  p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.guild_territory_state_json(v_user);
end
$function$;

revoke all on function public.get_guild_territory_state(uuid,bigint,text,text)
 from public,anon,authenticated;
grant execute on function public.get_guild_territory_state(uuid,bigint,text,text) to authenticated;
