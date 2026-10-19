-- SQL's three-valued comparisons must not let NULL lease arguments bypass authority.
-- Patch the installed functions without reverting later economy/bank changes or their ACLs.
do $migration$
declare
 signature text;body text;prefix text;pair text[];token text;
 marker text:=E'\nbegin\n';
 guard text:=E'\nbegin\n  if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception ''GAME_SESSION_LOST'';end if;\n';
begin
 foreach signature in array array[
  'private.require_active_game_session(uuid,bigint,text,text)',
  'public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text)'
 ] loop
  body:=pg_get_functiondef(signature::regprocedure);
  if (length(body)-length(replace(body,marker,'')))/length(marker)<>1 then
   raise exception 'Unexpected session function body: %',signature;
  end if;
  prefix:=case when signature like 'private.%' then 'v_active.' else 'v_game_session.' end;
  foreach pair slice 1 in array array[
   ['lease_id','p_lease_id'],['generation','p_generation'],['auth_session_id','v_auth_session'],
   ['device_id','p_device_id'],['client_instance_id','p_client_instance_id']
  ] loop
   token:=prefix||pair[1]||'<>'||pair[2];
   if strpos(body,token)=0 then raise exception 'Expected session comparison missing: %',token;end if;
   body:=replace(body,token,prefix||pair[1]||' is distinct from '||pair[2]);
  end loop;
  body:=replace(body,marker,guard);
  execute body;
 end loop;

 signature:='public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb)';
 body:=pg_get_functiondef(signature::regprocedure);
 token:='  if p_outcome not in(''returned'',''dead'') then raise exception ''EXPEDITION_RECEIPT_INVALID'';end if;';
 if strpos(body,token)=0 then raise exception 'Expected settlement validation missing';end if;
 -- Validate before the no-run/already-settled returns and before touching a run.
 body:=replace(body,token,'');
 token:='  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);';
 if strpos(body,token)=0 then raise exception 'Expected settlement session guard missing';end if;
 body:=replace(body,token,token||E'\n  if p_outcome is null or p_outcome not in(''returned'',''dead'') then raise exception ''EXPEDITION_RECEIPT_INVALID'';end if;');
 execute body;
end $migration$;
