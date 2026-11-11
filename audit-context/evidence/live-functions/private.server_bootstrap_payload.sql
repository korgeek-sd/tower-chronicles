CREATE OR REPLACE FUNCTION private.server_bootstrap_payload(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare p jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  p:=p || jsonb_build_object(
    'version',22,
    'silver',0,
    'materials',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0),'leather',jsonb_build_array(0,0,0,0,0),'gem',jsonb_build_array(0,0,0,0,0),'kaleon',jsonb_build_array(0,0,0,0,0)),
    'tickets',jsonb_build_object('ore',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'leather',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'gem',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'kaleon',jsonb_build_array(20,0,0,0,0,0,0,0,0,0)),
    'items',jsonb_build_array(jsonb_build_object('id','starter','kind','sword','tier',1,'enhancement',0)),
    'equipped',jsonb_build_object('weapon','starter','armor',null,'boots',null,'accessory',null),
    'skillBooks','{}'::jsonb,
    'lootItems','{}'::jsonb,
    'potions',jsonb_build_object('healing_lesser',30,'healing_standard',5,'healing_greater',0,'healing_supreme',0,'revival',0),
    'loadout',jsonb_build_object('healing_lesser',10,'healing_standard',0,'healing_greater',0,'healing_supreme',0,'revival',0),
    'ownedJobIds','[]'::jsonb,
    'currentJobId',null,
    'learned','[]'::jsonb,
    'skills',jsonb_build_array(null,null,null),
    'market',jsonb_build_object('traderCertified',false,'ownerId','local-player','gold',1000,'orders','[]'::jsonb,'trades','[]'::jsonb,'storage','[]'::jsonb,'nextOrderId',1,'nextTradeId',1,'nextSequence',1,'nextStorageId',1),
    'goldenRecorder',jsonb_build_object('expiresAt',null),
    'crafting',jsonb_build_object('jobs','[]'::jsonb,'nextJobId',1),
    'association',jsonb_build_object('currentId',null,'associations','[]'::jsonb,'nextId',1,'nextApplicationId',1),
    'lastExpedition',null,
    'expedition',null
  );
  return p;
end $function$

