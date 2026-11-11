CREATE OR REPLACE FUNCTION public.ops_grant_reward(p_user_id uuid, p_reward jsonb, p_reason text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_mail uuid; prior private.operations_audit%rowtype;
begin
 perform private.assert_operations_admin();
 if p_request_id is null or p_user_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 200 then raise exception 'INVALID_GRANT';end if;
 perform private.validate_coupon_reward(p_reward);
 if not exists(select 1 from public.game_player_profiles where user_id=p_user_id) then raise exception 'PLAYER_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select * into prior from private.operations_audit where actor_id=auth.uid() and request_id=p_request_id;
 if found then
  if prior.target_id<>p_user_id::text or prior.details->'reward'<>p_reward or prior.details->>'reason'<>btrim(p_reason) then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('mailId',prior.details->>'mailId','duplicate',true);
 end if;
 insert into private.game_mail(user_id,event_key,category,title,body,attachment_item_id,attachment_quantity,attachment_reward) values(p_user_id,'ops:'||p_request_id,'reward','운영팀 지급 보상',btrim(p_reason),'coupon_reward',1,p_reward) returning mail_id into v_mail;
 insert into private.operations_audit(actor_id,action,target_id,details,request_id) values(auth.uid(),'reward_grant',p_user_id::text,jsonb_build_object('reward',p_reward,'reason',btrim(p_reason),'mailId',v_mail),p_request_id);
 return jsonb_build_object('mailId',v_mail,'duplicate',false);
end $function$

