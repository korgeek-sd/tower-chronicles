-- Run with privileged SQL tooling. Every row belongs to a synthetic account.
-- No market matching, expiry worker, or real-player rows are touched.
begin;
create temporary table mail_security_fixture as
select gen_random_uuid() u,gen_random_uuid() s,gen_random_uuid() l,
 least(a,b) good,greatest(a,b) bad,gen_random_uuid() expired,gen_random_uuid() gear
from (select gen_random_uuid() a,gen_random_uuid() b from generate_series(1,2)) x;
grant select on mail_security_fixture to authenticated;
insert into auth.users(id) select u from mail_security_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select s,u,now(),now() from mail_security_fixture;
insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
select u,l,s,'mail-security','mail-security','QA','0.1.93',1,now(),now(),now()+interval '1 hour' from mail_security_fixture;
insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
select u,1,23,'0.1.93',private.server_bootstrap_payload('{}')||'{"version":23,"expedition":null,"equipmentItems":[],"silver":1000,"market":{"gold":0}}'::jsonb,'synthetic' from mail_security_fixture;
select private.sync_market_economy_from_latest_save(u) from mail_security_fixture;
insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity,attachment_reward)
select good,u,'security:valid','reward','Synthetic reward','reward:coupon',1,'{"silver":50,"gold":7,"items":[{"id":"other:enhancement_stone","quantity":3}]}'::jsonb from mail_security_fixture
union all
select bad,u,'security:invalid','reward','Synthetic invalid reward','reward:coupon',1,'{"silver":-1}'::jsonb from mail_security_fixture;
set local role authenticated;
do $$declare a record;b record;r jsonb;begin
 select * into a from mail_security_fixture order by u limit 1;
 select * into b from mail_security_fixture where u<>a.u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
 r:=public.get_game_mail();
 if jsonb_array_length(r->'mails')<>2 then raise exception 'Mail listing crossed account boundary';end if;
 for r in select to_jsonb(x) from (values('read'),('claim'),('delete')) x(action) loop
  begin
   perform public.manage_game_mail(a.l,1,'mail-security','mail-security',r->>'action',b.good);
   raise exception 'Foreign mail accepted';
  exception when others then if sqlerrm not like '%MAIL_NOT_FOUND%' then raise;end if;end;
 end loop;
 begin
  perform public.manage_game_mail(a.l,1,'mail-security','mail-security','delete',a.good);
  raise exception 'Unclaimed attachment deleted';
 exception when others then if sqlerrm not like '%MAIL_UNCLAIMED%' then raise;end if;end;
 begin
  perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim_all',null);
  raise exception 'Invalid reward accepted';
 exception when others then if sqlerrm not like '%COUPON_REWARD_INVALID%' then raise;end if;end;
end $$;
reset role;
do $$begin
 if exists(select 1 from private.player_wallets where user_id in(select u from mail_security_fixture) and (silver<>1000 or gold<>0))
 or exists(select 1 from private.market_assets where user_id in(select u from mail_security_fixture))
 or exists(select 1 from private.game_mail where user_id in(select u from mail_security_fixture) and (claimed_at is not null or read_at is not null))
 or exists(select 1 from public.game_saves where user_id in(select u from mail_security_fixture) and revision<>1)
 then raise exception 'Failed claim_all retained a partial reward or save';end if;
end $$;
delete from private.game_mail where mail_id in(select bad from mail_security_fixture);
insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity,expires_at)
select expired,u,'security:expired','reward','Synthetic expired','other:enhancement_stone',100,now()-interval '1 second' from mail_security_fixture;
set local role authenticated;
do $$declare a record;r jsonb;begin
 select * into a from mail_security_fixture order by u limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
 begin
  perform public.manage_game_mail(null,1,'mail-security','mail-security','claim',a.good);
  raise exception 'Missing lease accepted';
 exception when others then if sqlerrm not like '%GAME_SESSION_LOST%' then raise;end if;end;
 begin
  perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim',a.expired);
  raise exception 'Expired mail claimed';
 exception when others then if sqlerrm not like '%MAIL_NOT_FOUND%' then raise;end if;end;
 perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim',a.good);
 r:=public.manage_game_mail(a.l,1,'mail-security','mail-security','claim',a.good);
 if (r->'economy'->'wallet'->>'silver')::bigint<>1050 or (r->'economy'->'wallet'->>'gold')::bigint<>7
 or (select (x->>'quantity')::bigint from jsonb_array_elements(r->'economy'->'assets') x where x->>'itemId'='other:enhancement_stone') is distinct from 3::bigint
 then raise exception 'Claim replay duplicated or lost rewards';end if;
 perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim_all',null);
end $$;
reset role;
do $$declare a record;b record;begin
 select * into a from mail_security_fixture order by u limit 1;
 select * into b from mail_security_fixture where u<>a.u;
 if (select revision from public.game_saves where user_id=a.u)<>2 then raise exception 'Replay persisted a duplicate save';end if;
 if (select silver from private.player_wallets where user_id=b.u)<>1000
 or (select claimed_at from private.game_mail where mail_id=b.good) is not null
 or exists(select 1 from private.game_mail where user_id in(select u from mail_security_fixture) and mail_id in(select expired from mail_security_fixture) and claimed_at is not null)
 then raise exception 'Claim affected foreign or expired rewards';end if;
end $$;
-- A returned equipment batch keeps original IDs and cannot be collected twice.
insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity,attachment_assets)
select gear,u,'security:gear','trade','Synthetic equipment','equipment:association_supply_iron_sword:rare:+2',2,
 jsonb_build_array(
 jsonb_build_object('id',gear::text||'-1','kind','association_supply_iron_sword','grade','rare','enhancement',2),
 jsonb_build_object('id',gear::text||'-2','kind','association_supply_iron_sword','grade','rare','enhancement',2))
from mail_security_fixture;
update public.game_saves set payload=jsonb_set(payload,'{expedition}','{}') where user_id=(select u from mail_security_fixture order by u limit 1);
set local role authenticated;
do $$declare a record;begin
 select * into a from mail_security_fixture order by u limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
 begin
  perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim',a.gear);
  raise exception 'Expedition attachment claimed';
 exception when others then if sqlerrm not like '%MAIL_EXPEDITION_BLOCKED%' then raise;end if;end;
end $$;
reset role;
update public.game_saves set payload=jsonb_set(payload,'{expedition}','null') where user_id=(select u from mail_security_fixture order by u limit 1);
set local role authenticated;
do $$declare a record;begin
 select * into a from mail_security_fixture order by u limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.u,'role','authenticated','session_id',a.s)::text,true);
 perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim',a.gear);
 perform public.manage_game_mail(a.l,1,'mail-security','mail-security','claim_all',null);
end $$;
reset role;
do $$declare a record;begin
 select * into a from mail_security_fixture order by u limit 1;
 if (select count(*) from private.market_assets where user_id=a.u and item_id in('equipment_v2:'||a.gear||'-1','equipment_v2:'||a.gear||'-2') and quantity=1)<>2
 or (select revision from public.game_saves where user_id=a.u)<>3
 then raise exception 'Equipment claim replay changed original instances or save';end if;
end $$;
select 'mail_claim_security: passed (all synthetic changes rolled back)' as verification;
rollback;
