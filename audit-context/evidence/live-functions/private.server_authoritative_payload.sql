CREATE OR REPLACE FUNCTION private.server_authoritative_payload(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p jsonb;
  b jsonb:=private.server_consumables_json(p_user);
  l jsonb;
  owned jsonb:=private.server_owned_jobs_json(p_user);
  current_job text:=private.server_current_job(p_user);
begin
  p:=private.server_economy_payload(p_user,p_payload);
  l:=coalesce(p->'loadout','{}'::jsonb);
  p:=jsonb_set(p,'{potions}',b,true);
  p:=jsonb_set(p,'{loadout}',jsonb_build_object(
    'healing_lesser',least(greatest(0,coalesce((l->>'healing_lesser')::integer,0)),coalesce((b->>'healing_lesser')::integer,0)),
    'healing_standard',least(greatest(0,coalesce((l->>'healing_standard')::integer,0)),coalesce((b->>'healing_standard')::integer,0)),
    'healing_greater',least(greatest(0,coalesce((l->>'healing_greater')::integer,0)),coalesce((b->>'healing_greater')::integer,0)),
    'healing_supreme',least(greatest(0,coalesce((l->>'healing_supreme')::integer,0)),coalesce((b->>'healing_supreme')::integer,0)),
    'revival',least(1,greatest(0,coalesce((l->>'revival')::integer,0)),coalesce((b->>'revival')::integer,0))
  ),true);
  p:=jsonb_set(p,'{ownedJobIds}',owned,true);
  p:=jsonb_set(p,'{currentJobId}',case when current_job is null then 'null'::jsonb else to_jsonb(current_job) end,true);
  p:=private.server_association_payload(p_user,p);
  return p;
end $function$

