-- Recruitment directory reads the same server-authoritative member power as guild rankings.
-- No client-supplied scores, stored counters, or temporary effects.
CREATE OR REPLACE FUNCTION private.online_association_state_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'combatPower',coalesce(cp.combat_power,0),
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
  ) d
  left join lateral (
    select coalesce(sum(private.member_combat_power(m.user_id)),0)::bigint as combat_power
    from private.online_association_members m
    where m.association_id=d.association_id
  ) cp on true;

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
    'myApplications',v_my_apps,'rejoinAt',(select rejoin_at from private.association_rejoin_cooldowns where user_id=p_user and rejoin_at>clock_timestamp()),'serverNow',extract(epoch from clock_timestamp())*1000
  );
end;$function$;
