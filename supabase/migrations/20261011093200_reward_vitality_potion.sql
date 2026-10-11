-- Reward-only product; no recipe or market catalog entry.
create table private.vitality_potion_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, response jsonb not null, primary key(user_id,request_id)
);
alter table private.vitality_potion_receipts enable row level security;
create or replace function public.use_vitality_potion(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_action text,p_item text,p_count integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; balance bigint; h jsonb; response jsonb;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_action is distinct from 'vitality' or p_item is distinct from 'vitality_potion' or p_count is distinct from 1 then raise exception 'COUNT_INVALID';end if;
 perform 1 from private.village_life_players where user_id=u for update;
 select r.response into response from private.vitality_potion_receipts r where user_id=u and request_id=p_request_id;
 if found then return response||jsonb_build_object('replayed',true);end if;
 select coalesce((products->>'vitality_potion')::bigint,0) into balance from private.village_life_players where user_id=u;
 if balance is null or balance<1 then raise exception 'PRODUCTS_EMPTY';end if;
 h:=private.refresh_hunting_state(u);
 perform 1 from private.hunting_states where user_id=u for update;
 if (select vitality from private.hunting_states where user_id=u)>900 then raise exception 'VITALITY_LIMIT';end if;
 update private.village_life_players set products=jsonb_set(products,'{vitality_potion}',to_jsonb(balance-1),true) where user_id=u;
 update private.hunting_states set vitality=vitality+100 where user_id=u;
 response:=jsonb_build_object('state',private.village_life_snapshot(u),'result',jsonb_build_object('action','vitality','item','vitality_potion','count',1,'quantity',100,'actionPointsSpent',0),'replayed',false);
 insert into private.vitality_potion_receipts values(u,p_request_id,response);
 return response;
end $$;
revoke all on function public.use_vitality_potion(uuid,bigint,text,text,uuid,text,text,text,integer) from public,anon;
grant execute on function public.use_vitality_potion(uuid,bigint,text,text,uuid,text,text,text,integer) to authenticated;
-- Called by trusted reward processors, never a client-controlled quantity RPC.
create or replace function private.grant_vitality_potions(p_user_id uuid,p_quantity integer)
returns void language plpgsql set search_path='' as $$
begin
 if p_quantity is null or p_quantity<1 then raise exception 'COUNT_INVALID';end if;
 update private.village_life_players set products=jsonb_set(products,'{vitality_potion}',to_jsonb(coalesce((products->>'vitality_potion')::bigint,0)+p_quantity),true) where user_id=p_user_id;
 if not found then raise exception 'PLAYER_REQUIRED';end if;
end $$;
revoke all on function private.grant_vitality_potions(uuid,integer) from public,anon,authenticated;
