const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const extensionDir = path.resolve(__dirname, '../extension');
const distDir = path.resolve(__dirname, '../dist-extension');

console.log('====================================================');
console.log('🔍 Validating Chrome Extension for Chrome Web Store');
console.log('====================================================');

// 1. Validate manifest.json
const manifestPath = path.join(extensionDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Error: manifest.json not found in', extensionDir);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Checks
if (manifest.manifest_version !== 3) {
  console.error('❌ Manifest version must be 3, found:', manifest.manifest_version);
  process.exit(1);
}

const requiredIcons = ['16', '32', '48', '128'];
for (const size of requiredIcons) {
  const iconRel = manifest.icons?.[size];
  if (!iconRel || !fs.existsSync(path.join(extensionDir, iconRel))) {
    console.error(`❌ Missing icon ${size}px: ${iconRel}`);
    process.exit(1);
  }
}

// Check host_permissions for localhost
const hostPerms = manifest.host_permissions || [];
for (const perm of hostPerms) {
  if (perm.includes('localhost') || perm.includes('127.0.0.1')) {
    console.error('❌ Chrome Web Store violation: localhost found in required host_permissions:', perm);
    process.exit(1);
  }
}

console.log('✅ manifest.json: MV3 compliant, icons present, zero forbidden host permissions.');

// 2. Validate background service worker
const bgFile = path.join(extensionDir, manifest.background?.service_worker || 'background.js');
if (!fs.existsSync(bgFile)) {
  console.error('❌ Service worker file missing:', bgFile);
  process.exit(1);
}
const bgCode = fs.readFileSync(bgFile, 'utf8');
if (/\b(window|document)\b/.test(bgCode)) {
  console.error('❌ Chrome MV3 violation: window or document referenced in service worker.');
  process.exit(1);
}
if (/eval\(|new Function\(/.test(bgCode)) {
  console.error('❌ Chrome Web Store violation: eval or Function constructor detected.');
  process.exit(1);
}
console.log('✅ Service worker: Clean, zero window/document access, zero eval/dynamic code.');

// 3. Create zip bundle
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipFilename = `inventkid-page-replicator-v${manifest.version}.zip`;
const zipPath = path.join(distDir, zipFilename);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKb = (archive.pointer() / 1024).toFixed(2);
  console.log('====================================================');
  console.log(`🎉 SUCCESS: Extension packaged for Chrome Web Store!`);
  console.log(`📦 File: ${zipPath} (${sizeKb} KB)`);
  console.log(`🚀 Ready to upload to Chrome Web Store Developer Dashboard!`);
  console.log('====================================================');
});

archive.on('error', (err) => {
  console.error('❌ Archiving error:', err);
  process.exit(1);
});

archive.pipe(output);

// Files to include
const filesToPack = [
  'manifest.json',
  'background.js',
  'content/picker.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'options/options.html',
  'options/options.js',
  'options/options.css',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

for (const relFile of filesToPack) {
  const absPath = path.join(extensionDir, relFile);
  if (fs.existsSync(absPath)) {
    archive.file(absPath, { name: relFile });
  } else {
    console.warn(`⚠️ Warning: Expected file not found: ${relFile}`);
  }
}

archive.finalize();
