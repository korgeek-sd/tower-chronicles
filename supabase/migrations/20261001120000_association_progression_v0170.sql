-- v0.1.70: association progression foundation
-- Adds server-side experience, contribution and donation tracking.

alter table private.online_associations
  add column if not exists association_level integer not null default 1,
  add column if not exists association_exp bigint not null default 0,
  add column if not exists total_donation bigint not null default 0;

create table if not exists private.online_association_member_progression (
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_point bigint not null default 0,
  total_silver_donation bigint not null default 0,
  total_gold_donation bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(association_id,user_id)
);

alter table private.online_association_member_progression enable row level security;
revoke all on private.online_association_member_progression from public,anon,authenticated;

create table if not exists private.online_association_donations (
  donation_id bigint generated always as identity primary key,
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  currency_type text not null check(currency_type in ('SILVER','GOLD')),
  amount bigint not null check(amount>0),
  association_exp_gain bigint not null,
  contribution_gain bigint not null,
  created_at timestamptz not null default now()
);

alter table private.online_association_donations enable row level security;
revoke all on private.online_association_donations from public,anon,authenticated;

create index if not exists online_association_donations_assoc_idx
on private.online_association_donations(association_id,created_at desc);

create or replace function private.association_level_from_exp(p_exp bigint)
returns integer
language sql immutable
as $$
 select case
  when p_exp >= 100000 then 10
  when p_exp >= 50000 then 9
  when p_exp >= 25000 then 8
  when p_exp >= 12000 then 7
  when p_exp >= 6000 then 6
  when p_exp >= 3000 then 5
  when p_exp >= 1500 then 4
  when p_exp >= 700 then 3
  when p_exp >= 300 then 2
  else 1 end
$$;

revoke all on function private.association_level_from_exp(bigint) from public,anon,authenticated;

create or replace function private.donate_to_association(
 p_association_id uuid,
 p_currency_type text,
 p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_member boolean;
 v_exp bigint;
 v_contribution bigint;
 v_level integer;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

 select exists(
  select 1 from private.online_association_members
  where association_id=p_association_id and user_id=v_user
 ) into v_member;

 if not v_member then raise exception 'NOT_MEMBER'; end if;
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 if p_currency_type not in ('SILVER','GOLD') then raise exception 'INVALID_CURRENCY'; end if;

 -- Economy deduction is connected in the existing server economy layer.
 -- This foundation stores authoritative association growth data.
 v_exp := case when p_currency_type='GOLD' then p_amount*2 else p_amount end;
 v_contribution := p_amount;

 update private.online_associations
 set association_exp=association_exp+v_exp,
     total_donation=total_donation+p_amount,
     association_level=private.association_level_from_exp(association_exp+v_exp),
     updated_at=now()
 where association_id=p_association_id;

 insert into private.online_association_member_progression(
  association_id,user_id,contribution_point,
  total_silver_donation,total_gold_donation
 ) values(
  p_association_id,v_user,v_contribution,
  case when p_currency_type='SILVER' then p_amount else 0 end,
  case when p_currency_type='GOLD' then p_amount else 0 end
 )
 on conflict(association_id,user_id) do update set
  contribution_point=private.online_association_member_progression.contribution_point+excluded.contribution_point,
  total_silver_donation=private.online_association_member_progression.total_silver_donation+excluded.total_silver_donation,
  total_gold_donation=private.online_association_member_progression.total_gold_donation+excluded.total_gold_donation,
  updated_at=now();

 insert into private.online_association_donations(
 association_id,user_id,currency_type,amount,association_exp_gain,contribution_gain
 ) values(p_association_id,v_user,p_currency_type,p_amount,v_exp,v_contribution);

 select association_exp,association_level into v_exp,v_level
 from private.online_associations
 where association_id=p_association_id;

 return jsonb_build_object(
  'associationExp',v_exp,
  'associationLevel',v_level,
  'contributionGain',v_contribution
 );
end;$$;

revoke all on function private.donate_to_association(uuid,text,bigint) from public,anon,authenticated;
