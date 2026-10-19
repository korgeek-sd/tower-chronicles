CREATE OR REPLACE FUNCTION private.prepare_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_name text; v_last timestamptz;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'CHAT_AUTH_REQUIRED' using errcode='42501';
 end if;
 select nickname into v_name from public.game_player_profiles where user_id=v_user for update;
 if not found then raise exception 'CHAT_PROFILE_REQUIRED' using errcode='42501';end if;
 if new.association_id is not null then
  perform 1 from private.online_association_members m join private.online_associations a using(association_id)
   where m.user_id=v_user and m.association_id=new.association_id and a.status='ACTIVE' for share of m,a;
  if not found then raise exception 'CHAT_ASSOCIATION_REQUIRED' using errcode='42501';end if;
 end if;
 -- Retries of an already committed request hit UNIQUE and recover the original through REST.
 if not exists(select 1 from public.game_chat_messages where user_id=v_user and client_id=new.client_id) then
  select created_at into v_last from public.game_chat_messages where user_id=v_user order by created_at desc limit 1;
  if v_last is not null and clock_timestamp()<v_last+interval '2 seconds' then
   raise exception 'CHAT_RATE_LIMIT' using errcode='P0001';
  end if;
 end if;
 new.body:=btrim(normalize(new.body,NFC));
 if new.body is null or char_length(new.body) not between 1 and 200 or new.body ~ '[[:cntrl:]]'
 or new.body ~ U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]' then
  raise exception 'CHAT_BODY_INVALID' using errcode='23514';
 end if;
 new.user_id:=v_user;new.nickname:=v_name;new.created_at:=clock_timestamp();
 return new;
end;$function$

