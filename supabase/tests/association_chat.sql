begin;
create temporary table assoc_chat_fixture as select id,row_number() over(order by id) n from (select id from auth.users u order by id limit 2) t;
-- Temporarily detach fixture accounts inside this rollback-only transaction.
delete from private.online_association_members where user_id in(select id from assoc_chat_fixture);
grant select on assoc_chat_fixture to authenticated;
insert into public.game_player_profiles(user_id,nickname) select id,'Qa'||substr(md5(id::text),1,8) from assoc_chat_fixture where not exists(select 1 from public.game_player_profiles where user_id=id);
create temporary table assoc_chat_group as select gen_random_uuid() id;
grant select on assoc_chat_group to authenticated;
insert into private.online_associations(association_id,record_number,name,leader_user_id,revenue_share_rate_percent) select g.id,'QA-'||g.id,'Qa'||substr(g.id::text,1,8),f.id,13 from assoc_chat_group g,assoc_chat_fixture f where f.n=1;
insert into private.online_association_members(association_id,user_id,role) select g.id,f.id,'LEADER' from assoc_chat_group g,assoc_chat_fixture f where f.n=1;
set local role authenticated;
do $$declare mine uuid; outsider uuid; gid uuid; message_id uuid;begin
 select id into mine from assoc_chat_fixture where n=1;select id into outsider from assoc_chat_fixture where n=2;select id into gid from assoc_chat_group;
 if outsider is null then raise exception 'Need two unjoined fixture accounts';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',mine,'role','authenticated')::text,true);
 if (public.get_chat_association()->>'id')::uuid<>gid then raise exception 'Missing own association';end if;
 insert into public.game_chat_messages(body,client_id,association_id) values('단원 전용',gen_random_uuid(),gid) returning id into message_id;
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 if exists(select 1 from public.game_chat_messages where id=message_id) then raise exception 'Outsider history leak';end if;
 begin insert into public.game_chat_messages(body,client_id,association_id) values('침입',gen_random_uuid(),gid);raise exception 'Outsider send';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into private.online_association_members(association_id,user_id,role) select g.id,f.id,'MEMBER' from assoc_chat_group g,assoc_chat_fixture f where f.n=2;
set local role authenticated;
do $$declare me uuid;begin
 select id into me from assoc_chat_fixture where n=2;perform set_config('request.jwt.claims',json_build_object('sub',me,'role','authenticated')::text,true);
 if not exists(select 1 from public.game_chat_messages where association_id=(select id from assoc_chat_group)) then raise exception 'Member cannot read';end if;
end $$;
reset role;
do $$declare me uuid;state jsonb;begin
 select id into me from assoc_chat_fixture where n=1;state:=private.online_association_state_json(me);
 if state->'current'->'members'->0->>'playerLabel'<>(select nickname from public.game_player_profiles where user_id=me) then raise exception 'Nickname not connected';end if;
 if not exists(select 1 from jsonb_array_elements(state->'directory') d where (d->>'associationId')::uuid=(select id from assoc_chat_group) and (d->>'revenueShareRatePercent')::int=13) then raise exception 'Directory fee missing';end if;
end $$;
delete from private.online_association_members where user_id=(select id from assoc_chat_fixture where n=2);
set local role authenticated;
do $$declare me uuid;begin
 select id into me from assoc_chat_fixture where n=2;perform set_config('request.jwt.claims',json_build_object('sub',me,'role','authenticated')::text,true);
 if public.get_chat_association() is not null or exists(select 1 from public.game_chat_messages where association_id=(select id from assoc_chat_group)) then raise exception 'Former member retained access';end if;
 begin insert into public.game_chat_messages(body,client_id,association_id) values('탈퇴 후',gen_random_uuid(),(select id from assoc_chat_group));raise exception 'Former member send';exception when insufficient_privilege then null;end;
end $$;
reset role;
update private.online_associations set status='DISBANDED' where association_id=(select id from assoc_chat_group);
set local role authenticated;
do $$declare me uuid;begin
 select id into me from assoc_chat_fixture where n=1;perform set_config('request.jwt.claims',json_build_object('sub',me,'role','authenticated')::text,true);
 if public.get_chat_association() is not null or exists(select 1 from public.game_chat_messages where association_id=(select id from assoc_chat_group)) then raise exception 'Disbanded association retained access';end if;
end $$;
rollback;
select 'association chat isolation, current membership, removal/disband revocation, profile labels and fee disclosure passed; fixtures rolled back' result;
