// Test for web/static/layout.css extraction
// Verifies layout styles (header, tabs, panels) are properly extracted

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

console.log('\nweb/static/layout.css Extraction Tests\n');

// Test 1: layout.css file exists
test('layout.css file exists', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  assertTrue(existsSync(layoutCssPath), 'web/static/layout.css should exist');
});

// Test 2: layout.css contains header styles
test('layout.css contains header styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, 'header {', 'layout.css should contain header selector');
  assertContains(content, '.logo {', 'layout.css should contain .logo selector');
  assertContains(content, '.logo-text {', 'layout.css should contain .logo-text selector');
  assertContains(content, '.logo-subtitle {', 'layout.css should contain .logo-subtitle selector');
  assertContains(content, '.status {', 'layout.css should contain .status selector');
  assertContains(content, '.status-dot', 'layout.css should contain .status-dot selector');
  assertContains(content, '.header-status-group', 'layout.css should contain .header-status-group selector');
});

// Test 3: layout.css contains extension status styles
test('layout.css contains extension status styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, '#extension-status', 'layout.css should contain #extension-status selector');
  assertContains(content, '#extension-status-dot', 'layout.css should contain #extension-status-dot selector');
});

// Test 4: layout.css contains tab styles
test('layout.css contains tab styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, '.tabs {', 'layout.css should contain .tabs selector');
  assertContains(content, '.tab {', 'layout.css should contain .tab selector');
  assertContains(content, '.tab:hover', 'layout.css should contain .tab:hover selector');
  assertContains(content, '.tab.active', 'layout.css should contain .tab.active selector');
  assertContains(content, '.tab-content', 'layout.css should contain .tab-content selector');
});

// Test 5: layout.css contains main content styles
test('layout.css contains main content styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, 'main {', 'layout.css should contain main selector');
  assertContains(content, 'max-width: 1400px', 'layout.css should set max-width');
  assertContains(content, '.hidden {', 'layout.css should contain .hidden class');
});

// Test 6: layout.css contains panel styles
test('layout.css contains panel styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, '.panel {', 'layout.css should contain .panel selector');
  assertContains(content, '.panel h2', 'layout.css should contain .panel h2 selector');
  assertContains(content, '.hint {', 'layout.css should contain .hint selector');
});

// Test 7: layout.css contains mobile navigation styles
test('layout.css contains mobile navigation styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, '.mobile-menu-btn', 'layout.css should contain .mobile-menu-btn selector');
  assertContains(content, '.hamburger-line', 'layout.css should contain .hamburger-line selector');
  assertContains(content, '.mobile-nav-overlay', 'layout.css should contain .mobile-nav-overlay selector');
});

// Test 8: layout.css contains responsive styles
test('layout.css contains responsive layout styles', () => {
  const layoutCssPath = join(staticDir, 'layout.css');
  const content = readFileSync(layoutCssPath, 'utf-8');
  assertContains(content, '@media (max-width: 768px)', 'layout.css should contain 768px media query');
  assertContains(content, '@media (max-width: 480px)', 'layout.css should contain 480px media query');
});

// Test 9: style.css does NOT contain header base styles
test('style.css does not contain header base styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  // Check that the header base styles are not present by matching the exact pattern
  // This regex looks for header { with display: flex immediately inside (base style)
  const headerBasePattern = /^header \{[\s\S]*?display: flex;[\s\S]*?justify-content: space-between;/m;
  if (headerBasePattern.test(content)) {
    throw new Error('style.css should not contain header base styles');
  }
});

// Test 10: style.css does NOT contain .tabs base styles
test('style.css does not contain .tabs base styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertNotContains(content, '.tabs {\n    display: flex;\n    gap: 4px;\n    padding: 12px 24px;',
    'style.css should not contain .tabs base styles');
});

// Test 11: style.css does NOT contain .panel base styles
test('style.css does not contain .panel base styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertNotContains(content, '.panel {\n    background: var(--bg-1);\n    border-radius: 8px;',
    'style.css should not contain .panel base styles');
});

// Test 12: style.css does NOT contain mobile-menu-btn base styles
test('style.css does not contain mobile-menu-btn base styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertNotContains(content, '.mobile-menu-btn {\n    display: none;',
    'style.css should not contain .mobile-menu-btn base styles');
});

// Test 13: index.html includes layout.css between main.css and style.css
test('index.html includes layout.css between main.css and style.css', () => {
  const indexPath = join(rootDir, 'web', 'index.html');
  const content = readFileSync(indexPath, 'utf-8');
  assertContains(content, 'layout.css', 'index.html should include layout.css');

  const mainCssIndex = content.indexOf('main.css');
  const layoutCssIndex = content.indexOf('layout.css');
  const styleCssIndex = content.indexOf('style.css');

  assertTrue(mainCssIndex < layoutCssIndex, 'main.css should be included before layout.css');
  assertTrue(layoutCssIndex < styleCssIndex, 'layout.css should be included before style.css');
});

// Test 14: style.css still contains component styles (buttons, inputs, etc.)
test('style.css still contains component styles', () => {
  const styleCssPath = join(staticDir, 'style.css');
  const content = readFileSync(styleCssPath, 'utf-8');
  assertContains(content, '.btn', 'style.css should contain button styles');
  assertContains(content, '.input-group', 'style.css should contain input group styles');
  assertContains(content, '.relay-card', 'style.css should contain relay card styles');
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
