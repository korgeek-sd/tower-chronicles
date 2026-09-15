$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$node='D:\files-pasted-by-the-user-rpg\work\node-v22.14.0-win-x64\node.exe'
& $node node_modules/typescript/bin/tsc --noEmit
if($LASTEXITCODE -ne 0){throw 'TypeScript failed'}
& $node node_modules/vite/bin/vite.js build
if($LASTEXITCODE -ne 0){throw 'Build failed'}
& $node scripts/standalone.mjs
if($LASTEXITCODE -ne 0){throw 'Standalone failed'}
