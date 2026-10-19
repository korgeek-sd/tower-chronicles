CREATE OR REPLACE FUNCTION private.operations_capture_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx text;src text;ds numeric;dg numeric;f text;v record;
begin
 get diagnostics ctx=pg_context;
 src:=private.operations_wallet_source(ctx);
 if tg_op='INSERT' then ds:=new.silver;dg:=new.gold;src:='initial_sync';
 else ds:=new.silver::numeric-old.silver;dg:=new.gold::numeric-old.gold;end if;
 for v in select * from (values('silver',ds),('gold',dg)) x(currency,amount) where amount<>0 loop
  f:=case when src in ('initial_sync','unclassified') then 'adjustment'
   when src in ('market_transfer','gold_exchange_transfer') then 'transfer'
   when src in ('reward_mail','expedition_return','association_shop') and v.amount>0 then 'generation'
   when src in ('enhancement','job_registration','seal_roll','seal_reset','association_donation','association_creation','equipment_listing_fee') and v.amount<0 then 'consumption'
   else 'adjustment' end;
  insert into private.operations_economy_ledger(user_id,currency,amount,flow,source) values(new.user_id,v.currency,v.amount,f,src);
 end loop;
 return new;
end $function$

