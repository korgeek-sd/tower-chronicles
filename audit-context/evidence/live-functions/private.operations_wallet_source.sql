CREATE OR REPLACE FUNCTION private.operations_wallet_source(p_context text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
select case
 when p_context ~ 'function (private[.])?sync_market_economy_from_latest_save[(]' then 'initial_sync'
 when p_context ~ 'function (public[.])?enhance_online_equipment[(]' then 'enhancement'
 when p_context ~ 'function (public[.])?register_online_job[(]' then 'job_registration'
 when p_context ~ 'function (public[.])?roll_association_seal[(]' then 'seal_roll'
 when p_context ~ 'function (public[.])?reset_association_seal[(]' then 'seal_reset'
 when p_context ~ 'function (public[.])?donate_to_association[(]' then 'association_donation'
 when p_context ~ 'function (public[.])?(create_online_association_v2|spend_online_association_fee)[(]' then 'association_creation'
 when p_context ~ 'function (public[.])?buy_online_association_shop_item[(]' then 'association_shop'
 when p_context ~ 'function (private[.])?deliver_coupon_reward[(]' then 'reward_mail'
 when p_context ~ 'function (public[.])?settle_online_expedition_v2[(]' then 'expedition_return'
 when p_context ~ 'function (public[.])?list_online_equipment[(]' then 'equipment_listing_fee'
 when p_context ~ 'function (public[.])?(place_online_gold_exchange_order|cancel_online_gold_exchange_order)[(]' then 'gold_exchange_transfer'
 when p_context ~ 'function (public[.])?(place_online_market_order|buy_online_equipment_listing|claim_online_market_storage|claim_all_online_market_storage)[(]' or p_context ~ 'function (private[.])?close_market_order[(]' then 'market_transfer'
 else 'unclassified' end
$function$

