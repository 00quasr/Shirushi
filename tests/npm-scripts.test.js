// Test for npm scripts: dev, build, preview
// Verifies the package.json has the correct npm scripts configured

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
}

console.log('\nNPM Scripts Tests\n');

// Load package.json
const packageJsonPath = join(rootDir, 'package.json');
let packageJson;

test('package.json exists', () => {
  assertTrue(existsSync(packageJsonPath), 'package.json should exist in project root');
  const content = readFileSync(packageJsonPath, 'utf-8');
  packageJson = JSON.parse(content);
});

test('package.json has scripts object', () => {
  assertTrue(packageJson.scripts !== undefined, 'scripts should be defined in package.json');
  assertTrue(typeof packageJson.scripts === 'object', 'scripts should be an object');
});

test('dev script is configured correctly', () => {
  assertTrue(packageJson.scripts.dev !== undefined, 'dev script should be defined');
  assertEqual(packageJson.scripts.dev, 'vite', 'dev script should run "vite"');
});

test('build script is configured correctly', () => {
  assertTrue(packageJson.scripts.build !== undefined, 'build script should be defined');
  assertEqual(packageJson.scripts.build, 'vite build', 'build script should run "vite build"');
});

test('preview script is configured correctly', () => {
  assertTrue(packageJson.scripts.preview !== undefined, 'preview script should be defined');
  assertEqual(packageJson.scripts.preview, 'vite preview', 'preview script should run "vite preview"');
});

test('vite is listed as a devDependency', () => {
  assertTrue(packageJson.devDependencies !== undefined, 'devDependencies should be defined');
  assertTrue(packageJson.devDependencies.vite !== undefined, 'vite should be a devDependency');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
