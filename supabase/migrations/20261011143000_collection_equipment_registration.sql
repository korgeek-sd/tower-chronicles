-- A single collection mixes permanent appearance unlocks and a consumed equipment asset.
-- Server-owned immutable registration ledger; client save cannot forge or refund registrations.
create table if not exists private.collection_equipment_requirements (
 set_id text primary key,
 kind text not null,
 grade text not null check (grade in ('common','uncommon','rare','heroic','legendary'))
);
insert into private.collection_equipment_requirements(set_id,kind,grade) values
  ('featured_ash_survivors','return_corps_plate_armor','rare'),
  ('ashen_border_1','outer_guard_longbow','uncommon'),
  ('ashen_border_2','archive_standard_arcane_staff','rare'),
  ('ashen_border_3','expedition_iron_helmet','heroic'),
  ('ashen_border_4','return_corps_plate_armor','legendary'),
  ('ashen_border_5','mining_detail_reinforced_gloves','heroic'),
  ('ashen_border_6','survey_corps_dust_boots','legendary'),
  ('ashen_border_7','association_registration_tag','heroic'),
  ('ashen_border_8','expedition_merit_ring','legendary'),
  ('green_sanctum_1','return_corps_plate_armor','uncommon'),
  ('green_sanctum_2','mining_detail_reinforced_gloves','rare'),
  ('green_sanctum_3','survey_corps_dust_boots','heroic'),
  ('green_sanctum_4','association_registration_tag','legendary'),
  ('green_sanctum_5','expedition_merit_ring','heroic'),
  ('green_sanctum_6','outer_guard_longbow','legendary'),
  ('green_sanctum_7','archive_standard_arcane_staff','heroic'),
  ('green_sanctum_8','expedition_iron_helmet','legendary'),
  ('red_fang_1','association_registration_tag','uncommon'),
  ('red_fang_2','expedition_merit_ring','rare'),
  ('red_fang_3','outer_guard_longbow','heroic'),
  ('red_fang_4','archive_standard_arcane_staff','legendary'),
  ('red_fang_5','expedition_iron_helmet','heroic'),
  ('red_fang_6','return_corps_plate_armor','legendary'),
  ('red_fang_7','mining_detail_reinforced_gloves','heroic'),
  ('red_fang_8','survey_corps_dust_boots','legendary'),
  ('broken_archive_1','archive_standard_arcane_staff','uncommon'),
  ('broken_archive_2','expedition_iron_helmet','rare'),
  ('broken_archive_3','return_corps_plate_armor','heroic'),
  ('broken_archive_4','mining_detail_reinforced_gloves','legendary'),
  ('broken_archive_5','survey_corps_dust_boots','heroic'),
  ('broken_archive_6','association_registration_tag','legendary'),
  ('broken_archive_7','expedition_merit_ring','heroic'),
  ('broken_archive_8','outer_guard_longbow','legendary'),
  ('deep_fault_1','mining_detail_reinforced_gloves','uncommon'),
  ('deep_fault_2','survey_corps_dust_boots','rare'),
  ('deep_fault_3','association_registration_tag','heroic'),
  ('deep_fault_4','expedition_merit_ring','legendary'),
  ('deep_fault_5','outer_guard_longbow','heroic'),
  ('deep_fault_6','archive_standard_arcane_staff','legendary'),
  ('deep_fault_7','expedition_iron_helmet','heroic'),
  ('deep_fault_8','return_corps_plate_armor','legendary'),
  ('inverted_altar_1','expedition_merit_ring','uncommon'),
  ('inverted_altar_2','outer_guard_longbow','rare'),
  ('inverted_altar_3','archive_standard_arcane_staff','heroic'),
  ('inverted_altar_4','expedition_iron_helmet','legendary'),
  ('inverted_altar_5','return_corps_plate_armor','heroic'),
  ('inverted_altar_6','mining_detail_reinforced_gloves','legendary'),
  ('inverted_altar_7','survey_corps_dust_boots','heroic'),
  ('inverted_altar_8','association_registration_tag','legendary'),
  ('fallen_novar_1','expedition_iron_helmet','uncommon'),
  ('fallen_novar_2','return_corps_plate_armor','rare'),
  ('fallen_novar_3','mining_detail_reinforced_gloves','heroic'),
  ('fallen_novar_4','survey_corps_dust_boots','legendary'),
  ('fallen_novar_5','association_registration_tag','heroic'),
  ('fallen_novar_6','expedition_merit_ring','legendary'),
  ('fallen_novar_7','outer_guard_longbow','heroic'),
  ('fallen_novar_8','archive_standard_arcane_staff','legendary'),
  ('returning_road_1','survey_corps_dust_boots','uncommon'),
  ('returning_road_2','association_registration_tag','rare'),
  ('returning_road_3','expedition_merit_ring','heroic'),
  ('returning_road_4','outer_guard_longbow','legendary'),
  ('returning_road_5','archive_standard_arcane_staff','heroic'),
  ('returning_road_6','expedition_iron_helmet','legendary'),
  ('returning_road_7','return_corps_plate_armor','heroic'),
  ('returning_road_8','mining_detail_reinforced_gloves','legendary')
