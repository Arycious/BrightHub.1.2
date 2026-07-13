// ==========================================
// Build Script — Production Build
// ==========================================
// 1. Builds Next.js (standalone output)
// 2. Compiles the custom server (TypeScript → JavaScript)
// 3. Copies native modules (better-sqlite3)
// 4. Creates a portable dist/ folder

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const DIST_SERVER = path.join(ROOT, 'dist-server');

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('╔═══════════════════════════════════════════╗');
console.log('║     🔨 BrightModHub — Production Build    ║');
console.log('╚═══════════════════════════════════════════╝');

// Step 1: Clean dist/ and dist-server/
console.log('\n[1/6] Cleaning dist/ and dist-server/...');
rmDir(DIST);
rmDir(DIST_SERVER);
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(DIST_SERVER, { recursive: true });

// Step 2: Build Next.js (standalone)
console.log('\n[2/6] Building Next.js (standalone)...');
run('npx next build');

// Step 3: Compile server TypeScript into dist-server/
console.log('\n[3/6] Compiling server...');
run('npx tsc --project tsconfig.server.json');

// Step 4: Assemble dist/
console.log('\n[4/6] Assembling dist/...');

// Copy standalone Next.js output
const standalonePath = path.join(ROOT, '.next', 'standalone');
if (fs.existsSync(standalonePath)) {
  copyDir(standalonePath, DIST);
}

// Copy static assets
const staticSrc = path.join(ROOT, '.next', 'static');
const staticDest = path.join(DIST, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
}

// Copy public/ folder
const publicSrc = path.join(ROOT, 'public');
const publicDest = path.join(DIST, 'public');
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
}

// Copy compiled custom server over the standalone server
if (fs.existsSync(DIST_SERVER)) {
  copyDir(DIST_SERVER, DIST);
}

// Copy all node_modules required at runtime
// Next.js standalone output misses some transitive dependencies; copying the
// full node_modules folder is the safest way to get a portable dist/.
const nodeModulesSrc = path.join(ROOT, 'node_modules');
const nodeModulesDest = path.join(DIST, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
  copyDir(nodeModulesSrc, nodeModulesDest);
}

// Ensure data directory exists (channels are created at runtime)
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'data', 'channels'), { recursive: true });

// Step 5: Create starter scripts
console.log('\n[5/6] Creating starter scripts...');

// Package.json for the dist
fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify({
  name: 'brightmodhub',
  version: '1.0.0',
  private: true,
  scripts: {
    start: 'node server.js',
  },
}, null, 2));

// Step 6: Clean up temporary dist-server/
console.log('\n[6/6] Cleaning up temporary dist-server/...');
rmDir(DIST_SERVER);

console.log('\n╔═══════════════════════════════════════════╗');
console.log('║     ✅ Build complete!                     ║');
console.log('║     Output: ./dist/                        ║');
console.log('╚═══════════════════════════════════════════╝');
console.log('\nTo run: cd dist && node server.js');
console.log('Or use: BrightModHub.bat --prod\n');
