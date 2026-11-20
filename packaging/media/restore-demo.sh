#!/usr/bin/env bash
# Restore the exact original optional 5.1 MB embroidery demonstration video.
set -euo pipefail
cd "$(dirname "$0")"
for p in skitch-pp1-demo.mp4.part01 skitch-pp1-demo.mp4.part02 skitch-pp1-demo.mp4.part03; do
  test -s "$p" || { echo "Missing $p" >&2; exit 1; }
done
cat skitch-pp1-demo.mp4.part0{1,2,3} > skitch-pp1-demo.mp4
echo 'Restored original skitch-pp1-demo.mp4'
