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