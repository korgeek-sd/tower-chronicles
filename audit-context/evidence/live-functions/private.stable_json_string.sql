CREATE OR REPLACE FUNCTION private.stable_json_string(p_value jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_type text := jsonb_typeof(p_value);
  v_result text;
begin
  if v_type='object' then
    select '{'||coalesce(string_agg(to_jsonb(e.key)::text||':'||private.stable_json_string(e.value),',' order by e.key collate "C"),'')||'}'
    into v_result
    from jsonb_each(p_value) e;
    return v_result;
  elsif v_type='array' then
    select '['||coalesce(string_agg(private.stable_json_string(a.value),',' order by a.ord),'')||']'
    into v_result
    from jsonb_array_elements(p_value) with ordinality a(value,ord);
    return v_result;
  else
    return p_value::text;
  end if;
end;
$function$

