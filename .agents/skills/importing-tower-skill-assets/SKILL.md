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
- Use the enlarged mercenary icons approved on 2026-10-05 as the default size: trim outer transparent padding, proportionally scale the visible alpha bounding box to a **120px longest dimension**, and center it on the 128×128 canvas with **at least 4px edge clearance**. Keep shorter dimensions proportional and preserve internal negative space. Do not stretch or clip the art, and do not reintroduce 12–16px padding.
- Use one dominant symbol/action and at most one supporting effect. It must remain recognizable at roughly 25–42px in the five-card combat row.
- No baked-in text, skill name, cooldown, resource number, UI frame, rarity badge, or button border.
- Use the established Tower Chronicles muted dark-fantasy pixel-art direction: crisp edges, restrained detail, low-saturation iron/taupe/brown/cream tones, and limited semantic accents such as blood red or healing light.
- Direction is not mandatory; when the action has a clear travel direction, prefer rightward or upper-right motion.

## Existing Pipeline
The generic skill-art pipeline is already established.
- Registry: `src/game/jobs/skillVisualAssets.ts`, keyed by the existing `skill.id`.
- Resolver: `skillVisualAssetFor(skill.id)` returns the registered asset path or `null`.
- Renderer: `src/components/battle/BattleScreen.tsx` resolves the path and renders it inside the existing `tc-ref-card-art` area as `tc-skill-art`.
- Rendering uses `assetUrl(...)`, `object-fit: contain`, and pixelated image rendering without changing the five-card layout.
- Missing mapping: the current **Glyph fallback** remains visible, so an incomplete asset set never breaks combat controls.

A normal skill-image import must use this pipeline. Do not re-edit `BattleScreen` for a normal skill-image import; use the registry instead. Do not add per-skill conditions to the renderer. **REQUIRED SUB-SKILL:** use `tower-game-ui` only when changing the generic combat-button presentation itself rather than importing art, and add or update a focused regression test for that generic UI behavior.

## Import Workflow
1. Resolve all supplied job names and exact skill IDs in one pass.
2. Preserve user-supplied art; do not regenerate or restyle it unless the user explicitly asks. For newly generated art, follow the Canonical Contract.
3. Crop to the alpha bounding box, then resize proportionally (including upscaling when needed) to a 120px longest dimension using nearest-neighbor. Center on a transparent 128×128 canvas and export lossless WebP. Verify at least 4px edge clearance, preserved transparency, an unclipped silhouette, and readability at mobile size; compare apparent size across the set.
4. Store each file at the canonical path and add/update exactly one `SKILL_VISUAL_ASSETS` mapping per skill.
5. Batch multiple supplied icons in one registry edit and one commit when possible.
6. For a pure asset change, do not edit `BattleScreen`, gameplay definitions, cooldown/resource values, balance data, save schema, release version, or unrelated UI.
7. Run the focused `skillVisualAsset*.test.ts` checks when available plus the repository diff check; then run the full verification commands below before completion.
8. Commit the asset and mapping. Registration is not complete until a GitHub commit exists.

## Verification
Run all of these before claiming the import or pipeline change is complete:
1. `npm test`
2. `npm run typecheck`
3. `npm run build`

For a pipeline change, also confirm an unregistered skill still renders the existing Glyph fallback and that cooldown/resource overlays remain owned by the runtime UI.

## Pure Addition Contract
For an existing skill whose generic pipeline is already available, the intended diff is only:
- `public/assets/ui/skills/<job_id>/<skill_id>.webp`
- `src/game/jobs/skillVisualAssets.ts`

Replacing an icon at the same canonical path normally changes only the binary asset. Do not bump the release version or add a bespoke test per icon.

## Completion Contract
Report the job, skill name + `skill.id`, asset path, and **commit SHA**. Check CI/Pages once and report their observed status; do not claim deployment succeeded while it is queued or running.

## Common Mistakes
- High-resolution source committed unchanged → optimize to the 128×128 WebP contract.
- Icon contains cooldown/resource text → remove it; runtime UI owns state labels.
- Per-skill `BattleScreen` conditionals → use `SKILL_VISUAL_ASSETS` and `skillVisualAssetFor`.
- Missing icon breaks the button → preserve Glyph fallback.
- Visual request changes gameplay/balance → keep the change presentation-only.
