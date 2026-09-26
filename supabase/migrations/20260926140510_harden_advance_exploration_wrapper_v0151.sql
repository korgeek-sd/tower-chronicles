-- v0.1.51 harden the compatibility wrapper.
-- The wrapper itself does not need elevated privileges; the guarded canonical RPC it calls retains SECURITY DEFINER.

alter function public.advance_online_exploration(uuid,bigint,text,text,bigint) security invoker;
revoke all on function public.advance_online_exploration(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.advance_online_exploration(uuid,bigint,text,text,bigint) to authenticated;
