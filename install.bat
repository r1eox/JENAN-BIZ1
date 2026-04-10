@echo off
chcp 65001 >nul
title جنان بيز - تثبيت البرنامج
color 0B

echo.
echo  =====================================================
echo          جنان بيز - حلول الاعمال
echo          تثبيت البرنامج
echo  =====================================================
echo.

REM --- التحقق من Node.js ---
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js غير مثبت على هذا الجهاز.
    echo.
    echo  سيتم فتح صفحة تحميل Node.js...
    echo  قم بتحميل وتثبيت النسخة LTS ثم اعد تشغيل هذا الملف.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js مثبت - الاصدار: %NODE_VER%

REM --- تثبيت متطلبات الباكند ---
echo.
echo [1/2] تثبيت متطلبات الخادم...
cd /d "%~dp0backend"
call npm install --omit=dev
if %errorlevel% neq 0 (
    echo [!] خطأ في تثبيت متطلبات الخادم!
    pause
    exit /b 1
)
echo [OK] تم تثبيت الخادم.

REM --- ملفات الفرونتند الجاهزة موجودة أصلاً ---
echo.
echo [2/2] التحقق من ملفات الواجهة...
if exist "%~dp0frontend\dist\index.html" (
    echo [OK] ملفات الواجهة جاهزة.
) else (
    echo [!] ملفات الواجهة غير موجودة، يتم بناؤها الان...
    cd /d "%~dp0frontend"
    call npm install
    call npm run build
    if %errorlevel% neq 0 (
        echo [!] خطأ في بناء الواجهة!
        pause
        exit /b 1
    )
    echo [OK] تم بناء الواجهة.
)

REM --- إنشاء اختصار على سطح المكتب ---
echo.
echo [+] إنشاء اختصار على سطح المكتب...
set SHORTCUT_PATH=%USERPROFILE%\Desktop\جنان بيز.lnk
set TARGET_PATH=%~dp0start.bat
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_PATH%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'جنان بيز - حلول الاعمال'; $s.Save()" >nul 2>&1
if exist "%SHORTCUT_PATH%" (
    echo [OK] تم انشاء الاختصار على سطح المكتب.
) else (
    echo [i] لم يتم انشاء الاختصار، يمكنك تشغيل start.bat مباشرة.
)

echo.
echo  =====================================================
echo   [تم التثبيت بنجاح!]
echo.
echo   لتشغيل البرنامج:
echo     - انقر نقر مزدوج على: start.bat
echo     - أو من سطح المكتب على: جنان بيز
echo.
echo   الرابط بعد التشغيل: http://localhost:5000
echo.
echo   بيانات الادمن:
echo     البريد      : admin@weseet.com
echo     كلمة المرور : Admin@12345
echo  =====================================================
echo.
pause
