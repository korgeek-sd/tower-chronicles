-- Adds appearance summon tickets to the established coupon reward bundle.
-- Reward is escrowed in the existing mail until claimed; coupon remains once per account.
create or replace function private.validate_coupon_reward(r jsonb)
returns void language plpgsql set search_path='' as $$
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
   if item->>'id' not in('other:enhancement_stone','other:job_draw_ticket') then raise exception 'COUPON_REWARD_INVALID';end if;
  end loop;
 end if;
 if coalesce((r->>'silver')::bigint,0)=0 and coalesce((r->>'gold')::bigint,0)=0
    and coalesce((r->>'appearanceTickets')::bigint,0)=0
    and jsonb_array_length(coalesce(r->'items','[]'::jsonb))=0
 then raise exception 'COUPON_REWARD_INVALID';end if;
end $$;
revoke all on function private.validate_coupon_reward(jsonb) from public,anon,authenticated;

create or replace function private.deliver_coupon_reward(u uuid,r jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; ticket_count bigint;
begin
 perform private.validate_coupon_reward(r);
 update private.player_wallets
 set silver=silver+coalesce((r->>'silver')::bigint,0),
     gold=gold+coalesce((r->>'gold')::bigint,0),
     updated_at=now()
 where user_id=u;
 if not found then raise exception 'COUPON_WALLET_MISSING';end if;
 ticket_count:=coalesce((r->>'appearanceTickets')::bigint,0);
 if ticket_count>0 then
  insert into private.appearance_ticket_wallets(user_id,quantity) values(u,ticket_count)
  on conflict(user_id) do update
  set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
 end if;
 for item in select value from jsonb_array_elements(coalesce(r->'items','[]'::jsonb)) loop
  perform private.deliver_market_asset(u,item->>'id',(item->>'quantity')::bigint,null);
 end loop;
end $$;
revoke all on function private.deliver_coupon_reward(uuid,jsonb) from public,anon,authenticated;

-- Preserve the existing mail claim handler including lease, hub, locking and rollback.
-- Only extend its confirmed claim response with the server-owned ticket balance.
do $patch$
declare definition text; needle text; patched text;
begin
 select pg_get_functiondef('public.manage_game_mail(uuid,bigint,text,text,text,uuid)'::regprocedure) into definition;
 needle:='return public.get_game_mail()||jsonb_build_object(''economy'',case when p_action in(''claim'',''claim_all'') then private.market_state_json(u) end);';
 if position(needle in definition)=0 then raise exception 'COUPON_MAIL_HANDLER_PATCH_REQUIRED';end if;
 patched:=replace(definition,needle,
  'return public.get_game_mail()||jsonb_build_object(''economy'',case when p_action in(''claim'',''claim_all'') then private.market_state_json(u) end,''summonTickets'',case when p_action in(''claim'',''claim_all'') then coalesce((select quantity from private.appearance_ticket_wallets where user_id=u),0) end);');
 execute patched;
end $patch$;
revoke all on function public.manage_game_mail(uuid,bigint,text,text,text,uuid) from public,anon;
grant execute on function public.manage_game_mail(uuid,bigint,text,text,text,uuid) to authenticated;
