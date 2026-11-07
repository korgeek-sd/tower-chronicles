-- Existing server catalogue only; no new economy tables or client-controlled reward quantities.
-- Retired merchandise is disabled, not deleted, to preserve old purchase receipts.
update private.online_association_shop_items
 set enabled=false
 where item_id in ('enhancement_stone_daily','enhancement_stone_weekly',
                   'greater_potion_daily','greater_potion_weekly');

-- Retain historical purchase IDs and limits, but make rewards use the current appearance ticket wallet.
update private.online_association_shop_items
 set item_name=case item_id when 'job_draw_ticket_daily' then '외형 소환권 ×5' else '외형 소환권 ×30' end,
     description='외형 소환에서 사용',
     reward_type='APPEARANCE_TICKET',
     enabled=true
 where item_id in ('job_draw_ticket_daily','job_draw_ticket_weekly');

-- Approved daily offer: +100 vitality per potion; 500 contribution; 1/day; level 1.
insert into private.online_association_shop_items
 (item_id,item_name,shop_type,contribution_cost,purchase_limit,description,reward_type,reward_quantity,required_level,enabled)
 VALUES ('vitality_potion_daily','활력 회복 포션 ×1','DAILY',500,1,'사용 시 활력 100 회복 · 거래 불가','VITALITY_POTION',1,1,true)
 on conflict(item_id) do update
 set item_name=excluded.item_name,shop_type=excluded.shop_type,
     contribution_cost=excluded.contribution_cost,purchase_limit=excluded.purchase_limit,
     description=excluded.description,reward_type=excluded.reward_type,
     reward_quantity=excluded.reward_quantity,required_level=excluded.required_level,enabled=true;

-- All purchase rules, point deductions, expedition locks, receipt replay and server save sync are preserved.
-- Only the two current reward types gain real, server-owned credit paths.
CREATE OR REPLACE FUNCTION public.buy_online_association_shop_item(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_item_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid; a uuid; level integer; points bigint; bought integer; item private.online_association_shop_items%rowtype;
 previous private.association_operation_requests%rowtype; result jsonb; gear jsonb; gear_id text; kind text;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'ASSOCIATION_REQUEST_REQUIRED';end if;
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'BUY' or previous.input<>jsonb_build_object('itemId',p_item_id) then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return previous.result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id,x.association_level into a,level from private.online_association_members m join private.online_associations x using(association_id)
 where m.user_id=u and x.status='ACTIVE' for share of m,x;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into item from private.online_association_shop_items where item_id=p_item_id and enabled;
 if not found then raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 if level<item.required_level then raise exception 'ASSOCIATION_LEVEL_REQUIRED';end if;
 select contribution_point into points from private.online_association_member_progression where association_id=a and user_id=u for update;
 if coalesce(points,0)<item.contribution_cost then raise exception 'ASSOCIATION_CONTRIBUTION_SHORTAGE';end if;
 select count(*) into bought from private.online_association_shop_purchases where user_id=u and item_id=p_item_id and purchased_at>=private.association_period_start(item.shop_type);
 if bought>=item.purchase_limit then raise exception 'ASSOCIATION_PURCHASE_LIMIT';end if;
 update private.online_association_member_progression set contribution_point=contribution_point-item.contribution_cost,updated_at=now() where association_id=a and user_id=u;
 if item.reward_type in('SILVER','GOLD') then
  update private.player_wallets set silver=silver+case when item.reward_type='SILVER' then item.reward_quantity else 0 end,
  gold=gold+case when item.reward_type='GOLD' then item.reward_quantity else 0 end,updated_at=now() where user_id=u;
 elsif item.reward_type='VITALITY_POTION' then
  insert into private.village_life_players(user_id) values(u) on conflict(user_id) do nothing;
  perform private.grant_vitality_potions(u,item.reward_quantity);
 elsif item.reward_type='APPEARANCE_TICKET' then
  insert into private.appearance_ticket_wallets(user_id,quantity) values(u,item.reward_quantity)
  on conflict(user_id) do update set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
 elsif item.reward_type='POTION' then
  insert into private.player_consumables(user_id,item_id,quantity,updated_at) values(u,'healing_greater',item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();
 elsif item.reward_type in('STONE','TICKET') then
  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(u,case when item.reward_type='STONE' then 'other:enhancement_stone' else 'other:job_draw_ticket' end,item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
 elsif item.reward_type='EQUIPMENT' then
  gear_id:=gen_random_uuid()::text;kind:=kinds[1+floor(private.job_registration_secure_unit()*9)::integer];
  gear:=jsonb_build_object('id',gear_id,'kind',kind,'grade','rare','enhancement',0);
  insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||gear_id,1,gear);
 else raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 insert into private.online_association_shop_purchases(association_id,user_id,item_id,cost) values(a,u,p_item_id,item.contribution_cost);
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('reward',jsonb_build_object('name',item.item_name,'type',item.reward_type,'quantity',item.reward_quantity,'equipment',gear),'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'BUY',jsonb_build_object('itemId',p_item_id),result);
 return result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u));
end;$function$
;

-- Existing RPC grants remain unchanged; no new public API or Data API table access.
