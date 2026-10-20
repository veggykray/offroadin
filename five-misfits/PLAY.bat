@echo off
setlocal
cd /d "%~dp0"
title Five Misfits
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js was not found on this computer.
  echo  Install the LTS version from https://nodejs.org/ and run PLAY.bat again.
  echo.
  pause
  exit /b 1
)
for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if not exist node_modules (
  echo  First run: installing dependencies with npm ^(needs internet once^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo  Starting the game. Your browser should open at http://localhost:5180/
echo  Keep this window open while playing. Press Ctrl+C here to stop.
echo.
call npm run dev
pause
