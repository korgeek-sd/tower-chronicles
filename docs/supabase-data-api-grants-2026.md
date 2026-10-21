# Supabase Data API GRANT policy (2026-10-30)

Verified against the live `tower-chronicles` Supabase project on 2026-10-21.

## Impact

- Supabase's 2026-10-30 change removes **automatic API privileges for newly created tables in `public`**. Existing grants are preserved.
- This includes schema re-creation for new projects, preview environments, and local `supabase db reset`.
- `GRANT` answers whether an API role can access an object; RLS determines which rows can be accessed. A policy alone does not grant table privileges.
- This rollout concerns **`public`**. Do not expose server-authoritative `private` tables merely to address API permission errors.
- No existing table ACLs or default ACLs were changed during this audit.

## Verified live project baseline

All four existing `public` tables have RLS enabled.

| Table | `anon` | `authenticated` | `service_role` | RLS |
| --- | --- | --- | --- | --- |
| `public.game_saves` | no direct table access | SELECT (owner-only policy); writes via trusted RPC | table CRUD | enabled |
| `public.game_save_versions` | no direct table access | no direct table access (no client policy) | table CRUD | enabled |
| `public.game_player_profiles` | no direct table access | column SELECT and INSERT for `user_id`, `nickname` only | table CRUD | enabled |
| `public.game_chat_messages` | no direct table access | table SELECT; column INSERT for `body`, `client_id`, `association_id` | table CRUD | enabled |

**Important:** `has_table_privilege(..., 'INSERT')` is false for a column-only grant. Inspect `has_column_privilege` before treating it as a failure.

As of 2026-10-21, default ACLs for `postgres` and `supabase_admin` still granted broad table privileges in `public`; **do not depend on that behavior for future migrations**.

## Required checklist for every new `public` table

1. Specify the intended API roles and individual operations/columns before migration.
2. In the table-creation migration: enable RLS; explicitly revoke inherited/default broad client privileges as appropriate; grant only the required table or column privileges; create matching owner/authorization policies.
3. Do not grant anonymous access unless required; keep `service_role` keys server-side only.
4. Verify from a real `authenticated` client and an `anon` client, including intended denials, and check the Security Advisor.
5. Ensure the same migration works in a fresh database and on a preview branch; check any identity/serial sequences for required sequence privileges.
6. Do not use unrestricted grants as a quick fix for PostgREST `42501`; inspect the requested role, operation, columns, and RLS separately.

### Example: user-owned feature table

Adapt table/column names and privileges to the feature. **Do not run this example against an existing game table.**

```sql
create table public.feature_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table public.feature_events enable row level security;

-- Be explicit about both roles and operations.
revoke all on public.feature_events from public, anon, authenticated;
grant select on public.feature_events to authenticated;
grant insert (user_id, event_type) on public.feature_events to authenticated;
grant select, insert, update, delete on public.feature_events to service_role;

create policy "feature event owner read"
  on public.feature_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "feature event owner create"
  on public.feature_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
```

If a table is server-only, prefer `private` and a narrowly controlled RPC rather than granting direct client access in `public`.

## Verification queries (read only)

```sql
-- Table-level privileges. Column-only grants will not appear here.
select c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by c.relname;

-- Include column-scoped access, used by profiles and chat.
select c.relname, a.attname,
       has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') as auth_select,
       has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') as auth_insert
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relkind in ('r','p')
order by c.relname, a.attnum;
```

Supabase official guidance:
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/docs/guides/api/securing-your-api
