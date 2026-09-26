-- v0.1.50 remove superseded client-authoritative action/kill RPCs.
drop function if exists public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text);
drop function if exists public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint);

do $$
begin
 if to_regclass('private.online_combat_actions') is not null then
  comment on table private.online_combat_actions is 'Legacy v0.1.50 pre-authority ledger. No public RPC writes after canonical online combat state migration.';
 end if;
end $$;
