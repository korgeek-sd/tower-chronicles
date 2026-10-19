create table private.market_order_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 input jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.market_order_requests enable row level security;
revoke all on private.market_order_requests from public,anon,authenticated;

create or replace function public.place_online_market_order_v2(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_item_id text,p_side text,p_limit_price bigint,p_quantity bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;previous jsonb;params jsonb;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'MARKET_REQUEST_REQUIRED';end if;
 if nullif(p_item_id,'') is null then raise exception 'MARKET_ITEM_REQUIRED';end if;
 if p_side is null or p_side not in ('BUY','SELL') then raise exception 'MARKET_SIDE_INVALID';end if;
 if p_limit_price is null or p_limit_price<=0 or p_limit_price>1000000000000 then raise exception 'MARKET_PRICE_INVALID';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>1000000 then raise exception 'MARKET_QUANTITY_INVALID';end if;
 params:=jsonb_build_object('itemId',p_item_id,'side',p_side,'limitPrice',p_limit_price,'quantity',p_quantity);
 select input into previous from private.market_order_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous is distinct from params then raise exception 'MARKET_REQUEST_CONFLICT';end if;
  return private.market_state_json(u);
 end if;
 result:=public.place_online_market_order(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_item_id,p_side,p_limit_price,p_quantity);
 insert into private.market_order_requests(user_id,request_id,input) values(u,p_request_id,params);
 return result;
end $$;
revoke all on function public.place_online_market_order_v2(uuid,bigint,text,text,uuid,text,text,bigint,bigint) from public,anon;
grant execute on function public.place_online_market_order_v2(uuid,bigint,text,text,uuid,text,text,bigint,bigint) to authenticated,service_role;
