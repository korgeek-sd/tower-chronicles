-- An account's first permanent class. The client can insert once, read only its
-- own choice, and can never UPDATE/DELETE it (including from another device).
-- Skill-tree picks remain separate local preferences for now.
create table public.game_initial_classes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 class_id text not null constraint game_initial_classes_class_check
   check (class_id in ('warrior','mage','archer')),
 created_at timestamptz not null default now()
);
comment on table public.game_initial_classes is
 'Immutable first combat profession per authenticated Google account.';
alter table public.game_initial_classes enable row level security;
revoke all on public.game_initial_classes from public,anon,authenticated;
grant select (user_id,class_id),insert (user_id,class_id)
 on public.game_initial_classes to authenticated;
grant all on public.game_initial_classes to service_role;
create policy game_initial_class_own_read
 on public.game_initial_classes for select to authenticated
 using (user_id=(select auth.uid())
    and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
create policy game_initial_class_one_time_insert
 on public.game_initial_classes for insert to authenticated
 with check (user_id=(select auth.uid())
    and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
-- No UPDATE or DELETE policy, and neither privilege is granted.
-- The primary key forbids a second INSERT for the same account.
