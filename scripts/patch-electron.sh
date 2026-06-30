#!/bin/sh
# Patches the dev Electron binary to set LSUIElement=true so the dock icon
# never appears during development (mirrors the production build's Info.plist).
PLIST="node_modules/electron/dist/Electron.app/Contents/Info.plist"

if [ "$(uname)" != "Darwin" ]; then
  exit 0
fi

if [ ! -f "$PLIST" ]; then
  exit 0
fi

CURRENT=$(/usr/libexec/PlistBuddy -c "Print :LSUIElement" "$PLIST" 2>/dev/null)
if [ "$CURRENT" != "true" ]; then
  /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$PLIST"
  echo "Patched Electron Info.plist: LSUIElement=true"
fi
