do $repair$
declare original text;patched text;
begin
 original:=pg_get_functiondef('private.server_start_encounter(uuid,private.online_expeditions,jsonb,private.online_combat_states)'::regprocedure);
 patched:=regexp_replace(original,'j\s*:=case when p_run\.job_snapshot_id in\([^;]+;','j:=private.server_job_id(jsonb_build_object(''expedition'',jsonb_build_object(''jobSnapshotId'',p_run.job_snapshot_id)));');
 if patched=original then
  if strpos(original,'j:=private.server_job_id(')=0 then raise exception 'Encounter job whitelist was not found';end if;
 else execute patched;end if;
end $repair$;

update private.online_combat_states c
set job_id=e.job_snapshot_id,state_version=c.state_version+1,updated_at=now()
from private.online_expeditions e
where c.user_id=e.user_id and c.run_id=e.run_id and e.status='ACTIVE'
 and c.job_id is null and e.job_snapshot_id is not null
 and private.server_job_id(jsonb_build_object('expedition',jsonb_build_object('jobSnapshotId',e.job_snapshot_id)))=e.job_snapshot_id;

