# Tower Chronicles Agent Instructions

## Job character assets
When a user supplies one or more job character images, read and follow `.agents/skills/importing-tower-job-assets/SKILL.md`.

A pure job-image addition is a fast-path asset/data change. It must not trigger a release-version bump, README release note, save-schema change, bespoke per-job test, or repeated edits across battle/inventory/hub/job UI. Batch multiple supplied images into one commit when possible.

For this workflow, **registration includes the GitHub commit**. If the user has already identified the job, proceed without asking for another confirmation. Do not report an asset as registered, applied, or complete until the asset file and registry update are committed and a commit SHA exists. When CI or GitHub Pages is available, check and report its actual status after the commit.
