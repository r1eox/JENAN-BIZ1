@echo off
chcp 65001 >nul
title بناء حزمة التوزيع - جنان بيز
color 0B

echo.
echo  =====================================================
echo       جنان بيز - بناء حزمة التوزيع
echo  =====================================================
echo.

set DIST=%~dp0_dist\janan-biz
set ZIP_OUT=%~dp0janan-biz.zip

REM --- 1. بناء الفرونتند ---
echo [1/5] بناء واجهة المستخدم...
call npm --prefix "%~dp0frontend" install --silent
call npm --prefix "%~dp0frontend" run build
if %errorlevel% neq 0 (
    echo [!] فشل بناء الواجهة!
    pause & exit /b 1
)
echo [OK] تم بناء الواجهة.

REM --- 2. تجهيز مجلد التوزيع ---
echo.
echo [2/5] تجهيز مجلد التوزيع...
if exist "%DIST%" rmdir /S /Q "%DIST%"
mkdir "%DIST%"
mkdir "%DIST%\node"
mkdir "%DIST%\backend"
mkdir "%DIST%\frontend\dist"
mkdir "%DIST%\uploads\bank-statements"
mkdir "%DIST%\uploads\documents"
mkdir "%DIST%\uploads\complete-files"
mkdir "%DIST%\uploads\contracts"
echo [OK] تم انشاء مجلد التوزيع.

REM --- 3. نسخ Node.js ---
echo.
echo [3/5] نسخ Node.js...
set NODE_SRC=%~dp0_node_portable\node.exe
if not exist "%NODE_SRC%" set NODE_SRC=C:\Program Files\nodejs\node.exe
if not exist "%NODE_SRC%" (
    echo [!] لم يتم العثور على node.exe
    pause & exit /b 1
)
copy "%NODE_SRC%" "%DIST%\node\node.exe" >nul
echo [OK] تم نسخ Node.js.

REM --- 4. نسخ ملفات المشروع ---
echo.
echo [4/5] نسخ ملفات المشروع...

REM نسخ الباكند (بدون node_modules أولاً)
xcopy "%~dp0backend\*.js"        "%DIST%\backend\" /Y /Q >nul
xcopy "%~dp0backend\*.json"      "%DIST%\backend\" /Y /Q >nul
xcopy "%~dp0backend\routes\"     "%DIST%\backend\routes\" /E /I /Y /Q >nul
xcopy "%~dp0backend\middleware\"  "%DIST%\backend\middleware\" /E /I /Y /Q >nul
xcopy "%~dp0backend\services\"   "%DIST%\backend\services\" /E /I /Y /Q >nul
if exist "%~dp0backend\.env"     copy "%~dp0backend\.env" "%DIST%\backend\.env" >nul
REM لا نسخ weseet.db — تُنشأ تلقائياً نظيفة عند أول تشغيل

REM نسخ node_modules الباكند (prod فقط)
echo     نسخ المكتبات (قد يأخذ دقيقة)...
xcopy "%~dp0backend\node_modules\" "%DIST%\backend\node_modules\" /E /I /Y /Q >nul

REM نسخ الفرونتند المبني
xcopy "%~dp0frontend\dist\" "%DIST%\frontend\dist\" /E /I /Y /Q >nul

REM نسخ الصورة/اللوغو
if exist "%~dp0frontend\public\logo.jpeg" (
    mkdir "%DIST%\frontend\dist" 2>nul
    copy "%~dp0frontend\public\logo.jpeg" "%DIST%\frontend\dist\logo.jpeg" >nul
)

echo [OK] تم نسخ الملفات.

REM --- 5. إنشاء ملفات التشغيل ---
echo.
echo [5/5] إنشاء ملفات التشغيل...

REM --- start.bat للتوزيع ---
(
echo @echo off
echo chcp 65001 ^>nul
echo title جنان بيز
echo.
echo taskkill /F /IM node.exe ^>nul 2^>^&1
echo timeout /t 1 /nobreak ^>nul
echo.
echo start "Janan Biz" /min cmd /c "cd /d %%~dp0backend ^&^& ..\node\node.exe server.js"
echo timeout /t 3 /nobreak ^>nul
echo start http://localhost:5000
echo exit
) > "%DIST%\start.bat"

REM --- stop.bat للتوزيع ---
(
echo @echo off
echo chcp 65001 ^>nul
echo taskkill /F /IM node.exe ^>nul 2^>^&1
echo echo تم الاغلاق.
echo timeout /t 2 /nobreak ^>nul
) > "%DIST%\stop.bat"

REM --- README.txt ---
(
echo ====================================================
echo          جنان بيز - حلول الاعمال
echo ====================================================
echo.
echo التشغيل:
echo   انقر نقر مزدوج على: start.bat
echo.
echo الايقاف:
echo   انقر نقر مزدوج على: stop.bat
echo.
echo بعد التشغيل افتح المتصفح على:
echo   http://localhost:5000
echo.
echo بيانات الادمن:
echo   البريد      : admin@weseet.com
echo   كلمة المرور : Admin@12345
echo.
echo ملاحظة: لا يحتاج تثبيت اي برنامج اضافي.
echo ====================================================
) > "%DIST%\README.txt"

echo [OK] تم انشاء ملفات التشغيل.

REM --- ضغط الحزمة النهائية ---
echo.
echo ضغط الحزمة النهائية...
if exist "%ZIP_OUT%" del "%ZIP_OUT%"
powershell -Command "Compress-Archive -Path '%DIST%\*' -DestinationPath '%ZIP_OUT%' -Force"
if not exist "%ZIP_OUT%" (
    echo [!] فشل ضغط الحزمة!
    pause & exit /b 1
)

for /f %%A in ('powershell -Command "[math]::Round((Get-Item ''%ZIP_OUT%'').Length/1MB,0)"') do set SIZE=%%A

echo.
echo  =====================================================
echo   [تم بناء الحزمة بنجاح!]
echo.
echo   الملف: janan-biz.zip
echo   الحجم: %SIZE% MB
echo.
echo   ارسل الملف للموظفين مع التعليمات:
echo   1. فك الضغط في اي مكان
echo   2. انقر نقر مزدوج على start.bat
echo   3. افتح المتصفح: http://localhost:5000
echo.
echo  =====================================================
echo   لبناء مثبت احترافي (Setup.exe) شغّل:
echo   installer\build-installer.bat
echo  =====================================================
echo.
pause
