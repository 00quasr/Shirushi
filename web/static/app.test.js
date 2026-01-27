// Shirushi - App.js Tests
// Simple test suite for the exploreProfile feature

(function() {
    'use strict';

    // Test framework
    const tests = [];
    let passed = 0;
    let failed = 0;

    function describe(name, fn) {
        console.log(`\n--- ${name} ---`);
        fn();
    }

    function it(name, fn) {
        tests.push({ name, fn });
    }

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

    function assertDefined(value, message) {
        if (value === undefined || value === null) {
            throw new Error(message || 'Expected value to be defined');
        }
    }

    async function runTests() {
        console.log('Running Shirushi App Tests...\n');

        for (const test of tests) {
            try {
                await test.fn();
                console.log(`  ✓ ${test.name}`);
                passed++;
            } catch (error) {
                console.error(`  ✗ ${test.name}`);
                console.error(`    ${error.message}`);
                failed++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Results: ${passed} passed, ${failed} failed`);
        console.log(`========================================\n`);

        return { passed, failed };
    }

    // Mock fetch for testing
    let mockFetchResponse = null;
    let mockFetchError = null;
    let lastFetchUrl = null;
    let lastFetchOptions = null;

    const originalFetch = window.fetch;

    function mockFetch(url, options) {
        lastFetchUrl = url;
        lastFetchOptions = options;

        if (mockFetchError) {
            return Promise.reject(mockFetchError);
        }

        return Promise.resolve({
            ok: mockFetchResponse.ok !== undefined ? mockFetchResponse.ok : true,
            status: mockFetchResponse.status || 200,
            json: () => Promise.resolve(mockFetchResponse.data)
        });
    }

    function setMockFetch(response, error = null) {
        mockFetchResponse = response;
        mockFetchError = error;
        window.fetch = mockFetch;
    }

    function restoreFetch() {
        window.fetch = originalFetch;
        mockFetchResponse = null;
        mockFetchError = null;
        lastFetchUrl = null;
        lastFetchOptions = null;
    }

    // Mock DOM elements
    function createMockDOM() {
        // Create a container for test elements
        const container = document.createElement('div');
        container.id = 'test-container';
        container.innerHTML = `
            <input type="text" id="profile-search" value="">
            <div id="profile-card" class="hidden"></div>
            <div id="profile-content" class="hidden">
                <div id="profile-notes-tab" class="profile-tab-content active"></div>
                <div id="profile-following-tab" class="profile-tab-content"></div>
                <div id="profile-zaps-tab" class="profile-tab-content"></div>
            </div>
            <div id="profile-notes-list"></div>
            <div id="profile-following-list"></div>
            <div id="profile-zaps-list"></div>
            <div id="profile-follow-count">0</div>
            <div id="zap-total-count">0</div>
            <div id="zap-total-sats">0</div>
            <div id="zap-avg-sats">0</div>
            <div id="zap-top-zap">0</div>
            <button id="explore-profile-btn"></button>
            <button class="profile-tab" data-profile-tab="notes"></button>
            <button class="profile-tab" data-profile-tab="following"></button>
            <button class="profile-tab" data-profile-tab="zaps"></button>
        `;
        document.body.appendChild(container);
        return container;
    }

    function removeMockDOM(container) {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }

    // Test Data
    const testProfile = {
        pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        name: 'testuser',
        display_name: 'Test User',
        about: 'A test profile',
        picture: 'https://example.com/avatar.png',
        banner: 'https://example.com/banner.jpg',
        website: 'https://example.com',
        nip05: 'test@example.com',
        lud16: 'test@getalby.com',
        follow_count: 42,
        created_at: 1700000000
    };

    const testNotes = [
        {
            id: 'note1abc',
            kind: 1,
            pubkey: testProfile.pubkey,
            content: 'Hello Nostr!',
            created_at: 1700000100
        },
        {
            id: 'note2def',
            kind: 1,
            pubkey: testProfile.pubkey,
            content: 'Another note',
            created_at: 1700000200
        }
    ];

    const testContactList = {
        id: 'contact123',
        kind: 3,
        pubkey: testProfile.pubkey,
        content: '',
        tags: [
            ['p', 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234', 'wss://relay.example.com', 'alice'],
            ['p', 'efgh5678efgh5678efgh5678efgh5678efgh5678efgh5678efgh5678efgh5678', '', 'bob']
        ],
        created_at: 1700000000
    };

    // Tests
    describe('Shirushi Class', () => {
        it('should have exploreProfile method', () => {
            assertDefined(Shirushi.prototype.exploreProfile, 'exploreProfile method should exist');
        });

        it('should have setupExplorer method', () => {
            assertDefined(Shirushi.prototype.setupExplorer, 'setupExplorer method should exist');
        });

        it('should have renderProfile method', () => {
            assertDefined(Shirushi.prototype.renderProfile, 'renderProfile method should exist');
        });

        it('should have switchProfileTab method', () => {
            assertDefined(Shirushi.prototype.switchProfileTab, 'switchProfileTab method should exist');
        });

        it('should have loadProfileNotes method', () => {
            assertDefined(Shirushi.prototype.loadProfileNotes, 'loadProfileNotes method should exist');
        });

        it('should have loadProfileFollowing method', () => {
            assertDefined(Shirushi.prototype.loadProfileFollowing, 'loadProfileFollowing method should exist');
        });

        it('should have loadProfileZaps method', () => {
            assertDefined(Shirushi.prototype.loadProfileZaps, 'loadProfileZaps method should exist');
        });

        it('should have exploreProfileByPubkey method', () => {
            assertDefined(Shirushi.prototype.exploreProfileByPubkey, 'exploreProfileByPubkey method should exist');
        });

        it('should initialize currentProfile as null', () => {
            // Check that the constructor initializes currentProfile
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {}; // Temporarily disable init

            const instance = new Shirushi();
            assertEqual(instance.currentProfile, null, 'currentProfile should be initialized to null');

            Shirushi.prototype.init = originalInit; // Restore init
        });
    });

    describe('exploreProfile', () => {
        let container;

        it('should not make API call when input is empty', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;

            document.getElementById('profile-search').value = '';
            await instance.exploreProfile();

            assertEqual(lastFetchUrl, null, 'No API call should be made for empty input');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should call API with encoded pubkey', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.renderProfile = function() {};
            instance.loadProfileNotes = function() {};

            const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            document.getElementById('profile-search').value = testPubkey;

            await instance.exploreProfile();

            assertTrue(
                lastFetchUrl.includes('/api/profile/'),
                'API call should be to /api/profile/ endpoint'
            );
            assertTrue(
                lastFetchUrl.includes(testPubkey),
                'API call should include the pubkey'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should handle API errors gracefully', async () => {
            container = createMockDOM();
            setMockFetch({ ok: false, status: 404, data: { error: 'profile not found' } });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;

            document.getElementById('profile-search').value = testProfile.pubkey;
            await instance.exploreProfile();

            const profileCard = document.getElementById('profile-card');
            assertTrue(
                profileCard.innerHTML.includes('profile not found') || profileCard.innerHTML.includes('error'),
                'Error message should be displayed'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should store profile in currentProfile after successful load', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.renderProfile = function() {};
            instance.loadProfileNotes = function() {};

            document.getElementById('profile-search').value = testProfile.pubkey;
            await instance.exploreProfile();

            assertEqual(instance.currentProfile.pubkey, testProfile.pubkey, 'currentProfile should be set');
            assertEqual(instance.currentProfile.name, testProfile.name, 'currentProfile name should match');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should show profile content section after successful load', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.renderProfile = function() {};
            instance.loadProfileNotes = function() {};

            document.getElementById('profile-search').value = testProfile.pubkey;
            await instance.exploreProfile();

            const profileContent = document.getElementById('profile-content');
            assertFalse(
                profileContent.classList.contains('hidden'),
                'Profile content section should be visible'
            );

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('loadProfileNotes', () => {
        let container;

        it('should fetch notes for given pubkey', async () => {
            container = createMockDOM();
            setMockFetch({ data: testNotes });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;

            await instance.loadProfileNotes(testProfile.pubkey);

            assertTrue(
                lastFetchUrl.includes('/api/events'),
                'Should call events API'
            );
            assertTrue(
                lastFetchUrl.includes('kind=1'),
                'Should request kind 1 (notes)'
            );
            assertTrue(
                lastFetchUrl.includes(`author=${testProfile.pubkey}`),
                'Should filter by author pubkey'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should display notes in container', async () => {
            container = createMockDOM();
            setMockFetch({ data: testNotes });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;

            await instance.loadProfileNotes(testProfile.pubkey);

            const notesList = document.getElementById('profile-notes-list');
            assertTrue(
                notesList.innerHTML.includes('Hello Nostr!'),
                'Notes should display content'
            );
            assertTrue(
                notesList.innerHTML.includes('Another note'),
                'All notes should be displayed'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should show hint when no notes found', async () => {
            container = createMockDOM();
            setMockFetch({ data: [] });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;

            await instance.loadProfileNotes(testProfile.pubkey);

            const notesList = document.getElementById('profile-notes-list');
            assertTrue(
                notesList.innerHTML.includes('No notes found'),
                'Should display "No notes found" hint'
            );

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('loadProfileFollowing', () => {
        let container;

        it('should fetch contact list for given pubkey', async () => {
            container = createMockDOM();
            setMockFetch({ data: [testContactList] });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;

            await instance.loadProfileFollowing(testProfile.pubkey);

            assertTrue(
                lastFetchUrl.includes('/api/events'),
                'Should call events API'
            );
            assertTrue(
                lastFetchUrl.includes('kind=3'),
                'Should request kind 3 (contact list)'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should parse follows from tags', async () => {
            container = createMockDOM();
            setMockFetch({ data: [testContactList] });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;

            await instance.loadProfileFollowing(testProfile.pubkey);

            const followingList = document.getElementById('profile-following-list');
            assertTrue(
                followingList.innerHTML.includes('abcd1234'),
                'Should display followed pubkeys'
            );
            assertTrue(
                followingList.innerHTML.includes('alice'),
                'Should display petnames'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should update follow count', async () => {
            container = createMockDOM();
            setMockFetch({ data: [testContactList] });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;

            await instance.loadProfileFollowing(testProfile.pubkey);

            const followCount = document.getElementById('profile-follow-count');
            assertEqual(followCount.textContent, '2', 'Follow count should be updated');

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('loadProfileZaps', () => {
        let container;

        it('should fetch zap receipts', async () => {
            container = createMockDOM();
            setMockFetch({ data: [] });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;

            await instance.loadProfileZaps(testProfile.pubkey);

            assertTrue(
                lastFetchUrl.includes('/api/events'),
                'Should call events API'
            );
            assertTrue(
                lastFetchUrl.includes('kind=9735'),
                'Should request kind 9735 (zap receipts)'
            );

            restoreFetch();
            removeMockDOM(container);
        });

        it('should update zap stats', async () => {
            container = createMockDOM();

            const zapReceipts = [
                {
                    id: 'zap1',
                    kind: 9735,
                    pubkey: 'zapperPubkey',
                    content: '',
                    tags: [
                        ['p', testProfile.pubkey],
                        ['description', JSON.stringify({ amount: 1000000, pubkey: 'sender1' })] // 1000 sats
                    ],
                    created_at: 1700000100
                },
                {
                    id: 'zap2',
                    kind: 9735,
                    pubkey: 'zapperPubkey',
                    content: '',
                    tags: [
                        ['p', testProfile.pubkey],
                        ['description', JSON.stringify({ amount: 2000000, pubkey: 'sender2' })] // 2000 sats
                    ],
                    created_at: 1700000200
                }
            ];

            setMockFetch({ data: zapReceipts });

            const instance = Object.create(Shirushi.prototype);
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;

            await instance.loadProfileZaps(testProfile.pubkey);

            assertEqual(
                document.getElementById('zap-total-count').textContent,
                '2',
                'Total zap count should be 2'
            );
            assertEqual(
                document.getElementById('zap-total-sats').textContent,
                '3,000',
                'Total sats should be 3000'
            );

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('exploreProfileByPubkey', () => {
        let container;

        it('should set search input and call exploreProfile', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            let exploreProfileCalled = false;
            const instance = Object.create(Shirushi.prototype);
            instance.exploreProfile = function() {
                exploreProfileCalled = true;
            };

            const newPubkey = 'newpubkey1234567890abcdef1234567890abcdef1234567890abcdef1234';
            instance.exploreProfileByPubkey(newPubkey);

            assertEqual(
                document.getElementById('profile-search').value,
                newPubkey,
                'Search input should be set to new pubkey'
            );
            assertTrue(exploreProfileCalled, 'exploreProfile should be called');

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('renderProfile', () => {
        let container;

        function createProfileMockDOM() {
            const el = document.createElement('div');
            el.id = 'profile-test-container';
            el.innerHTML = `
                <div id="profile-card" class="hidden">
                    <div id="profile-banner" class="profile-banner"></div>
                    <div class="profile-header">
                        <div id="profile-avatar" class="profile-avatar"></div>
                        <div class="profile-info">
                            <div class="profile-name-row">
                                <span id="profile-display-name" class="profile-display-name"></span>
                                <span id="profile-nip05-badge" class="nip05-badge hidden">
                                    <span class="nip05-icon">✓</span>
                                    <span id="profile-nip05"></span>
                                </span>
                            </div>
                            <span id="profile-name" class="profile-username"></span>
                            <span id="profile-pubkey" class="profile-pubkey"></span>
                        </div>
                        <div class="profile-actions">
                            <button class="btn small" id="copy-npub-btn">Copy npub</button>
                        </div>
                    </div>
                    <div class="profile-body">
                        <p id="profile-about" class="profile-about"></p>
                        <div class="profile-links">
                            <a id="profile-website" class="profile-link hidden" target="_blank">
                                <span class="link-icon">🌐</span>
                                <span class="link-text"></span>
                            </a>
                            <span id="profile-lightning" class="profile-link hidden">
                                <span class="link-icon">⚡</span>
                                <span class="link-text"></span>
                            </span>
                        </div>
                        <div class="profile-stats">
                            <div class="stat">
                                <span id="profile-follow-count" class="stat-value">0</span>
                                <span class="stat-label">Following</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(el);
            return el;
        }

        it('should render profile display name', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const displayName = document.getElementById('profile-display-name');
            assertEqual(displayName.textContent, 'Test User', 'Display name should be rendered');

            removeMockDOM(container);
        });

        it('should render username with @ prefix', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const username = document.getElementById('profile-name');
            assertEqual(username.textContent, '@testuser', 'Username should have @ prefix');

            removeMockDOM(container);
        });

        it('should render shortened pubkey', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const pubkeyEl = document.getElementById('profile-pubkey');
            assertTrue(
                pubkeyEl.textContent.includes('...'),
                'Pubkey should be shortened with ellipsis'
            );
            assertTrue(
                pubkeyEl.textContent.includes('12345678'),
                'Pubkey should show first 8 chars'
            );

            removeMockDOM(container);
        });

        it('should show NIP-05 badge when nip05 is present', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const badge = document.getElementById('profile-nip05-badge');
            assertFalse(badge.classList.contains('hidden'), 'NIP-05 badge should be visible');

            const nip05Text = document.getElementById('profile-nip05');
            assertEqual(nip05Text.textContent, 'test@example.com', 'NIP-05 address should be displayed');

            removeMockDOM(container);
        });

        it('should hide NIP-05 badge when nip05 is not present', () => {
            container = createProfileMockDOM();

            const profileWithoutNip05 = { ...testProfile, nip05: null };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(profileWithoutNip05);

            const badge = document.getElementById('profile-nip05-badge');
            assertTrue(badge.classList.contains('hidden'), 'NIP-05 badge should be hidden');

            removeMockDOM(container);
        });

        it('should render about text', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const about = document.getElementById('profile-about');
            assertEqual(about.textContent, 'A test profile', 'About text should be rendered');

            removeMockDOM(container);
        });

        it('should show website link when present', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const websiteEl = document.getElementById('profile-website');
            assertFalse(websiteEl.classList.contains('hidden'), 'Website should be visible');
            assertEqual(websiteEl.href, 'https://example.com/', 'Website href should be set');

            removeMockDOM(container);
        });

        it('should hide website link when not present', () => {
            container = createProfileMockDOM();

            const profileWithoutWebsite = { ...testProfile, website: null };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(profileWithoutWebsite);

            const websiteEl = document.getElementById('profile-website');
            assertTrue(websiteEl.classList.contains('hidden'), 'Website should be hidden');

            removeMockDOM(container);
        });

        it('should show lightning address when lud16 is present', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const lightningEl = document.getElementById('profile-lightning');
            assertFalse(lightningEl.classList.contains('hidden'), 'Lightning address should be visible');
            assertTrue(
                lightningEl.querySelector('.link-text').textContent.includes('test@getalby.com'),
                'Lightning address should be displayed'
            );

            removeMockDOM(container);
        });

        it('should hide lightning address when lud16 is not present', () => {
            container = createProfileMockDOM();

            const profileWithoutLud16 = { ...testProfile, lud16: null };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(profileWithoutLud16);

            const lightningEl = document.getElementById('profile-lightning');
            assertTrue(lightningEl.classList.contains('hidden'), 'Lightning address should be hidden');

            removeMockDOM(container);
        });

        it('should render follow count', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const followCount = document.getElementById('profile-follow-count');
            assertEqual(followCount.textContent, '42', 'Follow count should be rendered');

            removeMockDOM(container);
        });

        it('should set banner background image when present', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const banner = document.getElementById('profile-banner');
            assertTrue(
                banner.style.backgroundImage.includes('banner.jpg'),
                'Banner background image should be set'
            );

            removeMockDOM(container);
        });

        it('should set avatar background image when picture is present', () => {
            container = createProfileMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const avatar = document.getElementById('profile-avatar');
            assertTrue(
                avatar.style.backgroundImage.includes('avatar.png'),
                'Avatar background image should be set'
            );

            removeMockDOM(container);
        });

        it('should display initial letter when no picture is available', () => {
            container = createProfileMockDOM();

            const profileWithoutPicture = { ...testProfile, picture: null };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(profileWithoutPicture);

            const avatar = document.getElementById('profile-avatar');
            assertEqual(avatar.textContent, 'T', 'Avatar should show first letter of name');

            removeMockDOM(container);
        });

        it('should handle profile with minimal data (Anonymous)', () => {
            container = createProfileMockDOM();

            const minimalProfile = {
                pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(minimalProfile);

            const displayName = document.getElementById('profile-display-name');
            assertEqual(displayName.textContent, 'Anonymous', 'Should show Anonymous for no name');

            removeMockDOM(container);
        });

        it('should setup copy npub button click handler', () => {
            container = createProfileMockDOM();
            setMockFetch({ data: { encoded: 'npub1testencoded' } });

            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(testProfile);

            const copyBtn = document.getElementById('copy-npub-btn');
            assertDefined(copyBtn, 'Copy npub button should exist');

            restoreFetch();
            removeMockDOM(container);
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const instance = Object.create(Shirushi.prototype);
            const result = instance.escapeHtml('<script>alert("xss")</script>');
            assertFalse(
                result.includes('<script>'),
                'Should escape script tags'
            );
            assertTrue(
                result.includes('&lt;script&gt;') || !result.includes('<'),
                'Should convert < to safe entity'
            );
        });

        it('should handle normal text unchanged', () => {
            const instance = Object.create(Shirushi.prototype);
            const result = instance.escapeHtml('Hello World');
            assertEqual(result, 'Hello World', 'Normal text should not be changed');
        });
    });

    describe('formatTime', () => {
        it('should format Unix timestamp to locale time string', () => {
            const instance = Object.create(Shirushi.prototype);
            const result = instance.formatTime(1700000000);
            assertDefined(result, 'formatTime should return a string');
            assertTrue(result.length > 0, 'Formatted time should not be empty');
        });
    });

    // Export test runner for browser and Node.js
    if (typeof window !== 'undefined') {
        window.runShirushiTests = runTests;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { runTests };
    }
})();
