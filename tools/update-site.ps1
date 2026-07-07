param([string]$Category = '骑士特摄')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$generator = Join-Path $PSScriptRoot 'generate-wallpaper-data.ps1'
$builder = Join-Path $PSScriptRoot 'build-web-gallery.py'
$directImporter = Join-Path $PSScriptRoot 'import-direct-wallpapers.py'
$python = 'C:\Users\W-SF\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'

Set-Location $projectRoot
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $generator
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $python $builder
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $python $directImporter --category $Category
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Gallery updated. Commit and push the changes with GitHub Desktop.'
