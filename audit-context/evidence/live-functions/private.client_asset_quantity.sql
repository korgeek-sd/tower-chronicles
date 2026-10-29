CREATE OR REPLACE FUNCTION private.client_asset_quantity(p_payload jsonb, p_item_id text)
 RETURNS bigint
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare v_kind text:=split_part(p_item_id,':',1);v_a text:=split_part(p_item_id,':',2);v_b int;v_value text;
begin
 if v_kind in ('material','ticket') then
  begin v_b:=split_part(p_item_id,':',3)::int;exception when others then return 0;end;
  if v_b<1 then return 0;end if;
  v_value:=p_payload->case when v_kind='material' then 'materials' else 'tickets' end->v_a->>(v_b-1);
  if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 elsif v_kind='skillbook' then
  v_value:=p_payload->'skillBooks'->>v_a;if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 elsif v_kind='other' then
  v_value:=p_payload->'lootItems'->>v_a;if v_value is null or v_value!~'^[0-9]+$' then return 0;end if;return v_value::bigint;
 end if;return 0;
end;$function$

