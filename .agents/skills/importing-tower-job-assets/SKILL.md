---
name: importing-tower-job-assets
description: Use when a user provides one or more Tower Chronicles job character images to add, replace, or connect to job IDs in the GitHub game repository.
---

# Importing Tower Job Assets

## Overview
Treat a normal job-image import as an asset/data operation, not a UI feature. The existing job-art pipeline already feeds battle, inventory, hub, job list, and registration results.

## Fast path
1. Verify the job ID in `JOB_CATALOG`.
2. Use the supplied image; do not regenerate or restyle it.
3. Store the optimized transparent WebP at `public/assets/characters/jobs/<job_id>.webp`.
4. Add or update exactly one entry in `src/game/jobs/visualAssets.ts`.
5. Batch multiple supplied jobs into one commit when possible.
6. Run the normal test/build/deploy checks and report completion only after CI/Pages finish.

## Pure addition contract
For a job whose UI pipeline already exists, the intended diff is only:
- `public/assets/characters/jobs/<job_id>.webp`
- `src/game/jobs/visualAssets.ts`

Do not bump `APP_VERSION`, `package.json`, `package-lock.json`, README release notes, save schema, or per-job tests for a pure asset addition. Do not edit BattleScene, JobsScreen, InventoryScreen, CoreScreens, graphics helpers, or CSS unless the generic pipeline itself is broken.

Replacing an existing job image normally changes only the binary asset contents; the registry does not need editing when the filename stays the same.

## Image rules
Keep the established Tower Chronicles job-asset contract: one full-body character, right-facing, square canvas, transparent alpha, no scene/UI/text/frame, crisp pixel edges, muted dark-fantasy palette, and readable mobile silhouette. Preserve the user's supplied design.

## Verification
The generic job visual test checks every registry entry, canonical path, asset existence/size, catalog exposure, and player graphic resolution. A new job must not require a new test case.

## Common mistakes
| Mistake | Fix |
|---|---|
| Editing many UI files for every image | Use the existing visualAssetKey pipeline |
| Bumping the release version per image | Keep the current version for pure asset imports |
| Adding a bespoke test for each job | Let the registry-driven generic test cover it |
| Processing images one commit at a time | Batch images already supplied together |
| Rebuilding supplied art | Preserve it; only optimize format/alpha/size when needed |
