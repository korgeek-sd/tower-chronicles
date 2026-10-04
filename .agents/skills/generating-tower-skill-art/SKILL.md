---
name: generating-tower-skill-art
description: Use when a user asks to create, generate, make, design, redraw, or standardize Tower Chronicles active-skill icon artwork before it is imported or registered.
---

# Generating Tower Skill Art

## Overview
Use a three-layer visual system for every skill icon: **Global Style Lock → Job Visual Lock → Skill Motif**. Generation defines the artwork only; gameplay values, skill IDs, registration, and deployment belong elsewhere.

## Global Style Lock
- Use Tower Chronicles **muted dark-fantasy pixel art** with crisp pixel edges. Avoid painterly, glossy 3D, or anime rendering.
- Use a transparent square canvas. Keep the main silhouette around **70–80%** of the canvas with clear edge breathing room.
- Base palette: low-saturation iron, taupe, brown, cream, aged brass, and restrained reddish-brown. Strong color is a semantic accent, not the base.
- Build around **one dominant object/symbol/action** and at most one supporting effect.
- Prefer weapons, hands, sigils, tools, marks, or effects over a full character.
- Attacks normally flow rightward or upper-right; defense, healing, and buffs usually use centered compositions.
- The icon must remain distinguishable at roughly **25–42px**.
- Do not bake text, skill names, cooldown values, resource values, rarity, a UI frame, button border, or runtime state into the art.

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
2. Define or reuse the job's Visual Lock.
3. Assign one unique Skill Motif to each skill: primary object, action direction, supporting effect, and intensity.
4. Generate all three from the same prompt skeleton and Visual Lock; change only the skill-specific motif/action/intensity.
5. Compare the three together. Reject an icon that looks like a different game or is too similar to a sibling icon.
6. Check readability at 25–42px and simplify before adding detail.
7. When the artwork is approved for game use, hand it to `importing-tower-skill-assets`.

## Handoff to Import
The generation skill does not register files. The established `importing-tower-skill-assets` workflow exports the approved art as **128×128 transparent WebP**, stores it under the canonical skill path, maps the existing `skill.id` in `skillVisualAssets.ts`, verifies the Glyph fallback contract, and commits the result.

## Common Mistakes
- Three skills from one job use unrelated palettes/materials → strengthen the Job Visual Lock.
- Three icons are nearly identical → change silhouette and Skill Motif, not the shared visual language.
- Tiny decorative detail disappears at combat size → simplify around the dominant symbol.
- Resource/cooldown text is painted into the art → remove it; runtime UI owns state.
- Full character overwhelms the icon → return to a weapon, hand, sigil, tool, mark, or effect.
