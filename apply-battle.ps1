$ErrorActionPreference='Stop'
$source=$PSScriptRoot
$target='D:\files-pasted-by-the-user-rpg\outputs\tower-rpg'
$backup='D:\files-pasted-by-the-user-rpg\outputs\battle-backup-v0.1.16-20260913'
$files=@('src/main.tsx','src/components/battle/BattleScreen.tsx','src/components/battle/immersive.css','src/game/engine/combat.ts','src/game/engine/turns.ts','tests/battle-turns.test.ts','package.json','package-lock.json','BATTLE-v0.1.17.md','public/assets/backgrounds/iron-t1-abandoned-mine.png','public/assets/monsters/iron-t1/goblin_miner.png','public/assets/player/default.png','play.html')
if(Test-Path -LiteralPath $backup){throw 'Backup folder already exists; refusing to overwrite'}
New-Item -ItemType Directory -Path $backup | Out-Null
foreach($file in $files){$previous=Join-Path $target $file;if(Test-Path -LiteralPath $previous){$save=Join-Path $backup $file;New-Item -ItemType Directory -Path (Split-Path $save) -Force | Out-Null;Copy-Item -LiteralPath $previous -Destination $save}}
Copy-Item -LiteralPath (Join-Path $target 'dist') -Destination (Join-Path $backup 'dist') -Recurse
Copy-Item -LiteralPath 'D:\files-pasted-by-the-user-rpg\outputs\탑의기록-플레이.html' -Destination (Join-Path $backup '탑의기록-플레이.html')
foreach($file in $files){$dest=Join-Path $target $file;New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $source $file) -Destination $dest -Force}
Copy-Item -Path (Join-Path $source 'dist\*') -Destination (Join-Path $target 'dist') -Recurse -Force
Copy-Item -Path (Join-Path $source 'public\assets\*') -Destination 'D:\files-pasted-by-the-user-rpg\outputs\assets' -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source 'play.html') -Destination 'D:\files-pasted-by-the-user-rpg\outputs\탑의기록-플레이.html' -Force
$files | ForEach-Object {if((Get-FileHash -LiteralPath (Join-Path $source $_)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $target $_)).Hash){throw "Copy mismatch: $_"}}
Write-Output 'Applied v0.1.17. Source and destination hashes verified.'
Write-Output "Backup: $backup"
