-- Public guild leaderboard: no mutable ranking counters and no synthetic guilds.
-- All rankings are derived from active guild membership, territory owners and settled wars.
create or replace function private.guild_ranking_state_json(p_user uuid,p_mode text default 'OVERALL')
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_my_guild uuid;v_rows jsonb;v_total integer;v_my_rank bigint;
begin
 if p_mode not in ('OVERALL','TERRITORY','WARS','GROWTH') then
   raise exception 'GUILD_RANKING_MODE_INVALID';
 end if;
 select m.association_id into v_my_guild
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where m.user_id=p_user;

 with guilds as (
  select a.association_id,a.name,a.record_number as record_number,
    a.association_level as guild_level,a.association_exp as guild_exp,
    a.member_limit,a.created_at,
    coalesce(m.members,0)::integer as members,
    coalesce(o.territories,0)::integer as territories,
    coalesce(w.victories,0)::integer as victories,
    coalesce(w.captures,0)::integer as captures,
    coalesce(w.defenses,0)::integer as defenses
  from private.online_associations a
  left join lateral (
   select count(*) as members from private.online_association_members m
    where m.association_id=a.association_id
  ) m on true
  left join lateral (
   select count(*) as territories from private.village_war_owners o
    where o.association_id=a.association_id
  ) o on true
  left join lateral (
   select count(*) as victories,
     count(*) filter(where e.owner_association_id is distinct from a.association_id) as captures,
     count(*) filter(where e.owner_association_id=a.association_id) as defenses
   from private.village_war_events e
   where e.winner_association_id=a.association_id and e.settled_at is not null
  ) w on true
  where a.status='ACTIVE'
 ), ranked as (
  select g.*,row_number() over(order by
   case p_mode when 'WARS' then g.victories when 'GROWTH' then g.guild_level else g.territories end desc,
   case p_mode when 'TERRITORY' then g.guild_level when 'WARS' then g.captures when 'GROWTH' then g.guild_exp else g.victories end desc,
   case p_mode when 'TERRITORY' then g.victories when 'WARS' then g.territories when 'GROWTH' then g.members else g.guild_level end desc,
   case p_mode when 'WARS' then g.guild_level when 'GROWTH' then g.territories else g.members end desc,
   g.created_at asc,g.association_id asc
  ) as rank
  from guilds g
 )
 select count(*)::integer,
   max(rank) filter(where association_id=v_my_guild),
   coalesce(jsonb_agg(jsonb_build_object(
     'rank',rank,'associationId',association_id,'name',name,'recordNumber',record_number,
     'level',guild_level,'exp',guild_exp,'members',members,'memberLimit',member_limit,
     'territories',territories,'victories',victories,'captures',captures,'defenses',defenses,
     'createdAt',created_at,'mine',association_id=v_my_guild
   ) order by rank) filter(where rank<=100),'[]'::jsonb)
 into v_total,v_my_rank,v_rows from ranked;

 return jsonb_build_object('mode',p_mode,'totalGuilds',coalesce(v_total,0),
  'myAssociationId',v_my_guild,'myRank',v_my_rank,'entries',v_rows,
  'updatedAt',clock_timestamp());
end
$function$;

revoke all on function private.guild_ranking_state_json(uuid,text) from public,anon,authenticated;

create or replace function public.get_guild_rankings(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_mode text default 'OVERALL'
)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.guild_ranking_state_json(v_user,p_mode);
end
$function$;

revoke all on function public.get_guild_rankings(uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.get_guild_rankings(uuid,bigint,text,text,text) to authenticated;
