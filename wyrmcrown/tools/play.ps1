param([int]$Port = 0)
$ErrorActionPreference = 'Stop'
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
$pythonPath = if ($pythonCommand -and $pythonCommand.Source -notlike '*WindowsApps*') { $pythonCommand.Source } else { Join-Path $env:USERPROFILE 'miniconda3\python.exe' }
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) { throw 'Python 3 is needed to start the game. Install Python or add your existing Python to PATH.' }
# Port 0 selects a free port, so an older copy cannot be opened accidentally.
$serverScript = Join-Path $PSScriptRoot 'serve.py'
& $pythonPath -u $serverScript --port $Port --open
