create or replace function private.online_association_state_json(p_user uuid)
returns jsonb
language plpgsql volatile security definer set search_path=''
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
      'playerLabel',coalesce((select nickname from public.game_player_profiles where user_id=m.user_id),'미등록 탐험가'),
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
        'playerLabel',coalesce((select nickname from public.game_player_profiles where user_id=ap.applicant_user_id),'미등록 탐험가'),
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
    'revenueShareRatePercent',d.revenue_share_rate_percent,
    'createdAt',d.created_at
  ) order by d.member_count desc,d.created_at,d.name),'[]'::jsonb)
  into v_directory
  from (
    select a.association_id,a.record_number,a.name,a.description,a.join_policy,a.member_limit,a.revenue_share_rate_percent,a.created_at,count(m.user_id)::int member_count
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

-- Chat membership helper returns only the caller's active association.
create function private.my_chat_association() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.association_id,'name',a.name) from private.online_association_members m
 join private.online_associations a using(association_id) where m.user_id=auth.uid() and a.status='ACTIVE'
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.game_player_profiles where user_id=auth.uid()) limit 1;
$$;
revoke all on function private.my_chat_association() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.my_chat_association() to authenticated;
create function public.get_chat_association() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_chat_association();$$;
revoke all on function public.get_chat_association() from public,anon;
grant execute on function public.get_chat_association() to authenticated;
alter table public.game_chat_messages add column association_id uuid references private.online_associations(association_id) on delete cascade;
grant insert(association_id) on public.game_chat_messages to authenticated;
create index game_chat_channel_history_idx on public.game_chat_messages(association_id,created_at desc,id);
drop policy chat_member_read on public.game_chat_messages;
create policy chat_member_read on public.game_chat_messages for select to authenticated using (
 (select auth.uid()) is not null and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
 and exists(select 1 from public.game_player_profiles where user_id=(select auth.uid()))
 and (association_id is null or association_id=((select private.my_chat_association())->>'id')::uuid));
create or replace function private.prepare_chat_message() returns trigger
 language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_name text; v_last timestamptz;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'CHAT_AUTH_REQUIRED' using errcode='42501';
 end if;
 select nickname into v_name from public.game_player_profiles where user_id=v_user for update;
 if not found then raise exception 'CHAT_PROFILE_REQUIRED' using errcode='42501';end if;
 if new.association_id is not null then
  perform 1 from private.online_association_members m join private.online_associations a using(association_id)
   where m.user_id=v_user and m.association_id=new.association_id and a.status='ACTIVE' for share of m,a;
  if not found then raise exception 'CHAT_ASSOCIATION_REQUIRED' using errcode='42501';end if;
 end if;
 -- Retries of an already committed request hit UNIQUE and recover the original through REST.
 if not exists(select 1 from public.game_chat_messages where user_id=v_user and client_id=new.client_id) then
  select created_at into v_last from public.game_chat_messages where user_id=v_user order by created_at desc limit 1;
  if v_last is not null and clock_timestamp()<v_last+interval '2 seconds' then
   raise exception 'CHAT_RATE_LIMIT' using errcode='P0001';
  end if;
 end if;
 new.body:=btrim(normalize(new.body,NFC));
 if new.body is null or char_length(new.body) not between 1 and 200 or new.body ~ '[[:cntrl:]]'
 or new.body ~ U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]' then
  raise exception 'CHAT_BODY_INVALID' using errcode='23514';
 end if;
 new.user_id:=v_user;new.nickname:=v_name;new.created_at:=clock_timestamp();
 return new;
end;$$;
