-- One-off event: every currently registered account receives exactly 1,000 vitality.
-- Natural recovery stays capped at 100 but must never erase above-cap promotional vitality.
-- No change to gear rewards, vitality cost per battle, or existing player progression.
CREATE OR REPLACE FUNCTION private.refresh_hunting_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s private.hunting_states%rowtype;ticks integer;stamp timestamptz:=now();
begin
 insert into private.hunting_states(user_id) values(u) on conflict(user_id) do nothing;
 select * into s from private.hunting_states where user_id=u for update;
 ticks:=floor(greatest(0,extract(epoch from stamp-s.recovered_at))/300)::integer;
 s.vitality:=case when s.vitality>=100 then s.vitality else least(100,s.vitality+ticks) end;
 s.recovered_at:=case when s.vitality>=100 then greatest(stamp,s.recovered_at) else s.recovered_at+ticks*interval '300 seconds' end;
 update private.hunting_states set vitality=s.vitality,recovered_at=s.recovered_at where user_id=u;
 return jsonb_build_object('vitality',s.vitality,'recoveredAt',extract(epoch from s.recovered_at)*1000,'experience',s.experience,'mastery',s.mastery,'skills',to_jsonb(s.skills),'lastResult',s.last_result,'combatStats',private.combat_equipment_stats(u,(select jsonb_set(payload,'{expedition}',jsonb_build_object('equipment',payload->'equipped'),true) from public.game_saves where user_id=u)),'statAllocation',s.stat_allocation,'statResets',s.stat_resets,'statPoints',greatest(0,private.hunting_level(s.experience)-1-coalesce((s.stat_allocation->>'hp')::integer,0)-coalesce((s.stat_allocation->>'attack')::integer,0)-coalesce((s.stat_allocation->>'defense')::integer,0)-coalesce((s.stat_allocation->>'crit')::integer,0)),'currentHp',s.current_hp,'maxHp',s.max_hp,'potions',coalesce((select (l.products->>'potion')::bigint from private.village_life_players l where l.user_id=u),0),'foodTurns',coalesce((select l.food_turns from private.village_life_players l where l.user_id=u),'{}'::jsonb));
end $function$;

-- Include registered users who have never entered the hunting screen.
insert into private.hunting_states (user_id,vitality,recovered_at)
select id,1000,now() from auth.users
on conflict (user_id) do update set
 vitality=excluded.vitality,
 recovered_at=excluded.recovered_at;
