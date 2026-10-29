CREATE OR REPLACE FUNCTION private.server_economy_payload(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_wallet private.player_wallets%rowtype;v_payload jsonb:=p_payload;v_materials jsonb;v_tickets jsonb;v_skillbooks jsonb;v_loot_items jsonb;v_items jsonb;v_equipment_items jsonb;
begin
 select * into v_wallet from private.player_wallets where user_id=p_user;if not found then return private.quest_ticket_payload(p_user,private.skill_progress_payload(p_user,p_payload));end if;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_materials from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='material:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_tickets from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='ticket:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(substr(item_id,11),quantity),'{}'::jsonb) into v_skillbooks from private.market_assets where user_id=p_user and item_id like 'skillbook:%' and quantity>0;
 select coalesce(jsonb_object_agg(substr(item_id,7),quantity),'{}'::jsonb) into v_loot_items from private.market_assets where user_id=p_user and item_id like 'other:%' and quantity>0;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_items
 from private.market_assets where user_id=p_user and item_id like 'gear:%' and quantity=1 and gear is not null;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_equipment_items
 from private.market_assets where user_id=p_user and item_id like 'equipment_v2:%' and quantity=1 and gear is not null;
 v_payload:=jsonb_set(v_payload,'{silver}',to_jsonb(v_wallet.silver),true);
 v_payload:=jsonb_set(v_payload,'{market,gold}',to_jsonb(v_wallet.gold),true);
 v_payload:=jsonb_set(v_payload,'{materials}',v_materials,true);v_payload:=jsonb_set(v_payload,'{tickets}',v_tickets,true);
 v_payload:=jsonb_set(v_payload,'{skillBooks}',v_skillbooks,true);v_payload:=jsonb_set(v_payload,'{lootItems}',v_loot_items,true);v_payload:=jsonb_set(v_payload,'{items}',v_items,true);v_payload:=jsonb_set(v_payload,'{equipmentItems}',v_equipment_items,true);
 return private.quest_ticket_payload(p_user,private.skill_progress_payload(p_user,v_payload));
end;$function$

