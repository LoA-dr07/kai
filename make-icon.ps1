Add-Type -AssemblyName System.Drawing

$pngPath = "$PSScriptRoot\mobile\assets\icon.png"
$icoPath = "$PSScriptRoot\kai.ico"

$src = [System.Drawing.Image]::FromFile($pngPath)

# Render to 32-bit ARGB bitmap at 64x64
$bmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, 64, 64)
$g.Dispose()

# Lock bits to get raw pixel data (BGRA)
$rect = New-Object System.Drawing.Rectangle(0, 0, 64, 64)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$pixelBytes = New-Object byte[] ($data.Stride * 64)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixelBytes, 0, $pixelBytes.Length)
$bmp.UnlockBits($data)

# ICO: BITMAPINFOHEADER is 40 bytes, XOR mask = 64*64*4 bytes, AND mask = 64*8 bytes (1bpp, rows padded to 4 bytes)
$andMaskRowSize = [Math]::Ceiling(64 / 8.0)
# pad to 4-byte boundary
$andMaskRowPadded = [Math]::Ceiling($andMaskRowSize / 4.0) * 4
$andMask = New-Object byte[] ($andMaskRowPadded * 64)  # all zeros = fully opaque

# Build XOR mask: flip rows vertically (BMP is bottom-up)
$xorMask = New-Object byte[] (64 * 64 * 4)
for ($row = 0; $row -lt 64; $row++) {
    $srcRow = 63 - $row
    [Array]::Copy($pixelBytes, $srcRow * $data.Stride, $xorMask, $row * 64 * 4, 64 * 4)
}

$bmpInfoHeader = New-Object byte[] 40
[BitConverter]::GetBytes([uint32]40)      | ForEach-Object { $i = 0 } { $bmpInfoHeader[$i++] = $_ }  # size
[BitConverter]::GetBytes([int32]64)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # width
[BitConverter]::GetBytes([int32]128)      | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # height * 2 (XOR+AND)
[BitConverter]::GetBytes([uint16]1)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # planes
[BitConverter]::GetBytes([uint16]32)      | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # bpp
[BitConverter]::GetBytes([uint32]0)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # compression
[BitConverter]::GetBytes([uint32]0)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # image size
[BitConverter]::GetBytes([int32]0)        | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # x pels
[BitConverter]::GetBytes([int32]0)        | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # y pels
[BitConverter]::GetBytes([uint32]0)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # clr used
[BitConverter]::GetBytes([uint32]0)       | ForEach-Object { $bmpInfoHeader[$i++] = $_ }              # clr important

$imageDataSize = $bmpInfoHeader.Length + $xorMask.Length + $andMask.Length

$fs = [System.IO.File]::OpenWrite($icoPath)
$w = New-Object System.IO.BinaryWriter($fs)

# ICO header
$w.Write([uint16]0)    # reserved
$w.Write([uint16]1)    # type: icon
$w.Write([uint16]1)    # count

# Directory entry
$w.Write([byte]64)     # width
$w.Write([byte]64)     # height
$w.Write([byte]0)      # color count
$w.Write([byte]0)      # reserved
$w.Write([uint16]1)    # planes
$w.Write([uint16]32)   # bit count
$w.Write([uint32]$imageDataSize)
$w.Write([uint32]22)   # offset: 6 + 16

# Image data
$w.Write($bmpInfoHeader)
$w.Write($xorMask)
$w.Write($andMask)
$w.Close()
$fs.Close()

Write-Host "Icon erstellt: $icoPath"
