# Windows wrapper — runs testnet ASP/policy sync in WSL where zklaim-deploy lives.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$drive = $Root.Substring(0, 1).ToLower()
$rest = $Root.Substring(3) -replace "\\", "/"
$WslRoot = "/mnt/$drive/$rest"
wsl bash -lc "cd '$WslRoot' && bash scripts/sync_demo_testnet.sh testnet zklaim-deploy"
