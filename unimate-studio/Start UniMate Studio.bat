@echo off
title UniMate Studio
rem Starts UniMate Studio with the conda environment you already set up for UniMate.
rem If your environment is not called "unimate", change the name on the next line.
set "ENVNAME=unimate"
set "APP=%~dp0studio.py"

if not exist "%APP%" (
  echo Can't find studio.py next to this file.
  echo Keep "Start UniMate Studio.bat" and "studio.py" in the same folder.
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
  echo Open "Start UniMate Studio.bat" in Notepad and change ENVNAME to the
  echo name of the environment you installed UniMate into, then run it again.
  echo In an Anaconda Prompt or PowerShell, "conda env list" shows the names.
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
