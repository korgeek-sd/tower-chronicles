create or replace function private.fixed_equipment_stats(p_kind text,p_grade text)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce('{"association_supply_iron_sword":{"common":{"attack":10,"defense":4},"uncommon":{"attack":12,"defense":5},"rare":{"attack":14,"defense":6},"heroic":{"attack":17,"defense":7},"legendary":{"attack":20,"defense":8}},"outer_guard_longbow":{"common":{"attack":12,"critChance":0.02},"uncommon":{"attack":14,"critChance":0.03},"rare":{"attack":17,"critChance":0.04},"heroic":{"attack":20,"critChance":0.05},"legendary":{"attack":24,"critChance":0.06}},"archive_standard_arcane_staff":{"common":{"attack":10,"armorPenetration":0.05},"uncommon":{"attack":12,"armorPenetration":0.07},"rare":{"attack":14,"armorPenetration":0.09},"heroic":{"attack":17,"armorPenetration":0.12},"legendary":{"attack":20,"armorPenetration":0.15}},"expedition_iron_helmet":{"common":{"hp":20,"defense":5},"uncommon":{"hp":25,"defense":6},"rare":{"hp":30,"defense":7},"heroic":{"hp":40,"defense":9},"legendary":{"hp":50,"defense":11}},"return_corps_plate_armor":{"common":{"hp":55,"defense":7},"uncommon":{"hp":65,"defense":9},"rare":{"hp":80,"defense":11},"heroic":{"hp":100,"defense":14},"legendary":{"hp":125,"defense":17}},"mining_detail_reinforced_gloves":{"common":{"attack":3,"critChance":0.01},"uncommon":{"attack":4,"critChance":0.02},"rare":{"attack":5,"critChance":0.03},"heroic":{"attack":6,"critChance":0.04},"legendary":{"attack":8,"critChance":0.05}},"survey_corps_dust_boots":{"common":{"hp":15,"defense":3},"uncommon":{"hp":20,"defense":4},"rare":{"hp":25,"defense":5},"heroic":{"hp":35,"defense":6},"legendary":{"hp":45,"defense":8}},"association_registration_tag":{"common":{"hp":25,"critDamage":0.05},"uncommon":{"hp":30,"critDamage":0.07},"rare":{"hp":40,"critDamage":0.1},"heroic":{"hp":50,"critDamage":0.14},"legendary":{"hp":65,"critDamage":0.2}},"expedition_merit_ring":{"common":{"attack":4,"armorPenetration":0.02},"uncommon":{"attack":5,"armorPenetration":0.03},"rare":{"attack":6,"armorPenetration":0.04},"heroic":{"attack":8,"armorPenetration":0.06},"legendary":{"attack":10,"armorPenetration":0.08}}}'::jsonb->p_kind->p_grade,'{}'::jsonb)
$$;

create or replace function private.association_seal_bonus_json(p_level integer)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  v_level integer:=greatest(0,least(30,coalesce(p_level,0)));
  v_hp numeric:=0;
  v_half numeric:=0;
begin
  v_hp:=v_level*.10
    + case when v_level>=5 then .20 else 0 end
    + case when v_level>=10 then .30 else 0 end
    + case when v_level>=15 then .40 else 0 end
    + case when v_level>=20 then .50 else 0 end
    + case when v_level>=25 then .60 else 0 end
    + case when v_level>=30 then 1.00 else 0 end;
  v_hp:=round(v_hp,2);
  v_half:=round(v_hp/2,2);
  return jsonb_build_object(
    'hpPercent',v_hp,
    'attackPercent',v_half,
    'defensePercent',v_half
  );
end;
$$;

CREATE OR REPLACE FUNCTION private.combat_equipment_stats(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 eq jsonb:=coalesce(p_payload->'expedition'->'equipment',p_payload->'equipped','{}');
 i jsonb;b jsonb;slot text;expected text;weapon text:='sword';
 hp numeric:=180;attack numeric:=8;defense numeric:=3;crit numeric:=.05;crit_damage numeric:=1.5;pen numeric:=0;
 seal_level integer:=0;bonus jsonb; allocated jsonb;
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
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon);
end $function$;

create or replace function private.hunting_damage(attack numeric,defense numeric,multiplier numeric,penetration numeric)
returns numeric language sql immutable set search_path='' as $$
 select greatest(1,floor(greatest(0,attack)*multiplier*100/(100+greatest(0,defense)*(1-greatest(0,least(1,penetration))))))
$$;

