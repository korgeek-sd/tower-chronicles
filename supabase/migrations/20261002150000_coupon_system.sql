-- Coupon system foundation
-- Server-side validation and reward delivery will use this schema.

create table if not exists private.game_coupons (
 coupon_id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 reward_data jsonb not null default '{}',
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 max_uses integer,
 used_count integer not null default 0,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 check(expires_at > starts_at),
 check(max_uses is null or max_uses > 0)
);

create table if not exists private.coupon_claims (
 claim_id uuid primary key default gen_random_uuid(),
 coupon_id uuid not null references private.game_coupons(coupon_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 claimed_at timestamptz not null default now(),
 unique(coupon_id,user_id)
);

create index if not exists game_coupons_code_idx on private.game_coupons(code);
create index if not exists coupon_claims_user_idx on private.coupon_claims(user_id);
