-- v0.1.50 remove superseded client-authoritative action/kill RPCs.
revoke all on function public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint) from public,anon,authenticated;
drop function if exists public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text);
drop function if exists public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint);

-- The ledger is retained only as historical migration data; canonical combat state owns actions now.
comment on table private.online_combat_actions is 'Legacy v0.1.50 pre-authority ledger. No public RPC writes after canonical online combat state migration.';
