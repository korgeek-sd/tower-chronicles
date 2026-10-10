-- One book per skill. Ownership is independent of client saves.
create table private.skill_book_catalog(skill_id text primary key,name text not null,grade text not null check(grade in('C','B','A','S','SR','SSR')),kind text not null check(kind in('active','passive')));
alter table private.skill_book_catalog enable row level security;
revoke all on private.skill_book_catalog from public,anon,authenticated;
create table private.learned_catalog_skills(user_id uuid not null references auth.users(id) on delete cascade,skill_id text not null references private.skill_book_catalog(skill_id),learned_at timestamptz not null default now(),primary key(user_id,skill_id));
alter table private.learned_catalog_skills enable row level security;
revoke all on private.learned_catalog_skills from public,anon,authenticated;
insert into private.skill_book_catalog(skill_id,name,grade,kind) values
('sword_strike_c','보급검 베기 스킬북','C','active'),
('sword_strike_b','강철 베기 스킬북','B','active'),
('sword_strike_a','파쇄 베기 스킬북','A','active'),
('sword_strike_s','성문 가르기 스킬북','S','active'),
('sword_strike_sr','귀환자의 참격 스킬북','SR','active'),
('sword_strike_ssr','종언의 참격 스킬북','SSR','active'),
('sword_wound_c','상처 내기 스킬북','C','active'),
('sword_wound_b','상처 베기 스킬북','B','active'),
('sword_wound_a','흡혈격 스킬북','A','active'),
('sword_wound_s','피의 회수 스킬북','S','active'),
('sword_wound_sr','붉은 귀환 스킬북','SR','active'),
('sword_wound_ssr','불멸의 혈검 스킬북','SSR','active'),
('bow_shot_c','경비대 사격 스킬북','C','active'),
('bow_shot_b','정밀 사격 스킬북','B','active'),
('bow_shot_a','관통 화살 스킬북','A','active'),
('bow_shot_s','갑옷 꿰뚫기 스킬북','S','active'),
('bow_shot_sr','운명의 관통 스킬북','SR','active'),
('bow_shot_ssr','마지막 별 스킬북','SSR','active'),
('bow_volley_c','두 발 사격 스킬북','C','active'),
('bow_volley_b','독촉 연사 스킬북','B','active'),
('bow_volley_a','맹독 연사 스킬북','A','active'),
('bow_volley_s','사냥꾼의 연격 스킬북','S','active'),
('bow_volley_sr','독비 스킬북','SR','active'),
('bow_volley_ssr','검은 별의 연사 스킬북','SSR','active'),
('staff_flame_c','마력탄 스킬북','C','active'),
('staff_flame_b','불씨 스킬북','B','active'),
('staff_flame_a','화염구 스킬북','A','active'),
('staff_flame_s','화염 폭발 스킬북','S','active'),
('staff_flame_sr','잿빛 심판 스킬북','SR','active'),
('staff_flame_ssr','원소의 종말 스킬북','SSR','active'),
('staff_rift_c','균열탄 스킬북','C','active'),
('staff_rift_b','마력 균열 스킬북','B','active'),
('staff_rift_a','공허의 창 스킬북','A','active'),
('staff_rift_s','결계 파쇄 스킬북','S','active'),
('staff_rift_sr','심연의 균열 스킬북','SR','active'),
('staff_rift_ssr','심연 붕괴 스킬북','SSR','active'),
('shield_c','버티기 스킬북','C','active'),
('shield_b','수호막 스킬북','B','active'),
('shield_a','수호 결계 스킬북','A','active'),
('shield_s','귀환의 결계 스킬북','S','active'),
('shield_sr','별빛 성역 스킬북','SR','active'),
('shield_ssr','불가침의 성역 스킬북','SSR','active'),
('heal_c','응급 처치 스킬북','C','active'),
('heal_b','회복의 숨 스킬북','B','active'),
('heal_a','재생의 숨 스킬북','A','active'),
('heal_s','생명의 회수 스킬북','S','active'),
('heal_sr','귀환의 축복 스킬북','SR','active'),
('heal_ssr','귀환의 기적 스킬북','SSR','active'),
('restore_c','정신 집중 스킬북','C','active'),
('restore_b','마력 수집 스킬북','B','active'),
('restore_a','마력 회수 스킬북','A','active'),
('restore_s','공허의 호흡 스킬북','S','active'),
('restore_sr','심연의 샘 스킬북','SR','active'),
('restore_ssr','무한의 각인 스킬북','SSR','active'),
('prepare_c','집중 스킬북','C','active'),
('prepare_b','전투 집중 스킬북','B','active'),
('prepare_a','약점 포착 스킬북','A','active'),
('prepare_s','결전 준비 스킬북','S','active'),
('prepare_sr','승리의 각인 스킬북','SR','active'),
('prepare_ssr','종결의 각인 스킬북','SSR','active'),
('sword_mastery_c','검술 기초 스킬북','C','passive'),
('sword_mastery_b','검술 숙련 스킬북','B','passive'),
('sword_mastery_a','검의 잔향 스킬북','A','passive'),
('sword_mastery_s','검의 의지 스킬북','S','passive'),
('sword_mastery_sr','귀환검의 계승 스킬북','SR','passive'),
('sword_mastery_ssr','종언검의 주인 스킬북','SSR','passive'),
('bow_mastery_c','사격 기초 스킬북','C','passive'),
('bow_mastery_b','사격 숙련 스킬북','B','passive'),
('bow_mastery_a','약점 조준 스킬북','A','passive'),
('bow_mastery_s','사냥의 눈 스킬북','S','passive'),
('bow_mastery_sr','추적자의 통찰 스킬북','SR','passive'),
('bow_mastery_ssr','별을 꿰뚫는 눈 스킬북','SSR','passive'),
('staff_mastery_c','마력 기초 스킬북','C','passive'),
('staff_mastery_b','마력 숙련 스킬북','B','passive'),
('staff_mastery_a','원소 잔재 스킬북','A','passive'),
('staff_mastery_s','마력 순환 스킬북','S','passive'),
('staff_mastery_sr','심연의 지식 스킬북','SR','passive'),
('staff_mastery_ssr','원소의 지배자 스킬북','SSR','passive'),
('return_oath_ssr','귀환자의 맹세 스킬북','SSR','passive'),
('sixth_mark_ssr','여섯 번째 각인 스킬북','SSR','passive');

