#!/usr/bin/env bash
# Re-copy the SDK's Needle templates into this sample's scripts folder.
#
# Four of the files in Needle/WebScene/src/scripts are NOT sample code — they ship with
# @multisetai/vps and are copied into every project that uses it. They are checked in here so the
# sample is clone-and-run, which means they can silently fall behind the installed package.
#
# Run this after upgrading @multisetai/vps. It only touches SDK-owned files; the sample's own
# scripts are never overwritten.
#
#   ./sync-sdk-templates.sh

set -euo pipefail

WEB="$(cd "$(dirname "$0")" && pwd)/Needle/WebScene"
SRC="$WEB/node_modules/@multisetai/vps/templates"
DEST="$WEB/src/scripts"

if [ ! -d "$SRC" ]; then
  echo "error: @multisetai/vps is not installed in $WEB" >&2
  echo "       run: cd Needle/WebScene && npm install" >&2
  exit 1
fi

# SDK-owned. Anything not in this list belongs to the sample and is left alone.
TEMPLATES=(MultisetVPS.ts MapSpace.ts MapAnchor.ts MapType.ts)

changed=0
for f in "${TEMPLATES[@]}"; do
  if [ ! -f "$SRC/$f" ]; then
    echo "  SKIP $f — not in this version of the package (removed upstream?)"
    continue
  fi
  if [ -f "$DEST/$f" ] && cmp -s "$SRC/$f" "$DEST/$f"; then
    echo "  ok   $f"
  else
    cp "$SRC/$f" "$DEST/$f"
    echo "  SYNC $f"
    changed=$((changed + 1))
  fi
done

# MapType.cs lives in Assets/, not the web project — Unity reads it for the Inspector dropdown.
ASSETS="$(cd "$(dirname "$0")" && pwd)/Assets"
if [ -f "$SRC/MapType.cs" ]; then
  if cmp -s "$SRC/MapType.cs" "$ASSETS/MapType.cs" 2>/dev/null; then
    echo "  ok   MapType.cs (Assets/)"
  else
    cp "$SRC/MapType.cs" "$ASSETS/MapType.cs"
    echo "  SYNC MapType.cs (Assets/)"
    changed=$((changed + 1))
  fi
fi

echo
if [ "$changed" -eq 0 ]; then
  echo "Up to date with $(node -p "require('$WEB/node_modules/@multisetai/vps/package.json').version")."
else
  echo "Synced $changed file(s) from @multisetai/vps@$(node -p "require('$WEB/node_modules/@multisetai/vps/package.json').version")."
  echo "Review the diff before committing — these are files you may have customised."
fi
