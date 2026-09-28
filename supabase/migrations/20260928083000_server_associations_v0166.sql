-- v0.1.66: server-authoritative multi-account associations.
-- Association membership becomes global server state; save association data is a compatibility projection only.

create sequence if not exists private.online_association_record_seq start 1;

create table if not exists private.player_association_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  qualified boolean not null default false,
  qualified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table private.player_association_eligibility enable row level security;
revoke all on private.player_association_eligibility from public,anon,authenticated;

insert into private.player_association_eligibility(user_id,qualified,qualified_at,updated_at)
select user_id,true,updated_at,now()
from public.game_saves
where coalesce((payload->'market'->>'traderCertified')::boolean,false)
on conflict(user_id) do update set qualified=true,updated_at=now();

create table if not exists private.online_associations (
  association_id uuid primary key default gen_random_uuid(),
  record_number text not null unique,
  name text not null check (char_length(btrim(name)) between 2 and 20),
  description text not null default '' check (char_length(description)<=120),
  leader_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  notice text not null default '' check (char_length(notice)<=180),
  notice_updated_at timestamptz,
  join_policy text not null default 'APPROVAL' check (join_policy in ('OPEN','APPROVAL','CLOSED')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISBANDED')),
  member_limit integer not null default 30 check (member_limit between 1 and 30),
  revenue_share_rate_percent integer not null default 0 check (revenue_share_rate_percent between 0 and 30),
  treasury_silver bigint not null default 0 check (treasury_silver>=0),
  updated_at timestamptz not null default now()
);
create unique index if not exists online_associations_active_name_uq
on private.online_associations(lower(name))
where status='ACTIVE';
create index if not exists online_associations_leader_idx
on private.online_associations(leader_user_id)
where status='ACTIVE';
alter table private.online_associations enable row level security;
revoke all on private.online_associations from public,anon,authenticated;

create table if not exists private.online_association_members (
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('LEADER','MEMBER')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(association_id,user_id),
  unique(user_id)
);
create index if not exists online_association_members_assoc_role_idx
on private.online_association_members(association_id,role,joined_at);
alter table private.online_association_members enable row level security;
revoke all on private.online_association_members from public,anon,authenticated;

create table if not exists private.online_association_applications (
  application_id uuid primary key default gen_random_uuid(),
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index if not exists online_association_pending_applicant_uq
on private.online_association_applications(applicant_user_id)
where status='PENDING';
create index if not exists online_association_applications_assoc_idx
on private.online_association_applications(association_id,status,created_at);
alter table private.online_association_applications enable row level security;
revoke all on private.online_association_applications from public,anon,authenticated;

create table if not exists private.online_association_activity (
  activity_id bigint generated always as identity primary key,
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists online_association_activity_assoc_idx
on private.online_association_activity(association_id,created_at desc);
alter table private.online_association_activity enable row level security;
revoke all on private.online_association_activity from public,anon,authenticated;

create or replace function private.server_association_member(p_user uuid)
returns private.online_association_members
language sql stable security definer set search_path=''
as $$
  select m
  from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id
  where m.user_id=p_user and a.status='ACTIVE'
  limit 1
$$;
revoke all on function private.server_association_member(uuid) from public,anon,authenticated;

create or replace function private.server_association_revenue_rate(p_user uuid)
returns integer
language sql stable security definer set search_path=''
as $$
  select coalesce((
    select a.revenue_share_rate_percent
    from private.online_association_members m
    join private.online_associations a on a.association_id=m.association_id
    where m.user_id=p_user and a.status='ACTIVE'
    limit 1
  ),0)
$$;
revoke all on function private.server_association_revenue_rate(uuid) from public,anon,authenticated;

create or replace function private.server_association_projection(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_member private.online_association_members%rowtype;
  v_assoc private.online_associations%rowtype;
  v_members jsonb:='[]'::jsonb;
  v_activity jsonb:='[]'::jsonb;
  v_assoc_json jsonb;
begin
  select m.* into v_member
  from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id
  where m.user_id=p_user and a.status='ACTIVE'
  limit 1;

  if not found then
    return jsonb_build_object('currentId',null,'associations','[]'::jsonb,'nextId',1,'nextApplicationId',1);
  end if;

  select * into v_assoc
  from private.online_associations
  where association_id=v_member.association_id and status='ACTIVE';

  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId',m.user_id::text,
    'role',m.role,
    'joinedAt',floor(extract(epoch from m.joined_at)*1000)::bigint
  ) order by case when m.role='LEADER' then 0 else 1 end,m.joined_at,m.user_id),'[]'::jsonb)
  into v_members
  from private.online_association_members m
  where m.association_id=v_assoc.association_id;

  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb)
  into v_activity
  from (
    select jsonb_build_object(
      'at',floor(extract(epoch from aa.created_at)*1000)::bigint,
      'text',aa.text
    ) as obj,aa.created_at
    from private.online_association_activity aa
    where aa.association_id=v_assoc.association_id
    order by aa.created_at desc
    limit 30
  ) x;

  v_assoc_json:=jsonb_build_object(
    'associationId',v_assoc.association_id::text,
    'recordNumber',v_assoc.record_number,
    'name',v_assoc.name,
    'description',v_assoc.description,
    'leaderId',v_assoc.leader_user_id::text,
    'createdAt',floor(extract(epoch from v_assoc.created_at)*1000)::bigint,
    'notice',v_assoc.notice,
    'noticeUpdatedAt',case when v_assoc.notice_updated_at is null then null else floor(extract(epoch from v_assoc.notice_updated_at)*1000)::bigint end,
    'joinPolicy',v_assoc.join_policy,
    'status','ACTIVE',
    'members',v_members,
    'applications','[]'::jsonb,
    'activityLog',v_activity,
    'revenueShareRatePercent',v_assoc.revenue_share_rate_percent,
    'treasurySilver',v_assoc.treasury_silver,
    'treasuryLedger','[]'::jsonb
  );

  return jsonb_build_object(
    'currentId',v_assoc.association_id::text,
    'associations',jsonb_build_array(v_assoc_json),
    'nextId',1,
    'nextApplicationId',1
  );
