-- Appearance shards: one dedicated shard per summon, 5 to unlock, 10 per level to Lv5.
-- Existing owners keep permanent unlock; verified historical duplicates become shards.
alter table private.appearance_ownership
 add column fragment_balance bigint not null default 0 check(fragment_balance>=0),
 add column enhancement_level integer not null default 0 check(enhancement_level between 0 and 5);
update private.appearance_ownership
set enhancement_level=1,fragment_balance=duplicate_count;

-- Server alone writes ownership, levels, shard balances and the equipped ID into cloud saves.
create or replace function private.appearance_authoritative_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ids jsonb; shards jsonb; levels jsonb; requested text; actual text;
begin
 select coalesce(jsonb_agg(appearance_id order by appearance_id) filter(where enhancement_level>0),'[]'::jsonb),
        coalesce(jsonb_object_agg(appearance_id,fragment_balance) filter(where fragment_balance>0),'{}'::jsonb),
        coalesce(jsonb_object_agg(appearance_id,enhancement_level) filter(where enhancement_level>0),'{}'::jsonb)
 into ids,shards,levels from private.appearance_ownership where user_id=p_user;
 requested:=coalesce(p_payload->'cosmetics'->>'selectedAppearanceId','default');
 actual:=case when requested='default' or exists(select 1 from private.appearance_ownership where user_id=p_user and appearance_id=requested and enhancement_level>0) then requested else 'default' end;
 return jsonb_set(p_payload,'{cosmetics}',
  coalesce(p_payload->'cosmetics','{}'::jsonb)||
  jsonb_build_object('unlockedAppearanceIds',jsonb_build_array('default')||ids,
    'appearanceItems',shards,'appearanceLevels',levels,'selectedAppearanceId',actual),true);
