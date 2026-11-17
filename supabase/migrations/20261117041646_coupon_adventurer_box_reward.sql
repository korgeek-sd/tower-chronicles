CREATE OR REPLACE FUNCTION private.validate_coupon_reward(r jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item jsonb;k text;
begin
 if r is null or jsonb_typeof(r)<>'object' or r='{}'::jsonb then raise exception 'COUPON_REWARD_INVALID';end if;
 if exists(select 1 from jsonb_object_keys(r) x where x not in('silver','gold','items','appearanceTickets')) then raise exception 'COUPON_REWARD_INVALID';end if;
 foreach k in array array['silver','gold','appearanceTickets'] loop
  if r ? k and (jsonb_typeof(r->k)<>'number' or (r->>k)!~'^[0-9]+$'
   or (r->>k)::numeric>(case when k='appearanceTickets' then 1000000 else 1000000000 end))
  then raise exception 'COUPON_REWARD_INVALID';end if;
 end loop;
 if r ? 'items' then
  if jsonb_typeof(r->'items')<>'array' or jsonb_array_length(r->'items')>20 then raise exception 'COUPON_REWARD_INVALID';end if;
  for item in select value from jsonb_array_elements(r->'items') loop
   if jsonb_typeof(item)<>'object' or not(item ? 'id' and item ? 'quantity')
    or jsonb_typeof(item->'id')<>'string' or jsonb_typeof(item->'quantity')<>'number'
    or (item->>'quantity')!~'^[0-9]+$' or (item->>'quantity')::numeric not between 1 and 1000000
   then raise exception 'COUPON_REWARD_INVALID';end if;
   if item->>'id' not in('other:enhancement_stone','other:job_draw_ticket','product:life:adventurer_box') then raise exception 'COUPON_REWARD_INVALID';end if;
  end loop;
 end if;
 if coalesce((r->>'silver')::bigint,0)=0 and coalesce((r->>'gold')::bigint,0)=0
    and coalesce((r->>'appearanceTickets')::bigint,0)=0
    and jsonb_array_length(coalesce(r->'items','[]'::jsonb))=0
 then raise exception 'COUPON_REWARD_INVALID';end if;
end $function$;
revoke all on function private.validate_coupon_reward(jsonb) from public,anon,authenticated;
