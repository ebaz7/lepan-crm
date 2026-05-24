@echo off
echo ==========================================
echo    Android APK Build Script (Full Auto)
echo ==========================================

echo [1/5] Installing web dependencies...
call npm install

echo [2/5] Building web application (UI, Menus, Offline Assets)...
call npm run build

echo [3/5] Syncing assets to Android project...
call npx cap sync android

echo [4/5] Building APK using Gradle...
cd android
call gradlew.bat assembleDebug
cd ..

echo.
echo ==========================================
echo BUILD FINISHED!
echo APK Location: android\app\build\outputs\apk\debug\app-debug.apk
echo ==========================================
pause
