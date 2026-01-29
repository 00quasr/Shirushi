// Test for web/static/main.css extraction
// Verifies CSS variables and base styles are properly extracted

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const staticDir = join(rootDir, 'web', 'static');

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

function assertFalse(value, message) {
  if (value) {
    throw new Error(message || 'Expected false but got true');
  }
}

function assertContains(content, substring, message) {
  if (!content.includes(substring)) {
    throw new Error(message || `Expected content to contain "${substring}"`);
  }
}

function assertNotContains(content, substring, message) {
  if (content.includes(substring)) {
    throw new Error(message || `Expected content to NOT contain "${substring}"`);
  }
}

console.log('\nweb/static/main.css Extraction Tests\n');

// Test 1: main.css file exists
test('main.css file exists', () => {
  const mainCssPath = join(staticDir, 'main.css');
  assertTrue(existsSync(mainCssPath), 'web/static/main.css should exist');
});

// Test 2: main.css contains CSS variables
test('main.css contains :root with CSS variables', () => {
  const mainCssPath = join(staticDir, 'main.css');
  const content = readFileSync(mainCssPath, 'utf-8');
  assertContains(content, ':root', 'main.css should contain :root selector');
});

// Test 3: main.css contains all color variables
test('main.css contains all color variables', () => {
  const mainCssPath = join(staticDir, 'main.css');
  const content = readFileSync(mainCssPath, 'utf-8');

  const requiredVariables = [
    '--bg-0',
    '--bg-1',
    '--bg-2',
    '--bg-3',
    '--bg-4',
    '--text-0',
    '--text-1',
    '--text-2',
    '--text-3',
    '--border',
    '--border-light',
    '--accent',
    '--success',
    '--error',
    '--warning',
  ];

  for (const variable of requiredVariables) {
    assertContains(content, variable, `main.css should contain ${variable}`);
  }
});

// Test 4: main.css contains base reset
test('main.css contains base reset (* selector)', () => {
  const mainCssPath = join(staticDir, 'main.css');
  const content = readFileSync(mainCssPath, 'utf-8');
  assertContains(content, 'box-sizing: border-box', 'main.css should contain box-sizing reset');
  assertContains(content, 'margin: 0', 'main.css should contain margin reset');
  assertContains(content, 'padding: 0', 'main.css should contain padding reset');
});

// Test 5: main.css contains body styles
test('main.css contains body styles', () => {
  const mainCssPath = join(staticDir, 'main.css');
  const content = readFileSync(mainCssPath, 'utf-8');
  assertContains(content, 'body {', 'main.css should contain body selector');
  assertContains(content, 'font-family', 'main.css should define font-family');
  assertContains(content, 'background', 'main.css should define background');
  assertContains(content, 'min-height: 100vh', 'main.css should define min-height');
});

// Test 6: main.css contains code/pre font styles
test('main.css contains code/pre font styles', () => {
  const mainCssPath = join(staticDir, 'main.css');
  const content = readFileSync(mainCssPath, 'utf-8');
  assertContains(content, 'code, pre', 'main.css should contain code, pre selector');
  assertContains(content, 'Geist Mono', 'main.css should use Geist Mono font');
});

// Test 7: style.css does NOT contain CSS variables anymore
test('style.css does not contain :root CSS variables', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertNotContains(content, ':root {', 'style.css should not contain :root selector');
});

// Test 8: style.css does NOT contain base reset
test('style.css does not contain base reset', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  // Check that the file doesn't start with * selector (base reset)
  const lines = content.trim().split('\n');
  const firstNonCommentLine = lines.find((line) => !line.trim().startsWith('/*') && !line.trim().startsWith('*') && line.trim().length > 0);
  assertFalse(
    firstNonCommentLine && firstNonCommentLine.trim().startsWith('* {'),
    'style.css should not start with * selector (base reset)'
  );
});

// Test 9: index.html includes main.css before style.css
test('index.html includes main.css before style.css', () => {
  const indexPath = join(rootDir, 'web', 'index.html');
  const content = readFileSync(indexPath, 'utf-8');
  assertContains(content, 'main.css', 'index.html should include main.css');
  assertContains(content, 'style.css', 'index.html should include style.css');

  const mainCssIndex = content.indexOf('main.css');
  const styleCssIndex = content.indexOf('style.css');
  assertTrue(mainCssIndex < styleCssIndex, 'main.css should be included before style.css');
});

// Test 10: style.css still contains component styles (not layout styles)
test('style.css still contains component styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertContains(content, '.btn', 'style.css should contain button styles');
  assertContains(content, '.relay-card', 'style.css should contain relay card styles');
  assertContains(content, '.input-group', 'style.css should contain input group styles');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
