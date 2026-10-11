-- Enable Corsair in the same guarded server job pathways as existing combat-ready classes.
-- This is idempotent and retains the entitlement and active-expedition checks.
DO $corsair_selection$
DECLARE
 f record;
 source_definition text;
 updated_definition text;
 marker text;
BEGIN
 FOR f IN
  SELECT p.oid,n.nspname,p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='public' AND p.proname='select_online_job')
     OR (n.nspname='private' AND p.proname IN ('require_server_combat_job','server_start_encounter'))
 LOOP
  source_definition:=pg_get_functiondef(f.oid);
  IF strpos(source_definition,'''corsair''')>0 THEN CONTINUE; END IF;
  marker:=CASE WHEN f.nspname='public' THEN '''hundred_battle_returnee''' ELSE '''expedition_archivist''' END;
  updated_definition:=replace(source_definition,marker,marker||','||quote_literal('corsair'));
  IF updated_definition=source_definition THEN
   -- Some newer encounter implementations no longer use a static job whitelist.
   -- Those already accept the selected catalog job and must be left untouched.
   IF f.nspname='public' THEN
    RAISE EXCEPTION 'CORSAIR_JOB_SELECTION_PATCH_SOURCE_MISMATCH: %.%',f.nspname,f.proname;
   END IF;
   CONTINUE;
  END IF;
  EXECUTE updated_definition;
 END LOOP;
END
$corsair_selection$;
