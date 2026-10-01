-- Allow association creation for testing without boss-return certification.
-- Keep market certification, registration fee and all other validations intact.
create or replace function public.create_online_association_v2(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_name text,p_description text,p_join_policy text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_name text:=btrim(coalesce(p_name,''));
  v_assoc private.online_associations%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_record text;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(u);
  if exists(select 1 from private.online_association_members where user_id=u) then raise exception 'ASSOCIATION_ALREADY_JOINED';end if;
  if char_length(v_name)<2 or char_length(v_name)>20
     or v_name in('탑기록원','노바르 평의회','은저울 상회','네 공방 연맹','청동마차 상단') then
    raise exception 'ASSOCIATION_NAME_INVALID';
  end if;
  if char_length(coalesce(p_description,''))>120 or p_join_policy not in('OPEN','APPROVAL') then
    raise exception 'ASSOCIATION_INPUT_INVALID';
  end if;
  if exists(select 1 from private.online_associations where status='ACTIVE' and lower(name)=lower(v_name)) then
    raise exception 'ASSOCIATION_NAME_TAKEN';
  end if;

  select * into v_wallet from private.player_wallets where user_id=u for update;
  if not found or v_wallet.silver<1000 then raise exception 'ASSOCIATION_SILVER_SHORTAGE';end if;
  update private.player_wallets set silver=silver-1000,updated_at=now() where user_id=u;

  v_record:='NR-'||to_char(nextval('private.online_association_record_seq'::regclass),'FM000000');
  insert into private.online_associations(
    record_number,name,description,leader_user_id,join_policy
  ) values(
    v_record,v_name,btrim(coalesce(p_description,'')),u,p_join_policy
  ) returning * into v_assoc;

  insert into private.online_association_members(association_id,user_id,role)
  values(v_assoc.association_id,u,'LEADER');

  perform private.association_activity(v_assoc.association_id,u,'CREATED','원정단이 탑기록원에 등록되었습니다.');
  perform private.persist_server_association_to_save(u);
  perform private.broadcast_association_change(v_assoc.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.create_online_association_v2(uuid,bigint,text,text,text,text,text) from public,anon;
grant execute on function public.create_online_association_v2(uuid,bigint,text,text,text,text,text) to authenticated;

