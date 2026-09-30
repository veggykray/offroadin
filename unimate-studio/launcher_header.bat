@echo off
title UniMate Studio
rem UniMate Studio - one file. Double-click to start.
rem It uses the conda environment you already set up for UniMate.
rem If your environment is not called "unimate", change the name on the next line.
set "ENVNAME=unimate"

set "HOMEDIR=%LOCALAPPDATA%\UniMateStudio"
set "APP=%HOMEDIR%\studio.py"
set "SELF=%~f0"
if not exist "%HOMEDIR%" mkdir "%HOMEDIR%"

rem The app itself is stored at the bottom of this file; unpack the latest copy.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8); $m='::'+'__STUDIO_PY_BELOW__'; $i=$t.IndexOf($m); if($i -lt 0){exit 2}; $py=$t.Substring($t.IndexOf([char]10,$i)+1); [IO.File]::WriteAllText($env:APP,$py,(New-Object Text.UTF8Encoding $false))"
if errorlevel 1 (
  echo Couldn't unpack the app. Make sure this file wasn't edited or cut short.
  pause
  exit /b 1
)

set "PYEXE="
for %%R in ("%USERPROFILE%\miniconda3" "%USERPROFILE%\anaconda3" "%LOCALAPPDATA%\miniconda3" "%LOCALAPPDATA%\anaconda3" "%ProgramData%\miniconda3" "%ProgramData%\anaconda3" "%USERPROFILE%\.conda" "%USERPROFILE%\miniforge3" "%USERPROFILE%\mambaforge") do (
  if not defined PYEXE if exist "%%~R\envs\%ENVNAME%\python.exe" set "PYEXE=%%~R\envs\%ENVNAME%\python.exe"
)
if not defined PYEXE (
  for /f "tokens=1,* delims= " %%A in ('conda env list 2^>nul ^| findstr /b /c:"%ENVNAME% "') do (
    for /f "tokens=*" %%P in ("%%B") do if exist "%%~P\python.exe" set "PYEXE=%%~P\python.exe"
  )
)
if not defined PYEXE (
  echo.
  echo Couldn't find a conda environment called "%ENVNAME%".
  echo Open this file in Notepad and change ENVNAME near the top to the name
  echo of the environment you installed UniMate into, then run it again.
  echo In PowerShell, "conda env list" shows the names.
  echo.
  pause
  exit /b 1
)

echo Starting UniMate Studio with:
echo   %PYEXE%
echo Keep this window open while you use the app. Messages appear here if anything goes wrong.
echo.
"%PYEXE%" "%APP%"
if errorlevel 1 (
  echo.
  echo UniMate Studio stopped with an error ^(shown above^).
  echo Copy the lines above and send them to Claude.
  echo.
  pause
)
exit /b 0

::__STUDIO_PY_BELOW__
