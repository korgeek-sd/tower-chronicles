---
name: generating-tower-skill-art
description: Use when a user asks to create, generate, make, design, redraw, or standardize Tower Chronicles active-skill icon artwork before it is imported or registered.
---

# Generating Tower Skill Art

## Overview
Use a three-layer visual system for every skill icon: **Global Style Lock → Job Visual Lock → Skill Motif**. Generation defines the artwork only; gameplay values, skill IDs, registration, and deployment belong elsewhere.

## Global Style Lock
- Use Tower Chronicles **muted dark-fantasy pixel art** with crisp pixel edges. Avoid painterly, glossy 3D, or anime rendering.
- Use a transparent square canvas. Keep the main silhouette around **90–94%** of the canvas with clear edge breathing room.
- Base palette: low-saturation iron, taupe, brown, cream, aged brass, and restrained reddish-brown. Permit dominant semantic effect colors as specified in the Reference Style Lock.
- Build around **one dominant object/symbol/action** and at most one supporting effect.
- Prefer weapons, hands, sigils, tools, marks, or effects over a full character.
- Attacks normally flow rightward or upper-right. Center defense, healing, and buffs when useful, but preserve action and motion; do not default to a static frontal badge.
- The icon must remain distinguishable at roughly **25–42px**.
- Do not bake text, skill names, cooldown values, resource values, rarity, a UI frame, button border, or runtime state into the art.

## Reference Style Lock (user examples, 2026-10-04)
Use the five user-supplied external-game skill images as the default visual direction for future skill art. Transfer their visual grammar into original Tower Chronicles motifs:
- Use **coarse, chunky pixel clusters**, stepped contours, broad flat color masses, and very little interior detail. Keep pixel density consistent across icons.
- Depict the **skill action/effect itself**: a thick crescent slash, a sweeping weapon stroke, a compact flame group, or a central burst with a few detached fragments. Let tools or weapons support the action when needed.
- Prefer a single bold directional silhouette with visible negative space. Use a curved sweep for slashes, upward tongues for flames, and a centered mass with sparse outward shards for bursts.
- Use roughly **3–6 principal colors** with 2–3 clear value levels: dark mass, middle tone, bright core/edge. Prefer cream, bone, gray-violet, muted ochre, and rust for the shared base.
- Allow a dominant semantic color when the skill calls for it: blood/crimson can carry a red slash; fire uses rust/orange and pale yellow; cold/spirit effects can use restrained cyan. Do not force every effect into monochrome or brown.
- Keep highlights in large readable blocks. Avoid filigree, tiny runes, dense particles, realistic surface textures, fine outlines, glossy gradients, and broad bloom.
- Treat the visible blur/soft enlargement in the supplied previews as **presentation artifacts**, not a generation requirement. Produce crisp pixel edges; do not bake blur into the icon.
- Treat black surrounding space in the examples as a preview background. Generate **transparent backgrounds** and preserve dark pixels belonging to the effect; never remove black indiscriminately.
- Use the references for style, palette structure, and action readability. Design each motif from the actual Tower Chronicles skill instead of duplicating another game's exact icon.

## Approved Pixel Treatment
Use the user-approved contract mercenary Heavy Strike, Opening Thrust, and revised diagonal Raise Shield as the family benchmark.
- Require **visibly large square pixels and stair-step contours**, like a low-resolution sprite enlarged with nearest-neighbor. Match the approved icons' pixel scale; do not substitute a smooth illustration with a pixel-art label.
- Use broad flat blocks for both equipment and effects. Reject smooth curves, painterly metal textures, gradients, fine outlines, and excessive tiny details.
- Match the same pixel density, gray-violet iron, cream highlights, ochre/rust accents, edge weight, and effect thickness across a job's full set.
- Depict defensive skills as an **action frozen in motion**: for Raise Shield, tilt the shield in three-quarter view while its rim intercepts a strike; connect the deflection sweep and impact to the shield.
- Avoid an isolated frontal shield with a detached halo. A centered defensive composition must still belong to the same dynamic effect language as its attacking siblings.
- When available, include the actual approved sibling images as generation references, explicitly labeling them as style references. Do not rely only on textual color matching.

