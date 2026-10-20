-- Authorization/RLS integration checks, not a live WebSocket delivery test.
-- Only synthetic fixtures; every write is rolled back.
begin;
set local lock_timeout='3s';
set local statement_timeout='25s';
create temporary table rt_fixture as
select label,gen_random_uuid() u,gen_random_uuid() association_id,gen_random_uuid() message_id
from unnest(array['a','b','world','unregistered']) label;
grant select on rt_fixture to authenticated,anon;
grant update(message_id) on rt_fixture to authenticated;
insert into auth.users(id,raw_app_meta_data) select u,'{}'::jsonb from rt_fixture;
insert into public.game_player_profiles(user_id,nickname) select u,'시험'||substr(replace(u::text,'-',''),1,8) from rt_fixture where label<>'unregistered';
insert into private.online_associations(association_id,record_number,name,leader_user_id,revenue_share_rate_percent)
select association_id,'QA-'||association_id,'시험'||substr(replace(association_id::text,'-',''),1,8),u,0 from rt_fixture where label in ('a','b');
insert into private.online_association_members(association_id,user_id,role)
select association_id,u,'LEADER' from rt_fixture where label in ('a','b');
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
select u,1,23,'realtime-security-test',private.server_bootstrap_payload('{}'::jsonb),'qa' from rt_fixture where label in ('a','b');
create temporary table rt_broadcast_fixture as
select gen_random_uuid() id,topic,extension from (
select 'game-session:'||u::text topic,'broadcast'::text extension from rt_fixture where label in ('a','b')
union all select 'association','broadcast'
union all select 'occupation','broadcast'
union all select 'market','broadcast'
union all select 'resource_stronghold','broadcast'
union all select 'unknown-security-qa','broadcast'
union all select 'game-session:'||u::text,'presence' from rt_fixture where label='a'
) t;
grant select on rt_broadcast_fixture to authenticated,anon;
insert into realtime.messages(id,topic,extension,event,payload,private)
select id,topic,extension,'security-qa','{}'::jsonb,true from rt_broadcast_fixture;
set local role authenticated;
do $test$
declare f record;me uuid;other uuid;n integer;c record;
begin
 for f in select * from rt_fixture where label in ('a','b','world') loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.u,'role','authenticated')::text,true);
  insert into public.game_chat_messages(body,client_id,association_id)
  values('실시간 권한 시험',gen_random_uuid(),case when f.label='world' then null else f.association_id end) returning id into f.message_id;
  update rt_fixture set message_id=f.message_id where label=f.label;
 end loop;
 select u into me from rt_fixture where label='a';
 select u into other from rt_fixture where label='b';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',me,'role','authenticated')::text,true);
 -- Deliberately omit client filters: server RLS must isolate association rows.
 select count(*) into n from public.game_chat_messages where id in(select message_id from rt_fixture);
 if n<>2 then raise exception 'TEST_CHAT_UNFILTERED_ISOLATION %',n;end if;
 if exists(select 1 from public.game_chat_messages where id=(select message_id from rt_fixture where label='b')) then raise exception 'TEST_CROSS_ASSOCIATION_READ';end if;
 if (select count(*) from public.game_saves where user_id in(select u from rt_fixture))<>1 then raise exception 'TEST_CROSS_ACCOUNT_SAVE_READ';end if;
 begin
  insert into public.game_chat_messages(body,client_id,association_id) values('타 원정단 전송',gen_random_uuid(),(select association_id from rt_fixture where label='b'));
  raise exception 'TEST_CROSS_ASSOCIATION_SEND';
 exception when insufficient_privilege then if sqlerrm<>'CHAT_ASSOCIATION_REQUIRED' then raise;end if;end;
 -- Realtime's authorization lookup filters to the requested topic.
 for c in select distinct topic from rt_broadcast_fixture loop
  perform set_config('realtime.topic',c.topic,true);
  select count(*) into n from realtime.messages where id in(select id from rt_broadcast_fixture) and topic=c.topic;
  if c.topic in ('game-session:'||me::text,'market','resource_stronghold','association','occupation') then
   if n<>1 then raise exception 'TEST_ALLOWED_BROADCAST_TOPIC % %',c.topic,n;end if;
  elsif n<>0 then raise exception 'TEST_FORBIDDEN_BROADCAST_TOPIC %',c.topic;end if;
 end loop;
 perform set_config('realtime.topic','game-session:'||me::text,true);
 begin
  insert into realtime.messages(topic,extension,event,payload,private) values('game-session:'||me::text,'broadcast','session_changed','{}'::jsonb,true);
  raise exception 'TEST_CLIENT_SESSION_BROADCAST_FORGERY';
 exception when insufficient_privilege then null;end;
 -- A registered outsider may see world chat only.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select u from rt_fixture where label='world'),'role','authenticated')::text,true);
 if (select count(*) from public.game_chat_messages where id in(select message_id from rt_fixture))<>1 then raise exception 'TEST_OUTSIDER_CHAT';end if;
 -- No profile and anonymous sign-in cannot read chat.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select u from rt_fixture where label='unregistered'),'role','authenticated')::text,true);
 if exists(select 1 from public.game_chat_messages where id in(select message_id from rt_fixture)) then raise exception 'TEST_UNREGISTERED_CHAT';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',me,'role','authenticated','is_anonymous',true)::text,true);
 if exists(select 1 from public.game_chat_messages where id in(select message_id from rt_fixture)) then raise exception 'TEST_ANONYMOUS_CHAT';end if;
