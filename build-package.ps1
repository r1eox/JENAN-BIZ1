$DIST = "c:\Users\AzM\OneDrive\Desktop\weseet\_dist\janan-biz"
$ROOT = "c:\Users\AzM\OneDrive\Desktop\weseet"
$ZIP  = "c:\Users\AzM\OneDrive\Desktop\janan-biz.zip"

Write-Host "=== بناء حزمة التوزيع ===" -ForegroundColor Cyan

# 1. بناء الفرونتند
Write-Host "[1/6] بناء الواجهة..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"
npm run build
Set-Location $ROOT
Write-Host "[OK]" -ForegroundColor Green

# 2. إنشاء مجلدات
Write-Host "[2/6] إنشاء مجلدات التوزيع..." -ForegroundColor Yellow
Remove-Item $DIST -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$DIST\node"                    -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\backend"                 -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\frontend\dist"           -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\uploads\bank-statements" -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\uploads\documents"       -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\uploads\complete-files"  -Force | Out-Null
New-Item -ItemType Directory -Path "$DIST\uploads\contracts"       -Force | Out-Null
Write-Host "[OK]" -ForegroundColor Green

# 3. نسخ Node.js
Write-Host "[3/6] نسخ Node.js..." -ForegroundColor Yellow
Copy-Item "C:\Program Files\nodejs\node.exe" "$DIST\node\node.exe"
Write-Host "[OK]" -ForegroundColor Green

# 4. نسخ ملفات الباكند
Write-Host "[4/6] نسخ الباكند..." -ForegroundColor Yellow
$files = "server.js","database.js","package.json",".env","weseet.db"
foreach ($f in $files) {
    $src = "$ROOT\backend\$f"
    if (Test-Path $src) { Copy-Item $src "$DIST\backend\" }
}
$dirs = "routes","middleware","services"
foreach ($d in $dirs) {
    $src = "$ROOT\backend\$d"
    if (Test-Path $src) { Copy-Item $src "$DIST\backend\$d" -Recurse -Force }
}
Write-Host "    نسخ node_modules..." -ForegroundColor Gray
Copy-Item "$ROOT\backend\node_modules" "$DIST\backend\node_modules" -Recurse -Force
Write-Host "[OK]" -ForegroundColor Green

# 5. نسخ الفرونتند
Write-Host "[5/6] نسخ الواجهة المبنية..." -ForegroundColor Yellow
Copy-Item "$ROOT\frontend\dist\*" "$DIST\frontend\dist\" -Recurse -Force
$logo = "$ROOT\frontend\public\logo.jpeg"
if (Test-Path $logo) { Copy-Item $logo "$DIST\frontend\dist\" }
Write-Host "[OK]" -ForegroundColor Green

# 6. إنشاء ملفات التشغيل
Write-Host "[6/6] إنشاء ملفات التشغيل..." -ForegroundColor Yellow

$lines = "@echo off","chcp 65001 >nul","title Janan Biz",
         "taskkill /F /IM node.exe >nul 2>&1",
         "timeout /t 1 /nobreak >nul",
         "start `"Janan Biz`" /min cmd /c `"cd /d %~dp0backend ^&^& ..\node\node.exe server.js`"",
         "timeout /t 3 /nobreak >nul",
         "start http://localhost:5000",
         "exit"
[System.IO.File]::WriteAllLines("$DIST\start.bat", $lines, [System.Text.Encoding]::Default)

$stopLines = "@echo off","chcp 65001 >nul","taskkill /F /IM node.exe >nul 2>&1","timeout /t 2 /nobreak >nul"
[System.IO.File]::WriteAllLines("$DIST\stop.bat", $stopLines, [System.Text.Encoding]::Default)

$readmeLines = "====================================================",
               "     Janan Biz - Business Solutions",
               "====================================================",
               "",
               "Start:  double-click  start.bat",
               "Stop:   double-click  stop.bat",
               "Browser: http://localhost:5000",
               "",
               "Admin: admin@weseet.com",
               "Pass:  Admin@12345",
               ""
               "===================================================="
[System.IO.File]::WriteAllLines("$DIST\README.txt", $readmeLines, [System.Text.Encoding]::UTF8)

Write-Host "[OK]" -ForegroundColor Green

# ضغط الحزمة
Write-Host "ضغط الحزمة..." -ForegroundColor Yellow
if (Test-Path $ZIP) { Remove-Item $ZIP -Force }
Compress-Archive -Path "$DIST\*" -DestinationPath $ZIP -Force
$zipMB = [math]::Round((Get-Item $ZIP).Length/1MB,0)

Write-Host ""
Write-Host "=== تم ===" -ForegroundColor Cyan
Write-Host "الملف: $ZIP  ($zipMB MB)"
Write-Host "للموظف: فك الضغط, انقر start.bat, افتح http://localhost:5000"
