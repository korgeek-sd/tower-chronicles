-- Server-authoritative appearance summon: C 60%, B 30%, A 8%, SR 1.8%, SSR 0.2%.
-- Each roll is independent. No guaranteed tier, pity, or shard conversion.
-- Existing unlocked appearances are grandfathered into the private ownership ledger.
create table private.appearance_catalog (
 appearance_id text primary key,
 rarity text not null check (rarity in ('C','B','A','SR','SSR'))
);
insert into private.appearance_catalog(appearance_id,rarity) values
 ('corsair','B'),
 ('teddy','B'),
 ('proletaria','A'),
 ('mechanic','C'),
 ('skeleton_knight','C'),
 ('valkyrie','A'),
 ('seraphim','A'),
 ('ophanim','A'),
 ('cain','SR'),
 ('plague_doctor','B'),
 ('knight','B'),
 ('nidhogg','SSR'),
 ('bahamut','SSR'),
 ('baal','SSR'),
 ('puppeteer','SSR'),
 ('rat_king','SR'),
 ('association_archivist','C'),
 ('returning_knight','C'),
 ('novar_outskirts_guard','C'),
 ('mining_crew','C'),
 ('slime','C'),
 ('faceless_one','C'),
 ('saintess','SR'),
 ('summoner','B'),
 ('hexer','C'),
 ('ice_mage','C'),
 ('inquisitor','C'),
 ('nameless_pilgrim','C'),
 ('cultist','B'),
 ('scout','C'),
 ('celestial_archer','B'),
 ('arcane_archer','C'),
 ('thief','C'),
 ('pickpocket','C'),
 ('musketeer','C'),
 ('bounty_hunter','C'),
 ('assault_gunner','B'),
 ('apprentice_mage','C'),
 ('advanced_mage','A'),
 ('archmage','SR'),
 ('alchemist','B'),
 ('nameless_sinner','SR'),
 ('blacksmith','B'),
 ('bourgeoisie','SR'),
 ('contract_mercenary','B'),
 ('lumpen','C'),
 ('intellectual','SR'),
 ('golem','C'),
 ('butcher','C'),
 ('necromancer','SR'),
 ('grave_robber','C'),
 ('court_jester','C'),
 ('noble_knight','SR'),
 ('crossbowman','C'),
 ('lumberjack','C');
create table private.appearance_ownership(
 user_id uuid not null references auth.users(id) on delete cascade,
 appearance_id text not null references private.appearance_catalog(appearance_id),
 duplicate_count bigint not null default 0 check (duplicate_count>=0),
 primary key(user_id,appearance_id)
);
create table private.appearance_summon_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 currency text not null check(currency in ('gold','ticket')),
 rolls integer not null check(rolls in (1,10)),
 cost bigint not null check(cost>=0),
 results jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
create index appearance_summon_receipts_latest_idx on private.appearance_summon_receipts(user_id,created_at desc);
alter table private.appearance_catalog enable row level security;
alter table private.appearance_ownership enable row level security;
alter table private.appearance_summon_receipts enable row level security;
revoke all on private.appearance_catalog,private.appearance_ownership,private.appearance_summon_receipts from public,anon,authenticated;

-- Convert the existing catalog-linked cosmetic ownership once, before enforcing server authority.
insert into private.appearance_ownership(user_id,appearance_id,duplicate_count)
select s.user_id, a.appearance_id,
 least(1000000,greatest(0,case when (s.payload->'cosmetics'->'appearanceItems'->>a.appearance_id) ~ '^[0-9]{1,7}$' then (s.payload->'cosmetics'->'appearanceItems'->>a.appearance_id)::bigint else 0 end))
from public.game_saves s
cross join lateral (
 select distinct appearance_id from (
  select jsonb_array_elements_text(case when jsonb_typeof(s.payload->'cosmetics'->'unlockedAppearanceIds')='array' then s.payload->'cosmetics'->'unlockedAppearanceIds' else '[]'::jsonb end) appearance_id
  union
  select k.key appearance_id from jsonb_each(case when jsonb_typeof(s.payload->'cosmetics'->'appearanceItems')='object' then s.payload->'cosmetics'->'appearanceItems' else '{}'::jsonb end) k
 ) ids
) a
join private.appearance_catalog c on c.appearance_id=a.appearance_id
on conflict (user_id,appearance_id) do nothing;

create function private.appearance_authoritative_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ids jsonb; extras jsonb; requested text; actual text;
begin
 select coalesce(jsonb_agg(appearance_id order by appearance_id),'[]'::jsonb),
        coalesce(jsonb_object_agg(appearance_id,duplicate_count) filter(where duplicate_count>0),'{}'::jsonb)
 into ids,extras from private.appearance_ownership where user_id=p_user;
 requested:=coalesce(p_payload->'cosmetics'->>'selectedAppearanceId','default');
 actual:=case when requested='default' or exists(select 1 from private.appearance_ownership where user_id=p_user and appearance_id=requested) then requested else 'default' end;
 return jsonb_set(p_payload,'{cosmetics}',
  coalesce(p_payload->'cosmetics','{}'::jsonb)||
  jsonb_build_object('unlockedAppearanceIds',jsonb_build_array('default')||ids,
    'appearanceItems',extras,'selectedAppearanceId',actual),true);
