# Tower Chronicles Agent Instructions

## Game UI and HUD
When a user asks to change gameplay UI, HUD, overlays, persistent buttons, mobile sheets, menus, or reports that an interface element is obstructing play, read and follow `.agents/skills/tower-game-ui/SKILL.md` before editing.

Use `docs/game-feel/README.md` as the local interaction authority. Preserve gameplay/server/save behavior when the request is visual or interaction-only, keep secondary persistent controls off the critical play field, respect normal/immersive shell edges and safe areas, and add a focused regression test before the implementation change.

## Job character assets
When a user supplies one or more job character images, read and follow `.agents/skills/importing-tower-job-assets/SKILL.md`.

A pure job-image addition is a fast-path asset/data change. It must not trigger a release-version bump, README release note, save-schema change, bespoke per-job test, or repeated edits across battle/inventory/hub/job UI. Batch multiple supplied images into one commit when possible.

For this workflow, **registration includes the GitHub commit**. If the user has already identified the job, proceed without asking for another confirmation. Do not report an asset as registered, applied, or complete until the asset file and registry update are committed and a commit SHA exists. When CI or GitHub Pages is available, check and report its actual status after the commit.

For pure job-image imports and replacements, run the focused asset tests and diff checks described in the skill once; let GitHub CI run the full test suite and build. After verifying the remote commit, check CI/Pages once and report pending workflows as in progress without waiting. If the user explicitly requests completed deployment, continue checking until deployment is resolved.

## Skill art generation
When a user asks to create, generate, make, design, redraw, or standardize Tower Chronicles active-skill artwork, read and follow `.agents/skills/generating-tower-skill-art/SKILL.md` before generating the image.

Use the generation skill to establish the shared game style and the job-specific Visual Lock before varying each skill's motif. When generated artwork is approved and needs to be applied or registered in the game, hand it off to `.agents/skills/importing-tower-skill-assets/SKILL.md`.

## Skill image assets
When a user supplies, replaces, registers, or applies one or more active-skill images for combat buttons or job skill displays, read and follow `.agents/skills/importing-tower-skill-assets/SKILL.md`.

Keep pure skill-image work presentation-only: preserve the existing skill ID, combat behavior, balance values, cooldown/resource rules, save data, and server authority. Use the generic skill-image registry and retain the Glyph fallback instead of adding per-skill BattleScreen conditionals. Batch multiple supplied skill images when possible, and do not report them as registered until the asset mapping is committed and a commit SHA exists.
## Game balance / character growth / hunting economy
When asked to design, simulate or tune Tower Chronicles leveling, stat allocation, equipment power, hunting-monster stats, battle strategies, potion economy, XP/silver, vitality or drop probabilities, read and follow '.agents/skills/tower-balance/SKILL.md'. The skill's reproducible baseline, live-server cross-check and safeguards are mandatory. Analysis does not authorize production numerical changes.

## Appearance skin assets
For user-supplied named appearance artwork or an appearance name + grade, read and follow `.agents/skills/tower-skin-manager/SKILL.md`. Treat a replacement as the same existing appearance ID; do not touch player ownership or balance values. A user request to apply the skin includes committing the binary artwork and catalog to main, verifying GitHub CI and GitHub Pages deployment for the exact commit, and checking the in-game rendering paths. Do not stop at preparing or linking a local image. Equipped non-default cosmetic art takes precedence over the job-specific portrait, while the default cosmetic keeps job art.


## Supabase Data API exposure (October 30, 2026)
Supabase stops automatically granting API roles access to newly created `public` tables on 2026-10-30 (including database resets, new projects, and preview environments). Whenever creating or replacing a `public` table in `supabase/migrations/`:

1. In the **same migration**, enable RLS and establish policies that check row ownership/authorization.
2. Make the exposure decision explicit with **least-privilege GRANT statements**. Do not rely on default privileges. Prefer column-scoped privileges where appropriate (e.g. immutable profiles and chat messages). Give `anon` no table access unless the feature truly requires anonymous access; give `authenticated` only the necessary operations or columns. Grant `service_role` only permissions required by trusted server-side code.
3. If a `public` table is intentionally not API-accessible, explicitly `REVOKE ALL` from `PUBLIC`, `anon`, and `authenticated`, document its internal-only purpose, and avoid client-side REST access.
4. Grant sequence USAGE/SELECT only when needed for identity/serial inserts. New RPC functions also require explicit EXECUTE restrictions; never expose `SECURITY DEFINER` functions broadly.
5. Verify the migration under the intended API role (including a fresh schema/reset path) and check the Supabase Security Advisor. Never use broad `GRANT ALL ON ALL TABLES` or blanket grants to bypass a 42501 error.

**Do not retroactively widen existing table permissions.** In this game, `public.game_player_profiles` and `public.game_chat_messages` deliberately use column-level grants, and `public.game_save_versions` deliberately has no client-readable RLS policy. The `private` schema remains distinct from the `public` Data API exposure change. See `docs/supabase-data-api-grants-2026.md` for the verified project access matrix and safe examples.
