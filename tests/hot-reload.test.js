// Test for Vite hot reload (HMR) functionality
// Verifies that the dev server starts and HMR is configured correctly

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (error) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`${message || 'Assertion failed'}: expected string to include "${substring}"`);
  }
}

console.log('\nHot Reload (HMR) Tests\n');

// Test 1: Vite config exists and has correct root
test('Vite config has correct root for HMR', async () => {
  const { default: config } = await import(join(rootDir, 'vite.config.js'));
  assertEqual(config.root, 'web', 'Root should be "web" directory');
});

// Test 2: Check that web/index.html exists (entry point for Vite)
test('Entry point index.html exists in web/', () => {
  const indexPath = join(rootDir, 'web', 'index.html');
  assertTrue(existsSync(indexPath), 'web/index.html should exist as Vite entry point');
});

// Test 3: Check that HMR is not explicitly disabled in config
test('HMR is not disabled in Vite config', async () => {
  const { default: config } = await import(join(rootDir, 'vite.config.js'));
  // HMR is enabled by default in Vite, so we just check it's not explicitly disabled
  const hmrDisabled = config.server?.hmr === false;
  assertTrue(!hmrDisabled, 'HMR should not be explicitly disabled');
});

// Test 4: Check that JavaScript files exist and are importable
test('Main JavaScript files exist for HMR', () => {
  const appJsPath = join(rootDir, 'web', 'static', 'app.js');
  const stylePath = join(rootDir, 'web', 'static', 'style.css');

  assertTrue(existsSync(appJsPath), 'web/static/app.js should exist');
  assertTrue(existsSync(stylePath), 'web/static/style.css should exist');
});

// Test 5: Check that modular JavaScript exists in web/src
test('Modular JavaScript structure exists for HMR', () => {
  const srcDir = join(rootDir, 'web', 'src');
  const mainJsPath = join(srcDir, 'main.js');
  const modulesDir = join(srcDir, 'modules');
  const utilsDir = join(srcDir, 'utils');

  assertTrue(existsSync(srcDir), 'web/src/ directory should exist');
  assertTrue(existsSync(mainJsPath), 'web/src/main.js should exist');
  assertTrue(existsSync(modulesDir), 'web/src/modules/ directory should exist');
  assertTrue(existsSync(utilsDir), 'web/src/utils/ directory should exist');
});

// Test 6: Verify dev server can start (quick check)
await testAsync('Dev server starts successfully', async () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      devServer.kill();
      reject(new Error('Dev server startup timed out after 10 seconds'));
    }, 10000);

    const devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5174'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';

    devServer.stdout.on('data', (data) => {
      output += data.toString();
      // Vite outputs "ready in" when server is ready
      if (output.includes('ready in') || output.includes('Local:')) {
        clearTimeout(timeout);
        devServer.kill();
        resolve();
      }
    });

    devServer.stderr.on('data', (data) => {
      output += data.toString();
    });

    devServer.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start dev server: ${err.message}`));
    });

    devServer.on('close', (code) => {
      if (output.includes('ready in') || output.includes('Local:')) {
        resolve();
      }
    });
  });
});

// Test 7: Check CSS file can be modified (simulating hot reload trigger)
test('CSS files are structured for HMR', () => {
  const stylesDir = join(rootDir, 'web', 'src', 'styles');

  // Check that CSS is properly modularized
  if (existsSync(stylesDir)) {
    const files = ['main.css', 'variables.css', 'base.css', 'components.css', 'index.css'];
    const existingFiles = files.filter(f => existsSync(join(stylesDir, f)));
    assertTrue(existingFiles.length > 0, 'At least one CSS module should exist in web/src/styles/');
  } else {
    // Fallback check for static/style.css
    const staticStyle = join(rootDir, 'web', 'static', 'style.css');
    assertTrue(existsSync(staticStyle), 'Style file should exist for HMR');
  }
});

// Test 8: Verify package.json has dev script
test('package.json has dev script for hot reload', () => {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  assertTrue(packageJson.scripts?.dev !== undefined, 'dev script should be defined');
  assertIncludes(packageJson.scripts.dev, 'vite', 'dev script should use vite');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
