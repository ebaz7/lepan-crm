@echo off
echo >>> Stopping all Node and Chrome processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM chrome.exe /T 2>nul
echo.
echo >>> Cleaning npm cache...
call npm cache clean --force
echo.
echo >>> Installing dependencies using high-speed mirror...
call npm install --registry=https://registry.npmmirror.com
echo.
echo >>> DONE! You can now start the app.
pause
