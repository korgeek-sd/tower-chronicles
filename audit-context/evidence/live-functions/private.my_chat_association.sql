CREATE OR REPLACE FUNCTION private.my_chat_association()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',a.association_id,'name',a.name) from private.online_association_members m
 join private.online_associations a using(association_id) where m.user_id=auth.uid() and a.status='ACTIVE'
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.game_player_profiles where user_id=auth.uid()) limit 1;
$function$

