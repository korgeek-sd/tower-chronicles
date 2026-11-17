-- Display-name change only; keep the original item key, purchase limits and all player balances.
update private.online_association_shop_items
set item_name='모험가 장비 상자 ×5'
where item_id='rare_equipment_weekly' and item_name='모험가 상자 ×5';
