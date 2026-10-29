CREATE OR REPLACE FUNCTION private.accept_client_economy_consumption(p_user uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_asset record;v_client bigint;
begin
 for v_asset in select item_id,quantity from private.market_assets where user_id=p_user and item_id not like 'gear:%' and item_id not like 'equipment_v2:%' for update loop
  v_client:=private.client_asset_quantity(p_payload,v_asset.item_id);
  if v_client<v_asset.quantity then
   if v_client=0 then delete from private.market_assets where user_id=p_user and item_id=v_asset.item_id;
   else update private.market_assets set quantity=v_client,updated_at=now() where user_id=p_user and item_id=v_asset.item_id;end if;
  end if;
 end loop;
 delete from private.market_assets a where a.user_id=p_user and a.item_id like 'gear:%'
 and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) g where g->>'id'=substr(a.item_id,6));
end;$function$

