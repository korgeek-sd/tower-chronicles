-- Privileged integration fixture, no schema changes or real-player mutations.
-- RPC authorization uses request.jwt.claims; role ACLs are checked separately.
begin;
do $$
declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();
 s uuid:=gen_random_uuid();l uuid:=gen_random_uuid();
 first_id uuid:=gen_random_uuid();last_id uuid:=gen_random_uuid();m uuid;bad uuid;r jsonb;before_assets jsonb;before_stones bigint;
begin
 m:=least(first_id,last_id);bad:=greatest(first_id,last_id);
 insert into auth.users(id) values(u),(other_user);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
 values(u,l,s,'mail-security','mail-security','QA','0.1.93',1,now(),now(),now()+interval '1 hour');
 insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
 values(u,1,23,'0.1.93',private.server_bootstrap_payload('{}')||'{"version":23,"expedition":null,"equipmentItems":[],"silver":1000,"market":{"gold":0}}'::jsonb,'synthetic');
 perform private.sync_market_economy_from_latest_save(u);
 select coalesce(jsonb_agg(to_jsonb(a) order by item_id),'[]'::jsonb) into before_assets from private.market_assets a where user_id=u;
 select coalesce((select quantity from private.market_assets where user_id=u and item_id='other:enhancement_stone'),0) into before_stones;
 insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity,attachment_reward)
 values(m,u,'security:valid','reward','Synthetic reward','reward:coupon',1,'{"silver":50,"gold":7,"items":[{"id":"other:enhancement_stone","quantity":3}]}'),
 (bad,u,'security:invalid','reward','Synthetic invalid','reward:coupon',1,'{"silver":-1}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
 begin
  perform public.manage_game_mail(l,1,'mail-security','mail-security','claim_all',null);
  raise exception 'Invalid reward accepted';
 exception when others then if sqlerrm not like '%COUPON_REWARD_INVALID%' then raise;end if;end;
 if (select silver from private.player_wallets where user_id=u)<>1000
 or (select coalesce(jsonb_agg(to_jsonb(a) order by item_id),'[]'::jsonb) from private.market_assets a where user_id=u) is distinct from before_assets
 or exists(select 1 from private.game_mail where user_id=u and claimed_at is not null)
 or (select revision from public.game_saves where user_id=u)<>1
 then raise exception 'Failed batch retained partial rewards';end if;
 delete from private.game_mail where mail_id=bad and user_id=u;
 insert into private.game_mail(mail_id,user_id,event_key,category,title,attachment_item_id,attachment_quantity)
 values(bad,other_user,'security:foreign','reward','Synthetic foreign','other:enhancement_stone',100);
 begin
  perform public.manage_game_mail(l,1,'mail-security','mail-security','claim',bad);
  raise exception 'Foreign reward accepted';
 exception when others then if sqlerrm not like '%MAIL_NOT_FOUND%' then raise;end if;end;
 begin
  perform public.manage_game_mail(null,1,'mail-security','mail-security','claim',m);
  raise exception 'Null lease accepted';
 exception when others then if sqlerrm not like '%GAME_SESSION_LOST%' then raise;end if;end;
 perform public.manage_game_mail(l,1,'mail-security','mail-security','claim',m);
 r:=public.manage_game_mail(l,1,'mail-security','mail-security','claim',m);
 if (r->'economy'->'wallet'->>'silver')::bigint<>1050
 or (r->'economy'->'wallet'->>'gold')::bigint<>7
 or (select quantity from private.market_assets where user_id=u and item_id='other:enhancement_stone') is distinct from before_stones+3
 or (select revision from public.game_saves where user_id=u)<>2
 or (select claimed_at from private.game_mail where mail_id=bad) is not null
 then raise exception 'Replay changed rewards, foreign mail or save revision';end if;
 -- Invalidating the backing auth session must block even a previously claimed mail.
 delete from auth.sessions where id=s and user_id=u;
 begin
  perform public.manage_game_mail(l,1,'mail-security','mail-security','claim',m);
  raise exception 'Revoked auth session accepted';
 exception when others then if sqlerrm not like '%AUTH_SESSION_INVALID%' then raise;end if;end;
end $$;
select 'mail_claim_live_security: passed; rollback follows' as verification;
rollback;
