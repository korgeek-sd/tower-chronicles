-- Equipment is consumed only by authoritative equipment RPCs, never legacy client saves.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.accept_client_economy_consumption(uuid,jsonb)'::regprocedure);
 if position('and item_id not like ''equipment_v2:%''' in definition)=0 then
 definition:=replace(definition,'and item_id not like ''gear:%'' for update','and item_id not like ''gear:%'' and item_id not like ''equipment_v2:%'' for update');
 execute definition;
 end if;
end $$;