end;$$;
revoke all on function private.server_association_projection(uuid) from public,anon,authenticated;

create or replace function private.server_association_payload(p_user uuid,p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  p jsonb:=p_payload;
  v_qualified boolean:=false;
begin
  select qualified into v_qualified
  from private.player_association_eligibility
  where user_id=p_user;
  p:=jsonb_set(p,'{association}',private.server_association_projection(p_user),true);
  p:=jsonb_set(p,'{market,traderCertified}',to_jsonb(coalesce(v_qualified,false)),true);
  return p;
end;$$;
revoke all on function private.server_association_payload(uuid,jsonb) from public,anon,authenticated;

-- Extend the canonical authoritative save overlay. Client saves can no longer claim
-- association membership, leadership, revenue share, treasury, or trader certification.
create or replace function private.server_authoritative_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p jsonb;
  b jsonb:=private.server_consumables_json(p_user);
  l jsonb;
  owned jsonb:=private.server_owned_jobs_json(p_user);
  current_job text:=private.server_current_job(p_user);
begin
  p:=private.server_economy_payload(p_user,p_payload);
  l:=coalesce(p->'loadout','{}'::jsonb);
  p:=jsonb_set(p,'{potions}',b,true);
  p:=jsonb_set(p,'{loadout}',jsonb_build_object(
    'healing_lesser',least(greatest(0,coalesce((l->>'healing_lesser')::integer,0)),coalesce((b->>'healing_lesser')::integer,0)),
    'healing_standard',least(greatest(0,coalesce((l->>'healing_standard')::integer,0)),coalesce((b->>'healing_standard')::integer,0)),
    'healing_greater',least(greatest(0,coalesce((l->>'healing_greater')::integer,0)),coalesce((b->>'healing_greater')::integer,0)),
    'healing_supreme',least(greatest(0,coalesce((l->>'healing_supreme')::integer,0)),coalesce((b->>'healing_supreme')::integer,0)),
    'revival',least(1,greatest(0,coalesce((l->>'revival')::integer,0)),coalesce((b->>'revival')::integer,0))
  ),true);
  p:=jsonb_set(p,'{ownedJobIds}',owned,true);
  p:=jsonb_set(p,'{currentJobId}',case when current_job is null then 'null'::jsonb else to_jsonb(current_job) end,true);
  p:=private.server_association_payload(p_user,p);
  return p;
end $$;
revoke all on function private.server_authoritative_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function private.persist_server_association_to_save(p_user uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_save public.game_saves%rowtype;
begin
  select * into v_save from public.game_saves where user_id=p_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  perform private.persist_client_payload_with_server_economy(p_user,v_save.payload,'0.1.66');
  return private.cloud_record_json(p_user);
end;$$;
revoke all on function private.persist_server_association_to_save(uuid) from public,anon,authenticated;

create or replace function private.association_activity(
  p_association_id uuid,p_actor uuid,p_event_type text,p_text text
) returns void
language sql security definer set search_path=''
as $$
  insert into private.online_association_activity(association_id,actor_user_id,event_type,text)
  values(p_association_id,p_actor,p_event_type,p_text)
$$;
revoke all on function private.association_activity(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function private.association_occupation_locked(p_association_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from private.occupation_matches m
    where m.status='ACTIVE'
      and (m.attacker_group_key=p_association_id::text or m.defender_group_key=p_association_id::text)
      and (private.occupation_window(clock_timestamp())->>'phase')='BATTLE'
  )
$$;
revoke all on function private.association_occupation_locked(uuid) from public,anon,authenticated;

create or replace function private.online_association_state_json(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_member private.online_association_members%rowtype;
  v_assoc private.online_associations%rowtype;
  v_current jsonb:=null;
  v_members jsonb:='[]'::jsonb;
  v_apps jsonb:='[]'::jsonb;
  v_activity jsonb:='[]'::jsonb;
  v_directory jsonb:='[]'::jsonb;
  v_my_apps jsonb:='[]'::jsonb;
begin
  select m.* into v_member
  from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id
  where m.user_id=p_user and a.status='ACTIVE'
  limit 1;

  if found then
    select * into v_assoc
    from private.online_associations
    where association_id=v_member.association_id and status='ACTIVE';

    select coalesce(jsonb_agg(jsonb_build_object(
      'userId',m.user_id,
      'playerLabel','탐사자-'||upper(substr(replace(m.user_id::text,'-',''),1,6)),
      'role',m.role,
      'joinedAt',m.joined_at
    ) order by case when m.role='LEADER' then 0 else 1 end,m.joined_at,m.user_id),'[]'::jsonb)
    into v_members
    from private.online_association_members m
    where m.association_id=v_assoc.association_id;

    if v_member.role='LEADER' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId',ap.application_id,
        'applicantUserId',ap.applicant_user_id,
        'playerLabel','탐사자-'||upper(substr(replace(ap.applicant_user_id::text,'-',''),1,6)),
        'createdAt',ap.created_at,
        'status',ap.status
      ) order by ap.created_at),'[]'::jsonb)
      into v_apps
      from private.online_association_applications ap
      where ap.association_id=v_assoc.association_id and ap.status='PENDING';
    end if;

    select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb)
    into v_activity
    from (
      select jsonb_build_object('activityId',aa.activity_id,'text',aa.text,'createdAt',aa.created_at) obj,aa.created_at
      from private.online_association_activity aa
      where aa.association_id=v_assoc.association_id
      order by aa.created_at desc
      limit 30
    ) x;

    v_current:=jsonb_build_object(
      'associationId',v_assoc.association_id,
      'recordNumber',v_assoc.record_number,
      'name',v_assoc.name,
      'description',v_assoc.description,
      'leaderUserId',v_assoc.leader_user_id,
      'createdAt',v_assoc.created_at,
      'notice',v_assoc.notice,
      'noticeUpdatedAt',v_assoc.notice_updated_at,
      'joinPolicy',v_assoc.join_policy,
      'status',v_assoc.status,
      'memberLimit',v_assoc.member_limit,
      'revenueShareRatePercent',v_assoc.revenue_share_rate_percent,
      'treasurySilver',v_assoc.treasury_silver,
      'myRole',v_member.role,
      'members',v_members,
      'applications',v_apps,
      'activity',v_activity
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'associationId',d.association_id,
    'recordNumber',d.record_number,
    'name',d.name,
    'description',d.description,
    'joinPolicy',d.join_policy,
    'memberCount',d.member_count,
    'memberLimit',d.member_limit,
    'createdAt',d.created_at
  ) order by d.member_count desc,d.created_at,d.name),'[]'::jsonb)
  into v_directory
  from (
    select a.association_id,a.record_number,a.name,a.description,a.join_policy,a.member_limit,a.created_at,count(m.user_id)::int member_count
    from private.online_associations a
    left join private.online_association_members m on m.association_id=a.association_id
    where a.status='ACTIVE'
    group by a.association_id
    order by count(m.user_id) desc,a.created_at
    limit 50
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object(
    'applicationId',ap.application_id,
    'associationId',ap.association_id,
    'associationName',a.name,
    'createdAt',ap.created_at,
    'status',ap.status
  ) order by ap.created_at desc),'[]'::jsonb)
  into v_my_apps
  from private.online_association_applications ap
  join private.online_associations a on a.association_id=ap.association_id
  where ap.applicant_user_id=p_user and ap.status='PENDING';

  return jsonb_build_object(
    'userId',p_user,
    'qualified',coalesce((select qualified from private.player_association_eligibility where user_id=p_user),false),
    'current',v_current,
    'directory',v_directory,
    'myApplications',v_my_apps
  );