end $$;
revoke all on function private.appearance_authoritative_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function public.summon_appearances(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_currency text,p_rolls integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; r private.appearance_summon_receipts%rowtype;
 ticket_balance bigint:=0; ticket_spend bigint; gold_spend bigint; payment jsonb;
 settlement text; draws jsonb:='[]'::jsonb; i integer; bucket integer; tier text;
 pool text[]; chosen text; was_owned boolean; fragments_now bigint; level_now integer;
begin
 -- Session lock and canonical save/wallet order match existing economy mutations.
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 -- Old game bundles may send 'gold'/'ticket'; both now use mandatory automatic priority.
 if p_request_id is null or p_currency is null
    or p_currency not in ('auto','gold','ticket') or p_rolls is null or p_rolls not in (1,10)
 then raise exception 'SUMMON_INVALID';end if;

 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into r from private.appearance_summon_receipts
 where user_id=u and request_id=p_request_id;
 if found then
  if r.rolls<>p_rolls then raise exception 'SUMMON_REQUEST_CONFLICT';end if;
  return jsonb_build_object(
    'draws',r.results,'cost',r.cost,'currency',r.currency,
    'ticketsSpent',r.tickets_spent,'goldSpent',r.gold_spent,
    'replayed',true,'record',private.cloud_record_json(u));
 end if;

 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select quantity into ticket_balance from private.appearance_ticket_wallets
 where user_id=u for update;
 ticket_balance:=coalesce(ticket_balance,0);
 payment:=private.appearance_payment(p_rolls,ticket_balance);
 ticket_spend:=(payment->>'ticketsSpent')::bigint;
 gold_spend:=(payment->>'goldSpent')::bigint;

 -- Both deductions and all rewards are rolled back if any part fails.
 update private.player_wallets set gold=gold-gold_spend,updated_at=now()
 where user_id=u and gold>=gold_spend;
 if not found then raise exception 'SUMMON_GOLD_INSUFFICIENT';end if;
 if ticket_spend>0 then
  update private.appearance_ticket_wallets set quantity=quantity-ticket_spend
  where user_id=u and quantity>=ticket_spend;
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
  select exists(select 1 from private.appearance_ownership
                where user_id=u and appearance_id=chosen and enhancement_level>0) into was_owned;
  insert into private.appearance_ownership(user_id,appearance_id,duplicate_count,fragment_balance,enhancement_level)
   values(u,chosen,0,1,0)
   on conflict(user_id,appearance_id) do update
   set duplicate_count=private.appearance_ownership.duplicate_count+1,
       fragment_balance=private.appearance_ownership.fragment_balance+1
   returning fragment_balance,enhancement_level into fragments_now,level_now;
  draws:=draws||jsonb_build_array(jsonb_build_object(
    'id',chosen,'rarity',tier,'duplicate',was_owned,'fragments',1,
    'fragmentBalance',fragments_now,'level',level_now));
 end loop;

 settlement:=case when ticket_spend=0 then 'gold'
                  when gold_spend=0 then 'ticket' else 'mixed' end;
 insert into private.appearance_summon_receipts(
  user_id,request_id,currency,rolls,cost,results,tickets_spent,gold_spent)
 values(u,p_request_id,settlement,p_rolls,gold_spend,draws,ticket_spend,gold_spend);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object(
  'draws',draws,'cost',gold_spend,'currency',settlement,
  'ticketsSpent',ticket_spend,'goldSpent',gold_spend,
  'replayed',false,'record',private.cloud_record_json(u));
end $$;

revoke all on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.summon_appearances(uuid,bigint,text,text,uuid,text,integer) to authenticated;

-- Explicit request id makes unlock/upgrade retry-safe after network loss.
create table private.appearance_upgrade_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 appearance_id text not null references private.appearance_catalog(appearance_id),
 level_after integer not null check(level_after between 1 and 5),
 shards_spent integer not null check(shards_spent in (5,10)),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.appearance_upgrade_receipts enable row level security;
revoke all on private.appearance_upgrade_receipts from public,anon,authenticated;

create function public.advance_appearance(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_appearance_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; receipt private.appearance_upgrade_receipts%rowtype;
 old_level integer; current_balance bigint; next_level integer; cost integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_appearance_id is null or p_appearance_id='default'
 then raise exception 'APPEARANCE_INVALID';end if;
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into receipt from private.appearance_upgrade_receipts
 where user_id=u and request_id=p_request_id;
 if found then
  if receipt.appearance_id<>p_appearance_id then raise exception 'APPEARANCE_REQUEST_CONFLICT';end if;
  return jsonb_build_object('appearanceId',receipt.appearance_id,
   'level',receipt.level_after,'shardsSpent',receipt.shards_spent,
   'replayed',true,'record',private.cloud_record_json(u));
 end if;
 select enhancement_level,fragment_balance into old_level,current_balance
 from private.appearance_ownership where user_id=u and appearance_id=p_appearance_id for update;
 if not found then raise exception 'APPEARANCE_SHARDS_INSUFFICIENT';end if;
 if old_level>=5 then raise exception 'APPEARANCE_MAX_LEVEL';end if;
 cost:=case when old_level=0 then 5 else 10 end;
 if current_balance<cost then raise exception 'APPEARANCE_SHARDS_INSUFFICIENT';end if;
 next_level:=old_level+1;
 update private.appearance_ownership
 set fragment_balance=fragment_balance-cost,enhancement_level=next_level
 where user_id=u and appearance_id=p_appearance_id;
 insert into private.appearance_upgrade_receipts(user_id,request_id,appearance_id,level_after,shards_spent)
 values(u,p_request_id,p_appearance_id,next_level,cost);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('appearanceId',p_appearance_id,'level',next_level,
  'shardsSpent',cost,'replayed',false,'record',private.cloud_record_json(u));
end $$;
revoke all on function public.advance_appearance(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.advance_appearance(uuid,bigint,text,text,uuid,text) to authenticated;

-- Server combat logic: one equipped and server-owned appearance only; shard state never grants power.
create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 eq jsonb:=coalesce(p_payload->'expedition'->'equipment',p_payload->'equipped','{}');
 i jsonb;b jsonb;slot text;expected text;weapon text:='sword';
 hp numeric:=180;attack numeric:=8;defense numeric:=3;crit numeric:=.05;crit_damage numeric:=1.5;pen numeric:=0;
 seal_level integer:=0;bonus jsonb; allocated jsonb;
 ap_rarity text; ap_level integer; ap_base numeric; ap_multiplier numeric;
begin
 foreach slot in array array['weapon','helmet','armor','gloves','boots','necklace','ring'] loop
  select gear into i from private.market_assets where user_id=p_user and item_id='equipment_v2:'||(eq->>slot) and quantity=1;
  if i is null then continue;end if;
  expected:=case i->>'kind' when 'association_supply_iron_sword' then 'weapon' when 'outer_guard_longbow' then 'weapon' when 'archive_standard_arcane_staff' then 'weapon' when 'expedition_iron_helmet' then 'helmet' when 'return_corps_plate_armor' then 'armor' when 'mining_detail_reinforced_gloves' then 'gloves' when 'survey_corps_dust_boots' then 'boots' when 'association_registration_tag' then 'necklace' when 'expedition_merit_ring' then 'ring' else null end;
  if expected is distinct from slot then continue;end if;
  b:=private.fixed_equipment_stats(i->>'kind',i->>'grade');
  hp:=hp+coalesce((b->>'hp')::numeric,0);attack:=attack+coalesce((b->>'attack')::numeric,0);defense:=defense+coalesce((b->>'defense')::numeric,0);
  crit:=crit+coalesce((b->>'critChance')::numeric,0);crit_damage:=crit_damage+coalesce((b->>'critDamage')::numeric,0);pen:=pen+coalesce((b->>'armorPenetration')::numeric,0);
  if slot='weapon' then weapon:=case i->>'kind' when 'outer_guard_longbow' then 'bow' when 'archive_standard_arcane_staff' then 'staff' else 'sword' end;end if;
 end loop;
 select stat_allocation into allocated from private.hunting_states where user_id=p_user;
 hp:=hp+12*coalesce((allocated->>'hp')::integer,0);
 attack:=attack+coalesce((allocated->>'attack')::integer,0);
 defense:=defense+2*coalesce((allocated->>'defense')::integer,0);
 crit:=least(.6,crit+.02*coalesce((allocated->>'crit')::integer,0));
 select level into seal_level from private.player_association_seals where user_id=p_user;
 bonus:=private.association_seal_bonus_json(coalesce(seal_level,0));
 hp:=hp*(1+coalesce((bonus->>'hpPercent')::numeric,0)/100);
 attack:=attack*(1+coalesce((bonus->>'attackPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((bonus->>'defensePercent')::numeric,0)/100);
 select c.rarity,o.enhancement_level into ap_rarity,ap_level
 from private.appearance_ownership o join private.appearance_catalog c on c.appearance_id=o.appearance_id
 where o.user_id=p_user and o.appearance_id=p_payload->'cosmetics'->>'selectedAppearanceId' and o.enhancement_level>0;
 if found then
  ap_base:=case ap_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end;
  ap_multiplier:=case ap_level when 1 then 1 when 2 then 1.1 when 3 then 1.2 when 4 then 1.35 when 5 then 1.5 else 0 end;
  attack:=attack*(1+ap_base*ap_multiplier/100);
 end if;
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

-- Keep prior cloud save revisions untouched during migration. Their next normal
-- authenticated save/summon/upgrade applies the authoritative shard projection.
