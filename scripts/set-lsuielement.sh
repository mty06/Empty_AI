#!/bin/bash

# Force set LSUIElement for the built app
APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
  echo "Usage: $0 /path/to/App.app"
  exit 1
fi

PLIST="$APP_PATH/Contents/Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "Error: Info.plist not found at $PLIST"
  exit 1
fi

# Use defaults write to force set LSUIElement
/usr/libexec/PlistBuddy -c "Delete :LSUIElement" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PLIST"

# Also set LSBackgroundOnly to ensure it's a background app
/usr/libexec/PlistBuddy -c "Delete :LSBackgroundOnly" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :LSBackgroundOnly bool false" "$PLIST"

echo "✅ LSUIElement forced for $APP_PATH"
