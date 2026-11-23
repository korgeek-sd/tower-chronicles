# 운영 RPC 진입점 전체 목록

대상: public 함수 153개. 인증 역할의 EXECUTE는 진입 자격이며 본문 내 업무 권한을 보장하지 않는다. 익명 EXECUTE는 모두 false. 소스 연결은 AST 문자열 위치이며 동적 호출·실제 도달성 증명이 아니다. 세부 인자는 rpc-inventory.json 참조.

| 함수 | 분류 | authenticated EXECUTE | 소스 문자열 위치 | 분석 범위 |
|---|---|---|---|---|
| `abandon_online_resource_stronghold` | 점령·대전 | 예 | src/online/economy.ts:L385 | 진입점 목록화 |
| `abandon_resource_stronghold` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L66 | 진입점 목록화 |
| `acquire_game_session` | 세션·접속 | 예 | src/online/gameSession.ts:L110 | 진입점 목록화 |
| `advance_online_exploration` | 전투·원정 | 예 | src/online/economy.ts:L381 | 진입점 목록화 |
| `advance_resource_stronghold_state` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L54 | 진입점 목록화 |
| `allocate_hunting_stats` | 전투·원정 | 예 | src/online/hunting.ts:L25 | 진입점 목록화 |
| `apply_friend_invite_code` | 성장·보상·소셜 | 예 | src/online/friendInvites.ts:L21 | 진입점 목록화 |
| `apply_occupation_duel_action` | 점령·대전 | 예 | src/online/occupation.ts:L154 | 진입점 목록화 |
| `apply_online_basic_attack` | 전투·원정 | 예 | src/online/economy.ts:L145 | 진입점 목록화 |
| `apply_online_flee` | 전투·원정 | 예 | src/online/economy.ts:L154 | 진입점 목록화 |
| `apply_online_job_skill` | 전투·원정 | 예 | src/online/economy.ts:L151 | 진입점 목록화 |
| `apply_online_potion` | 전투·원정 | 예 | src/online/economy.ts:L157 | 진입점 목록화 |
| `apply_resource_stronghold_contest_action` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L63 | 진입점 목록화 |
| `attack_guild_boss` | 협회·길드 | 예 | src/online/guildBoss.ts:L52 | 진입점 목록화 |
| `attack_village_war_front` | 점령·대전 | 예 | src/online/villageWar.ts:L93 | 진입점 목록화 |
| `begin_online_combat_state` | 전투·원정 | 아니오 | 이 src에서 nothing found | 진입점 목록화 |
| `begin_online_combat_state_v2` | 전투·원정 | 예 | src/online/economy.ts:L142 | 진입점 목록화 |
| `bid_guild_auction` | 협회·길드 | 예 | src/online/guildAuction.ts:L30 | 진입점 목록화 |
| `buy_online_association_shop_item` | 협회·길드 | 예 | src/online/associationShop.ts:L21 | 진입점 목록화 |
| `buy_online_equipment_listing` | 성장·보상·소셜 | 아니오 | src/online/market.ts:L150 | 진입점 목록화 |
| `buy_premium_account` | 성장·보상·소셜 | 예 | src/components/PremiumDialog.tsx:L12 | 진입점 목록화 |
| `cancel_online_equipment_listing` | 성장·보상·소셜 | 아니오 | src/online/market.ts:L147 | 진입점 목록화 |
| `cancel_online_gold_exchange_order` | 거래·은행 | 예 | src/online/goldExchange.ts:L112 | 진입점 목록화 |
| `cancel_online_market_order` | 거래·은행 | 예 | src/online/market.ts:L133 | 진입점 목록화 |
| `claim_all_online_market_storage` | 거래·은행 | 예 | src/online/market.ts:L139 | 진입점 목록화 |
| `claim_empty_village_war_front` | 점령·대전 | 예 | src/online/villageWar.ts:L87 | 진입점 목록화 |
| `claim_guild_auction_item` | 협회·길드 | 예 | src/online/guildAuction.ts:L34 | 진입점 목록화 |
| `claim_guild_boss_reward` | 협회·길드 | 예 | src/online/guildAuction.ts:L32 | 진입점 목록화 |
| `claim_online_market_storage` | 거래·은행 | 예 | src/online/market.ts:L136 | 진입점 목록화 |
| `claim_online_resource_stronghold` | 점령·대전 | 예 | src/online/economy.ts:L383 | 진입점 목록화 |
| `claim_quest` | 성장·보상·소셜 | 예 | src/online/quests.ts:L23 | 진입점 목록화 |
| `continue_online_expedition` | 전투·원정 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `create_game_coupon` | 운영·관리 | 예 | src/online/coupons.ts:L49 | 진입점 목록화 |
| `create_online_association_v2` | 협회·길드 | 예 | src/online/association.ts:L127 | 진입점 목록화 |
| `declare_village_war` | 점령·대전 | 예 | src/online/villageWar.ts:L70 | 진입점 목록화 |
| `deposit_association_warehouse` | 협회·길드 | 아니오 | 이 src에서 nothing found | 진입점 목록화 |
| `disband_online_association` | 협회·길드 | 예 | src/online/association.ts:L164 | 진입점 목록화 |
| `dismantle_online_equipment` | 성장·보상·소셜 | 예 | src/online/economy.ts:L284 | 진입점 목록화 |
| `donate_occupation_tickets` | 점령·대전 | 예 | src/online/occupation.ts:L139 | 진입점 목록화 |
| `donate_to_association` | 협회·길드 | 예 | src/online/associationProgression.ts:L28 | 진입점 목록화 |
| `enhance_catalog_skill` | 성장·보상·소셜 | 예 | src/online/skillBooks.ts:L9 | 진입점 목록화 |
| `enhance_online_equipment` | 성장·보상·소셜 | 아니오 | src/online/economy.ts:L293 | 진입점 목록화 |
| `exchange_job_residual_recommendation` | 성장·보상·소셜 | 예 | src/online/economy.ts:L278 | 진입점 목록화 |
| `exchange_job_residual_record` | 성장·보상·소셜 | 예 | src/online/economy.ts:L260 | 진입점 목록화 |
| `force_takeover_game_session` | 세션·접속 | 예 | src/online/gameSession.ts:L138 | 진입점 목록화 |
| `gather_village` | 생활·제작 | 예 | src/online/villageLife.ts:L26 | 진입점 목록화 |
| `get_association_progression` | 협회·길드 | 예 | src/online/associationProgression.ts:L31 | 진입점 목록화 |
| `get_association_seal_state` | 협회·길드 | 예 | src/online/seal.ts:L94 | 진입점 목록화 |
| `get_association_warehouse` | 협회·길드 | 예 | src/online/associationWarehouse.ts:L64 | 진입점 목록화 |
| `get_association_warehouse_history` | 협회·길드 | 예 | src/online/associationWarehouse.ts:L78 | 진입점 목록화 |
| `get_chat_association` | 협회·길드 | 예 | src/online/chat.ts:L115 | 진입점 목록화 |
| `get_collection_equipment_registrations` | 성장·보상·소셜 | 예 | src/online/collection.ts:L36 | 진입점 목록화 |
| `get_friend_invite_state` | 성장·보상·소셜 | 예 | src/online/friendInvites.ts:L21 | 진입점 목록화 |
| `get_game_mail` | 성장·보상·소셜 | 예 | src/online/mail.ts:L42 | 진입점 목록화 |
| `get_guild_auction_state` | 협회·길드 | 예 | src/online/guildAuction.ts:L28 | 진입점 목록화 |
| `get_guild_boss_state` | 협회·길드 | 예 | src/online/guildBoss.ts:L51 | 진입점 목록화 |
| `get_guild_materials` | 협회·길드 | 예 | src/online/guildMaterials.ts:L25 | 진입점 목록화 |
| `get_guild_rankings` | 협회·길드 | 예 | src/online/guildRankings.ts:L16 | 진입점 목록화 |
| `get_guild_territory_state` | 협회·길드 | 예 | src/online/guildTerritory.ts:L24 | 진입점 목록화 |
| `get_hunting_state` | 전투·원정 | 예 | src/online/hunting.ts:L16 | 진입점 목록화 |
| `get_job_registration_state` | 성장·보상·소셜 | 예 | src/online/economy.ts:L218 | 진입점 목록화 |
| `get_occupation_state` | 점령·대전 | 예 | src/online/occupation.ts:L136 | 진입점 목록화 |
| `get_online_association_shop` | 협회·길드 | 예 | src/online/associationShop.ts:L19 | 진입점 목록화 |
| `get_online_association_state` | 협회·길드 | 예 | src/online/association.ts:L124 | 진입점 목록화 |
| `get_online_gold_exchange_state` | 거래·은행 | 예 | src/online/goldExchange.ts:L94 | 진입점 목록화 |
| `get_online_market_state` | 거래·은행 | 예 | src/online/market.ts:L127 | 진입점 목록화 |
| `get_premium_account` | 성장·보상·소셜 | 예 | src/components/PremiumDialog.tsx:L12 | 진입점 목록화 |
| `get_premium_status` | 성장·보상·소셜 | 예 | src/components/PremiumStatus.tsx:L18; src/online/premium.ts:L15 | 진입점 목록화 |
| `get_quests` | 성장·보상·소셜 | 예 | src/online/quests.ts:L22 | 진입점 목록화 |
| `get_resource_stronghold_state` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L51 | 진입점 목록화 |
| `get_server_bank` | 거래·은행 | 예 | src/online/bank.ts:L18 | 진입점 목록화 |
| `get_skill_book_state` | 성장·보상·소셜 | 예 | src/online/skillBooks.ts:L9 | 진입점 목록화 |
| `get_system_monitoring` | 운영·관리 | 예 | src/online/monitoring.ts:L68 | 진입점 목록화 |
| `get_village_life` | 생활·제작 | 예 | src/online/villageLife.ts:L24 | 진입점 목록화 |
| `get_village_war_declarations` | 점령·대전 | 예 | src/online/villageWar.ts:L69 | 진입점 목록화 |
| `get_village_war_state` | 점령·대전 | 예 | src/online/villageWar.ts:L83 | 진입점 목록화 |
| `get_village_war_state_stage_one` | 점령·대전 | 아니오 | 이 src에서 nothing found | 진입점 목록화 |
| `heartbeat_game_session` | 세션·접속 | 예 | src/online/gameSession.ts:L116 | 진입점 목록화 |
| `hunt_once` | 전투·원정 | 예 | src/online/hunting.ts:L19 | 함수 분석 |
| `inspect_game_session` | 세션·접속 | 예 | src/online/gameSession.ts:L124 | 진입점 목록화 |
| `is_coupon_admin` | 운영·관리 | 예 | src/online/coupons.ts:L47 | 진입점 목록화 |
| `join_occupation_front` | 점령·대전 | 예 | src/online/occupation.ts:L149 | 진입점 목록화 |
| `join_online_association` | 협회·길드 | 예 | src/online/association.ts:L132 | 진입점 목록화 |
| `kick_online_association_member` | 협회·길드 | 예 | src/online/association.ts:L159 | 진입점 목록화 |
| `learn_catalog_skill` | 성장·보상·소셜 | 예 | src/online/skillBooks.ts:L9 | 진입점 목록화 |
| `leave_online_association` | 협회·길드 | 예 | src/online/association.ts:L142 | 진입점 목록화 |
| `list_game_coupons` | 운영·관리 | 예 | src/online/coupons.ts:L48 | 진입점 목록화 |
| `list_online_equipment` | 성장·보상·소셜 | 아니오 | src/online/market.ts:L142 | 진입점 목록화 |
| `manage_game_mail` | 성장·보상·소셜 | 예 | src/online/mail.ts:L43 | 진입점 목록화 |
| `ops_audit` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_coupon_analytics` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_create_coupon` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_economy_flows` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_grant_history` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_grant_reward` | 운영·관리 | 예 | 이 src에서 nothing found | 함수 분석 |
| `ops_item_prices` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_market_orders` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_overview` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_player_detail` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_player_flows` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_players` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_save_trade_review` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_set_coupon_enabled` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_trade_review` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `ops_trade_review_case` | 운영·관리 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `place_occupation_bid` | 점령·대전 | 예 | src/online/occupation.ts:L144 | 진입점 목록화 |
| `place_online_gold_exchange_order` | 거래·은행 | 예 | src/online/goldExchange.ts:L100 | 진입점 목록화 |
| `place_online_market_order` | 거래·은행 | 예 | 이 src에서 nothing found | 진입점 목록화 |
| `place_online_market_order_v2` | 거래·은행 | 예 | src/online/marketOrderRequests.ts:L20 | 진입점 목록화 |
| `place_village_war_defender` | 점령·대전 | 예 | src/online/villageWar.ts:L85 | 진입점 목록화 |
| `recover_guild_auction_item` | 협회·길드 | 예 | src/online/guildAuction.ts:L39 | 진입점 목록화 |
| `recover_guild_material_auction` | 협회·길드 | 예 | src/online/guildMaterials.ts:L34 | 진입점 목록화 |
| `redeem_game_coupon` | 성장·보상·소셜 | 예 | src/online/coupons.ts:L46 | 진입점 목록화 |
| `register_collection_equipment` | 성장·보상·소셜 | 예 | src/online/collection.ts:L39 | 진입점 목록화 |
| `register_guild_auction_item` | 협회·길드 | 예 | src/online/guildAuction.ts:L37 | 진입점 목록화 |
| `register_guild_material_auction` | 협회·길드 | 예 | src/online/guildMaterials.ts:L31 | 진입점 목록화 |
| `register_online_job` | 성장·보상·소셜 | 예 | src/online/economy.ts:L235 | 진입점 목록화 |
| `register_online_job_with_tickets` | 성장·보상·소셜 | 예 | src/online/associationShop.ts:L23 | 진입점 목록화 |
| `release_game_session` | 세션·접속 | 예 | src/online/gameSession.ts:L144 | 진입점 목록화 |
| `relist_guild_boss_auction_item` | 협회·길드 | 예 | src/online/guildAuction.ts:L41 | 진입점 목록화 |
| `remove_village_war_defender` | 점령·대전 | 예 | src/online/villageWar.ts:L86 | 진입점 목록화 |
| `request_game_session_takeover` | 세션·접속 | 예 | src/online/gameSession.ts:L132 | 진입점 목록화 |
| `request_resource_stronghold` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L57 | 진입점 목록화 |
| `reset_association_seal` | 협회·길드 | 예 | src/online/seal.ts:L112 | 진입점 목록화 |
| `reset_hunting_stats` | 전투·원정 | 예 | src/online/hunting.ts:L26 | 진입점 목록화 |
| `resolve_online_exploration_event` | 전투·원정 | 예 | src/online/economy.ts:L382 | 진입점 목록화 |
| `resolve_online_revival` | 전투·원정 | 예 | src/online/economy.ts:L161 | 진입점 목록화 |
| `respond_resource_stronghold_contest` | 점령·대전 | 예 | src/online/resourceStronghold.ts:L60 | 진입점 목록화 |
| `restore_online_expedition` | 전투·원정 | 예 | src/online/economy.ts:L388 | 진입점 목록화 |
| `review_online_association_application` | 협회·길드 | 예 | src/online/association.ts:L137 | 진입점 목록화 |
| `roll_association_seal` | 협회·길드 | 예 | src/online/seal.ts:L101 | 진입점 목록화 |
| `save_game_state` | 저장 | 예 | src/online/cloudSave.ts:L78 | 함수 분석 |
| `save_hunting_preset` | 전투·원정 | 예 | src/online/hunting.ts:L17 | 진입점 목록화 |
| `save_hunting_setup` | 전투·원정 | 예 | src/online/hunting.ts:L28 | 진입점 목록화 |
| `save_hunting_skill_sets` | 전투·원정 | 예 | src/online/hunting.ts:L30 | 진입점 목록화 |
| `select_online_job` | 성장·보상·소셜 | 예 | src/online/economy.ts:L170 | 진입점 목록화 |
| `send_game_notice` | 운영·관리 | 아니오 | 이 src에서 nothing found | 진입점 목록화 |
| `server_bank_action` | 거래·은행 | 예 | src/online/bank.ts:L18 | 함수 분석 |
| `set_game_coupon_enabled` | 운영·관리 | 예 | src/online/coupons.ts:L50 | 진입점 목록화 |
| `set_guild_village_tax` | 협회·길드 | 예 | src/online/guildMaterials.ts:L27 | 진입점 목록화 |
| `set_job_registration_pickups` | 성장·보상·소셜 | 예 | src/online/economy.ts:L225 | 진입점 목록화 |
| `set_websocket_presence` | 세션·접속 | 예 | src/online/monitoring.ts:L61 | 진입점 목록화 |
| `settle_online_expedition_v2` | 전투·원정 | 예 | src/online/economy.ts:L165 | 진입점 목록화 |
| `settle_online_resource_stronghold` | 점령·대전 | 예 | src/online/economy.ts:L384 | 진입점 목록화 |
| `spend_online_association_fee` | 협회·길드 | 예 | src/online/economy.ts:L301 | 진입점 목록화 |
| `start_online_expedition` | 전투·원정 | 예 | src/online/economy.ts:L136 | 진입점 목록화 |
| `transfer_association_treasury` | 협회·길드 | 예 | src/online/associationWarehouse.ts:L73 | 진입점 목록화 |
| `transfer_guild_material` | 협회·길드 | 예 | src/online/guildMaterials.ts:L29 | 진입점 목록화 |
| `transfer_online_association_leadership` | 협회·길드 | 예 | src/online/association.ts:L154 | 진입점 목록화 |
| `travel_village` | 생활·제작 | 예 | src/online/villageLife.ts:L25 | 진입점 목록화 |
| `update_online_association` | 협회·길드 | 예 | src/online/association.ts:L145 | 진입점 목록화 |
| `use_vitality_potion` | 생활·제작 | 예 | src/online/villageLife.ts:L27 | 진입점 목록화 |
| `village_life_action` | 생활·제작 | 예 | src/online/villageLife.ts:L27 | 진입점 목록화 |
