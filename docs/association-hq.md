# Association HQ update

The online registry defaults to a searchable recruitment list with an available-only filter. Selecting a company reveals its description, revenue-share rate and join action. Creation is a separate view. Pending applications remain visible.

The headquarters prioritizes notice, compact treasury/revenue information, an occupation entry with server phase/owned towers and a company chat shortcut. Members use registered nicknames. Management actions are revealed per selected member. Ordinary members find leave under their membership menu. Existing authorization, economic and occupation rules are unchanged.

The existing chat panel switches between world and association channels using one active socket. Each channel loads its newest 50 records. Association chat is checked against current membership and active association state by database RLS and the INSERT trigger. Removing membership or disbanding blocks further reads and writes; an open panel refreshes membership every 30 seconds. Existing cooldown, idempotency and retention apply to both channels. Client-supplied channel IDs do not grant access.

References: OpenAI game-ui-frontend, fcsouza design-ui-ux-game, dreamteam-hq gamedev-mmo-persistence. Adapted mobile hierarchy, progressive disclosure and guild access patterns to the existing React/Supabase project.

Verification: full existing tests, chat channel API tests, transactional association_chat.sql with all fixture changes rolled back. Live guest registry checked after deployment; authenticated multi-account UI remains a manual QA scenario.
