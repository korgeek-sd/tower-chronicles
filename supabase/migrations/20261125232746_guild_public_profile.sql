-- Public gameplay information only; active authenticated game lease required.
create or replace function private.guild_public_profile(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_association_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid; a private.online_associations%rowtype; roster jsonb; lands jsonb; wars jsonb; leader text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is distinct from auth.uid() or not exists(select 1 from public.game_player_profiles where user_id=u) then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from private.online_associations where association_id=p_association_id and status='ACTIVE';
 if not found then return null; end if;
 select nickname into leader from public.game_player_profiles where user_id=a.leader_user_id;
 with scored as materialized (
  select m.user_id,pr.nickname,m.role,coalesce(private.member_combat_power(m.user_id),0) power
  from private.online_association_members m left join public.game_player_profiles pr on pr.user_id=m.user_id
  where m.association_id=a.association_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('nickname',nickname,'role',role,'combatPower',power) order by power desc,user_id),'[]'::jsonb) into roster from scored;
 select coalesce(jsonb_agg(jsonb_build_object('name',t.name,'occupiedAt',o.occupied_at) order by t.name),'[]'::jsonb) into lands
 from private.village_war_owners o join private.village_life_towns t on t.id=o.town_id and t.is_active where o.association_id=a.association_id;
 select coalesce(jsonb_agg(jsonb_build_object('townName',h.town_name,'settledAt',h.settled_at,'outcome',h.outcome) order by h.settled_at desc),'[]'::jsonb) into wars
 from (select coalesce(t.name,e.town_id) town_name,e.settled_at,
   case when e.winner_association_id=a.association_id and e.owner_association_id=a.association_id then 'DEFENDED'
        when e.winner_association_id=a.association_id then 'CAPTURED'
        when e.winner_association_id is null then 'UNDECIDED' else 'LOST' end outcome
   from private.village_war_events e left join private.village_life_towns t on t.id=e.town_id
   where e.settled_at is not null and (e.owner_association_id=a.association_id or e.winner_association_id=a.association_id)
   order by e.settled_at desc limit 5) h;
 return jsonb_build_object('associationId',a.association_id,'description',a.description,'leaderName',leader,'joinPolicy',a.join_policy,'members',roster,'territories',lands,'recentWars',wars);
end
$fn$;
revoke all on function private.guild_public_profile(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function private.guild_public_profile(uuid,bigint,text,text,uuid) to authenticated;
create or replace function public.get_guild_public_profile(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_association_id uuid)
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.guild_public_profile(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_association_id);
$fn$;
revoke all on function public.get_guild_public_profile(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_guild_public_profile(uuid,bigint,text,text,uuid) to authenticated;