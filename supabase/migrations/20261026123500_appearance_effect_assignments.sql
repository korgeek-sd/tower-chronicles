-- Assignment does not change owned skins, shards, summon rates, or default appearance.
alter table private.appearance_catalog add column if not exists effect_id text;
alter table private.appearance_catalog drop constraint if exists appearance_catalog_effect_id_check;
alter table private.appearance_catalog add constraint appearance_catalog_effect_id_check
 check(effect_id is null or effect_id in ('attack','defense','max_hp','max_mp','crit_chance','crit_damage','armor_penetration','skill_damage','mp_cost_reduction','skill_activation','hp_recovery','shield_generation','dot_damage','hunting_exp','hunting_silver','hunting_equipment_drop'));
update private.appearance_catalog c set effect_id=v.effect_id
from (values
 ('mechanic','hunting_equipment_drop'),
 ('skeleton_knight','defense'),
 ('association_archivist','hunting_exp'),
 ('returning_knight','shield_generation'),
 ('novar_outskirts_guard','defense'),
 ('mining_crew','hunting_silver'),
 ('slime','max_hp'),
 ('faceless_one','skill_activation'),
 ('hexer','dot_damage'),
 ('ice_mage','mp_cost_reduction'),
 ('inquisitor','armor_penetration'),
 ('nameless_pilgrim','hp_recovery'),
 ('scout','skill_activation'),
 ('arcane_archer','skill_damage'),
 ('thief','crit_chance'),
 ('pickpocket','hunting_silver'),
 ('musketeer','crit_damage'),
 ('bounty_hunter','hunting_equipment_drop'),
 ('apprentice_mage','max_mp'),
 ('lumpen','hunting_exp'),
 ('golem','max_hp'),
 ('butcher','dot_damage'),
 ('grave_robber','hunting_equipment_drop'),
 ('court_jester','crit_chance'),
 ('crossbowman','armor_penetration'),
 ('lumberjack','attack'),
 ('corsair','hunting_silver'),
 ('teddy','max_hp'),
 ('plague_doctor','dot_damage'),
 ('knight','shield_generation'),
 ('summoner','skill_damage'),
 ('cultist','mp_cost_reduction'),
 ('celestial_archer','crit_chance'),
 ('assault_gunner','crit_damage'),
 ('alchemist','hp_recovery'),
 ('blacksmith','hunting_equipment_drop'),
 ('contract_mercenary','attack'),
 ('wandering_preacher','hunting_exp'),
 ('proletaria','attack'),
 ('valkyrie','shield_generation'),
 ('seraphim','hp_recovery'),
 ('ophanim','skill_activation'),
 ('advanced_mage','max_mp'),
 ('cain','crit_damage'),
 ('rat_king','hunting_equipment_drop'),
 ('saintess','hp_recovery'),
 ('archmage','skill_damage'),
 ('nameless_sinner','max_hp'),
 ('bourgeoisie','hunting_silver'),
 ('intellectual','hunting_exp'),
 ('necromancer','dot_damage'),
 ('noble_knight','defense'),
 ('antichrist','armor_penetration'),
 ('nidhogg','dot_damage'),
 ('bahamut','max_hp'),
 ('baal','armor_penetration'),
 ('puppeteer','skill_activation'),
 ('nameless_king','attack'),
 ('first_forgotten_one','hunting_equipment_drop'),
 ('false_savior','hp_recovery')
) as v(appearance_id,effect_id) where c.appearance_id=v.appearance_id;
do $$ begin
 if (select count(*) from private.appearance_catalog where effect_id is not null)<>60 then
  raise exception 'APPEARANCE_ASSIGNMENTS_MISMATCH';
 end if;
end $$;

create or replace function private.appearance_effect_base(p_effect text,p_rarity text)
returns numeric language sql immutable set search_path='' as $$
 select case p_effect
 when 'attack' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'defense' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 when 'max_hp' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 when 'max_mp' then case p_rarity when 'C' then 10 when 'B' then 20 when 'A' then 30 when 'SR' then 40 when 'SSR' then 50 else 0 end
 when 'crit_chance' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'crit_damage' then case p_rarity when 'C' then 4 when 'B' then 8 when 'A' then 12 when 'SR' then 16 when 'SSR' then 20 else 0 end
 when 'armor_penetration' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'skill_damage' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 5 when 'SSR' then 7 else 0 end
 when 'mp_cost_reduction' then case p_rarity when 'C' then 2 when 'B' then 3 when 'A' then 4 when 'SR' then 6 when 'SSR' then 8 else 0 end
 when 'skill_activation' then case p_rarity when 'C' then 0.5 when 'B' then 1 when 'A' then 1.5 when 'SR' then 2 when 'SSR' then 3 else 0 end
 when 'hp_recovery' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'shield_generation' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'dot_damage' then case p_rarity when 'C' then 3 when 'B' then 6 when 'A' then 9 when 'SR' then 12 when 'SSR' then 15 else 0 end
 when 'hunting_exp' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'hunting_silver' then case p_rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 when 'SSR' then 5 else 0 end
 when 'hunting_equipment_drop' then case p_rarity when 'C' then 2 when 'B' then 4 when 'A' then 6 when 'SR' then 8 when 'SSR' then 10 else 0 end
 else 0 end
$$;
revoke all on function private.appearance_effect_base(text,text) from public,anon,authenticated;

-- Only the selected, server-owned, unlocked level can produce a battle/reward bonus.
create or replace function private.appearance_equipped_effect(p_user uuid,p_payload jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.effect_id,'value',
  case when c.effect_id='max_mp' then round(private.appearance_effect_base(c.effect_id,c.rarity)*case o.enhancement_level when 1 then 1 when 2 then 1.1 when 3 then 1.2 when 4 then 1.35 when 5 then 1.5 else 0 end)
       else round(private.appearance_effect_base(c.effect_id,c.rarity)*case o.enhancement_level when 1 then 1 when 2 then 1.1 when 3 then 1.2 when 4 then 1.35 when 5 then 1.5 else 0 end,2) end)
 from private.appearance_ownership o join private.appearance_catalog c on c.appearance_id=o.appearance_id
 where o.user_id=p_user and o.appearance_id=p_payload->'cosmetics'->>'selectedAppearanceId'
   and o.enhancement_level between 1 and 5 and c.effect_id is not null
$$;
revoke all on function private.appearance_equipped_effect(uuid,jsonb) from public,anon,authenticated;
