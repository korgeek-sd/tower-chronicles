-- Integration checks against two existing accounts without profiles. All writes roll back.
begin;
create temporary table nickname_test_context as
 select id, row_number() over (order by id) as n from
 (select id from auth.users u where not exists (select 1 from public.game_player_profiles p where p.user_id=u.id) order by id limit 2) candidates;
grant select on nickname_test_context to authenticated;
do $$ begin
 if (select count(*) from nickname_test_context) <> 2 then raise exception 'Nickname tests require two accounts without profiles'; end if;
end $$;
set local role authenticated;
do $$
declare mine uuid; other_user uuid; chosen text;
begin
 select id into mine from nickname_test_context where n=1;
 select id into other_user from nickname_test_context where n=2;
 chosen := 'Qa' || substr(md5(mine::text),1,8);
 perform set_config('request.jwt.claims',json_build_object('sub',mine,'role','authenticated')::text,true);
 insert into public.game_player_profiles(user_id,nickname) values(mine,chosen);
 if not exists(select 1 from public.game_player_profiles where user_id=mine and nickname=chosen) then raise exception 'Own profile not readable'; end if;
 begin
  insert into public.game_player_profiles(user_id,nickname) values(other_user,'다른모험가');
  raise exception 'Cross-account insert unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 begin
  update public.game_player_profiles set nickname='바꾼이름' where user_id=mine;
  raise exception 'Rename unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.game_player_profiles where user_id=mine;
  raise exception 'Delete unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',json_build_object('sub',other_user,'role','authenticated')::text,true);
 begin
  insert into public.game_player_profiles(user_id,nickname) values(other_user,lower(chosen));
  raise exception 'Case-insensitive duplicate unexpectedly succeeded';
 exception when unique_violation then null; end;
 begin
  insert into public.game_player_profiles(user_id,nickname) values(other_user,'ADMIN');
  raise exception 'Reserved nickname unexpectedly succeeded';
 exception when check_violation then null; end;
 begin
  insert into public.game_player_profiles(user_id,nickname) values(other_user,'a b');
  raise exception 'Invalid nickname unexpectedly succeeded';
 exception when check_violation then null; end;
 perform set_config('request.jwt.claims',json_build_object('sub',other_user,'role','authenticated','is_anonymous',true)::text,true);
 begin
  insert into public.game_player_profiles(user_id,nickname) values(other_user,'익명모험가');
  raise exception 'Anonymous user insert unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform nickname from public.game_player_profiles;raise exception 'Anon read unexpectedly succeeded';exception when insufficient_privilege then null;end;
 begin insert into public.game_player_profiles(user_id,nickname) values(gen_random_uuid(),'익명모험가');raise exception 'Anon insert unexpectedly succeeded';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'nickname ownership, case-insensitive uniqueness, immutable identity, validation and anonymous denial passed; writes rolled back' as result;
