-- v0.1.51 fix scalar-to-array concatenation in canonical event selection.
-- Keep array element appends explicit so Postgres never attempts to parse event IDs as array literals.

create or replace function private.server_event_id(
  p_tower text,
  p_floor integer,
  p_hp bigint,
  p_max_hp bigint,
  p_ticket numeric
)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  ids text[]:=array[]::text[];
  weights numeric[]:=array[]::numeric[];
  total numeric:=0;
  v numeric;
  i int;
begin
  if p_max_hp>0 and p_hp::numeric/p_max_hp<.8 then
    ids:=array_append(ids,'common_rest');
    weights:=array_append(weights,1::numeric);
  end if;
  ids:=array_append(ids,'common_cache');
  weights:=array_append(weights,1::numeric);
  ids:=array_append(ids,'resource_gather_'||p_tower);
  weights:=array_append(weights,1::numeric);
  ids:=array_append(ids,'common_risk');
  weights:=array_append(weights,1::numeric);
  ids:=array_append(ids,'common_remedy');
  weights:=array_append(weights,1::numeric);
  if p_floor between 3 and 10 then
    ids:=array_append(ids,'resource_stronghold');
    weights:=array_append(weights,.65::numeric);
  end if;
  select sum(x) into total from unnest(weights)x;
  v:=p_ticket*total;
  for i in 1..array_length(ids,1) loop
    if v<weights[i] then return ids[i];end if;
    v:=v-weights[i];
  end loop;
  return ids[array_length(ids,1)];
end
$$;

create or replace function private.server_event_id(
  p_tower text,
  p_floor integer,
  p_hp bigint,
  p_max_hp bigint,
  p_ticket numeric,
  p_recent text[],
  p_stronghold jsonb
)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  ids text[]:=array[]::text[];
  weights numeric[]:=array[]::numeric[];
  total numeric:=0;
  v numeric;
  i int;
  blocked boolean:=coalesce(p_stronghold->>'status','') in('ACTIVE','CONTESTED');
begin
  if p_max_hp>0 and p_hp::numeric/p_max_hp<.8 and not ('common_rest'=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'common_rest');
    weights:=array_append(weights,1::numeric);
  end if;
  if not ('common_cache'=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'common_cache');
    weights:=array_append(weights,1::numeric);
  end if;
  if not (('resource_gather_'||p_tower)=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'resource_gather_'||p_tower);
    weights:=array_append(weights,1::numeric);
  end if;
  if not ('common_risk'=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'common_risk');
    weights:=array_append(weights,1::numeric);
  end if;
  if not ('common_remedy'=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'common_remedy');
    weights:=array_append(weights,1::numeric);
  end if;
  if p_floor between 3 and 10
     and not blocked
     and not ('resource_stronghold'=any(coalesce(p_recent,'{}'::text[]))) then
    ids:=array_append(ids,'resource_stronghold');
    weights:=array_append(weights,.65::numeric);
  end if;
  if coalesce(array_length(ids,1),0)=0 then return null;end if;
  select sum(x) into total from unnest(weights)x;
  v:=p_ticket*total;
  for i in 1..array_length(ids,1) loop
    if v<weights[i] then return ids[i];end if;
    v:=v-weights[i];
  end loop;
  return ids[array_length(ids,1)];
end
$$;

revoke all on function private.server_event_id(text,integer,bigint,bigint,numeric) from public,anon,authenticated;
revoke all on function private.server_event_id(text,integer,bigint,bigint,numeric,text[],jsonb) from public,anon,authenticated;
