Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

function New-RoundedRectPath([float]$size, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Emblem(
  [System.Drawing.Graphics]$g,
  [float]$cx,
  [float]$cy,
  [float]$diameter
) {
  $coinColor = [System.Drawing.ColorTranslator]::FromHtml("#D6AD60")
  $leafColor = [System.Drawing.ColorTranslator]::FromHtml("#0F4D32")

  $coinRect = New-Object System.Drawing.RectangleF(
    ($cx - $diameter / 2),
    ($cy - $diameter / 2),
    $diameter,
    $diameter
  )
  $coinBrush = New-Object System.Drawing.SolidBrush($coinColor)
  $g.FillEllipse($coinBrush, $coinRect)
  $coinBrush.Dispose()

  $u = $diameter / 2

  $leafPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $leafPath.StartFigure()
  $leafPath.AddBezier(
    [System.Drawing.PointF]::new($cx + (-0.75 * $u), $cy + (0.26 * $u)),
    [System.Drawing.PointF]::new($cx + (-0.30 * $u), $cy + (-0.96 * $u)),
    [System.Drawing.PointF]::new($cx + (0.68 * $u), $cy + (-0.98 * $u)),
    [System.Drawing.PointF]::new($cx + (0.86 * $u), $cy + (0.02 * $u))
  )
  $leafPath.AddBezier(
    [System.Drawing.PointF]::new($cx + (0.86 * $u), $cy + (0.02 * $u)),
    [System.Drawing.PointF]::new($cx + (0.68 * $u), $cy + (0.95 * $u)),
    [System.Drawing.PointF]::new($cx + (-0.05 * $u), $cy + (1.10 * $u)),
    [System.Drawing.PointF]::new($cx + (-0.75 * $u), $cy + (0.26 * $u))
  )
  $leafPath.CloseFigure()
  $leafBrush = New-Object System.Drawing.SolidBrush($leafColor)
  $g.FillPath($leafBrush, $leafPath)
  $leafBrush.Dispose()

  $veinPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($diameter * 0.045))
  $veinPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $veinPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine(
    $veinPen,
    [System.Drawing.PointF]::new($cx + (-0.38 * $u), $cy + (0.56 * $u)),
    [System.Drawing.PointF]::new($cx + (0.46 * $u), $cy + (-0.34 * $u))
  )
  $veinPen.Dispose()

  $dotSize = $diameter * 0.15
  $dotRect = New-Object System.Drawing.RectangleF(
    ($cx - 0.08 * $u - ($dotSize / 2)),
    ($cy + 0.28 * $u - ($dotSize / 2)),
    $dotSize,
    $dotSize
  )
  $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillEllipse($dotBrush, $dotRect)
  $dotBrush.Dispose()

  $leafPath.Dispose()
}

function New-FullIcon([int]$size, [string]$outputPath, [bool]$roundOnly = $false) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $dark = [System.Drawing.ColorTranslator]::FromHtml("#0B3F32")
  $light = [System.Drawing.ColorTranslator]::FromHtml("#2C8A63")
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.PointF]::new($size, $size),
    $dark,
    $light
  )

  if ($roundOnly) {
    $g.FillEllipse($bgBrush, 0, 0, $size - 1, $size - 1)
  } else {
    $bgPath = New-RoundedRectPath -size $size -radius ($size * 0.22)
    $g.FillPath($bgBrush, $bgPath)
    $bgPath.Dispose()
  }
  $bgBrush.Dispose()

  $shine = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.PointF]::new(0, $size * 0.45),
    [System.Drawing.Color]::FromArgb(70, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(0, 255, 255, 255)
  )
  if ($roundOnly) {
    $g.FillEllipse($shine, 0, 0, $size - 1, $size - 1)
  } else {
    $shinePath = New-RoundedRectPath -size $size -radius ($size * 0.22)
    $g.FillPath($shine, $shinePath)
    $shinePath.Dispose()
  }
  $shine.Dispose()

  Draw-Emblem -g $g -cx ($size / 2) -cy ($size / 2) -diameter ($size * 0.62)

  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outputPath)) | Out-Null
  $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
}

function New-ForegroundIcon([int]$size, [string]$outputPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  Draw-Emblem -g $g -cx ($size / 2) -cy ($size / 2) -diameter ($size * 0.68)

  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outputPath)) | Out-Null
  $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
}

$androidRes = "android/app/src/main/res"
$targets = @(
  @{ dir = "mipmap-mdpi"; size = 48 },
  @{ dir = "mipmap-hdpi"; size = 72 },
  @{ dir = "mipmap-xhdpi"; size = 96 },
  @{ dir = "mipmap-xxhdpi"; size = 144 },
  @{ dir = "mipmap-xxxhdpi"; size = 192 }
)

foreach ($target in $targets) {
  $dir = Join-Path $androidRes $target.dir
  New-FullIcon -size $target.size -outputPath (Join-Path $dir "ic_launcher.png")
  New-FullIcon -size $target.size -outputPath (Join-Path $dir "ic_launcher_round.png") -roundOnly $true
  New-ForegroundIcon -size $target.size -outputPath (Join-Path $dir "ic_launcher_foreground.png")
}

Write-Host "App icons regenerated successfully."
