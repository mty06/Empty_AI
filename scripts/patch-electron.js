#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'darwin') process.exit(0);

const appBundle = path.join(
  __dirname,
  '../node_modules/electron/dist/Electron.app'
);
const plistPath = path.join(appBundle, 'Contents/Info.plist');

if (!fs.existsSync(plistPath)) {
  console.log('[patch-electron] Info.plist not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(plistPath, 'utf8');

if (!content.includes('<key>LSUIElement</key>')) {
  content = content.replace(
    '<dict>',
    '<dict>\n\t<key>LSUIElement</key>\n\t<true/>'
  );
  fs.writeFileSync(plistPath, content, 'utf8');
  console.log('[patch-electron] Patched Info.plist: LSUIElement=true');
} else {
  console.log('[patch-electron] LSUIElement already present');
}

// Re-sign with ad-hoc identity so macOS respects the modified plist
try {
  execSync(
    `codesign --sign - --force --deep "${appBundle}"`,
    { stdio: 'pipe' }
  );
  console.log('[patch-electron] Re-signed Electron.app with ad-hoc signature');
} catch (err) {
  console.warn('[patch-electron] Re-sign failed:', err.message);
}
