create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 1),
  save_schema integer not null,
  app_version text not null,
  payload jsonb not null,
  payload_hash text not null,
  device_id text,
  client_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_save_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  save_schema integer not null,
  app_version text not null,
  payload jsonb not null,
  payload_hash text not null,
  device_id text,
  created_at timestamptz not null default now(),
  unique(user_id, revision)
);

alter table public.game_saves enable row level security;
alter table public.game_save_versions enable row level security;

revoke all on public.game_saves from anon, authenticated;
revoke all on public.game_save_versions from anon, authenticated;
grant select on public.game_saves to authenticated;

drop policy if exists "read own current save" on public.game_saves;
create policy "read own current save"
on public.game_saves for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.save_game_state(
  p_base_revision bigint,
  p_save_schema integer,
  p_app_version text,
  p_payload jsonb,
  p_payload_hash text,
  p_device_id text default null
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current public.game_saves%rowtype;
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select * into v_current
  from public.game_saves
  where user_id=v_user
  for update;

  if not found then
    if p_base_revision <> 0 then
      raise exception 'SAVE_CONFLICT';
    end if;

    insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,client_saved_at)
    values(v_user,1,p_save_schema,p_app_version,p_payload,p_payload_hash,p_device_id,now())
    returning game_saves.revision, game_saves.updated_at into v_revision,v_updated_at;
  else
    if v_current.revision <> p_base_revision then
      raise exception 'SAVE_CONFLICT';
    end if;

    insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
    values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
    on conflict on constraint game_save_versions_user_id_revision_key do nothing;

    update public.game_saves
    set revision=v_current.revision+1,
        save_schema=p_save_schema,
        app_version=p_app_version,
        payload=p_payload,
        payload_hash=p_payload_hash,
        device_id=p_device_id,
        client_saved_at=now(),
        updated_at=now()
    where user_id=v_user
    returning game_saves.revision, game_saves.updated_at into v_revision,v_updated_at;
  end if;

  return query select v_revision,v_updated_at;
end;
$$;

revoke all on function public.save_game_state(bigint,integer,text,jsonb,text,text) from public, anon;
grant execute on function public.save_game_state(bigint,integer,text,jsonb,text,text) to authenticated;
