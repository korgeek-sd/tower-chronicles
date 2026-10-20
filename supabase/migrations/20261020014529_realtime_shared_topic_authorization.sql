-- Restore private shared change-notification channels. No client publishing grants.
create policy "authenticated can receive association broadcasts"
on realtime.messages for select to authenticated
using (
 extension='broadcast'
 and realtime.topic()='association'
 and (select auth.uid()) is not null
 and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
);
create policy "authenticated can receive occupation broadcasts"
on realtime.messages for select to authenticated
using (
 extension='broadcast'
 and realtime.topic()='occupation'
 and (select auth.uid()) is not null
 and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
);
