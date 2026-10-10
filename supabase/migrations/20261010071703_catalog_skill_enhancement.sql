-- Approved +3 skill enhancement: 2/3/5 books, +5/+10/+15% effect amounts.
alter table private.learned_catalog_skills add column enhancement_level integer not null default 0 check(enhancement_level between 0 and 3);

create function private.skill_progress_payload(u uuid,p jsonb) returns jsonb language sql set search_path='' as $$
 select jsonb_set(p,'{skillEnhancements}',coalesce((select jsonb_object_agg(skill_id,enhancement_level) from private.learned_catalog_skills where user_id=u),'{}'::jsonb),true);
$$;
revoke all on function private.skill_progress_payload(uuid,jsonb) from public,anon,authenticated;

-- Preserve the existing canonical economy function and add server-owned skill levels.
CREATE OR REPLACE FUNCTION private.server_economy_payload(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_wallet private.player_wallets%rowtype;v_payload jsonb:=p_payload;v_materials jsonb;v_tickets jsonb;v_skillbooks jsonb;v_loot_items jsonb;v_items jsonb;v_equipment_items jsonb;
begin
 select * into v_wallet from private.player_wallets where user_id=p_user;if not found then return private.skill_progress_payload(p_user,p_payload);end if;
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
 return private.skill_progress_payload(p_user,v_payload);
end;$function$;


create or replace function private.skill_book_snapshot(u uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object(
 'books',(select jsonb_object_agg(c.skill_id,coalesce(a.quantity,0)) from private.skill_book_catalog c left join private.market_assets a on a.user_id=u and a.item_id='skillbook:'||c.skill_id),
 'learned',(select coalesce(jsonb_agg(skill_id order by skill_id),'[]'::jsonb) from private.learned_catalog_skills where user_id=u),
 'enhancements',(select coalesce(jsonb_object_agg(skill_id,enhancement_level),'{}'::jsonb) from private.learned_catalog_skills where user_id=u),
 'gold',coalesce((select gold from private.player_wallets where user_id=u),0));
$$;
revoke all on function private.skill_book_snapshot(uuid) from public,anon,authenticated;
revoke all on function private.server_economy_payload(uuid,jsonb) from public,anon,authenticated;

create function public.enhance_catalog_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skill_id text,p_expected_level integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s public.game_saves%rowtype;g text;lvl integer;q bigint;wallet_gold bigint;book_cost integer;gold_cost bigint;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select grade into g from private.skill_book_catalog where skill_id=p_skill_id;
 if not found then raise exception 'SKILL_UNKNOWN';end if;
 if p_expected_level is null or p_expected_level not between 0 and 3 then raise exception 'SKILL_ENHANCEMENT_STALE';end if;
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if jsonb_typeof(s.payload->'expedition') is distinct from 'null' or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'SKILL_EXPEDITION_BLOCKED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 select w.gold into wallet_gold from private.player_wallets w where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select enhancement_level into lvl from private.learned_catalog_skills where user_id=u and skill_id=p_skill_id for update;
 if not found then raise exception 'SKILL_NOT_LEARNED';end if;
 -- Replay of a successfully processed stage returns state without charging again.
 if lvl>p_expected_level then return private.skill_book_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));end if;
 if lvl<>p_expected_level then raise exception 'SKILL_ENHANCEMENT_STALE';end if;
 if lvl>=3 then raise exception 'SKILL_MAX_ENHANCEMENT';end if;
 book_cost:=(array[2,3,5])[lvl+1];
 gold_cost:=(case g when 'C' then 500 when 'B' then 1000 when 'A' then 2000 when 'S' then 4000 when 'SR' then 8000 when 'SSR' then 16000 end)*(2^lvl)::bigint;
 select quantity into q from private.market_assets where user_id=u and item_id='skillbook:'||p_skill_id for update;
 if q is null or q<book_cost then raise exception 'SKILL_BOOK_EMPTY';end if;
 if wallet_gold<gold_cost then raise exception 'SKILL_GOLD_EMPTY';end if;
 if q=book_cost then delete from private.market_assets where user_id=u and item_id='skillbook:'||p_skill_id;
 else update private.market_assets set quantity=quantity-book_cost,updated_at=now() where user_id=u and item_id='skillbook:'||p_skill_id;end if;
 update private.player_wallets set gold=wallet_gold-gold_cost,updated_at=now() where user_id=u;
 update private.learned_catalog_skills set enhancement_level=lvl+1 where user_id=u and skill_id=p_skill_id;
 perform private.persist_client_payload_with_server_economy(u,s.payload,s.app_version);
 return private.skill_book_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));
end $$;
revoke all on function public.enhance_catalog_skill(uuid,bigint,text,text,text,integer) from public,anon;
grant execute on function public.enhance_catalog_skill(uuid,bigint,text,text,text,integer) to authenticated;

