CREATE OR REPLACE FUNCTION private.server_association_projection(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end;$function$

