// Test for vite.config.js
// Verifies the Vite configuration is correct and builds to web/dist/

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (error) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
}

console.log('\nVite Configuration Tests\n');

// Test 1: vite.config.js exists
test('vite.config.js exists', () => {
  const configPath = join(rootDir, 'vite.config.js');
  assertTrue(existsSync(configPath), 'vite.config.js should exist in project root');
});

// Test 2: Config exports correct structure
test('vite.config.js exports valid configuration', async () => {
  const { default: config } = await import(join(rootDir, 'vite.config.js'));
  assertTrue(typeof config === 'object', 'Config should be an object');
  assertEqual(config.root, 'web', 'Root should be set to "web"');
  assertTrue(config.build !== undefined, 'Build config should be defined');
  assertEqual(config.build.outDir, 'dist', 'Build outDir should be "dist"');
  assertEqual(config.build.emptyOutDir, true, 'emptyOutDir should be true');
});

// Test 3: Build produces output in correct directory
test('vite build outputs to web/dist/', () => {
  const distPath = join(rootDir, 'web', 'dist');

  // Clean up any existing dist directory
  if (existsSync(distPath)) {
    rmSync(distPath, { recursive: true });
  }

  // Run the build
  try {
    execSync('npm run build', { cwd: rootDir, stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }

  // Check that dist directory was created
  assertTrue(existsSync(distPath), 'web/dist/ directory should be created after build');

  // Check that index.html exists in dist
  const indexPath = join(distPath, 'index.html');
  assertTrue(existsSync(indexPath), 'web/dist/index.html should exist after build');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
