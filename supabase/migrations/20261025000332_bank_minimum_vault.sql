-- Keep a one-million-silver reserve when the owner withdraws funds.
-- Loans still use bank capital; no existing wallet, loan or vault balance is rewritten.
do $migration$
declare definition text;old_branch text:=E'  else\n   update private.server_banks set vault=vault-amount where id=b.id and vault>=amount;';
begin
 definition:=pg_get_functiondef('public.server_bank_action(uuid,bigint,text,text,uuid,text,jsonb)'::regprocedure);
 if strpos(definition,'BANK_MINIMUM_VAULT')>0 then return;end if;
 if strpos(definition,old_branch)=0 then raise exception 'BANK_WITHDRAW_BRANCH_NOT_FOUND';end if;
 definition:=replace(definition,old_branch,E'  else\n   if b.vault-amount<1000000 then raise exception ''BANK_MINIMUM_VAULT'';end if;\n   update private.server_banks set vault=vault-amount where id=b.id and vault>=amount;');
 execute definition;
end $migration$;
