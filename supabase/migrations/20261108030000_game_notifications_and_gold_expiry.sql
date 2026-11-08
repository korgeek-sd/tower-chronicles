-- Server-owned in-game notifications, Android push tokens, and 30-day Gold order expiry.
-- Only trusted server events may create notifications; app clients can only list/read their own rows.
create table if not exists private.game_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,
 category text not null check (category in ('trade','mail','bank','auction','war')),
 title text not null,
 body text not null default '',
 target text not null default 'home',
 created_at timestamptz not null default now(),
 read_at timestamptz,
 push_sent_at timestamptz,
 unique(user_id,event_key)
);
alter table private.game_notifications enable row level security;
revoke all on private.game_notifications from public,anon,authenticated;
create index if not exists game_notifications_user_idx on private.game_notifications(user_id,created_at desc);
create index if not exists game_notifications_unsent_idx on private.game_notifications(created_at) where push_sent_at is null;

create table if not exists private.game_push_tokens (
 token text primary key check(length(token) between 32 and 4096),
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id text not null check(length(device_id) between 1 and 256),
 platform text not null default 'android' check(platform='android'),
 updated_at timestamptz not null default now()
);
alter table private.game_push_tokens enable row level security;
revoke all on private.game_push_tokens from public,anon,authenticated;
create index if not exists game_push_tokens_user_idx on private.game_push_tokens(user_id);

create or replace function public.get_game_notifications()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object(
  'unread', (select count(*) from private.game_notifications where user_id=u and read_at is null),
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id',n.id,'category',n.category,'title',n.title,'body',n.body,
    'target',n.target,'createdAt',extract(epoch from n.created_at)*1000,
    'read',n.read_at is not null
  ) order by n.created_at desc,n.id desc)
  from (select * from private.game_notifications where user_id=u order by created_at desc,id desc limit 100)n),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.get_game_notifications() from public,anon,authenticated;
grant execute on function public.get_game_notifications() to authenticated;

