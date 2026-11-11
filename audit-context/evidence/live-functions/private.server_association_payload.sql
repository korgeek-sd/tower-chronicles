CREATE OR REPLACE FUNCTION private.server_association_payload(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p jsonb:=p_payload;
  v_qualified boolean:=false;
begin
  select qualified into v_qualified
  from private.player_association_eligibility
  where user_id=p_user;
  p:=jsonb_set(p,'{association}',private.server_association_projection(p_user),true);
  p:=jsonb_set(p,'{market,traderCertified}',to_jsonb(coalesce(v_qualified,false)),true);
  return p;
end;$function$

