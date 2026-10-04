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
The generic skill-art pipeline is already established.
- Registry: `src/game/jobs/skillVisualAssets.ts`, keyed by the existing `skill.id`.
- Resolver: `skillVisualAssetFor(skill.id)` returns the registered asset path or `null`.
- Renderer: `src/components/battle/BattleScreen.tsx` resolves the path and renders it inside the existing `tc-ref-card-art` area as `tc-skill-art`.
- Rendering uses `assetUrl(...)`, `object-fit: contain`, and pixelated image rendering without changing the five-card layout.
- Missing mapping: the current **Glyph fallback** remains visible, so an incomplete asset set never breaks combat controls.

A normal skill-image import must use this pipeline. Do not add per-skill conditions to `BattleScreen`, and do not edit the renderer again just to register another icon. **REQUIRED SUB-SKILL:** use `tower-game-ui` only when changing the generic combat-button presentation itself rather than importing art.

## Import Workflow
1. Resolve all supplied job names and exact skill IDs in one pass.
2. Preserve user-supplied art; do not regenerate or restyle it unless the user explicitly asks. For newly generated art, follow the Canonical Contract.
3. Crop/scale deliberately, preserve transparency, export 128×128 transparent WebP, and inspect readability at mobile size.
4. Store each file at the canonical path and add/update exactly one `SKILL_VISUAL_ASSETS` mapping per skill.
5. Batch multiple supplied icons in one registry edit and one commit when possible.
6. For a pure asset change, do not edit `BattleScreen`, gameplay definitions, cooldown/resource values, balance data, save schema, release version, or unrelated UI.
7. Run the focused `skillVisualAsset*.test.ts` checks when available plus the repository diff check; let CI own the full suite/build.
8. Commit the asset and mapping. Registration is not complete until a GitHub commit exists.

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
