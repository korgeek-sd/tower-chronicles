-- Read-only adventurer directory. Only explicitly approved gameplay fields leave the server.
create or replace function private.adventurer_directory(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_target uuid,p_search text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid; t uuid; p jsonb; eq jsonb; combat jsonb; gear jsonb; result jsonb; v_search text; v_completed integer; v_total integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is distinct from auth.uid() or not exists(select 1 from public.game_player_profiles where user_id=u) then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 v_search:=lower(btrim(coalesce(p_search,'')));
 if char_length(v_search)>12 then raise exception 'INVALID_NICKNAME';end if;
 if p_target is null then
  with scored as materialized (
   select pr.user_id,pr.nickname,private.member_combat_power(pr.user_id) power,
   private.hunting_level(coalesce(h.experience,0)) level,c.class_id,a.name guild_name
   from public.game_player_profiles pr join public.game_saves s on s.user_id=pr.user_id
   left join private.hunting_states h on h.user_id=pr.user_id
   left join public.game_initial_classes c on c.user_id=pr.user_id
   left join private.online_association_members m on m.user_id=pr.user_id
   left join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
  ), ranked as (select *,row_number() over(order by power desc,level desc,user_id) rank from scored)
  select jsonb_build_object('myRank',max(rank) filter(where user_id=u),'total',count(*),
   'entries',coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'nickname',nickname,'combatPower',power,'level',level,'classId',class_id,'guildName',guild_name,'rank',rank) order by rank)
    filter(where (v_search='' and rank<=100) or (v_search<>'' and lower(nickname)=v_search)),'[]'::jsonb)) into result from ranked;
  return result;
 end if;
 t:=p_target;
 select s.payload into p from public.game_saves s join public.game_player_profiles pr on pr.user_id=s.user_id where s.user_id=t;
 if p is null then return null;end if;
 eq:=coalesce(p->'equipped','{}'::jsonb);
 p:=jsonb_set(p,'{expedition}',jsonb_build_object('equipment',eq),true);
 combat:=private.combat_equipment_stats(t,p);
 select coalesce(jsonb_agg(jsonb_build_object('slot',e.key,'kind',a.gear->>'kind','grade',a.gear->>'grade','enhancement',coalesce(a.gear->'enhancement','0'::jsonb)) order by e.key),'[]'::jsonb) into gear
 from jsonb_each_text(eq) e join private.market_assets a on a.user_id=t and a.item_id='equipment_v2:'||e.value and a.quantity=1
 where e.key in ('weapon','helmet','armor','gloves','boots','necklace','ring') and a.gear is not null;
 select count(*)::integer,count(*) filter(where (s.kind='appearance' and not exists(select 1 from unnest(s.appearance_ids) needed(appearance_id) where not exists(select 1 from private.appearance_ownership o where o.user_id=t and o.appearance_id=needed.appearance_id and o.enhancement_level>=1))) or (s.kind='equipment' and exists(select 1 from private.collection_equipment_registrations reg where reg.user_id=t and reg.set_id=s.set_id)))::integer into v_total,v_completed from private.record_collection_sets s;
 select jsonb_build_object('userId',pr.user_id,'nickname',pr.nickname,'classId',c.class_id,'level',private.hunting_level(coalesce(h.experience,0)),
  'guildName',a.name,'guildEmblem',a.emblem,'guildRole',case when a.association_id is not null then m.role else null end,
  'currentJobId',p->>'currentJobId','selectedAppearanceId',coalesce(p->'cosmetics'->>'selectedAppearanceId','default'),
  'combatPower',private.member_combat_power(t),
  'stats',jsonb_build_object('hp',combat->'hp','attack',combat->'attack','defense',combat->'defense','critChance',combat->'critChance'),
  'equipment',gear,'associationSeal',coalesce((select level from private.player_association_seals where user_id=t),0),
  'guardianSeal',coalesce((select level from private.player_guardian_seals where user_id=t),0),
  'collectionCompleted',v_completed,'collectionTotal',v_total)
 into result from public.game_player_profiles pr
 left join private.hunting_states h on h.user_id=pr.user_id
 left join public.game_initial_classes c on c.user_id=pr.user_id
 left join private.online_association_members m on m.user_id=pr.user_id
 left join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE'
 where pr.user_id=t;
 return result;
end
$fn$;
revoke all on function private.adventurer_directory(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.adventurer_directory(uuid,bigint,text,text,uuid,text) to authenticated;
create or replace function public.get_adventurer_directory(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_target uuid default null,p_search text default '')
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.adventurer_directory(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_target,p_search);
$fn$;
revoke all on function public.get_adventurer_directory(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.get_adventurer_directory(uuid,bigint,text,text,uuid,text) to authenticated;