end $test$;
reset role;
delete from private.online_association_members where user_id=(select u from rt_fixture where label='a');
set local role authenticated;
do $test$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select u from rt_fixture where label='a'),'role','authenticated')::text,true);
 if exists(select 1 from public.game_chat_messages where id=(select message_id from rt_fixture where label='a')) then raise exception 'TEST_FORMER_MEMBER_READ';end if;
 begin
  insert into public.game_chat_messages(body,client_id,association_id) values('탈퇴 후 전송',gen_random_uuid(),(select association_id from rt_fixture where label='a'));
  raise exception 'TEST_FORMER_MEMBER_SEND';
 exception when insufficient_privilege then if sqlerrm<>'CHAT_ASSOCIATION_REQUIRED' then raise;end if;end;
end $test$;
reset role;
update private.online_associations set status='DISBANDED' where association_id=(select association_id from rt_fixture where label='b');
set local role authenticated;
do $test$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select u from rt_fixture where label='b'),'role','authenticated')::text,true);
 if exists(select 1 from public.game_chat_messages where id=(select message_id from rt_fixture where label='b')) then raise exception 'TEST_DISBANDED_READ';end if;
end $test$;
set local role anon;
do $test$
declare n integer;
begin
 perform set_config('request.jwt.claims','{}',true);
 perform set_config('realtime.topic','market',true);
 if exists(select 1 from realtime.messages where id in(select id from rt_broadcast_fixture)) then raise exception 'TEST_ANON_BROADCAST_READ';end if;
 begin
  select count(*) into n from public.game_chat_messages where id in(select message_id from rt_fixture);
  if n<>0 then raise exception 'TEST_ANON_CHAT_READ';end if;
 exception when insufficient_privilege then null;end;
end $test$;
reset role;
do $test$
begin
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and (schemaname<>'public' or tablename<>'game_chat_messages')) then raise exception 'TEST_UNREVIEWED_PUBLICATION';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_chat_messages') then raise exception 'TEST_CHAT_PUBLICATION_MISSING';end if;
 if exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and cmd in ('ALL','INSERT','UPDATE')) then raise exception 'TEST_CLIENT_BROADCAST_WRITE_POLICY';end if;
end $test$;
rollback;
select 'PASS: cross-account saves, world/association chat, membership removal/disbanding, private broadcast topics and client-forgery rejection; all fixtures rolled back; WebSocket delivery not exercised' as result;
