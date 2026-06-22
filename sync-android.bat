@echo off
chcp 65001 >nul
echo ================================
echo  FateTell Android 同步 + 打包
echo ================================

set SRC=F:\00011
set WWW=F:\00011-android\www
set ANDROID=F:\00011-android\android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set ANDROID_HOME=C:\Android\Sdk
set PATH=C:\Program Files\nodejs;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

echo.
echo [1/3] 同步文件到 www...
copy /Y "%SRC%\fatetell.html" "%WWW%\index.html" >nul

xcopy /Y /E /Q "%SRC%\btn\*"          "%WWW%\btn\"          >nul 2>&1
xcopy /Y /E /Q "%SRC%\baguatu\*"      "%WWW%\baguatu\"      >nul 2>&1
xcopy /Y /E /Q "%SRC%\baguatu2\*"     "%WWW%\baguatu2\"     >nul 2>&1
xcopy /Y /E /Q "%SRC%\zhanbuyemian\*" "%WWW%\zhanbuyemian\" >nul 2>&1
xcopy /Y /E /Q "%SRC%\lib\*"          "%WWW%\lib\"          >nul 2>&1
xcopy /Y /E /Q "%SRC%\yijing-book\*"  "%WWW%\yijing-book\"  >nul 2>&1
xcopy /Y /E /Q "%SRC%\wu-tu\*"        "%WWW%\wu-tu\"        >nul 2>&1

copy /Y "%SRC%\*.svg" "%WWW%\" >nul 2>&1
copy /Y "%SRC%\*.png" "%WWW%\" >nul 2>&1
copy /Y "%SRC%\*.js"  "%WWW%\" >nul 2>&1

echo [1/3] 文件同步完成

echo.
echo [2/3] Capacitor 同步...
cd /d F:\00011-android
call npx cap sync android
echo [2/3] Capacitor 同步完成

echo.
echo [3/3] 打包 APK...
cd /d %ANDROID%
call gradlew.bat assembleDebug

echo.
if exist "%ANDROID%\app\build\outputs\apk\debug\app-debug.apk" (
    echo ================================
    echo  打包成功！
    echo  APK 路径：
    echo  %ANDROID%\app\build\outputs\apk\debug\app-debug.apk
    echo ================================
    explorer "%ANDROID%\app\build\outputs\apk\debug\"
) else (
    echo  打包失败，请查看上方错误信息
)
pause
