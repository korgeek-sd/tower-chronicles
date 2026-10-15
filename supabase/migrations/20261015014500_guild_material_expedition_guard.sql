-- Do not allow material wallet/escrow transfers while the player is on expedition.
CREATE OR REPLACE FUNCTION public.recover_guild_material_auction(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;l private.guild_auction_listings%rowtype;balance bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
  or coalesce((select payload->>'expedition' from public.game_saves where user_id=u),'null')<>'null'
 then raise exception 'GUILD_MATERIAL_EXPEDITION_ACTIVE';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 select * into l from private.guild_auction_listings where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.source<>'MATERIAL' then raise exception 'GUILD_MATERIAL_AUCTION_INVALID';end if;
 if l.returned_at is not null then
  return jsonb_build_object('replayed',true,'state',private.guild_auction_state_json(u));end if;
 if l.top_user_id is not null or l.claimed_at is not null or l.cancelled_at is not null
 then raise exception 'GUILD_AUCTION_CANNOT_CANCEL';end if;
 insert into private.guild_material_stock(association_id,material,quantity)
 values(aid,l.material_id,l.material_quantity)
 on conflict(association_id,material) do update set quantity=private.guild_material_stock.quantity+excluded.quantity
 returning quantity into balance;
 update private.guild_auction_listings
 set returned_at=clock_timestamp(),cancelled_at=case when ends_at>clock_timestamp() then clock_timestamp() else null end
 where listing_id=p_listing_id;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,listing_id,detail)
 values(aid,u,'AUCTION_RETURN',l.material_id,l.material_quantity,balance,l.listing_id,'취소·유찰 물품 재료 창고 반환');
 return jsonb_build_object('replayed',false,'state',private.guild_auction_state_json(u));
end $function$
;

CREATE OR REPLACE FUNCTION public.register_guild_material_auction(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_material text, p_quantity bigint, p_starting_bid bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;listing private.guild_auction_listings%rowtype;balance bigint;listing_id uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
  or coalesce((select payload->>'expedition' from public.game_saves where user_id=u),'null')<>'null'
 then raise exception 'GUILD_MATERIAL_EXPEDITION_ACTIVE';end if;
 if p_request_id is null or p_material not in('herb','pepper','potato','wheat')
 or p_quantity is null or p_quantity<1 or p_quantity>1000000000
 or p_starting_bid is null or p_starting_bid<1 or p_starting_bid>1000000000
 then raise exception 'GUILD_MATERIAL_INPUT_INVALID';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 perform 1 from private.online_associations where association_id=aid for update;
 select * into listing from private.guild_auction_listings
 where association_id=aid and material_request_id=p_request_id;
 if found then
  if listing.material_id<>p_material or listing.material_quantity<>p_quantity or listing.starting_bid<>p_starting_bid then
   raise exception 'GUILD_MATERIAL_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'state',private.guild_auction_state_json(u));
 end if;
 update private.guild_material_stock set quantity=quantity-p_quantity
 where association_id=aid and material=p_material and quantity>=p_quantity
 returning quantity into balance;
 if not found then raise exception 'GUILD_MATERIAL_STOCK_SHORT';end if;
 insert into private.guild_auction_listings(association_id,source,gear,starting_bid,
 material_id,material_quantity,material_request_id,started_at,ends_at)
 values(aid,'MATERIAL','{}'::jsonb,p_starting_bid,p_material,p_quantity,p_request_id,clock_timestamp(),clock_timestamp()+interval '24 hours')
 returning listing_id into listing_id;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,listing_id,detail)
 values(aid,u,'AUCTION_LIST',p_material,-p_quantity,balance,listing_id,'24시간 공헌도 경매 등록');
 perform private.association_activity(aid,u,'AUCTION','재료 경매 등록 · '||p_material||' ×'||p_quantity||' / 시작 '||p_starting_bid||'P');
 return jsonb_build_object('replayed',false,'state',private.guild_auction_state_json(u));
end $function$
;

CREATE OR REPLACE FUNCTION public.transfer_guild_material(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_direction text, p_material text, p_amount bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;r jsonb;old jsonb;own bigint;balance bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
  or coalesce((select payload->>'expedition' from public.game_saves where user_id=u),'null')<>'null'
 then raise exception 'GUILD_MATERIAL_EXPEDITION_ACTIVE';end if;
 if p_request_id is null or p_direction not in('DEPOSIT','WITHDRAW') or p_material not in('herb','pepper','potato','wheat')
 or p_amount is null or p_amount<1 or p_amount>1000000000 then raise exception 'GUILD_MATERIAL_INPUT_INVALID';end if;
 perform private.refresh_village_life(u);
 perform 1 from private.village_life_players where user_id=u for update;
 select m.association_id into aid
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 r:=jsonb_build_object('direction',p_direction,'material',p_material,'amount',p_amount,'associationId',aid);
 select request into old from private.guild_material_request_receipts where user_id=u and request_id=p_request_id;
 if found then
  if old<>r then raise exception 'GUILD_MATERIAL_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'state',private.guild_materials_state(u));
 end if;
 insert into private.guild_material_stock(association_id,material,quantity) values(aid,p_material,0) on conflict do nothing;
 if p_direction='DEPOSIT' then
  select coalesce((materials->>p_material)::bigint,0) into own from private.village_life_players where user_id=u;
  if own<p_amount then raise exception 'GUILD_MATERIAL_PERSONAL_SHORT';end if;
  update private.village_life_players set materials=jsonb_set(materials,array[p_material],to_jsonb(own-p_amount),true) where user_id=u;
  update private.guild_material_stock set quantity=quantity+p_amount where association_id=aid and material=p_material returning quantity into balance;
 else
  update private.guild_material_stock set quantity=quantity-p_amount
  where association_id=aid and material=p_material and quantity>=p_amount returning quantity into balance;
  if not found then raise exception 'GUILD_MATERIAL_STOCK_SHORT';end if;
  update private.village_life_players set materials=jsonb_set(materials,array[p_material],to_jsonb(coalesce((materials->>p_material)::bigint,0)+p_amount),true) where user_id=u;
 end if;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,detail)
 values(aid,u,p_direction,p_material,case when p_direction='DEPOSIT' then p_amount else -p_amount end,balance,'길드장 직접 '||case when p_direction='DEPOSIT' then '입고' else '인출' end);
 insert into private.guild_material_request_receipts(user_id,request_id,request) values(u,p_request_id,r);
 return jsonb_build_object('replayed',false,'state',private.guild_materials_state(u));
end $function$
;