create or replace function private.hunting_skill_spec(p_id text) returns jsonb language sql immutable set search_path='' as $spec$
 select ($json${"sword_strike_c":{"family":"sword_strike","weapon":"sword","type":"active","mp":0,"power":75,"chance":100,"gradeIndex":0},"sword_strike_b":{"family":"sword_strike","weapon":"sword","type":"active","mp":25,"power":130,"chance":90,"gradeIndex":1},"sword_strike_a":{"family":"sword_strike","weapon":"sword","type":"active","mp":45,"power":165,"chance":92,"gradeIndex":2},"sword_strike_s":{"family":"sword_strike","weapon":"sword","type":"active","mp":75,"power":205,"chance":94,"gradeIndex":3},"sword_strike_sr":{"family":"sword_strike","weapon":"sword","type":"active","mp":115,"power":250,"chance":96,"gradeIndex":4},"sword_strike_ssr":{"family":"sword_strike","weapon":"sword","type":"active","mp":170,"power":300,"chance":98,"gradeIndex":5},"sword_wound_c":{"family":"sword_wound","weapon":"sword","type":"active","mp":15,"power":70,"chance":85,"gradeIndex":0},"sword_wound_b":{"family":"sword_wound","weapon":"sword","type":"active","mp":30,"power":105,"chance":88,"gradeIndex":1},"sword_wound_a":{"family":"sword_wound","weapon":"sword","type":"active","mp":55,"power":135,"chance":91,"gradeIndex":2},"sword_wound_s":{"family":"sword_wound","weapon":"sword","type":"active","mp":90,"power":170,"chance":94,"gradeIndex":3},"sword_wound_sr":{"family":"sword_wound","weapon":"sword","type":"active","mp":135,"power":210,"chance":97,"gradeIndex":4},"sword_wound_ssr":{"family":"sword_wound","weapon":"sword","type":"active","mp":200,"power":255,"chance":100,"gradeIndex":5},"bow_shot_c":{"family":"bow_shot","weapon":"bow","type":"active","mp":0,"power":70,"chance":100,"gradeIndex":0},"bow_shot_b":{"family":"bow_shot","weapon":"bow","type":"active","mp":25,"power":125,"chance":90,"gradeIndex":1},"bow_shot_a":{"family":"bow_shot","weapon":"bow","type":"active","mp":45,"power":155,"chance":92,"gradeIndex":2},"bow_shot_s":{"family":"bow_shot","weapon":"bow","type":"active","mp":75,"power":190,"chance":94,"gradeIndex":3},"bow_shot_sr":{"family":"bow_shot","weapon":"bow","type":"active","mp":115,"power":230,"chance":96,"gradeIndex":4},"bow_shot_ssr":{"family":"bow_shot","weapon":"bow","type":"active","mp":170,"power":275,"chance":98,"gradeIndex":5},"bow_volley_c":{"family":"bow_volley","weapon":"bow","type":"active","mp":15,"power":80,"chance":85,"gradeIndex":0},"bow_volley_b":{"family":"bow_volley","weapon":"bow","type":"active","mp":30,"power":120,"chance":88,"gradeIndex":1},"bow_volley_a":{"family":"bow_volley","weapon":"bow","type":"active","mp":55,"power":150,"chance":91,"gradeIndex":2},"bow_volley_s":{"family":"bow_volley","weapon":"bow","type":"active","mp":90,"power":185,"chance":94,"gradeIndex":3},"bow_volley_sr":{"family":"bow_volley","weapon":"bow","type":"active","mp":135,"power":225,"chance":97,"gradeIndex":4},"bow_volley_ssr":{"family":"bow_volley","weapon":"bow","type":"active","mp":200,"power":270,"chance":100,"gradeIndex":5},"staff_flame_c":{"family":"staff_flame","weapon":"staff","type":"active","mp":0,"power":70,"chance":100,"gradeIndex":0},"staff_flame_b":{"family":"staff_flame","weapon":"staff","type":"active","mp":25,"power":120,"chance":90,"gradeIndex":1},"staff_flame_a":{"family":"staff_flame","weapon":"staff","type":"active","mp":45,"power":150,"chance":92,"gradeIndex":2},"staff_flame_s":{"family":"staff_flame","weapon":"staff","type":"active","mp":75,"power":185,"chance":94,"gradeIndex":3},"staff_flame_sr":{"family":"staff_flame","weapon":"staff","type":"active","mp":115,"power":225,"chance":96,"gradeIndex":4},"staff_flame_ssr":{"family":"staff_flame","weapon":"staff","type":"active","mp":170,"power":270,"chance":98,"gradeIndex":5},"staff_rift_c":{"family":"staff_rift","weapon":"staff","type":"active","mp":15,"power":70,"chance":90,"gradeIndex":0},"staff_rift_b":{"family":"staff_rift","weapon":"staff","type":"active","mp":30,"power":110,"chance":92,"gradeIndex":1},"staff_rift_a":{"family":"staff_rift","weapon":"staff","type":"active","mp":55,"power":145,"chance":94,"gradeIndex":2},"staff_rift_s":{"family":"staff_rift","weapon":"staff","type":"active","mp":90,"power":185,"chance":96,"gradeIndex":3},"staff_rift_sr":{"family":"staff_rift","weapon":"staff","type":"active","mp":135,"power":230,"chance":98,"gradeIndex":4},"staff_rift_ssr":{"family":"staff_rift","weapon":"staff","type":"active","mp":200,"power":280,"chance":100,"gradeIndex":5},"shield_c":{"family":"shield","weapon":"any","type":"active","mp":10,"power":6,"chance":100,"gradeIndex":0},"shield_b":{"family":"shield","weapon":"any","type":"active","mp":20,"power":9,"chance":100,"gradeIndex":1},"shield_a":{"family":"shield","weapon":"any","type":"active","mp":35,"power":13,"chance":100,"gradeIndex":2},"shield_s":{"family":"shield","weapon":"any","type":"active","mp":55,"power":18,"chance":100,"gradeIndex":3},"shield_sr":{"family":"shield","weapon":"any","type":"active","mp":80,"power":24,"chance":100,"gradeIndex":4},"shield_ssr":{"family":"shield","weapon":"any","type":"active","mp":110,"power":31,"chance":100,"gradeIndex":5},"heal_c":{"family":"heal","weapon":"any","type":"active","mp":20,"power":6,"chance":100,"gradeIndex":0},"heal_b":{"family":"heal","weapon":"any","type":"active","mp":35,"power":10,"chance":100,"gradeIndex":1},"heal_a":{"family":"heal","weapon":"any","type":"active","mp":55,"power":15,"chance":100,"gradeIndex":2},"heal_s":{"family":"heal","weapon":"any","type":"active","mp":80,"power":21,"chance":100,"gradeIndex":3},"heal_sr":{"family":"heal","weapon":"any","type":"active","mp":110,"power":28,"chance":100,"gradeIndex":4},"heal_ssr":{"family":"heal","weapon":"any","type":"active","mp":150,"power":36,"chance":100,"gradeIndex":5},"restore_c":{"family":"restore","weapon":"any","type":"active","mp":0,"power":25,"chance":100,"gradeIndex":0},"restore_b":{"family":"restore","weapon":"any","type":"active","mp":0,"power":40,"chance":100,"gradeIndex":1},"restore_a":{"family":"restore","weapon":"any","type":"active","mp":0,"power":60,"chance":100,"gradeIndex":2},"restore_s":{"family":"restore","weapon":"any","type":"active","mp":0,"power":85,"chance":100,"gradeIndex":3},"restore_sr":{"family":"restore","weapon":"any","type":"active","mp":0,"power":115,"chance":100,"gradeIndex":4},"restore_ssr":{"family":"restore","weapon":"any","type":"active","mp":0,"power":150,"chance":100,"gradeIndex":5},"prepare_c":{"family":"prepare","weapon":"any","type":"active","mp":10,"power":10,"chance":100,"gradeIndex":0},"prepare_b":{"family":"prepare","weapon":"any","type":"active","mp":20,"power":15,"chance":100,"gradeIndex":1},"prepare_a":{"family":"prepare","weapon":"any","type":"active","mp":35,"power":22,"chance":100,"gradeIndex":2},"prepare_s":{"family":"prepare","weapon":"any","type":"active","mp":55,"power":30,"chance":100,"gradeIndex":3},"prepare_sr":{"family":"prepare","weapon":"any","type":"active","mp":80,"power":40,"chance":100,"gradeIndex":4},"prepare_ssr":{"family":"prepare","weapon":"any","type":"active","mp":110,"power":50,"chance":100,"gradeIndex":5},"sword_mastery_c":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":3,"chance":100,"gradeIndex":0},"sword_mastery_b":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":5,"chance":100,"gradeIndex":1},"sword_mastery_a":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":7,"chance":100,"gradeIndex":2},"sword_mastery_s":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":3},"sword_mastery_sr":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":4},"sword_mastery_ssr":{"family":"sword_mastery","weapon":"sword","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"bow_mastery_c":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":0,"chance":100,"gradeIndex":0},"bow_mastery_b":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":2,"chance":100,"gradeIndex":1},"bow_mastery_a":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":4,"chance":100,"gradeIndex":2},"bow_mastery_s":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":6,"chance":100,"gradeIndex":3},"bow_mastery_sr":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":4},"bow_mastery_ssr":{"family":"bow_mastery","weapon":"bow","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":5},"staff_mastery_c":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":3,"chance":100,"gradeIndex":0},"staff_mastery_b":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":5,"chance":100,"gradeIndex":1},"staff_mastery_a":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":7,"chance":100,"gradeIndex":2},"staff_mastery_s":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":9,"chance":100,"gradeIndex":3},"staff_mastery_sr":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":12,"chance":100,"gradeIndex":4},"staff_mastery_ssr":{"family":"staff_mastery","weapon":"staff","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"return_oath_ssr":{"family":"return_oath","weapon":"any","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5},"sixth_mark_ssr":{"family":"sixth_mark","weapon":"any","type":"passive","mp":0,"power":15,"chance":100,"gradeIndex":5}}$json$::jsonb)->p_id;