end;$$;
revoke all on function private.online_association_state_json(uuid) from public,anon,authenticated;

create or replace function private.online_association_result(p_user uuid)
returns jsonb
language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'state',private.online_association_state_json(p_user),
    'record',private.cloud_record_json(p_user)
  )
$$;
revoke all on function private.online_association_result(uuid) from public,anon,authenticated;

create or replace function private.broadcast_association_change(p_association_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  perform realtime.send(jsonb_build_object('associationId',p_association_id),'association_changed','association',true);
  perform realtime.send(jsonb_build_object('associationId',p_association_id),'occupation_changed','occupation',true);
end;$$;
revoke all on function private.broadcast_association_change(uuid) from public,anon,authenticated;

create or replace function public.get_online_association_state(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare u uuid;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  return private.online_association_state_json(u);
end;$$;
revoke all on function public.get_online_association_state(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_online_association_state(uuid,bigint,text,text) to authenticated;

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
  if not coalesce((select qualified from private.player_association_eligibility where user_id=u),false) then
    raise exception 'ASSOCIATION_NOT_CERTIFIED';
  end if;
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

create or replace function public.join_online_association(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_association_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_assoc private.online_associations%rowtype;
  v_count int;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if exists(select 1 from private.online_association_members where user_id=u) then raise exception 'ASSOCIATION_ALREADY_JOINED';end if;
  select * into v_assoc from private.online_associations where association_id=p_association_id and status='ACTIVE' for update;
  if not found then raise exception 'ASSOCIATION_NOT_FOUND';end if;
  if private.association_occupation_locked(v_assoc.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;
  if v_assoc.join_policy='CLOSED' then raise exception 'ASSOCIATION_JOIN_CLOSED';end if;

  select count(*) into v_count from private.online_association_members where association_id=v_assoc.association_id;
  if v_count>=v_assoc.member_limit then raise exception 'ASSOCIATION_FULL';end if;

  if v_assoc.join_policy='OPEN' then
    delete from private.online_association_applications where applicant_user_id=u and status='PENDING';
    insert into private.online_association_members(association_id,user_id,role)
    values(v_assoc.association_id,u,'MEMBER');
    perform private.association_activity(v_assoc.association_id,u,'JOINED','새 원정단원이 가입했습니다.');
    perform private.persist_server_association_to_save(u);
    perform private.broadcast_association_change(v_assoc.association_id);
  else
    if exists(select 1 from private.online_association_applications where applicant_user_id=u and status='PENDING') then
      raise exception 'ASSOCIATION_APPLICATION_EXISTS';
    end if;
    insert into private.online_association_applications(association_id,applicant_user_id)
    values(v_assoc.association_id,u);
    perform private.association_activity(v_assoc.association_id,u,'APPLICATION','새 가입 신청이 도착했습니다.');
    perform private.broadcast_association_change(v_assoc.association_id);
  end if;

  return private.online_association_result(u);
end;$$;
revoke all on function public.join_online_association(uuid,bigint,text,text,uuid) from public,anon;
grant execute on function public.join_online_association(uuid,bigint,text,text,uuid) to authenticated;

create or replace function public.review_online_association_application(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_application_id uuid,p_accept boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
  v_app private.online_association_applications%rowtype;
  v_assoc private.online_associations%rowtype;
  v_count int;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u;
  if not found or v_member.role<>'LEADER' then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
  select * into v_app from private.online_association_applications
  where application_id=p_application_id and association_id=v_member.association_id and status='PENDING'
  for update;
  if not found then raise exception 'ASSOCIATION_APPLICATION_NOT_FOUND';end if;
  select * into v_assoc from private.online_associations where association_id=v_member.association_id and status='ACTIVE' for update;
  if not found then raise exception 'ASSOCIATION_NOT_FOUND';end if;
  if private.association_occupation_locked(v_assoc.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;

  if p_accept then
    if exists(select 1 from private.online_association_members where user_id=v_app.applicant_user_id) then
      raise exception 'ASSOCIATION_APPLICANT_ALREADY_JOINED';
    end if;
    select count(*) into v_count from private.online_association_members where association_id=v_assoc.association_id;
    if v_count>=v_assoc.member_limit then raise exception 'ASSOCIATION_FULL';end if;
    update private.online_association_applications
    set status='ACCEPTED',reviewed_at=now(),reviewed_by=u
    where application_id=v_app.application_id;
    insert into private.online_association_members(association_id,user_id,role)
    values(v_assoc.association_id,v_app.applicant_user_id,'MEMBER');
    perform private.association_activity(v_assoc.association_id,u,'APPLICATION_ACCEPTED','가입 신청을 승인했습니다.');
    perform private.persist_server_association_to_save(v_app.applicant_user_id);
  else
    update private.online_association_applications
    set status='REJECTED',reviewed_at=now(),reviewed_by=u
    where application_id=v_app.application_id;
    perform private.association_activity(v_assoc.association_id,u,'APPLICATION_REJECTED','가입 신청을 거절했습니다.');
  end if;

  perform private.persist_server_association_to_save(u);
  perform private.broadcast_association_change(v_assoc.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.review_online_association_application(uuid,bigint,text,text,uuid,boolean) from public,anon;
grant execute on function public.review_online_association_application(uuid,bigint,text,text,uuid,boolean) to authenticated;

create or replace function public.leave_online_association(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u for update;
  if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
  if v_member.role='LEADER' then raise exception 'ASSOCIATION_LEADER_CANNOT_LEAVE';end if;
  if private.association_occupation_locked(v_member.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;

  delete from private.online_association_members where association_id=v_member.association_id and user_id=u;
  perform private.association_activity(v_member.association_id,u,'LEFT','원정단원이 탈퇴했습니다.');
  perform private.persist_server_association_to_save(u);
  perform private.broadcast_association_change(v_member.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.leave_online_association(uuid,bigint,text,text) from public,anon;
grant execute on function public.leave_online_association(uuid,bigint,text,text) to authenticated;

create or replace function public.update_online_association(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_description text,p_notice text,p_join_policy text,p_revenue_share_rate integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
  v_assoc private.online_associations%rowtype;
  v_target uuid;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u;
  if not found or v_member.role<>'LEADER' then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
  if char_length(coalesce(p_description,''))>120 or char_length(coalesce(p_notice,''))>180
     or p_join_policy not in('OPEN','APPROVAL','CLOSED')
     or p_revenue_share_rate<0 or p_revenue_share_rate>30 then
    raise exception 'ASSOCIATION_INPUT_INVALID';
  end if;

  update private.online_associations set
    description=btrim(coalesce(p_description,'')),
    notice=btrim(coalesce(p_notice,'')),
    notice_updated_at=case when notice is distinct from btrim(coalesce(p_notice,'')) then now() else notice_updated_at end,
    join_policy=p_join_policy,
    revenue_share_rate_percent=p_revenue_share_rate,
    updated_at=now()
  where association_id=v_member.association_id and status='ACTIVE'
  returning * into v_assoc;
  if not found then raise exception 'ASSOCIATION_NOT_FOUND';end if;

  perform private.association_activity(v_assoc.association_id,u,'UPDATED','원정단 정보가 수정되었습니다.');
  for v_target in select user_id from private.online_association_members where association_id=v_assoc.association_id loop
    perform private.persist_server_association_to_save(v_target);
  end loop;
  perform private.broadcast_association_change(v_assoc.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.update_online_association(uuid,bigint,text,text,text,text,text,integer) from public,anon;
grant execute on function public.update_online_association(uuid,bigint,text,text,text,text,text,integer) to authenticated;

create or replace function public.transfer_online_association_leadership(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_member_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
  v_target private.online_association_members%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u for update;
  if not found or v_member.role<>'LEADER' then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
  if private.association_occupation_locked(v_member.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;
  select * into v_target from private.online_association_members
  where association_id=v_member.association_id and user_id=p_member_user_id and role='MEMBER' for update;
  if not found then raise exception 'ASSOCIATION_MEMBER_NOT_FOUND';end if;

  update private.online_association_members set role='MEMBER',updated_at=now()
  where association_id=v_member.association_id and user_id=u;
  update private.online_association_members set role='LEADER',updated_at=now()
  where association_id=v_member.association_id and user_id=p_member_user_id;
  update private.online_associations set leader_user_id=p_member_user_id,updated_at=now()
  where association_id=v_member.association_id;

  perform private.association_activity(v_member.association_id,u,'LEADERSHIP_TRANSFERRED','원정단장 권한이 위임되었습니다.');
  perform private.persist_server_association_to_save(u);
  perform private.persist_server_association_to_save(p_member_user_id);
  perform private.broadcast_association_change(v_member.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.transfer_online_association_leadership(uuid,bigint,text,text,uuid) from public,anon;
grant execute on function public.transfer_online_association_leadership(uuid,bigint,text,text,uuid) to authenticated;

create or replace function public.kick_online_association_member(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_member_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
  v_target private.online_association_members%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u for update;
  if not found or v_member.role<>'LEADER' then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
  if private.association_occupation_locked(v_member.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;
  select * into v_target from private.online_association_members
  where association_id=v_member.association_id and user_id=p_member_user_id and role='MEMBER' for update;
  if not found then raise exception 'ASSOCIATION_MEMBER_NOT_FOUND';end if;

  delete from private.online_association_members
  where association_id=v_member.association_id and user_id=p_member_user_id;
  perform private.association_activity(v_member.association_id,u,'MEMBER_KICKED','원정단원이 원정단에서 제외되었습니다.');
  perform private.persist_server_association_to_save(p_member_user_id);
  perform private.persist_server_association_to_save(u);
  perform private.broadcast_association_change(v_member.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.kick_online_association_member(uuid,bigint,text,text,uuid) from public,anon;
grant execute on function public.kick_online_association_member(uuid,bigint,text,text,uuid) to authenticated;

create or replace function public.disband_online_association(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_member private.online_association_members%rowtype;
  v_target uuid;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_member from private.online_association_members where user_id=u for update;
  if not found or v_member.role<>'LEADER' then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
  if private.association_occupation_locked(v_member.association_id) then raise exception 'ASSOCIATION_OCCUPATION_LOCKED';end if;

  create temporary table if not exists association_disband_users(user_id uuid primary key) on commit drop;
  truncate association_disband_users;
  insert into association_disband_users(user_id)
  select user_id from private.online_association_members where association_id=v_member.association_id;

  perform private.association_activity(v_member.association_id,u,'DISBANDED','원정단이 해산되었습니다.');
  update private.online_associations set status='DISBANDED',updated_at=now()
  where association_id=v_member.association_id;
  delete from private.online_association_applications where association_id=v_member.association_id and status='PENDING';
  delete from private.online_association_members where association_id=v_member.association_id;

  for v_target in select user_id from association_disband_users loop
    perform private.persist_server_association_to_save(v_target);
  end loop;
  perform private.broadcast_association_change(v_member.association_id);
  return private.online_association_result(u);
end;$$;
revoke all on function public.disband_online_association(uuid,bigint,text,text) from public,anon;
grant execute on function public.disband_online_association(uuid,bigint,text,text) to authenticated;

-- Bind every expedition revenue-share snapshot to current server membership.
alter table private.online_expeditions
  add column if not exists association_id uuid references private.online_associations(association_id) on delete set null;
create index if not exists online_expeditions_association_idx
on private.online_expeditions(association_id,status);

create or replace function private.bind_online_expedition_association()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_assoc uuid;
begin
  if new.status='ACTIVE' then
    select m.association_id into v_assoc
    from private.online_association_members m
    join private.online_associations a on a.association_id=m.association_id
    where m.user_id=new.user_id and a.status='ACTIVE'
    limit 1;
    new.association_id:=v_assoc;
    new.revenue_share_rate:=case when v_assoc is null then 0 else private.server_association_revenue_rate(new.user_id) end;
  end if;
  return new;
end;$$;
revoke all on function private.bind_online_expedition_association() from public,anon,authenticated;

drop trigger if exists bind_online_expedition_association_trigger on private.online_expeditions;
create trigger bind_online_expedition_association_trigger
before insert or update of run_id,status on private.online_expeditions
for each row execute function private.bind_online_expedition_association();

create or replace function private.settle_online_association_side_effects()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_gross bigint:=0;
  v_share bigint:=0;
begin
  if old.status='ACTIVE' and new.status='RETURNED' then
    if old.floor=10 and coalesce(old.boss_defeated,false) then
      insert into private.player_association_eligibility(user_id,qualified,qualified_at,updated_at)
      values(new.user_id,true,now(),now())
      on conflict(user_id) do update set
        qualified=true,
        qualified_at=coalesce(private.player_association_eligibility.qualified_at,excluded.qualified_at),
        updated_at=now();
    end if;

    if old.association_id is not null and old.revenue_share_rate>0 then
      v_gross:=greatest(0,coalesce((old.temporary_loot->>'silver')::bigint,0));
      v_share:=floor(v_gross*old.revenue_share_rate/100.0);
      if v_share>0 then
        update private.online_associations
        set treasury_silver=treasury_silver+v_share,updated_at=now()
        where association_id=old.association_id and status='ACTIVE';
        if found then
          perform private.association_activity(
            old.association_id,new.user_id,'TREASURY_SHARE',
            '원정 수익 분담 '||v_share::text||' Silver가 원정단 금고에 적립되었습니다.'
          );
        end if;
      end if;
    end if;
  end if;
  return new;
end;$$;
revoke all on function private.settle_online_association_side_effects() from public,anon,authenticated;

drop trigger if exists settle_online_association_side_effects_trigger on private.online_expeditions;
create trigger settle_online_association_side_effects_trigger
after update of status on private.online_expeditions
for each row execute function private.settle_online_association_side_effects();

-- Replace v0.1.65 account-local occupation identity with the real global association.
create or replace function private.occupation_identity(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_member private.online_association_members%rowtype;
  v_assoc private.online_associations%rowtype;
begin
  select m.* into v_member
  from private.online_association_members m
  join private.online_associations a on a.association_id=m.association_id
  where m.user_id=p_user and a.status='ACTIVE'
  limit 1;
  if not found then raise exception 'OCCUPATION_ASSOCIATION_REQUIRED';end if;

  select * into v_assoc
  from private.online_associations
  where association_id=v_member.association_id and status='ACTIVE';
  if not found then raise exception 'OCCUPATION_ASSOCIATION_REQUIRED';end if;

  return jsonb_build_object(
    'groupKey',v_assoc.association_id::text,
    'groupName',v_assoc.name,
    'role',v_member.role,
    'associationId',v_assoc.association_id::text
  );
end;$$;
revoke all on function private.occupation_identity(uuid) from public,anon,authenticated;

-- Sync current saves once so subsequent client pulls immediately reflect server authority.
do $$
declare v_user uuid;
begin
  for v_user in select user_id from public.game_saves loop
    perform private.persist_server_association_to_save(v_user);
  end loop;
end $$;
