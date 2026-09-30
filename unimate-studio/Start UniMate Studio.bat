@echo off
rem Starts UniMate Studio with the conda environment you already set up for UniMate.
rem If your environment is not called "unimate", change the name on the next line.
set "ENVNAME=unimate"
set "APP=%~dp0studio.py"

for %%R in ("%USERPROFILE%\miniconda3" "%USERPROFILE%\anaconda3" "%LOCALAPPDATA%\miniconda3" "%LOCALAPPDATA%\anaconda3" "%ProgramData%\miniconda3" "%ProgramData%\anaconda3" "%USERPROFILE%\.conda" "%USERPROFILE%\miniforge3" "%USERPROFILE%\mambaforge") do (
  if exist "%%~R\envs\%ENVNAME%\pythonw.exe" (
    start "" "%%~R\envs\%ENVNAME%\pythonw.exe" "%APP%"
    exit /b 0
  )
)

rem Not in a usual place: ask conda where it is.
for /f "tokens=1,* delims= " %%A in ('conda env list 2^>nul ^| findstr /b /c:"%ENVNAME% "') do (
  for /f "tokens=*" %%P in ("%%B") do (
    if exist "%%~P\pythonw.exe" (
      start "" "%%~P\pythonw.exe" "%APP%"
      exit /b 0
    )
  )
)

echo.
echo Couldn't find a conda environment called "%ENVNAME%".
echo Open "Start UniMate Studio.bat" in Notepad and change ENVNAME to the
echo name of the environment you installed UniMate into, then run it again.
echo (In an Anaconda Prompt, "conda env list" shows the names.)
echo.
pause
