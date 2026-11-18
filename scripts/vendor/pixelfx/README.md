Source: https://github.com/patch-gg/pixelfx at 5294518ce7c72e48b6100a744596e0acf57f2826.

Core and lightning helpers retain the upstream MIT license and notices. chest-release.js is the game-specific adaptation. No stock actor, coins, items or rings are rendered.

Regenerate all five grade palettes: `node --import ./tests/register.mjs scripts/bakeBoxLightning.mjs`. The shared palettes live in boxLightningArt.ts. Each atlas has 7 columns of 192px cells, 49 frames, 24fps, origin (96,140). Main lightning channels: 6 (previously 2); charge channels: 9 (previously 3).

Scene preview: `node --import ./tests/register.mjs scripts/renderBoxLightningPreview.mjs rare`. This offline rendering uses production atlases and timing with the Canvas-compatible opening frames; it is not a browser/WebGL recording.
