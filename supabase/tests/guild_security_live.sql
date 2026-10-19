-- Privileged rollback-only integration check. JWT/lease guards run normally;
-- inspect database role ACLs separately. Only synthetic users/guilds are mutated.
begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();w uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();x uuid;s uuid;l uuid;
 us uuid;ul uuid;vs uuid;vl uuid;ws uuid;wl uuid;
 req uuid:=gen_random_uuid();donation uuid:=gen_random_uuid();bid_req uuid:=gen_random_uuid();
 material_req uuid:=gen_random_uuid();listing uuid;r jsonb;before_points bigint;
 expect_baseline boolean:=false;
begin
 foreach x in array array[u,v,w] loop
  s:=gen_random_uuid();l:=gen_random_uuid();
  if x=u then us:=s;ul:=l;elsif x=v then vs:=s;vl:=l;else ws:=s;wl:=l;end if;
  insert into auth.users(id) values(x);
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s,x,now(),now());
  insert into private.active_game_sessions(user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,generation,acquired_at,heartbeat_at,expires_at)
  values(x,l,s,'guild-security','guild-security','QA','0.1.93',1,now(),now(),now()+interval '1 hour');
  insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash)
  values(x,1,23,'0.1.93',private.server_bootstrap_payload('{}')||'{"version":23,"expedition":null,"equipmentItems":[],"silver":50000,"market":{"gold":1000}}'::jsonb,'synthetic');
  perform private.sync_market_economy_from_latest_save(x);
  perform private.refresh_village_life(x);
 end loop;
 insert into private.online_associations(association_id,record_number,name,leader_user_id,treasury_silver)
 values(a,'QA-'||a,'QA'||substr(a::text,1,12),u,1000),(b,'QA-'||b,'QA'||substr(b::text,1,12),w,2000);
 insert into private.online_association_members(association_id,user_id,role)
 values(a,u,'LEADER'),(a,v,'MEMBER'),(b,w,'LEADER');
 insert into private.online_association_member_progression(association_id,user_id,contribution_point)
 values(a,u,1000),(a,v,1000),(b,w,1000);
 insert into private.guild_material_stock(association_id,material,quantity) values(a,'herb',1000),(b,'herb',2000);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',us)::text,true);
 if expect_baseline then
  begin
   perform public.register_guild_material_auction(ul,1,'guild-security','guild-security',material_req,'herb',100,50);
   raise exception 'Expected baseline ambiguity was not reproduced';
  exception when ambiguous_column then null;end;
  if (select quantity from private.guild_material_stock where association_id=a and material='herb')<>1000
  or exists(select 1 from private.guild_auction_listings where association_id=a)
  then raise exception 'Failed baseline registration retained escrow';end if;
  return;
 end if;
 -- Ordinary members cannot use leader treasury operations.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','session_id',vs)::text,true);
 begin
  perform public.transfer_association_treasury(vl,1,'guild-security','guild-security',req,'WITHDRAW','SILVER',100,'QA');
  raise exception 'Member withdrew guild treasury';
 exception when others then if sqlerrm not like '%WAREHOUSE_LEADER_ONLY%' then raise;end if;end;
 -- A donation is charged once, and a changed payload cannot reuse its receipt.
 perform public.donate_to_association(vl,1,'guild-security','guild-security',donation,'silver',10000);
 r:=public.donate_to_association(vl,1,'guild-security','guild-security',donation,'silver',10000);
 if (r->>'replayed')::boolean is distinct from true
 or (select silver from private.player_wallets where user_id=v)<>40000
 or (select treasury_silver from private.online_associations where association_id=a)<>11000
 then raise exception 'Donation replay changed balances';end if;
 begin
  perform public.donate_to_association(vl,1,'guild-security','guild-security',donation,'silver',20000);
  raise exception 'Donation receipt conflict accepted';
 exception when others then if sqlerrm not like '%ASSOCIATION_REQUEST_CONFLICT%' then raise;end if;end;
 -- Register and replay material escrow once.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',us)::text,true);
 perform public.register_guild_material_auction(ul,1,'guild-security','guild-security',material_req,'herb',100,50);
 r:=public.register_guild_material_auction(ul,1,'guild-security','guild-security',material_req,'herb',100,50);
 select listing_id into listing from private.guild_auction_listings where association_id=a and material_request_id=material_req;
 if (r->>'replayed')::boolean is distinct from true or listing is null
 or (select quantity from private.guild_material_stock where association_id=a and material='herb')<>900
 then raise exception 'Material registration duplicated escrow';end if;
 -- Another guild's leader cannot bid, claim or recover this listing.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',w,'role','authenticated','session_id',ws)::text,true);
 begin
  perform public.bid_guild_auction(wl,1,'guild-security','guild-security',bid_req,listing,50);
  raise exception 'Foreign bid accepted';
 exception when others then if sqlerrm not like '%GUILD_AUCTION_CLOSED%' then raise;end if;end;
 begin
  perform public.claim_guild_auction_item(wl,1,'guild-security','guild-security',listing);
  raise exception 'Foreign claim accepted';
 exception when others then if sqlerrm not like '%GUILD_AUCTION_NOT_WINNER%' then raise;end if;end;
 begin
  perform public.recover_guild_material_auction(wl,1,'guild-security','guild-security',listing);
  raise exception 'Foreign return accepted';
 exception when others then if sqlerrm not like '%GUILD_MATERIAL_AUCTION_INVALID%' then raise;end if;end;
 -- A valid bid escrows contribution once; an ended auction delivers once.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','session_id',vs)::text,true);
 select contribution_point into before_points from private.online_association_member_progression where association_id=a and user_id=v;
 perform public.bid_guild_auction(vl,1,'guild-security','guild-security',bid_req,listing,50);
 perform public.bid_guild_auction(vl,1,'guild-security','guild-security',bid_req,listing,50);
 if (select contribution_point from private.online_association_member_progression where association_id=a and user_id=v)<>before_points-50 then raise exception 'Bid replay debited twice';end if;
 update private.guild_auction_listings set started_at=now()-interval '25 hours',ends_at=now()-interval '1 second' where listing_id=listing and association_id=a;
 select coalesce((materials->>'herb')::bigint,0) into before_points from private.village_life_players where user_id=v;
 perform public.claim_guild_auction_item(vl,1,'guild-security','guild-security',listing);
 perform public.claim_guild_auction_item(vl,1,'guild-security','guild-security',listing);
 if (select coalesce((materials->>'herb')::bigint,0) from private.village_life_players where user_id=v)<>before_points+100 then raise exception 'Auction reward replay duplicated materials';end if;
 -- Treasury transfers conserve personal + guild money and retain one receipt.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',us)::text,true);
 perform public.transfer_association_treasury(ul,1,'guild-security','guild-security',req,'WITHDRAW','SILVER',100,'QA');
 perform public.transfer_association_treasury(ul,1,'guild-security','guild-security',req,'WITHDRAW','SILVER',100,'QA');
 if (select silver from private.player_wallets where user_id=u)<>50100
 or (select treasury_silver from private.online_associations where association_id=a)<>10900
 or (select treasury_silver from private.online_associations where association_id=b)<>2000
 or (select quantity from private.guild_material_stock where association_id=b and material='herb')<>2000
 then raise exception 'Treasury replay or foreign guild mutation';end if;
 perform public.transfer_online_association_leadership(ul,1,'guild-security','guild-security',v);
 begin
  perform public.transfer_association_treasury(ul,1,'guild-security','guild-security',gen_random_uuid(),'WITHDRAW','SILVER',100,'QA');
  raise exception 'Former leader retained treasury authority';
 exception when others then if sqlerrm not like '%WAREHOUSE_LEADER_ONLY%' then raise;end if;end;
end $$;
select 'guild_security_live: passed; rollback follows' as verification;
rollback;
