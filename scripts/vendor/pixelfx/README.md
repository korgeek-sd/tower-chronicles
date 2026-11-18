Source: https://github.com/patch-gg/pixelfx at 5294518ce7c72e48b6100a744596e0acf57f2826.

Core and lightning helpers retain the upstream MIT license and notices. chest-release.js is the game-specific adaptation. No stock actor, coins, items or rings are rendered.

Regenerate: `node scripts/vendor/pixelfx/tools/render.mjs lightning/chest-release --sheet` then copy records/lightning/chest-release/chest-release.png to public/assets/ui/shop/box_lightning_pixelfx_v4.png. The atlas is 7 columns of 192px cells, 49 frames, 24fps, origin (96,140).

Scene preview: `node --import ./tests/register.mjs scripts/renderBoxLightningPreview.mjs`. This offline rendering uses production atlases and timing with the Canvas-compatible opening frames; it is not a browser/WebGL recording.
