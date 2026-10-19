CREATE OR REPLACE FUNCTION private.hunting_conditions_match(conditions jsonb, context jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare c jsonb;k text;v numeric;actual numeric;present boolean;
begin
 if conditions is null then return true;end if;
 if jsonb_typeof(conditions)<>'array' or jsonb_array_length(conditions)>2 then return false;end if;
 for c in select value from jsonb_array_elements(conditions) loop
  k:=c->>'kind';
  if k ~ '_(gte|lte|every)$' then v:=coalesce((c->>'value')::numeric,0);end if;
  if k='always' then continue;
  elsif k='turn_every' then if v<1 or (context->>'turn')::integer%v<>0 then return false;end if;
  elsif k ~ '_(gte|lte)$' then
   actual:=(context->>regexp_replace(k,'_(gte|lte)$',''))::numeric;
   if actual is null or (k like '%_gte' and actual<v) or (k like '%_lte' and actual>v) then return false;end if;
  elsif k ~ '_(present|absent)$' then
   present:=(context->>regexp_replace(k,'_(present|absent)$',''))::boolean;
   if present is null or (k like '%_present' and not present) or (k like '%_absent' and present) then return false;end if;
  else return false;end if;
 end loop;
 return true;
end $function$

