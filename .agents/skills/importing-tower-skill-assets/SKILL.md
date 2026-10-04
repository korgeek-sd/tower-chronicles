---
name: importing-tower-skill-assets
description: Use when a user creates, supplies, replaces, registers, or applies Tower Chronicles active-skill icon images for combat buttons or job skill displays.
---

# Importing Tower Skill Assets

## Overview
Treat skill art as a reusable visual asset keyed by the existing `skill.id`. A pure icon import must not change combat behavior, balance, cooldowns, resources, skill names, or save/server logic.

## Canonical Contract
- Resolve the job and exact `skill.id` from the registered combat definition before touching assets. Do not rename or replace a skill ID just to match display text.
- Final asset: **128×128 px transparent WebP**, square canvas.
- Store at `public/assets/ui/skills/<job_id>/<skill_id>.webp`.
- Keep at least **12px safe margin** on every edge; 16px is preferred when the silhouette remains readable.
- Use one dominant symbol/action and at most one supporting effect. It must remain recognizable at roughly 25–42px in the five-card combat row.
- No baked-in text, skill name, cooldown, resource number, UI frame, rarity badge, or button border.
- Use the established Tower Chronicles muted dark-fantasy pixel-art direction: crisp edges, restrained detail, low-saturation iron/taupe/brown/cream tones, and limited semantic accents such as blood red or healing light.
- Direction is not mandatory; when the action has a clear travel direction, prefer rightward or upper-right motion.

## Existing Pipeline
Skill images are presentation-only. The generic registry is `src/game/jobs/skillVisualAssets.ts`, keyed by `skill.id`. Battle UI should resolve that asset and render it inside the existing `tc-ref-card-art` area without changing the five-card layout. If an asset is absent, keep the current **Glyph fallback**.

If this generic pipeline does not exist yet, that is a one-time UI feature, not a pure asset import. **REQUIRED SUB-SKILL:** use `tower-game-ui`, add a focused regression test first, create the generic registry/resolver and fallback once, then return to this fast path. Do not patch `BattleScreen` separately for every skill.

## Import Workflow
1. Resolve all supplied job names and skill IDs in one pass.
2. Preserve user-supplied art; do not regenerate or restyle it unless the user explicitly asks. For newly generated art, follow the Canonical Contract.
3. Crop/scale deliberately, preserve transparency, export 128×128 transparent WebP, and inspect readability at mobile size.
4. Add/update the asset and one registry mapping per skill. Batch multiple supplied icons in one registry edit and one commit when possible.
5. For a pure asset change, do not edit gameplay definitions, cooldown/resource values, balance data, save schema, release version, or unrelated UI.
6. Run the focused `skillVisualAsset*.test.ts` checks when the pipeline provides them, plus the repository diff check; let CI own the full suite/build.
7. Commit the asset and mapping. Registration is not complete until a GitHub commit exists.

## Completion Contract
Report the job, skill name + `skill.id`, asset path, and **commit SHA**. Check CI/Pages once and report their observed status; do not claim deployment succeeded while it is queued or running.

## Common Mistakes
- High-resolution source committed unchanged → optimize to the 128×128 WebP contract.
- Icon contains cooldown/resource text → remove it; runtime UI owns state labels.
- Per-skill BattleScreen conditionals → use the generic registry.
- Missing icon breaks the button → preserve Glyph fallback.
- Visual request changes gameplay/balance → keep the change presentation-only.
