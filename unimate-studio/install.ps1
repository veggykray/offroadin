# UniMate Studio installer (run through "Install UniMate Studio.bat").
# Installs Git + Miniconda if missing, downloads UniMate and its trained model,
# builds its Python environment, and puts a "UniMate Studio" icon on the desktop.
# Safe to run again: finished steps are skipped or updated.

$ErrorActionPreference = 'Continue'
$Base   = Join-Path $env:LOCALAPPDATA 'UniMateStudio'
$Engine = Join-Path $Base 'UniMate'
$PyEnv  = Join-Path $Base 'env'
$Ckpt   = Join-Path $Base 'checkpoints'
New-Item -ItemType Directory -Force -Path $Base | Out-Null
Start-Transcript -Path (Join-Path $Base 'install-log.txt') -Append | Out-Null

function Step($n, $m) { Write-Host ''; Write-Host "==> Step $n of 7: $m" -ForegroundColor Cyan }
function Fail($m) {
    Write-Host ''
    Write-Host "PROBLEM: $m" -ForegroundColor Red
    Write-Host "The full log is in $Base\install-log.txt" -ForegroundColor Yellow
    Stop-Transcript | Out-Null
    exit 1
}
function Check($what) { if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit code $LASTEXITCODE)." } }
function Find-Exe($name, $candidates) {
    foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
    $c = Get-Command $name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}
function Need-Winget {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Fail "Windows 'App Installer' (winget) is missing. Install 'App Installer' from the Microsoft Store, then run this again."
    }
}

Write-Host 'UniMate Studio setup' -ForegroundColor Green
Write-Host 'This downloads several GB and can take 20-60 minutes. Leave this window open.'

# 1. Git (UniMate installs two of its libraries straight from GitHub)
Step 1 'Git'
$gitPaths = @("$env:ProgramFiles\Git\cmd\git.exe", "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe")
$git = Find-Exe git $gitPaths
if (-not $git) {
    Need-Winget
    winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements --silent
    $git = Find-Exe git $gitPaths
    if (-not $git) { Fail 'Git did not finish installing. Restart the PC and run this again.' }
}
$env:PATH = (Split-Path $git) + ';' + $env:PATH
Write-Host "Git: $git"

# 2. Miniconda (provides Python 3.10, which UniMate needs)
Step 2 'Miniconda (Python)'
$condaPaths = @(
    "$env:USERPROFILE\miniconda3\Scripts\conda.exe", "$env:LOCALAPPDATA\miniconda3\Scripts\conda.exe",
    "$env:ProgramData\miniconda3\Scripts\conda.exe", "$env:USERPROFILE\anaconda3\Scripts\conda.exe",
    "$env:ProgramData\anaconda3\Scripts\conda.exe", "$env:LOCALAPPDATA\anaconda3\Scripts\conda.exe")
$conda = Find-Exe conda $condaPaths
if (-not $conda) {
    Need-Winget
    winget install -e --id Anaconda.Miniconda3 --accept-source-agreements --accept-package-agreements --silent
    $conda = Find-Exe conda $condaPaths
    if (-not $conda) { Fail 'Miniconda did not finish installing. Restart the PC and run this again.' }
}
Write-Host "Conda: $conda"

# 3. UniMate code
Step 3 'Downloading UniMate'
if (Test-Path (Join-Path $Engine '.git')) {
    & $git -C $Engine pull --ff-only
    if ($LASTEXITCODE -ne 0) { Write-Host 'Could not update UniMate; keeping the copy already here.' -ForegroundColor Yellow }
} else {
    & $git clone --depth 1 https://github.com/Friedrich-M/UniMate $Engine
    Check 'Downloading UniMate'
}

# 4. Python 3.10 environment (kept inside the UniMate Studio folder, separate from anything else)
Step 4 'Setting up Python 3.10'
$py = Join-Path $PyEnv 'python.exe'
if (-not (Test-Path $py)) {
    & $conda create -y -p $PyEnv python=3.10 tk --override-channels -c conda-forge
    Check 'Creating the Python environment'
}
& $py -m pip install --upgrade pip wheel 'setuptools<81'
Check 'Updating pip'

# 5. UniMate's libraries (PyTorch with CUDA, Blender as a module, text encoders, ...)
Step 5 'Installing UniMate libraries (the big download)'
& $py -m pip install -r (Join-Path $Engine 'requirements.txt') --no-build-isolation
Check 'Installing UniMate libraries'

# 6. The trained model from Hugging Face
Step 6 'Downloading the trained model'
& $py -c "from huggingface_hub import snapshot_download; snapshot_download('Linzhan/UniMate', local_dir=r'$Ckpt')"
Check 'Downloading the trained model'
$found = Get-ChildItem -Path $Ckpt -Recurse -Filter 'config.json' -ErrorAction SilentlyContinue
if (-not $found) { Write-Host 'Warning: no model config.json found in the download. The app will say so.' -ForegroundColor Yellow }

# 7. The app itself + desktop and Start menu shortcuts
Step 7 'Installing the app'
Copy-Item (Join-Path $PSScriptRoot 'studio.py') $Base -Force
$pyw = Join-Path $PyEnv 'pythonw.exe'
$shell = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'UniMate Studio.lnk'
foreach ($lnkPath in @((Join-Path $desk 'UniMate Studio.lnk'), $menu)) {
    $s = $shell.CreateShortcut($lnkPath)
    $s.TargetPath = $pyw
    $s.Arguments = '"' + (Join-Path $Base 'studio.py') + '"'
    $s.WorkingDirectory = $Base
    $s.IconLocation = "$pyw,0"
    $s.Description = 'Animate a rigged character from a text prompt'
    $s.Save()
}

Write-Host ''
Write-Host 'All done. Double-click "UniMate Studio" on your desktop to start.' -ForegroundColor Green
Stop-Transcript | Out-Null
