CREATE OR REPLACE FUNCTION private.process_server_bank_due()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l record;t timestamptz:=clock_timestamp();n integer:=0;
begin
 if not exists(select 1 from private.server_bank_loans where status in ('ACTIVE','GRACE_PERIOD') and maturity_at<=t) then return 0;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('tc-market-mutations',0)) then return 0;end if;
 t:=clock_timestamp();
 for l in select id from private.server_bank_loans where status in ('ACTIVE','GRACE_PERIOD') and maturity_at<=t
  and (status='ACTIVE' or grace_at<=t or reminders<least(4,1+floor(extract(epoch from(t-maturity_at))/21600)::integer)) order by maturity_at,id limit 100 loop
  begin
   perform private.settle_server_bank_loan(l.id,t);n:=n+1;
  exception when others then raise log 'server bank settlement failed for %: %',l.id,sqlerrm;
  end;
 end loop;
 return n;
end $function$

