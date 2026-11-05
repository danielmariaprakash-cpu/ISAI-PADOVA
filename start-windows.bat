@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is not installed. Get it from https://nodejs.org ^(LTS^) and run this again. & pause & exit /b)
start "" /b cmd /c "timeout /t 2 >nul & (reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && start chrome http://localhost:3000 || start http://localhost:3000)"
node server.js
pause
