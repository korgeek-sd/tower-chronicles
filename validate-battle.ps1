$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$node='D:\files-pasted-by-the-user-rpg\work\node-v22.14.0-win-x64\node.exe'
& $node node_modules/typescript/bin/tsc --noEmit
if($LASTEXITCODE -ne 0){throw 'TypeScript failed'}
& $node --import ./tests/register.mjs --test tests/*.test.ts > validation-tests.txt 2>&1
Get-Content validation-tests.txt | Select-String -Pattern '^not ok','^  error:','^    13 !==','^# (tests|pass|fail)'
& $node node_modules/vite/bin/vite.js build
if($LASTEXITCODE -ne 0){throw 'Build failed'}
& $node scripts/standalone.mjs
if($LASTEXITCODE -ne 0){throw 'Standalone failed'}
