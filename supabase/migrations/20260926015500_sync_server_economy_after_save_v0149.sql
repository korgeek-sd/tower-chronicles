-- v0.1.49: project accepted cloud-save economy into the private online ledger immediately.

create or replace function private.sync_market_economy_after_save()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.sync_market_economy_from_latest_save(new.user_id);
  return new;
end;
$$;

revoke all on function private.sync_market_economy_after_save() from public,anon,authenticated;

drop trigger if exists sync_market_economy_after_game_save on public.game_saves;
create trigger sync_market_economy_after_game_save
after insert or update of revision,payload,payload_hash on public.game_saves
for each row execute function private.sync_market_economy_after_save();
