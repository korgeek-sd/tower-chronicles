-- Public game identity, separate from economic/save data. Nicknames are set once.
create table public.game_player_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null,
 nickname_key text generated always as (lower(nickname collate "C")) stored,
 created_at timestamptz not null default now(),
 constraint game_player_profiles_nickname_key unique (nickname_key),
 constraint game_player_profiles_nickname_valid check (
  char_length(nickname) between 2 and 12
  and nickname ~ '^[가-힣A-Za-z0-9]+$'
  and nickname = btrim(nickname)
  and nickname = normalize(nickname, NFC)
  and lower(nickname collate "C") not in ('admin','administrator','gm','system','운영자','관리자','시스템','공지')
 )
);
comment on table public.game_player_profiles is 'Public player identity for future chat, associations and market displays. No email or game economy data.';
alter table public.game_player_profiles enable row level security;
revoke all on public.game_player_profiles from public, anon, authenticated;
grant select (user_id,nickname), insert (user_id,nickname) on public.game_player_profiles to authenticated;
grant all on public.game_player_profiles to service_role;
create policy player_profiles_read on public.game_player_profiles for select to authenticated
 using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy player_profiles_register on public.game_player_profiles for insert to authenticated
 with check ((select auth.uid()) = user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
