---
name: importing-tower-job-assets
description: Use when a user provides one or more Tower Chronicles job character images to add, replace, or connect to job IDs in the GitHub game repository.
---

# Importing Tower Job Assets

## Overview
Treat a normal job-image import as an asset/data operation, not a UI feature. The existing job-art pipeline already feeds battle, inventory, hub, job list, and registration results.

A job-image import is **not complete until the repository commit exists**. Preparing or describing the change is not enough.

## Fast path
1. Verify the job ID in `JOB_CATALOG`.
2. Use the supplied image; do not regenerate or restyle it.
3. Export it as an exactly 1024×1024 transparent WebP and store it at `public/assets/characters/jobs/<job_id>.webp`.
4. Add or update exactly one entry in `src/game/jobs/visualAssets.ts`.
5. If the user already identified the job, do not ask for confirmation; proceed immediately.
6. Batch multiple supplied jobs into one registry edit and commit when possible.
7. Run the focused local checks below once, then commit all supplied assets and registry changes together. Let GitHub CI run the full suite and build.
8. Confirm the remote commit and files, check CI/Pages once, and report the commit SHA immediately. Do not wait or poll for CI/Pages completion for a pure asset import. Report queued/running workflows as in progress.

## Definition of done
Only say **registered**, **applied**, or **complete** when all required repository changes are committed.

Required:
- `public/assets/characters/jobs/<job_id>.webp` exists in the committed tree.
- `src/game/jobs/visualAssets.ts` points the job ID to the canonical asset path.
- A GitHub commit containing the change exists.
- The commit SHA is reported to the user.

When CI or GitHub Pages workflows are available, also check them and report their status. Do not claim they succeeded until they actually complete successfully.

If a write/commit action is unavailable or fails, explicitly report that the import is **not committed**. Never describe a locally prepared file or proposed patch as registered.

## Commit policy
For a single new job asset, use:
`feat: add <job_id> character asset`

For multiple supplied job assets committed together, use:
`feat: add job character assets`

For a replacement that keeps the same job ID and path, use:
`chore: replace <job_id> character asset`

Pure asset additions should normally be committed directly to the active target branch used by the current Tower Chronicles workflow unless the user explicitly requests a separate branch or pull request.

## Pure addition contract
For a job whose UI pipeline already exists, the intended diff is only:
- `public/assets/characters/jobs/<job_id>.webp`
- `src/game/jobs/visualAssets.ts`

Do not bump `APP_VERSION`, `package.json`, `package-lock.json`, README release notes, save schema, or per-job tests for a pure asset addition. Do not edit BattleScene, JobsScreen, InventoryScreen, CoreScreens, graphics helpers, or CSS unless the generic pipeline itself is broken.

Replacing an existing job image normally changes only the binary asset contents; the registry does not need editing when the filename stays the same.

## Image rules
Keep the established Tower Chronicles job-asset contract: one full-body character, right-facing, exactly 1024×1024 square canvas, real transparent alpha, no scene/UI/text/frame, crisp pixel edges, muted dark-fantasy palette, and readable mobile silhouette. Preserve the user's supplied design.

Use the highest-quality approved source and preserve its detail. Keep the final canvas at 1024×1024; never reduce it to the old compact 128/256-pixel sizes. Merely enlarging a low-resolution thumbnail does not restore detail: retrieve the approved original when available. Preserve aspect ratio, full-body framing, and the existing character occupancy; fit and center the character with transparent padding without stretching or clipping. Use high-quality WebP encoding (quality 95 or lossless) without trading away visible detail for a small byte count.

Verify alpha after encoding: a black, white, or checkerboard background is not transparency. Decode the final file completely, confirm width and height are both 1024, and confirm alpha contains transparent and visible pixels. Encode into a temporary file or memory buffer and atomically replace the target to avoid incomplete files.

For replacements, verify the shared job-asset revision URL changes from the previous deployed version. If it does not, update the generic job revision in `src/game/data/graphics.ts` and include the existing cache revision test; do not rely on a query parameter on the page URL alone.

## Verification
For a pure import or replacement into the existing pipeline:
1. Resolve all supplied job names in one catalog read, convert the images in one batch, and update the registry once. Reuse existing repository access, tooling, and image conversion settings.
2. Inspect each converted image for preservation of the supplied design, correct orientation, readable framing, and transparency. If an upload lacks transparency, resolve its background deliberately; do not assume a WebP conversion removes it.
3. Run `git diff --check` and the existing focused asset tests once:
   ```bash
   node --import ./tests/register.mjs --test tests/jobVisualAsset*.test.ts tests/assetCacheRevision.test.ts
   ```
4. If image decoding, dimensions, alpha, focused tests, and diff checks pass and the diff contains only the supplied assets, registry changes, and any required cache revision, commit immediately. Full local `npm test`, typecheck, and build are not required for this path; GitHub CI owns those checks. If CI is unavailable, run the full local build once before committing and report CI/Pages as unavailable.
5. If focused tests fail, fix the asset or mapping and rerun the affected checks. If generic rendering code, catalog definitions, dependencies, or unrelated behavior must change, leave this fast path and run checks appropriate to that broader change.

The generic job visual test checks every registry entry, canonical path, asset existence/size, catalog exposure, and player graphic resolution. A new job must not require a new test case.

After committing:
1. Confirm the asset exists at the canonical repository path.
2. Confirm the registry contains the new job ID.
3. Confirm the commit SHA is on the intended branch.
4. Query CI and GitHub Pages once for that commit SHA. Report the observed status. A queued or running workflow does not block the committed-registration report. Only say deployed when Pages succeeded for that SHA. If the user explicitly asks to finish deployment or investigate a failed workflow, continue until that separate goal is resolved.

## Completion response
Keep the completion report short and factual:
- job name and job ID
- asset path
- commit SHA
- CI status
- Pages status

For pending workflows, use the equivalent of: `커밋 완료 · <SHA> / CI: 진행 중 / 배포: 진행 중`. Keep committed registration and successful deployment distinct.

## Common mistakes
| Mistake | Fix |
|---|---|
| Saying an image is registered before committing it | Do not report completion until a GitHub commit exists |
| Stopping after local WebP conversion | Continue through registry update and commit |
| Editing many UI files for every image | Use the existing visualAssetKey pipeline |
| Bumping the release version per image | Keep the current version for pure asset imports |
| Adding a bespoke test for each job | Let the registry-driven generic test cover it |
| Processing images one commit at a time when several are already supplied | Batch the supplied set |
| Shrinking the canvas or enlarging a thumbnail instead of using the original | Use the approved high-resolution source and export 1024×1024 transparent WebP |
| Treating a solid background as transparency | Decode and verify actual alpha before committing |
| Rebuilding supplied art | Preserve it; only optimize format/alpha/size when needed |
