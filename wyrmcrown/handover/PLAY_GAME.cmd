@echo off
setlocal
cd /d "%~dp0"
echo Starting Dragon Wars with recorded voices and sound effects.
echo Keep this window open while playing. Close it when you finish.
where python >nul 2>nul
if not errorlevel 1 (
    python -u wyrmcrown\tools\serve.py --port 0 --open
    if errorlevel 1 pause
    exit /b
)
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -u wyrmcrown\tools\serve.py --port 0 --open
    if errorlevel 1 pause
    exit /b
)
if exist "%USERPROFILE%\miniconda3\python.exe" (
    "%USERPROFILE%\miniconda3\python.exe" -u wyrmcrown\tools\serve.py --port 0 --open
    if errorlevel 1 pause
    exit /b
)
echo Python 3 was not found. Install Python 3, then run PLAY_GAME.cmd again.
pause
