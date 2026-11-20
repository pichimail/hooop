#!/bin/bash
set -eo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null; then echo "Install Node.js 24+ first: https://nodejs.org"; read -r -p "Press Enter to close"; exit 1; fi
export HOOOP_CLI="${HOOOP_CLI:-$HERE/../../MacOS/zigzag}"
exec node "$HERE/server.mjs"