create function private.skill_book_snapshot(u uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('books',(select jsonb_object_agg(c.skill_id,coalesce(a.quantity,0)) from private.skill_book_catalog c left join private.market_assets a on a.user_id=u and a.item_id='skillbook:'||c.skill_id),'learned',(select coalesce(jsonb_agg(skill_id order by skill_id),'[]'::jsonb) from private.learned_catalog_skills where user_id=u));
$$;
revoke all on function private.skill_book_snapshot(uuid) from public,anon,authenticated;
create function public.get_skill_book_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.skill_book_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));
end $$;
create function public.learn_catalog_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skill_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s public.game_saves%rowtype;q bigint;payload jsonb;learned jsonb;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if not exists(select 1 from private.skill_book_catalog where skill_id=p_skill_id) then raise exception 'SKILL_UNKNOWN';end if;
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if jsonb_typeof(s.payload->'expedition') is distinct from 'null' or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'SKILL_EXPEDITION_BLOCKED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 -- The save-row lock serializes repeated requests: an already learned skill never consumes another book.
 if exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=p_skill_id) then return private.skill_book_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));end if;
 select quantity into q from private.market_assets where user_id=u and item_id='skillbook:'||p_skill_id for update;
 if q is null or q<1 then raise exception 'SKILL_BOOK_EMPTY';end if;
 if q=1 then delete from private.market_assets where user_id=u and item_id='skillbook:'||p_skill_id;
 else update private.market_assets set quantity=quantity-1,updated_at=now() where user_id=u and item_id='skillbook:'||p_skill_id;end if;
 insert into private.learned_catalog_skills(user_id,skill_id) values(u,p_skill_id);
 select coalesce(jsonb_agg(distinct id),'[]'::jsonb) into learned from (
  select value as id from jsonb_array_elements(coalesce(s.payload->'learned','[]'::jsonb)) where not exists(select 1 from private.skill_book_catalog where skill_id=value#>>'{}')
  union all select to_jsonb(skill_id) from private.learned_catalog_skills where user_id=u
 ) v;
 payload:=jsonb_set(s.payload,'{learned}',learned,true);
 perform private.persist_client_payload_with_server_economy(u,payload,s.app_version);
 return private.skill_book_snapshot(u)||jsonb_build_object('record',private.cloud_record_json(u));
end $$;
revoke all on function public.get_skill_book_state(uuid,bigint,text,text) from public,anon;
revoke all on function public.learn_catalog_skill(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.get_skill_book_state(uuid,bigint,text,text) to authenticated;
grant execute on function public.learn_catalog_skill(uuid,bigint,text,text,text) to authenticated;