$spec$;

create or replace function private.guild_boss_combat(p_user uuid,p_boss private.guild_boss_encounters,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero jsonb; hs private.hunting_states%rowtype;
 preset text[]:=array[]::text[]; skill text; candidate text; spec jsonb; family text; weapon text;
 max_hp numeric; hp numeric; attack numeric; defense numeric; crit numeric; crit_multiplier numeric; penetration numeric;
 mp_max numeric; mp numeric; bonus numeric:=0; preparatory numeric:=0; shield numeric:=0; dots numeric:=0;
 passive_hp numeric:=0; hit numeric; dealt bigint:=0; damage_taken numeric; threshold numeric;
 skill_power numeric; skill_chance numeric; skill_mp numeric; enhancement integer; cooldown jsonb:='{}';
 turn_number integer; turns jsonb:='[]'; lines jsonb; label text; guard boolean; active_count integer:=0;
 begin_hp numeric; action_limit integer:=12;
begin
 select * into hs from private.hunting_states where user_id=p_user;
 preset:=coalesce(hs.skills,array[]::text[]);
 hero:=private.combat_equipment_stats(p_user,jsonb_set(p_payload,'{expedition}',jsonb_build_object('equipment',p_payload->'equipped'),true));
 weapon:=coalesce(hero->>'weapon','sword');
 max_hp:=greatest(1,(hero->>'hp')::numeric);hp:=max_hp;begin_hp:=max_hp;
 attack:=greatest(0,(hero->>'attack')::numeric);
 defense:=greatest(0,(hero->>'defense')::numeric);
 crit:=greatest(0,least(1,coalesce((hero->>'critChance')::numeric,.05)));
 crit_multiplier:=greatest(1,coalesce((hero->>'critDamage')::numeric,1.5));
 penetration:=greatest(0,least(1,coalesce((hero->>'armorPenetration')::numeric,0)));
 mp_max:=100+10*coalesce((hs.stat_allocation->>'mp')::integer,0);mp:=mp_max;
 -- Validate every passive server-side and apply the player's enhancement level.
 foreach candidate in array preset loop
  spec:=private.hunting_skill_spec(candidate);
  if spec is null or spec->>'type'<>'passive' or spec->>'weapon' not in ('any',weapon) then continue;end if;
  select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=candidate;
  if not found then continue;end if;
  bonus:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05)/100;
  if spec->>'family'='return_oath' then
   max_hp:=max_hp*(1+bonus);hp:=max_hp;begin_hp:=max_hp;
  elsif spec->>'family' in ('sword_mastery','bow_mastery','staff_mastery') then
   passive_hp:=passive_hp+bonus;
  end if;
 end loop;
 for turn_number in 1..action_limit loop
  exit when hp<=0 or dealt>=p_boss.remaining_hp;
  lines:='[]';skill:=null;spec:=null;guard:=false;hit:=0;label:='기본 공격';
  if dots>0 then
   hit:=least(dots,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array('지속 피해 '||hit::bigint::text);
   dots:=0;
  end if;
  exit when dealt>=p_boss.remaining_hp;
  foreach candidate in array preset loop
   if coalesce((cooldown->>candidate)::integer,0)>turn_number then continue;end if;
   if candidate in ('heavy','quick','guard') then
    if candidate<>'guard' or hp/max_hp<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon) then continue;end if;
   if not exists(select 1 from private.learned_catalog_skills where user_id=p_user and skill_id=candidate) then continue;end if;
   if (spec->>'mp')::numeric>mp then continue;end if;
   if (spec->>'family'='restore' and mp>=mp_max)
    or (spec->>'family'='heal' and hp>=max_hp*.95)
    or (spec->>'family'='shield' and shield>max_hp*.1)
    or (spec->>'family'='prepare' and preparatory>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then
   if skill='guard' then
    guard:=true;label:='방어';cooldown:=cooldown||jsonb_build_object(skill,turn_number+4);
   elsif skill in ('heavy','quick') then
    label:=case skill when 'heavy' then '강타' else '속공' end;
    hit:=private.hunting_damage(attack,p_boss.defense_power,
     (case skill when 'heavy' then 1.8 else 1.2 end)*(1+passive_hp)*(case when random()<crit then crit_multiplier else 1 end),
     penetration);
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+case when skill='heavy' then 3 else 2 end);
   else
    select enhancement_level into enhancement from private.learned_catalog_skills where user_id=p_user and skill_id=skill;
    family:=spec->>'family';skill_power:=(spec->>'power')::numeric*(1+coalesce(enhancement,0)*.05);
    skill_chance:=coalesce((spec->>'chance')::numeric,100);skill_mp:=(spec->>'mp')::numeric;
    mp:=mp-skill_mp;active_count:=active_count+1;
    cooldown:=cooldown||jsonb_build_object(skill,turn_number+
      case when family in ('heal','shield') then 4 when family in ('restore','prepare') then 3 else 1 end);
    label:=coalesce((select name from private.skill_book_catalog where skill_id=skill),'스킬');
    if random()*100>=skill_chance then lines:=lines||jsonb_build_array(label||' · 발동 실패');
    elsif family='heal' then
     hit:=0;hp:=least(max_hp,hp+floor(max_hp*skill_power/100));
     lines:=lines||jsonb_build_array(label||' · HP 회복');
    elsif family='restore' then
     mp:=least(mp_max,mp+skill_power);
     lines:=lines||jsonb_build_array(label||' · MP 회복');
    elsif family='shield' then
     shield:=floor(max_hp*skill_power/100);
     lines:=lines||jsonb_build_array(label||' · 보호막');
    elsif family='prepare' then
     preparatory:=skill_power/100;
     lines:=lines||jsonb_build_array(label||' · 위력 증가 준비');
    else
     hit:=private.hunting_damage(attack,p_boss.defense_power,
      skill_power/100*(1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end),
      least(1,penetration+case when family in ('sword_strike','bow_shot') then .05*greatest(0,(spec->>'gradeIndex')::integer-1) else 0 end));
     if family in ('sword_wound','bow_volley','staff_flame') then
      dots:=floor(attack*.1*(1+coalesce(enhancement,0)*.05));
     end if;
     if family='sword_wound' then hp:=least(max_hp,hp+floor(hit*.05));end if;
     if family='staff_rift' then hit:=hit+floor(hit*.05);end if;
     preparatory:=0;
    end if;
   end if;
  else
   hit:=private.hunting_damage(attack,p_boss.defense_power,
    (1+passive_hp)*(1+preparatory)*(case when random()<crit then crit_multiplier else 1 end),penetration);
   preparatory:=0;
  end if;
  if hit>0 then
   hit:=least(hit,p_boss.remaining_hp-dealt);
   dealt:=dealt+hit::bigint;
   lines:=lines||jsonb_build_array(label||' · '||hit::bigint::text||' 피해');
  elsif jsonb_array_length(lines)=0 then lines:=lines||jsonb_build_array(label);
  end if;
  if dealt<p_boss.remaining_hp then
   threshold:=case when p_boss.kind='WEEKLY' and turn_number%4=0 then 1.35 else 1 end;
   damage_taken:=private.hunting_damage(p_boss.attack_power,defense,threshold*(case when guard then .5 else 1 end),0);
   if shield>0 then
    damage_taken:=greatest(0,damage_taken-shield);
    shield:=greatest(0,shield-private.hunting_damage(p_boss.attack_power,defense,threshold,0));
   end if;
   hp:=greatest(0,hp-damage_taken);
   lines:=lines||jsonb_build_array(p_boss.boss_name||'의 반격 · '||damage_taken::bigint::text||' 피해');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_number,'lines',lines,'playerHp',hp,'playerMp',mp,'damageTotal',dealt));
 end loop;
 return jsonb_build_object('damage',dealt,'turns',turns,'playerHp',hp,'maxPlayerHp',begin_hp,'playerMp',mp,'maxPlayerMp',mp_max,
  'outcome',case when hp<=0 then 'defeated' else 'survived' end,'attackStat',attack,'defenseStat',defense,'weapon',weapon);
end;$$;