$ErrorActionPreference='Stop'
$source=$PSScriptRoot
$target='D:\files-pasted-by-the-user-rpg\outputs\tower-rpg'
$output='D:\files-pasted-by-the-user-rpg\outputs'
$backup=Join-Path $output 'assets-backup-v0.1.17-20260913'
$files=@('src/main.tsx','src/components/RegionBackgrounds.tsx','src/components/battle/BattleScreen.tsx','src/components/battle/immersive.css','src/game/data/graphics.ts','src/game/engine/exploration.ts','package.json','package-lock.json','ASSETS-v0.1.18.md','play.html','dist/index.html')
if(Test-Path -LiteralPath $backup){throw 'Backup already exists'}
$monsterBefore=Get-ChildItem -LiteralPath (Join-Path $target 'public/assets/monsters') -Recurse -File | Get-FileHash
New-Item -ItemType Directory -Path $backup | Out-Null
foreach($file in $files){$old=Join-Path $target $file;if(Test-Path -LiteralPath $old){$save=Join-Path $backup $file;New-Item -ItemType Directory -Path (Split-Path $save) -Force | Out-Null;Copy-Item -LiteralPath $old -Destination $save};$dest=Join-Path $target $file;New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $source $file) -Destination $dest -Force}
Copy-Item -LiteralPath (Join-Path $output '탑의기록-플레이.html') -Destination (Join-Path $backup '탑의기록-플레이.html')
foreach($folder in @('backgrounds','ui/navigation')){
 $old=Join-Path $target "public/assets/$folder";if(Test-Path -LiteralPath $old){$save=Join-Path $backup "public/assets/$folder";New-Item -ItemType Directory -Path (Split-Path $save) -Force | Out-Null;Copy-Item -LiteralPath $old -Destination $save -Recurse}
 foreach($dest in @((Join-Path $target "public/assets/$folder"),(Join-Path $target "dist/assets/$folder"),(Join-Path $output "assets/$folder"))){New-Item -ItemType Directory -Path $dest -Force | Out-Null;Copy-Item -Path (Join-Path $source "public/assets/$folder/*") -Destination $dest -Recurse -Force}
}
Get-ChildItem -LiteralPath (Join-Path $source 'dist/assets') -File | Where-Object Extension -in '.js','.css' | Copy-Item -Destination (Join-Path $target 'dist/assets') -Force
Copy-Item -LiteralPath (Join-Path $source 'play.html') -Destination (Join-Path $output '탑의기록-플레이.html') -Force
foreach($file in $files){if((Get-FileHash (Join-Path $source $file)).Hash -ne (Get-FileHash (Join-Path $target $file)).Hash){throw "File mismatch $file"}}
foreach($file in $monsterBefore){if((Get-FileHash -LiteralPath $file.Path).Hash -ne $file.Hash){throw 'Monster changed'}}
Write-Output 'v0.1.18 applied. File hashes verified. Monster assets unchanged.'
