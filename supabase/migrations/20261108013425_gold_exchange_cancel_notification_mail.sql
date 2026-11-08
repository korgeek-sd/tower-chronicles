-- Inform players of cancelled GOLD/SILVER spot orders.
-- This runs in the same transaction as the existing cancellation/refund RPC.
-- No wallet rewards or claimable mail attachments are created.
create or replace function private.mail_on_gold_exchange_cancel()
returns trigger
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_filled bigint;
  v_refund bigint;
  v_buy boolean;
  v_title text;
  v_body text;
  v_format text := 'FM999,999,999,999,999,999,990';
begin
  v_buy := new.side = 'BUY_GOLD';
  v_filled := new.original_gold_quantity - new.remaining_gold_quantity;
  v_refund := case
    when v_buy then new.price_silver_per_gold * new.remaining_gold_quantity
    else new.remaining_gold_quantity
  end;
  v_title := case
    when v_buy then '골드 매수 주문 취소'
    else '골드 매도 주문 취소'
  end;

  v_body := concat_ws(E'\n',
    '골드 거래소에서 주문이 취소되었습니다.',
    '',
    '주문 가격: ' || to_char(new.price_silver_per_gold, v_format) || ' 실버 / 1 골드',
    '주문 수량: ' || to_char(new.original_gold_quantity, v_format) || ' 골드',
    '체결 수량: ' || to_char(v_filled, v_format) || ' 골드',
    '취소 수량: ' || to_char(new.remaining_gold_quantity, v_format) || ' 골드',
    case when v_buy
      then '반환 실버: ' || to_char(v_refund, v_format) || ' 실버'
      else '반환 골드: ' || to_char(v_refund, v_format) || ' 골드'
    end,
    '',
    '취소한 수량의 재화는 보유 재화에 즉시 반환되었습니다.',
    '이미 체결된 거래는 유지됩니다. 별도로 수령할 첨부 보상은 없습니다.'
  );

  insert into private.game_mail (
    user_id, event_key, category, title, body, details
  )
  values (
    new.user_id,
    'gold-exchange-cancel:' || new.order_id::text,
    'trade',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'gold_exchange_cancel',
      'orderId', new.order_id,
      'side', new.side,
      'priceSilverPerGold', new.price_silver_per_gold,
      'originalGoldQuantity', new.original_gold_quantity,
      'filledGoldQuantity', v_filled,
      'cancelledGoldQuantity', new.remaining_gold_quantity,
      'returnedSilver', case when v_buy then v_refund else 0 end,
      'returnedGold', case when v_buy then 0 else v_refund end
    )
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end;
$function$;

revoke all on function private.mail_on_gold_exchange_cancel()
  from public, anon, authenticated;

drop trigger if exists gold_exchange_cancel_mail on private.gold_exchange_orders;

create trigger gold_exchange_cancel_mail
after update of status on private.gold_exchange_orders
for each row
when (
  old.status in ('OPEN', 'PARTIAL')
  and new.status = 'CANCELLED'
  and new.remaining_gold_quantity > 0
)
execute function private.mail_on_gold_exchange_cancel();