on conflict (set_id) do update set kind=excluded.kind,grade=excluded.grade;

create table if not exists private.collection_equipment_registrations (
 user_id uuid not null references auth.users(id) on delete cascade,
 set_id text not null references private.collection_equipment_requirements(set_id),
 item_id text not null,
 kind text not null,
 grade text not null,
 registered_at timestamptz not null default now(),
 primary key(user_id,set_id),
 unique(user_id,item_id)
);
alter table private.collection_equipment_requirements enable row level security;
alter table private.collection_equipment_registrations enable row level security;
revoke all on table private.collection_equipment_requirements from public,anon,authenticated;
revoke all on table private.collection_equipment_registrations from public,anon,authenticated;

create or replace function public.get_collection_equipment_registrations(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 v_user:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return coalesce(
  (select jsonb_agg(jsonb_build_object('setId',r.set_id,'itemId',r.item_id,'kind',r.kind,'grade',r.grade) order by r.set_id)
   from private.collection_equipment_registrations r where r.user_id=v_user),
  '[]'::jsonb
 );
end;
$$;

create or replace function public.register_collection_equipment(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_set_id text,p_item_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid;
 v_save public.game_saves%rowtype;
 v_req private.collection_equipment_requirements%rowtype;
 v_prev private.collection_equipment_registrations%rowtype;
 v_asset private.market_assets%rowtype;
begin
 v_user:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if coalesce(length(p_set_id),0)=0 or coalesce(length(p_item_id),0)=0 then
  raise exception 'COLLECTION_REQUIREMENT_INVALID';
 end if;
 if p_item_id='starter-v2' then raise exception 'COLLECTION_STARTER_PROTECTED'; end if;
 select * into v_req from private.collection_equipment_requirements where set_id=p_set_id;
 if not found then raise exception 'COLLECTION_REQUIREMENT_INVALID'; end if;
 select * into v_save from public.game_saves where user_id=v_user for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
 select * into v_prev from private.collection_equipment_registrations
 where user_id=v_user and set_id=p_set_id;
 if found then
  if v_prev.item_id=p_item_id then
   return jsonb_build_object('setId',p_set_id,'itemId',p_item_id,'alreadyApplied',true,'record',private.cloud_record_json(v_user));
  end if;
  raise exception 'COLLECTION_ALREADY_REGISTERED';
 end if;
 if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
 or exists(select 1 from private.online_expeditions e where e.user_id=v_user and e.status='ACTIVE') then
  raise exception 'COLLECTION_EXPEDITION_BLOCKED';
 end if;
 if exists(
  select 1 from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) equipped
  where equipped.value=p_item_id
 ) then raise exception 'COLLECTION_EQUIPPED';end if;
 select * into v_asset from private.market_assets
 where user_id=v_user and item_id='equipment_v2:'||p_item_id and quantity=1 and gear is not null
 for update;
 if not found then raise exception 'COLLECTION_ITEM_NOT_FOUND';end if;
 if v_asset.gear->>'kind' is distinct from v_req.kind
 or v_asset.gear->>'grade' is distinct from v_req.grade then
  raise exception 'COLLECTION_ITEM_MISMATCH';
 end if;
 delete from private.market_assets
 where user_id=v_user and item_id='equipment_v2:'||p_item_id;
 insert into private.collection_equipment_registrations(user_id,set_id,item_id,kind,grade)
 values(v_user,p_set_id,p_item_id,v_req.kind,v_req.grade);
 perform private.persist_market_economy_to_save(v_user);
 return jsonb_build_object('setId',p_set_id,'itemId',p_item_id,'alreadyApplied',false,'record',private.cloud_record_json(v_user));
end;
$$;
revoke all on function public.get_collection_equipment_registrations(uuid,bigint,text,text) from public,anon;
revoke all on function public.register_collection_equipment(uuid,bigint,text,text,text,text) from public,anon;
grant execute on function public.get_collection_equipment_registrations(uuid,bigint,text,text) to authenticated;
grant execute on function public.register_collection_equipment(uuid,bigint,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
