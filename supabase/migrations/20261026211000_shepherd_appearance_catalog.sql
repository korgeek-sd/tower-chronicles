-- Add the new B-rarity shepherd to the server-authoritative summon/effect catalog.
-- No changes to player ownership, summon odds, or existing entries.
insert into private.appearance_catalog (appearance_id,rarity,effect_id)
values ('shepherd','B','shield_generation')
on conflict (appearance_id) do nothing;

do $$
begin
  if not exists (
    select 1 from private.appearance_catalog
    where appearance_id='shepherd' and rarity='B' and effect_id='shield_generation'
  ) then
    raise exception 'SHEPHERD_CATALOG_MISMATCH';
  end if;
end $$;
