create table private.ssr_selector_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 appearance_id text not null,
 primary key(user_id, request_id)
);
alter table private.ssr_selector_receipts enable row level security;
revoke all on private.ssr_selector_receipts from public, anon, authenticated;

create function public.redeem_ssr_shard_selector(
 p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text,
 p_request_id uuid, p_appearance_id text, p_expected_stock bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid;
 previous text;
begin
 u := private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is null or u is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
 if p_request_id is null then raise exception 'REQUEST_REQUIRED'; end if;
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
 select appearance_id into previous from private.ssr_selector_receipts where user_id=u and request_id=p_request_id;
 if found then
  if previous is distinct from p_appearance_id then raise exception 'REQUEST_CONFLICT'; end if;
 else
  if not exists(select 1 from private.appearance_catalog where appearance_id=p_appearance_id and rarity='SSR') then
   raise exception 'SELECTOR_INVALID_APPEARANCE';
  end if;
  update private.village_life_players
   set products=jsonb_set(products,'{ssr_shard_selector}',to_jsonb(p_expected_stock-1))
   where user_id=u and p_expected_stock>0 and (products->>'ssr_shard_selector')::bigint=p_expected_stock;
  if not found then raise exception 'SELECTOR_STOCK_CHANGED'; end if;
  insert into private.appearance_ownership(user_id,appearance_id,duplicate_count,fragment_balance,enhancement_level)
   values(u,p_appearance_id,0,3,0)
   on conflict(user_id,appearance_id) do update set fragment_balance=private.appearance_ownership.fragment_balance+3;
  insert into private.ssr_selector_receipts values(u,p_request_id,p_appearance_id);
  perform private.persist_market_economy_to_save(u);
 end if;
 return jsonb_build_object('state',private.village_life_snapshot(u),'record',private.cloud_record_json(u));
end $$;
revoke all on function public.redeem_ssr_shard_selector(uuid,bigint,text,text,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.redeem_ssr_shard_selector(uuid,bigint,text,text,uuid,text,bigint) to authenticated;
