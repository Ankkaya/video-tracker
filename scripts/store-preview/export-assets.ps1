param([Parameter(Mandatory=$true)][string]$ScreenshotDirectory, [string]$ProjectDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = if ($ProjectDirectory) { (Resolve-Path -LiteralPath $ProjectDirectory).ProviderPath } else { (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).ProviderPath }
$outputRoot = Join-Path $projectRoot 'output/edge-store'

# Export existing artwork and captured screenshots at exact store dimensions.
function Export-Png([string]$Source, [string]$Destination, [int]$Width, [int]$Height) {
    $sourceImage = [System.Drawing.Image]::FromFile($Source)
    if ($sourceImage.Width -eq $Width -and $sourceImage.Height -eq $Height) {
        try { $sourceImage.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png) }
        finally { $sourceImage.Dispose() }
        return
    }
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $ratio = [Math]::Min($Width / $sourceImage.Width, $Height / $sourceImage.Height)
        $renderWidth = [int][Math]::Round($sourceImage.Width * $ratio)
        $renderHeight = [int][Math]::Round($sourceImage.Height * $ratio)
        $graphics.DrawImage($sourceImage, [int](($Width-$renderWidth)/2), [int](($Height-$renderHeight)/2), $renderWidth, $renderHeight)
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose(); $sourceImage.Dispose() }
}

foreach ($locale in @('zh-CN','en-US')) {
    $localeDir = Join-Path $outputRoot $locale
    Export-Png (Join-Path $localeDir 'promo-large-original.png') (Join-Path $localeDir 'promo-large-1400x560.png') 1400 560
    Export-Png (Join-Path $localeDir 'promo-small-original.png') (Join-Path $localeDir 'promo-small-440x280.png') 440 280
    foreach ($name in @('01-records','02-settings','03-sites','04-popup')) {
        $sourcePath = Join-Path $ScreenshotDirectory "$name-$locale.png"
        if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing lossless PNG screenshot: $sourcePath" }
        $capture = [System.Drawing.Image]::FromFile($sourcePath)
        try {
            if ($capture.Width -ne 1280 -or $capture.Height -ne 800) { throw "Screenshot must be captured directly at 1280 x 800: $sourcePath" }
        } finally { $capture.Dispose() }
        Export-Png $sourcePath (Join-Path $localeDir "$name-1280x800.png") 1280 800
    }
}
Get-ChildItem -LiteralPath (Join-Path $outputRoot 'zh-CN'),(Join-Path $outputRoot 'en-US') -Filter '*x*.png' | ForEach-Object {
    $img = [System.Drawing.Image]::FromFile($_.FullName)
    [pscustomobject]@{File=$_.FullName; Width=$img.Width; Height=$img.Height; Bytes=$_.Length}
    $img.Dispose()
}
