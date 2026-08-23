#!/bin/bash
# gnome-extensions pack exits 0 even when it leaves out whole directories.
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

./pack.sh >/dev/null
zip=$(ls -t ./*.shell-extension.zip | head -1)
unzip -q -o "$zip" -d "$tmp"

fail=0
while read -r src; do
  while read -r imp; do
    resolved="$tmp/$(realpath -m --relative-to="$PWD" "$(dirname "$src")/$imp")"
    if [ ! -f "$resolved" ]; then
      echo "MISSING from bundle: $imp  (imported by $src)"
      fail=1
    fi
  done < <(grep -oE "from '(\.\.?/[^']+)'" "$src" | sed "s/from '//;s/'//")
done < <(find api lib models utils -name '*.js' 2>/dev/null; echo extension.js; echo settings.js)

for required in metadata.json stylesheet.css schemas; do
  [ -e "$tmp/$required" ] || { echo "MISSING from bundle: $required"; fail=1; }
done

rm -f "$zip"
[ "$fail" -eq 0 ] && echo "bundle complete" || echo "bundle INCOMPLETE"
exit "$fail"
