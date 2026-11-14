-- Resolve PL/pgSQL ambiguity between RETURNS TABLE output parameters and conflict target.
CREATE OR REPLACE FUNCTION public.register_initial_character(p_nickname text, p_class_id text)
 RETURNS TABLE(user_id uuid, nickname text, class_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := auth.uid();
 v_existing_name text;
 v_existing_class text;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Google 로그인이 필요합니다.' using errcode = '28000';
 end if;
 if p_class_id is null or p_class_id not in ('warrior','mage','archer') then
  raise exception '선택할 수 없는 직업입니다.' using errcode = '22023';
 end if;
 if p_nickname is null then
  raise exception '사용할 수 없는 닉네임입니다.' using errcode = '22023';
 end if;

 -- Serialize simultaneous registration attempts for this account.
 perform 1 from auth.users u where u.id=v_uid for update;
 if not found then
  raise exception '로그인 계정을 확인하지 못했습니다.' using errcode = '28000';
 end if;

 select p.nickname into v_existing_name
 from public.game_player_profiles p where p.user_id=v_uid;
 if found then
  select c.class_id into v_existing_class
  from public.game_initial_classes c where c.user_id=v_uid;
  -- Idempotent retry after a successful but unacknowledged registration.
  if v_existing_name=p_nickname and v_existing_class=p_class_id then
   return query select v_uid,v_existing_name,v_existing_class;
   return;
  end if;
  raise exception '이미 등록된 계정의 직업과 이름은 변경할 수 없습니다.'
    using errcode = 'P0001';
 end if;

 -- This update is only permitted before a profile has been registered.
 -- Direct client UPDATE/DELETE remain forbidden by existing RLS/grants.
 insert into public.game_initial_classes(user_id,class_id)
 values(v_uid,p_class_id)
 on conflict on constraint game_initial_classes_pkey do update set class_id=excluded.class_id;

 -- Both writes commit together. If the nickname is invalid/taken, neither
 -- the final class nor the nickname is saved.
 insert into public.game_player_profiles(user_id,nickname)
 values(v_uid,p_nickname);

 return query select v_uid,p_nickname,p_class_id;
end;
$function$
;
notify pgrst, 'reload schema';
