do $migration$
declare
 definition text := pg_get_functiondef('public.open_adventurer_boxes(uuid,bigint,text,text,uuid,integer)'::regprocedure);
 old_limit text := 'if cardinality(recent)>=30 then';
begin
 if array_length(string_to_array(definition,old_limit),1) is distinct from 2 then
  raise exception 'Unexpected equipment box rate limit definition';
 end if;
 execute replace(definition,old_limit,'if cardinality(recent)>=300 then');
end $migration$;
