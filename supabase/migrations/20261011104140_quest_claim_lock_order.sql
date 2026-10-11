create or replace function public.claim_quest(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_period text,p_day date,p_quest_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;stamp timestamptz:=now();board jsonb;q private.quest_assignments%rowtype;entry jsonb;kind text;quantity integer;item text;item_name text;reward_result jsonb:='[]';i integer;balance bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_period is null or p_period not in ('daily','weekly') or p_day is null or p_quest_id is null then raise exception 'QUEST_INVALID';end if;
 -- The outer market lock precedes the active-session lock as in market mutations.
 -- Match hunting lock order: save -> wallet -> life -> quest assignment.
 perform 1 from public.game_saves where user_id=u for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 perform private.refresh_village_life(u);
 board:=private.quest_snapshot(u,stamp);
 -- Serializes all claims for this period, including distinct quests/reward selection.
 perform 1 from private.quest_assignments where user_id=u and period=p_period and day=p_day order by position for update;
 select * into q from private.quest_assignments where user_id=u and period=p_period and day=p_day and quest_id=p_quest_id;
 if not found then raise exception 'QUEST_INVALID';end if;
 if q.claimed_at is not null then return jsonb_build_object('board',board,'reward',q.reward,'record',private.cloud_record_json(u),'replayed',true);end if;
 if p_day<>private.quest_period(p_period,stamp) then raise exception 'QUEST_EXPIRED';end if;
 select value into entry from jsonb_array_elements(board->p_period) where value->>'id'=p_quest_id;
 if entry is null or not (entry->>'completed')::boolean then raise exception 'QUEST_INCOMPLETE';end if;
 select candidate into kind from unnest(array['vitality','summon','potion','food','skillbook','challenge']) candidate
 where not exists(select 1 from private.quest_assignments a where a.user_id=u and a.period=p_period and a.day=p_day and a.reward_type=candidate) order by random() limit 1;
 quantity:=case kind when 'vitality' then case when p_period='daily' then 1 else 3 end when 'summon' then case when p_period='daily' then 5 else 15 end when 'potion' then case when p_period='daily' then 100 else 300 end when 'food' then case when p_period='daily' then 3 else 10 end when 'skillbook' then case when p_period='daily' then 1 else 3 end else case when p_period='daily' then 3 else 10 end end;
 if kind='summon' then
  insert into private.appearance_ticket_wallets values(u,quantity) on conflict(user_id) do update set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
  reward_result:=jsonb_build_array(jsonb_build_object('item','summon_ticket','name','외형 소환권','quantity',quantity));
 elsif kind='skillbook' then
  for i in 1..quantity loop
   select skill_id,name into item,item_name from private.skill_book_catalog where grade in ('C','B','A') order by random() limit 1;
   if item is null then raise exception 'QUEST_BOOK_CATALOG_EMPTY';end if;
   insert into private.market_assets(user_id,item_id,quantity) values(u,'skillbook:'||item,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1;
   reward_result:=reward_result||jsonb_build_array(jsonb_build_object('item',item,'name',item_name||' 스킬북','quantity',1));
  end loop;
 else
  for i in 1..case when kind='food' then quantity else 1 end loop
   item:=case kind when 'vitality' then 'vitality_potion' when 'potion' then 'potion' when 'challenge' then 'challenge_ticket' else (array['attack_food','defense_food','experience_food'])[1+floor(random()*3)::integer] end;
   item_name:=case item when 'vitality_potion' then '활력 회복 포션' when 'potion' then '체력 포션' when 'challenge_ticket' then '점령전 도전권' when 'attack_food' then '떡볶이' when 'defense_food' then '방어 음식' else '경험치 음식' end;
   select coalesce((products->>item)::bigint,0) into balance from private.village_life_players where user_id=u;
   update private.village_life_players set products=jsonb_set(products,array[item],to_jsonb(balance+case when kind='food' then 1 else quantity end),true) where user_id=u;
   reward_result:=reward_result||jsonb_build_array(jsonb_build_object('item',item,'name',item_name,'quantity',case when kind='food' then 1 else quantity end));
  end loop;
 end if;
 update private.quest_assignments set reward_type=kind,reward=reward_result,claimed_at=stamp where user_id=u and period=p_period and day=p_day and quest_id=p_quest_id;
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('board',private.quest_snapshot(u,stamp),'reward',reward_result,'record',private.cloud_record_json(u),'replayed',false);
end $$;
