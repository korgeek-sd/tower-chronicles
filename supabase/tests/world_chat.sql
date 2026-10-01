begin;
create temporary table chat_test_context as select id,row_number() over(order by id) n from (select id from auth.users order by id limit 2) u;
grant select on chat_test_context to authenticated;
-- Existing identities are reused; only missing profiles receive a transaction-local fixture.
insert into public.game_player_profiles(user_id,nickname)
 select c.id,'Qa'||substr(md5(c.id::text),1,8) from chat_test_context c
 where not exists(select 1 from public.game_player_profiles p where p.user_id=c.id);
set local role authenticated;
do $$
declare mine uuid; other_user uuid; msg public.game_chat_messages; cid uuid:=gen_random_uuid();
begin
 select id into mine from chat_test_context where n=1;
 select id into other_user from chat_test_context where n=2;
 if mine is null or other_user is null then raise exception 'Need two fixture accounts';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',mine,'role','authenticated')::text,true);
 -- Use the second account for a missing-profile test before creating profiles in a separate test.
 insert into public.game_chat_messages(body,client_id) values('안녕하세요',cid) returning * into msg;
 if msg.user_id<>mine or msg.nickname<>(select nickname from public.game_player_profiles where user_id=mine) then raise exception 'Sender attribution failed';end if;
 if abs(extract(epoch from(clock_timestamp()-msg.created_at)))>3 then raise exception 'Server timestamp failed';end if;
 begin insert into public.game_chat_messages(body,client_id) values('도배',gen_random_uuid());raise exception 'Cooldown bypass';exception when raise_exception then if sqlerrm<>'CHAT_RATE_LIMIT' then raise;end if;end;
 begin insert into public.game_chat_messages(body,client_id) values('안녕하세요',cid);raise exception 'Duplicate inserted';exception when unique_violation then null;end;
 begin insert into public.game_chat_messages(body,client_id,user_id) values('위조',gen_random_uuid(),other_user);raise exception 'Sender forged';exception when insufficient_privilege then null;end;
 begin update public.game_chat_messages set body='변경' where id=msg.id;raise exception 'Edited';exception when insufficient_privilege then null;end;
 begin delete from public.game_chat_messages where id=msg.id;raise exception 'Deleted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',other_user,'role','authenticated')::text,true);
 begin insert into public.game_chat_messages(body,client_id) values(repeat('a',201),gen_random_uuid());raise exception 'Long message accepted';exception when check_violation then null;end;
 begin insert into public.game_chat_messages(body,client_id) values('a'||chr(8203)||'b',gen_random_uuid());raise exception 'Invisible text accepted';exception when check_violation then null;end;
 begin insert into public.game_chat_messages(body,client_id) values(E'a\nb',gen_random_uuid());raise exception 'Control text accepted';exception when check_violation then null;end;
 if not exists(select 1 from public.game_chat_messages where id=msg.id) then raise exception 'Other member cannot read';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',other_user,'role','authenticated','is_anonymous',true)::text,true);
 if exists(select 1 from public.game_chat_messages) then raise exception 'Anonymous member read';end if;
 begin insert into public.game_chat_messages(body,client_id) values('익명',gen_random_uuid());raise exception 'Anonymous insert';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$begin
 begin perform body from public.game_chat_messages;raise exception 'Guest read';exception when insufficient_privilege then null;end;
 begin insert into public.game_chat_messages(body,client_id) values('익명',gen_random_uuid());raise exception 'Guest send';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'world chat attribution, cooldown, idempotency, immutable history, validation, member access and anonymous denial passed; writes rolled back' as result;
