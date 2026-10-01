-- v0.1.53: association contribution shop foundation
-- Adds server-side storage for contribution currency and shop inventory.

create table if not exists private.online_association_shop_items(
  item_id text primary key,
  item_name text not null,
  shop_type text not null check (shop_type in ('DAILY','WEEKLY')),
  contribution_cost integer not null check (contribution_cost>=0),
  purchase_limit integer not null default 1 check (purchase_limit>0),
  enabled boolean not null default true
);

create table if not exists private.online_association_shop_purchases(
  purchase_id bigint generated always as identity primary key,
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references private.online_association_shop_items(item_id),
  cost integer not null check (cost>=0),
  purchased_at timestamptz not null default now()
);

create index if not exists online_association_shop_purchase_user_idx
on private.online_association_shop_purchases(user_id,purchased_at desc);

alter table private.online_association_shop_items enable row level security;
alter table private.online_association_shop_purchases enable row level security;
revoke all on private.online_association_shop_items from public,anon,authenticated;
revoke all on private.online_association_shop_purchases from public,anon,authenticated;

insert into private.online_association_shop_items(item_id,item_name,shop_type,contribution_cost,purchase_limit)
values
('job_draw_ticket_daily','직능 뽑기권','DAILY',1000,5),
('enhancement_stone_weekly','강화석','WEEKLY',5000,10),
('greater_potion_weekly','상급 포션','WEEKLY',3000,20)
on conflict(item_id) do nothing;

create table if not exists private.online_association_member_contribution(
  association_id uuid not null references private.online_associations(association_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_point bigint not null default 0 check(contribution_point>=0),
  updated_at timestamptz not null default now(),
  primary key(association_id,user_id)
);

alter table private.online_association_member_contribution enable row level security;
revoke all on private.online_association_member_contribution from public,anon,authenticated;
