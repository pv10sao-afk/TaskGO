Add-Type -AssemblyName System.Drawing

$srcFile = "d:\Projertc2323\icon.png"
if (-Not (Test-Path $srcFile)) {
    Write-Output "Image not found at $srcFile"
    exit 1
}

$img = [System.Drawing.Image]::FromFile($srcFile)
$width = $img.Width
$height = $img.Height

Write-Output "Original Size: $width x $height"

# crop a central square
$cropSize = [int][math]::Floor($height * 0.5)
$x = [int][math]::Floor(($width - $cropSize) / 2)
$y = [int][math]::Floor(($height - $cropSize) / 2)

$rect = New-Object System.Drawing.Rectangle($x, $y, $cropSize, $cropSize)
$bmp = New-Object System.Drawing.Bitmap($cropSize, $cropSize)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cropSize, $cropSize)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# Define resolutions for mipmap
$resolutions = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$resPath = "d:\Projertc2323\app\src\main\res"

foreach ($key in $resolutions.Keys) {
    $size = [int]$resolutions[$key]
    $folder = "$resPath\$key"
    if (-Not (Test-Path $folder)) {
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
    }
    
    $outBmp = New-Object System.Drawing.Bitmap($size, $size)
    $outG = [System.Drawing.Graphics]::FromImage($outBmp)
    $outG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $outG.DrawImage($bmp, 0, 0, $size, $size)
    $outG.Dispose()
    
    $outFile = "$folder\ic_launcher.png"
    $outBmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()
    
    Write-Output "Saved $outFile"
}

# Adaptive icons foreground
$folder = "$resPath\mipmap-anydpi-v26"
if (-Not (Test-Path $folder)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$adaptiveSize = 108
$outBmp = New-Object System.Drawing.Bitmap($adaptiveSize, $adaptiveSize)
$outG = [System.Drawing.Graphics]::FromImage($outBmp)
$outG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
# For adaptive icon foreground, we draw the crop but slightly scaled so it leaves some safe area
# Standard foreground usually leaves some margin. Let's make it 72x72 inside 108x108
$fgSize = 90
$offset = [int](($adaptiveSize - $fgSize) / 2)
$outG.DrawImage($bmp, $offset, $offset, $fgSize, $fgSize)
$outG.Dispose()

$outFile = "$resPath\mipmap-xxxhdpi\ic_launcher_foreground.png"
$outBmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose()

$img.Dispose()
$bmp.Dispose()

Write-Output "Done generating icons!"