end $$;
revoke all on function private.appearance_authoritative_payload(uuid,jsonb) from public,anon,authenticated;

-- Applies to both cloud saves from clients and backend economy writes; precludes client-forged ownership.
create function private.guard_game_save_appearances()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.payload:=private.appearance_authoritative_payload(new.user_id,new.payload);
 new.payload_hash:=encode(extensions.digest(convert_to(private.stable_json_string(new.payload),'UTF8'),'sha256'),'hex');
 return new;
end $$;
revoke all on function private.guard_game_save_appearances() from public,anon,authenticated;
create trigger game_save_authoritative_appearances
 before insert or update of payload on public.game_saves
 for each row execute function private.guard_game_save_appearances();

-- CSPRNG rejection sampler ensures uniformity for rarity rolls and appearance index rolls.
create function private.appearance_secure_int(p_max integer)
returns integer language plpgsql volatile set search_path='' as $$
declare v_bytes bytea; v_value bigint; v_limit bigint;
begin
 if p_max is null or p_max<1 or p_max>1000000 then raise exception 'SUMMON_RANDOM_RANGE_INVALID';end if;
 v_limit:=(4294967296::bigint/p_max)*p_max;
 loop
  v_bytes:=extensions.gen_random_bytes(4);
  v_value:=get_byte(v_bytes,0)::bigint*16777216+
           get_byte(v_bytes,1)::bigint*65536+
           get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint;
  if v_value<v_limit then return (v_value%p_max)::integer;end if;
 end loop;
end $$;
revoke all on function private.appearance_secure_int(integer) from public,anon,authenticated;

-- Single transaction: session -> save -> wallet -> tickets -> debit -> rolls -> ownership -> receipt -> canonical save.
create function public.summon_appearances(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_currency text,p_rolls integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; price bigint; r private.appearance_summon_receipts%rowtype;
 v_gold bigint; v_tickets bigint; draws jsonb:='[]'::jsonb; i integer; bucket integer; tier text;
 pool text[]; chosen text; was_owned boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_currency not in ('gold','ticket') or p_rolls not in (1,10)
    or (p_currency='ticket' and p_rolls<>1) then raise exception 'SUMMON_INVALID';end if;
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into r from private.appearance_summon_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.currency<>p_currency or r.rolls<>p_rolls then raise exception 'SUMMON_REQUEST_CONFLICT';end if;
  return jsonb_build_object('draws',r.results,'cost',r.cost,'currency',r.currency,'replayed',true,'record',private.cloud_record_json(u));
 end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 price:=case when p_currency='ticket' then 1 when p_rolls=1 then 300 else 2700 end;
 if p_currency='gold' then
  update private.player_wallets set gold=gold-price,updated_at=now()
  where user_id=u and gold>=price returning gold into v_gold;
  if not found then raise exception 'SUMMON_GOLD_INSUFFICIENT';end if;
 else
  update private.appearance_ticket_wallets set quantity=quantity-1
  where user_id=u and quantity>=1 returning quantity into v_tickets;
  if not found then raise exception 'SUMMON_TICKET_INSUFFICIENT';end if;
 end if;
 for i in 1..p_rolls loop
  bucket:=private.appearance_secure_int(10000);
  tier:=case when bucket<6000 then 'C' when bucket<9000 then 'B'
            when bucket<9800 then 'A' when bucket<9980 then 'SR' else 'SSR' end;
  select array_agg(appearance_id order by appearance_id) into pool
  from private.appearance_catalog where rarity=tier;
  if coalesce(cardinality(pool),0)=0 then raise exception 'SUMMON_POOL_EMPTY';end if;
  chosen:=pool[private.appearance_secure_int(cardinality(pool))+1];
  select exists(select 1 from private.appearance_ownership where user_id=u and appearance_id=chosen) into was_owned;
  insert into private.appearance_ownership(user_id,appearance_id,duplicate_count)
   values(u,chosen,0)
   on conflict(user_id,appearance_id) do update
   set duplicate_count=private.appearance_ownership.duplicate_count+1;
  draws:=draws||jsonb_build_array(jsonb_build_object('id',chosen,'rarity',tier,'duplicate',was_owned));
 end loop;
 insert into private.appearance_summon_receipts(user_id,request_id,currency,rolls,cost,results)
 values(u,p_request_id,p_currency,p_rolls,price,draws);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('draws',draws,'cost',price,'currency',p_currency,'replayed',false,'record',private.cloud_record_json(u));
end $$;
revoke all on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) to authenticated;

create function public.get_appearance_summon_history(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; history jsonb;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select coalesce(jsonb_agg(jsonb_build_object('draws',results,'cost',cost,'currency',currency,'at',created_at)
              order by created_at desc),'[]'::jsonb)
 into history from (select results,cost,currency,created_at from private.appearance_summon_receipts
                   where user_id=u order by created_at desc limit 20) h;
 return jsonb_build_object('history',history);
end $$;
revoke all on function public.get_appearance_summon_history(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_appearance_summon_history(uuid,bigint,text,text) to authenticated;
