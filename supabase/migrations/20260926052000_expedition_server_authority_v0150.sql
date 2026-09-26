-- v0.1.50 server-authoritative expedition reward ledger.
-- The client may report battle progress, but can no longer choose the economic reward.
alter table private.online_expeditions
 add column if not exists confirmed_kills bigint not null default 0,
 add column if not exists reward_seed bigint not null default floor(random()*2147483647)::bigint;

create table if not exists private.online_expedition_kills(
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null,
 kill_index bigint not null,
 monster_id text not null,
 confirmed_at timestamptz not null default now(),
 primary key(user_id,run_id,kill_index)
);
alter table private.online_expedition_kills enable row level security;
revoke all on private.online_expedition_kills from public,anon,authenticated;

create or replace function private.expedition_ticket_drop(p_seed bigint,p_kill bigint)
returns boolean language sql immutable set search_path='' as $$
 select ((abs(hashtextextended(p_seed::text||':'||p_kill::text,0)) % 1000000)::numeric / 1000000) < 0.4
$$;

create or replace function public.confirm_online_expedition_kill(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_monster_id text,p_client_kill_index bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_next bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 v_next:=v_run.confirmed_kills+1;
 if p_client_kill_index<>v_next then
   if exists(select 1 from private.online_expedition_kills where user_id=v_user and run_id=v_run.run_id and kill_index=p_client_kill_index)
   then return jsonb_build_object('confirmedKills',v_run.confirmed_kills);end if;
   raise exception 'EXPEDITION_KILL_SEQUENCE_INVALID';
 end if;
 if p_monster_id is null or length(p_monster_id)<1 or length(p_monster_id)>100 then raise exception 'EXPEDITION_MONSTER_INVALID';end if;
 insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
 values(v_user,v_run.run_id,v_next,p_monster_id);
 update private.online_expeditions set confirmed_kills=v_next where user_id=v_user;
 return jsonb_build_object('confirmedKills',v_next);
end $$;
revoke all on function public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint) from public,anon;
grant execute on function public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint) to authenticated;

create or replace function public.settle_online_expedition_v2(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_outcome text,p_client_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_save public.game_saves%rowtype;
 v_kills bigint;v_gross bigint;v_share bigint;v_net bigint;v_material bigint;v_tickets bigint:=0;v_i bigint;
 v_payload jsonb;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found then return private.cloud_record_json(v_user);end if;
 if v_run.status in('RETURNED','DEAD') then return private.cloud_record_json(v_user);end if;
 if p_outcome not in('returned','dead') then raise exception 'EXPEDITION_RECEIPT_INVALID';end if;
 if jsonb_typeof(p_client_payload->'expedition') is distinct from 'null' then raise exception 'EXPEDITION_SETTLEMENT_PAYLOAD_INVALID';end if;
 v_kills:=v_run.confirmed_kills;
 if p_outcome='returned' then
   -- Economic rewards are derived only from server-confirmed kills and server RNG.
   v_gross:=v_kills*(10+v_run.floor*3);
   v_material:=v_kills*2;
   if v_run.floor<10 then
    for v_i in 1..v_kills loop if private.expedition_ticket_drop(v_run.reward_seed,v_i) then v_tickets:=v_tickets+1;end if;end loop;
   end if;
   v_share:=floor(v_gross*v_run.revenue_share_rate/100.0);v_net:=v_gross-v_share;
   update private.player_wallets set silver=silver+v_net,updated_at=now() where user_id=v_user;
   if v_material>0 then insert into private.market_assets(user_id,item_id,quantity,updated_at)
    values(v_user,'material:'||v_run.tower||':1',v_material,now())
    on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
   if v_tickets>0 then insert into private.market_assets(user_id,item_id,quantity,updated_at)
    values(v_user,'ticket:'||v_run.tower||':'||(v_run.floor+1)::text,v_tickets,now())
    on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
   update private.online_expeditions set status='RETURNED',settled_at=now() where user_id=v_user;
 else
   update private.online_expeditions set status='DEAD',settled_at=now() where user_id=v_user;
 end if;
 -- Client battle receipt is retained for presentation/progression, while all server-owned assets are overwritten.
 v_payload:=jsonb_set(p_client_payload,'{lastExpedition,kills}',to_jsonb(v_kills),true);
 perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.50');
 return private.cloud_record_json(v_user);
end $$;
revoke all on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) to authenticated;

create index if not exists online_expedition_kills_run_idx on private.online_expedition_kills(user_id,run_id,confirmed_at);