create or replace function public.read_game_notifications(p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_ids is not null and cardinality(p_ids)>100 then raise exception 'NOTIFICATION_LIMIT';end if;
 update private.game_notifications set read_at=now()
 where user_id=u and read_at is null and (p_ids is null or id=any(p_ids));
 return public.get_game_notifications();
end;
$$;
revoke all on function public.read_game_notifications(uuid[]) from public,anon,authenticated;
grant execute on function public.read_game_notifications(uuid[]) to authenticated;

create or replace function public.set_game_push_token(p_token text,p_device_id text,p_enabled boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_token is null or length(p_token) not between 32 and 4096
    or p_device_id is null or length(p_device_id) not between 1 and 256 then
   raise exception 'PUSH_TOKEN_INVALID';
 end if;
 if p_enabled then
  insert into private.game_push_tokens(token,user_id,device_id,platform)
  values(p_token,u,p_device_id,'android')
  on conflict(token) do update set user_id=excluded.user_id,device_id=excluded.device_id,updated_at=now();
 else
  delete from private.game_push_tokens where user_id=u and token=p_token;
 end if;
end;
$$;
revoke all on function public.set_game_push_token(text,text,boolean) from public,anon,authenticated;
grant execute on function public.set_game_push_token(text,text,boolean) to authenticated;

-- Mail arrivals are announcements, except intentionally silent self-cancelled Gold orders.
create or replace function private.notify_game_mail()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.event_key like 'gold-exchange-cancel:%' then return new;end if;
 insert into private.game_notifications(user_id,event_key,category,title,body,target)
 values(new.user_id,'mail:'||new.mail_id::text,'mail',new.title,left(new.body,500),'mail')
 on conflict(user_id,event_key) do nothing;
 return new;
end;
$$;
revoke all on function private.notify_game_mail() from public,anon,authenticated;
drop trigger if exists game_mail_notify on private.game_mail;
create trigger game_mail_notify after insert on private.game_mail
for each row execute function private.notify_game_mail();

create or replace function private.notify_gold_trade()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_body text;
begin
 v_body:=new.gold_quantity::text||' Gold / 1 Gold당 '||new.price_silver_per_gold::text||' Silver';
 insert into private.game_notifications(user_id,event_key,category,title,body,target)
 values(new.buyer_id,'gold-trade:buy:'||new.trade_id,'trade','골드 매수 체결',v_body,'gold-exchange'),
       (new.seller_id,'gold-trade:sell:'||new.trade_id,'trade','골드 매도 체결',v_body,'gold-exchange')
 on conflict(user_id,event_key) do nothing;
 return new;
end;
$$;
revoke all on function private.notify_gold_trade() from public,anon,authenticated;
drop trigger if exists gold_trade_notify on private.gold_exchange_trades;
create trigger gold_trade_notify after insert on private.gold_exchange_trades
for each row execute function private.notify_gold_trade();

create or replace function private.notify_bank_ledger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind in ('AUTO_REPAID','DEFAULTED') then
  insert into private.game_notifications(user_id,event_key,category,title,body,target)
  values(new.user_id,'bank:'||new.id::text,'bank',
    case when new.kind='AUTO_REPAID' then '은행 대출 자동 상환' else '은행 대출 미상환 처리' end,
    case when new.kind='AUTO_REPAID' then '만기 대출이 자동 정산되었습니다.' else '대출이 미상환 처리되었습니다. 은행 내역을 확인하세요.' end,
    'bank')
  on conflict(user_id,event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_bank_ledger() from public,anon,authenticated;
drop trigger if exists bank_ledger_notify on private.server_bank_ledger;
create trigger bank_ledger_notify after insert on private.server_bank_ledger
for each row execute function private.notify_bank_ledger();

-- Gold orders previously had no expiry. Preserve their original registration time.
alter table private.gold_exchange_orders add column if not exists expires_at timestamptz;
update private.gold_exchange_orders set expires_at=created_at+interval '30 days' where expires_at is null;
alter table private.gold_exchange_orders alter column expires_at set default(now()+interval '30 days');
alter table private.gold_exchange_orders alter column expires_at set not null;
alter table private.gold_exchange_orders drop constraint if exists gold_exchange_orders_status_check;
alter table private.gold_exchange_orders add constraint gold_exchange_orders_status_check
 check(status in ('OPEN','PARTIAL','FILLED','CANCELLED','EXPIRED'));
create index if not exists gold_exchange_due_idx on private.gold_exchange_orders(expires_at,order_id)
 where status in ('OPEN','PARTIAL') and remaining_gold_quantity>0;

create or replace function private.expire_gold_exchange_orders()
returns integer language plpgsql security definer set search_path='' as $$
declare o private.gold_exchange_orders%rowtype; v_count integer:=0;
begin
 -- Same advisory lock as placing/cancelling Gold orders, so escrow cannot be refunded twice.
 perform pg_advisory_xact_lock(hashtextextended('GOLD/SILVER',32));
 for o in
  select * from private.gold_exchange_orders
  where status in ('OPEN','PARTIAL') and remaining_gold_quantity>0 and expires_at<=now()
  order by expires_at,order_id for update
 loop
  if o.side='BUY_GOLD' then
   update private.player_wallets set silver=silver+o.price_silver_per_gold*o.remaining_gold_quantity,updated_at=now() where user_id=o.user_id;
  else
   update private.player_wallets set gold=gold+o.remaining_gold_quantity,updated_at=now() where user_id=o.user_id;
  end if;
  update private.gold_exchange_orders set status='EXPIRED',updated_at=now() where order_id=o.order_id;
  perform private.persist_market_economy_to_save(o.user_id);
  insert into private.game_mail(user_id,event_key,category,title,body,details)
  values(o.user_id,'gold-exchange-expired:'||o.order_id::text,'trade',
   case when o.side='BUY_GOLD' then '골드 매수 주문 30일 만료' else '골드 매도 주문 30일 만료' end,
   '등록한 골드 주문이 30일 만료되어 미체결 수량 '||o.remaining_gold_quantity||' Gold에 해당하는 '||
   case when o.side='BUY_GOLD' then (o.price_silver_per_gold*o.remaining_gold_quantity)::text||' Silver' else o.remaining_gold_quantity::text||' Gold' end||
   '가 서버 지갑으로 자동 반환되었습니다. 이미 체결된 거래는 유지됩니다.',
   jsonb_build_object('kind','gold_exchange_expired','orderId',o.order_id,'remainingGold',o.remaining_gold_quantity))
  on conflict(user_id,event_key) do nothing;
  v_count:=v_count+1;
 end loop;
 if v_count>0 then perform realtime.send(jsonb_build_object('pair','GOLD/SILVER'),'gold_exchange_changed','market',true);end if;
 return v_count;
end;
$$;
revoke all on function private.expire_gold_exchange_orders() from public,anon,authenticated;

create or replace function private.maintain_game_notifications()
returns void language plpgsql security definer set search_path='' as $$
begin
 -- One warning per mail, only when there is an unclaimed attachment.
 insert into private.game_notifications(user_id,event_key,category,title,body,target)
 select m.user_id,'mail-expiry:'||m.mail_id::text,'mail','우편 만료 임박',
        '첨부 보상이 포함된 우편이 24시간 이내 만료됩니다: '||m.title,'mail'
 from private.game_mail m
 where m.expires_at>now() and m.expires_at<=now()+interval '24 hours'
  and m.attachment_item_id is not null and m.claimed_at is null
 on conflict(user_id,event_key) do nothing;
 delete from private.game_notifications where created_at<now()-interval '90 days';
end;
$$;
revoke all on function private.maintain_game_notifications() from public,anon,authenticated;

select cron.schedule('tc-gold-exchange-expiry','* * * * *','select private.expire_gold_exchange_orders()');
select cron.schedule('tc-game-notifications-maintenance','*/10 * * * *','select private.maintain_game_notifications()');
