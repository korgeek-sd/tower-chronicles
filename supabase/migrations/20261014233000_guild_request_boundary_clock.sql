-- Generated with Supabase CLI; ordered after the existing KST-named auction revisions.
-- now() freezes at transaction start. Requests queued on row/advisory locks
-- must validate raid cycles, daily quota dates and auction deadlines using the
-- live database clock. Preserve each installed definition and its grants.
do $boundary$
declare signature text; fn regprocedure; definition text;
begin
 foreach signature in array array[
  'public.attack_guild_boss(uuid,bigint,text,text,uuid,text)',
  'public.bid_guild_auction(uuid,bigint,text,text,uuid,uuid,bigint)',
  'private.guild_boss_state_json(uuid)',
  'private.guild_auction_state_json(uuid)'
 ] loop
  fn:=to_regprocedure(signature);
  -- A partial test fixture may install only the raid or auction subsystem.
  if fn is null then continue;end if;
  definition:=pg_get_functiondef(fn);
  execute replace(definition,'now()','clock_timestamp()');
 end loop;
end;
$boundary$;
