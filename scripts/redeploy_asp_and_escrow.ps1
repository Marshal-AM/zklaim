$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$drive = $Root.Substring(0, 1).ToLower()
$rest = $Root.Substring(3) -replace "\\", "/"
$WslRoot = "/mnt/$drive/$rest"
wsl bash -lc "cd '$WslRoot' && sed -i 's/\r$//' scripts/redeploy_asp_and_escrow.sh && bash scripts/redeploy_asp_and_escrow.sh testnet zklaim-deploy"
