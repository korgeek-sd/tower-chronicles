-- Header lookup is read-only: it never synchronizes saves or settles rewards.
create function public.get_premium_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object('expiresAt',(select extract(epoch from expires_at)*1000 from private.premium_accounts where user_id=u),'serverNow',extract(epoch from now())*1000);
end $$;
revoke all on function public.get_premium_status() from public,anon;
grant execute on function public.get_premium_status() to authenticated;
