-- v0.1.72: retire crafting completely.
-- Existing in-flight jobs are refunded before the server queue and RPC surface are removed.

insert into private.market_assets(user_id,item_id,quantity,updated_at)
select
  user_id,
  'material:'||material_tower||':'||tier::text,
  sum(greatest(material_cost,0))::bigint,
  now()
from private.online_craft_jobs
where greatest(material_cost,0)>0
group by user_id,material_tower,tier
on conflict(user_id,item_id) do update
set quantity=private.market_assets.quantity+excluded.quantity,
    updated_at=now();

do $$
declare r record;
begin
  for r in select distinct user_id from private.online_craft_jobs loop
    perform private.persist_market_economy_to_save(r.user_id);
  end loop;
end;
$$;

update public.game_saves
set payload=jsonb_set(
  payload,
  '{crafting}',
  coalesce(payload->'crafting','{}'::jsonb)
    || jsonb_build_object('jobs','[]'::jsonb,'nextJobId',1),
  true
)
where payload ? 'crafting';

delete from private.online_craft_jobs;

drop function if exists public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer);
drop function if exists public.cancel_online_craft(uuid,bigint,text,text,text);
drop function if exists public.claim_online_craft(uuid,bigint,text,text,text,text);

drop table if exists private.online_craft_jobs;
