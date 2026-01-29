// Test for web/src/ directory structure
// Verifies all modules and utilities are properly structured

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'web', 'src');

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

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
}

function assertContains(content, substring, message) {
  if (!content.includes(substring)) {
    throw new Error(message || `Expected content to contain "${substring}"`);
  }
}

console.log('\nweb/src/ Directory Structure Tests\n');

// Test 1: src directory exists
test('web/src/ directory exists', () => {
  assertTrue(existsSync(srcDir), 'web/src/ directory should exist');
});

// Test 2: main.js entry point exists
test('main.js entry point exists', () => {
  const mainPath = join(srcDir, 'main.js');
  assertTrue(existsSync(mainPath), 'web/src/main.js should exist');
});

// Test 3: modules directory exists with all required files
test('modules/ directory has all required files', () => {
  const modulesDir = join(srcDir, 'modules');
  assertTrue(existsSync(modulesDir), 'web/src/modules/ should exist');

  const requiredModules = [
    'index.js',
    'websocket.js',
    'tabs.js',
    'relays.js',
    'explorer.js',
    'events.js',
    'publish.js',
    'testing.js',
    'keys.js',
    'console.js',
    'monitoring.js',
  ];

  for (const module of requiredModules) {
    const modulePath = join(modulesDir, module);
    assertTrue(existsSync(modulePath), `modules/${module} should exist`);
  }
});

// Test 4: utils directory exists with all required files
test('utils/ directory has all required files', () => {
  const utilsDir = join(srcDir, 'utils');
  assertTrue(existsSync(utilsDir), 'web/src/utils/ should exist');

  const requiredUtils = ['index.js', 'dom.js', 'api.js', 'toast.js', 'modal.js', 'format.js'];

  for (const util of requiredUtils) {
    const utilPath = join(utilsDir, util);
    assertTrue(existsSync(utilPath), `utils/${util} should exist`);
  }
});

// Test 5: styles directory exists with all required files
test('styles/ directory has all required files', () => {
  const stylesDir = join(srcDir, 'styles');
  assertTrue(existsSync(stylesDir), 'web/src/styles/ should exist');

  const requiredStyles = ['index.css', 'main.css', 'variables.css', 'base.css', 'components.css'];

  for (const style of requiredStyles) {
    const stylePath = join(stylesDir, style);
    assertTrue(existsSync(stylePath), `styles/${style} should exist`);
  }
});

// Test 6: main.js imports all modules
test('main.js imports all modules', () => {
  const mainPath = join(srcDir, 'main.js');
  const content = readFileSync(mainPath, 'utf-8');

  const requiredImports = [
    'WebSocketManager',
    'TabManager',
    'RelayManager',
    'ProfileExplorer',
    'EventStream',
    'EventPublisher',
    'NIPTester',
    'KeyManager',
    'NakConsole',
    'MonitoringDashboard',
  ];

  for (const importName of requiredImports) {
    assertContains(content, importName, `main.js should import ${importName}`);
  }
});

// Test 7: main.js imports utilities
test('main.js imports utilities', () => {
  const mainPath = join(srcDir, 'main.js');
  const content = readFileSync(mainPath, 'utf-8');

  const requiredImports = ['api', 'toast', 'modal', 'format', 'dom.js'];

  for (const importName of requiredImports) {
    assertContains(content, importName, `main.js should import ${importName}`);
  }
});

// Test 8: main.js exports Shirushi class
test('main.js exports Shirushi class', () => {
  const mainPath = join(srcDir, 'main.js');
  const content = readFileSync(mainPath, 'utf-8');

  assertContains(content, 'export class Shirushi', 'main.js should export Shirushi class');
  assertContains(content, 'export default Shirushi', 'main.js should have default export');
});

// Test 9: modules/index.js re-exports all modules
test('modules/index.js re-exports all modules', () => {
  const indexPath = join(srcDir, 'modules', 'index.js');
  const content = readFileSync(indexPath, 'utf-8');

  const requiredExports = [
    'WebSocketManager',
    'TabManager',
    'RelayManager',
    'ProfileExplorer',
    'EventStream',
    'EventPublisher',
    'NIPTester',
    'KeyManager',
    'NakConsole',
    'MonitoringDashboard',
  ];

  for (const exportName of requiredExports) {
    assertContains(content, exportName, `modules/index.js should export ${exportName}`);
  }
});

// Test 10: utils/index.js re-exports all utilities
test('utils/index.js re-exports utilities', () => {
  const indexPath = join(srcDir, 'utils', 'index.js');
  const content = readFileSync(indexPath, 'utf-8');

  const requiredExports = ['dom.js', 'api.js', 'toast', 'modal', 'format.js'];

  for (const exportName of requiredExports) {
    assertContains(content, exportName, `utils/index.js should export ${exportName}`);
  }
});

// Test 11: CSS variables are defined
test('variables.css defines CSS custom properties', () => {
  const variablesPath = join(srcDir, 'styles', 'variables.css');
  const content = readFileSync(variablesPath, 'utf-8');

  const requiredVariables = ['--bg-0', '--text-0', '--accent', '--border', '--font-sans', '--font-mono'];

  for (const variable of requiredVariables) {
    assertContains(content, variable, `variables.css should define ${variable}`);
  }
});

// Test 12: Each module exports a class
test('each module exports a class', () => {
  const modules = [
    { file: 'websocket.js', className: 'WebSocketManager' },
    { file: 'tabs.js', className: 'TabManager' },
    { file: 'relays.js', className: 'RelayManager' },
    { file: 'explorer.js', className: 'ProfileExplorer' },
    { file: 'events.js', className: 'EventStream' },
    { file: 'publish.js', className: 'EventPublisher' },
    { file: 'testing.js', className: 'NIPTester' },
    { file: 'keys.js', className: 'KeyManager' },
    { file: 'console.js', className: 'NakConsole' },
    { file: 'monitoring.js', className: 'MonitoringDashboard' },
  ];

  for (const { file, className } of modules) {
    const modulePath = join(srcDir, 'modules', file);
    const content = readFileSync(modulePath, 'utf-8');
    assertContains(content, `export class ${className}`, `${file} should export ${className}`);
    assertContains(content, `export default ${className}`, `${file} should have default export`);
  }
});

// Test 13: API utility exports request functions
test('api.js exports request functions', () => {
  const apiPath = join(srcDir, 'utils', 'api.js');
  const content = readFileSync(apiPath, 'utf-8');

  assertContains(content, 'export async function request', 'api.js should export request function');
  assertContains(content, 'export async function get', 'api.js should export get function');
  assertContains(content, 'export async function post', 'api.js should export post function');
  assertContains(content, 'export class APIError', 'api.js should export APIError class');
});

// Test 14: DOM utility exports helper functions
test('dom.js exports helper functions', () => {
  const domPath = join(srcDir, 'utils', 'dom.js');
  const content = readFileSync(domPath, 'utf-8');

  assertContains(content, 'export function $', 'dom.js should export $ function');
  assertContains(content, 'export function $$', 'dom.js should export $$ function');
  assertContains(content, 'export function createElement', 'dom.js should export createElement function');
  assertContains(content, 'export function delegate', 'dom.js should export delegate function');
});

// Test 15: Toast utility exports notification functions
test('toast.js exports notification functions', () => {
  const toastPath = join(srcDir, 'utils', 'toast.js');
  const content = readFileSync(toastPath, 'utf-8');

  assertContains(content, 'export function show', 'toast.js should export show function');
  assertContains(content, 'export function success', 'toast.js should export success function');
  assertContains(content, 'export function error', 'toast.js should export error function');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
