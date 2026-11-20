# Start after installing free Node.js 24+ from https://nodejs.org
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24+ is required for the Hooop Companion' }
$env:HOOOP_CLI = if ($env:HOOOP_CLI) { $env:HOOOP_CLI } else { Join-Path $PSScriptRoot '..\..\zigzag-cli.exe' }
node (Join-Path $PSScriptRoot 'server.mjs')
