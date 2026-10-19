CREATE OR REPLACE FUNCTION private.deliver_coupon_reward(u uuid, r jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb;
begin
 perform private.validate_coupon_reward(r);
 update private.player_wallets set silver=silver+coalesce((r->>'silver')::bigint,0),gold=gold+coalesce((r->>'gold')::bigint,0),updated_at=now() where user_id=u;
 if not found then raise exception 'COUPON_WALLET_MISSING';end if;
 for item in select value from jsonb_array_elements(coalesce(r->'items','[]')) loop
 perform private.deliver_market_asset(u,item->>'id',(item->>'quantity')::bigint,null);
 end loop;
end $function$