## Prompt Skeleton
Reuse this wording with the same Job Visual Lock for each job:
> Create one original Tower Chronicles active-skill effect icon for [actual skill/action]. Coarse retro dark-fantasy pixel art, visibly large square pixels like a low-resolution sprite enlarged with nearest-neighbor, chunky stepped pixel clusters, bold [crescent sweep/upward flames/central burst/skill-specific silhouette], large flat color blocks, minimal interior detail, 3–6 principal colors and 2–3 value levels, [job palette and semantic accent], [Generator/Neutral/Spender intensity], clear negative space, 90–94% canvas occupancy, readable at 25–42px, crisp pixel edges, transparent square canvas. No text, UI frame, scenery, full character, blur, smooth gradients, glossy rendering, dense particles, or intricate ornament.

## Job Visual Lock
Before generating the first icon for a job, define or reuse one **Visual Lock** for that job's three active skills. The same job must share:
- palette and accent colors;
- light direction and contrast;
- material language such as iron, leather, brass, cloth, bone, or magic;
- pixel density, edge weight, and detail level;
- effect-line shape, glow behavior, and impact language.

Keep the family resemblance strong, but make each skill's **silhouette and motif clearly different** so players can distinguish all three buttons at combat size. Reuse job identity cues; do not reuse the exact composition.

## Resource Intensity
Resource class changes visual intensity, not UI information:
- **Generator** — restrained motion/effect, clearest basic action.
- **Neutral** — medium emphasis or a secondary status/buff cue.
- **Spender** — strongest impact, contrast, trail, or burst while preserving the same Job Visual Lock.

Do not place resource cost/gain, cooldown numbers, or cooldown state in the image.

## Generation Workflow
1. Resolve the actual job, its three active skills, and each skill's Generator/Neutral/Spender role before drawing.
2. Apply the Reference Style Lock and define or reuse the job's Visual Lock.
3. Assign one unique Skill Motif to each skill: primary object, action direction, supporting effect, and intensity.
4. Generate all three from the same prompt skeleton and Visual Lock; change only the skill-specific motif/action/intensity.
5. Compare the three together. Reject an icon that looks like a different game or is too similar to a sibling icon.
6. Inspect each icon at 128px and 25–42px on dark and light backgrounds. Verify clean alpha edges, coarse pixel clusters, readable action, limited palette, distinct sibling silhouettes, and no baked blur or black background. Simplify before adding detail.
7. When the artwork is approved for game use, hand it to `importing-tower-skill-assets`.

## Final Display Size
Use the enlarged mercenary icons approved on 2026-10-05 as the default display-size benchmark. Trim outer transparent padding and proportionally resize the visible alpha bounding box so its longest dimension is **120px on a 128×128 canvas**. Center it with **at least 4px edge clearance**. Use nearest-neighbor resizing and lossless WebP; preserve the entire silhouette and internal negative space. Do not stretch, clip, or add the old 12–16px padding. Inspect all siblings at combat-button size for balanced apparent size.

## Handoff to Import
The generation skill does not register files. The established `importing-tower-skill-assets` workflow exports the approved art as **128×128 transparent WebP**, stores it under the canonical skill path, maps the existing `skill.id` in `skillVisualAssets.ts`, verifies the Glyph fallback contract, and commits the result.

## Common Mistakes
- Three skills from one job use unrelated palettes/materials → strengthen the Job Visual Lock.
- Three icons are nearly identical → change silhouette and Skill Motif, not the shared visual language.
- Tiny decorative detail disappears at combat size → simplify around the dominant symbol.
- Resource/cooldown text is painted into the art → remove it; runtime UI owns state.
- A defensive icon looks like a separate UI badge → use an angled active block/parry, integrate the impact and motion effect, and compare with approved attack siblings.
- Pixel art becomes smooth or finely textured → regenerate with explicit large square pixels, stepped contours, flat shading, and approved image references.
- Full character overwhelms the icon → return to a weapon, hand, sigil, tool, mark, or effect.
