CREATE OR REPLACE FUNCTION private.refresh_village_life(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare today date;
begin
 insert into private.village_life_players(user_id) values(u) on conflict(user_id) do nothing;
 perform 1 from private.village_life_players where user_id=u for update;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 update private.village_life_players set action_points=100,day=today where user_id=u and day<today;
end $function$

