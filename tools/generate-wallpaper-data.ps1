# 扫描上级 AI-海报素材目录，生成网页可直接读取的完整壁纸清单。
# 后续向素材文件夹加入图片后，重新运行本脚本即可同步到网页。

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Split-Path $projectRoot -Parent
$outputPath = Join-Path $projectRoot 'assets\js\wallpapers-data.js'
$projectPrefix = $projectRoot.TrimEnd('\') + '\'

function Get-Categories([string]$folder) {
  # 每个素材文件夹只能归入一个主分类，避免图片在不同选项卡中重复出现。
  switch ($folder) {
    '假面骑士-双重曝光'  { return @('骑士特摄') }
    '假面骑士-拖影'      { return @('骑士特摄') }
    '假面骑士最终形态'    { return @('骑士特摄') }
    '铠甲勇士'            { return @('骑士特摄') }
    '凡人修仙传'          { return @('动漫真人化') }
    '死神真人化'          { return @('动漫真人化') }
    '海贼真人化'          { return @('动漫真人化') }
    '假面骑士涂鸦风'      { return @('涂鸦速写') }
    '假面骑士涂鸦风-横板' { return @('涂鸦速写') }
    '死神涂鸦'            { return @('涂鸦速写') }
    '奥特曼&怪兽写真'     { return @('奥特曼主题') }
    '假面骑士写真'        { return @('人物特写') }
    default               { return @('动漫主题') }
  }
}

function Get-RatioLabel([int]$width, [int]$height) {
  $ratio = $width / $height
  if ($width -ge $height) {
    $choices = @(
      @{ Label = '16:9'; Value = 16 / 9 },
      @{ Label = '21:9'; Value = 21 / 9 },
      @{ Label = '32:9'; Value = 32 / 9 }
    )
  } else {
    $choices = @(
      @{ Label = '9:16'; Value = 9 / 16 },
      @{ Label = '3:4'; Value = 3 / 4 }
    )
  }
  return ($choices | Sort-Object { [Math]::Abs($_.Value - $ratio) } | Select-Object -First 1).Label
}

$files = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
  Where-Object {
    $_.FullName -notlike "$projectPrefix*" -and
    $_.Extension -match '^\.(png|jpg|jpeg|webp)$'
  } |
  # 最新修改的图片排在最前，网页默认展示这里的前 8 张。
  Sort-Object -Property @{ Expression = 'LastWriteTime'; Descending = $true }, DirectoryName, Name

$folderCounters = @{}
$items = foreach ($file in $files) {
  try {
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    $width = $image.Width
    $height = $image.Height
    $image.Dispose()

    $folder = $file.Directory.Name
    if (-not $folderCounters.ContainsKey($folder)) { $folderCounters[$folder] = 0 }
    $folderCounters[$folder]++
    $index = $folderCounters[$folder]
    $baseName = [IO.Path]::GetFileNameWithoutExtension($file.Name)
    $genericName = $baseName -match '^微信图片_' -or $baseName -match '^[a-f0-9]{20,}$'
    $title = if ($genericName) { '{0} · {1:D2}' -f $folder, $index } else { "$folder · $baseName" }
    $relativePath = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')

    [ordered]@{
      id = $items.Count + 1
      title = $title
      folder = $folder
      src = '../' + $relativePath
      width = $width
      height = $height
      updatedAt = $file.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
      orientation = if ($width -ge $height) { 'landscape' } else { 'portrait' }
      ratio = Get-RatioLabel $width $height
      categories = @(Get-Categories $folder)
    }
  } catch {
    Write-Warning "跳过无法读取的图片：$($file.FullName)"
  }
}

# 重新编号，避免个别损坏图片造成编号空缺。
for ($i = 0; $i -lt $items.Count; $i++) { $items[$i].id = $i + 1 }

$json = ConvertTo-Json -InputObject @($items) -Depth 5 -Compress
$content = "window.SYLVAN_WALLPAPERS = $json;`n"
[IO.File]::WriteAllText($outputPath, $content, [Text.UTF8Encoding]::new($false))

$landscape = @($items | Where-Object orientation -eq 'landscape').Count
$portrait = @($items | Where-Object orientation -eq 'portrait').Count
Write-Host "已生成 $($items.Count) 张：横屏 $landscape，竖屏 $portrait"
Write-Host $outputPath




