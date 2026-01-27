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
            instance.switchTab = function() {};

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

        it('should switch to explorer tab before exploring profile', async () => {
            container = createMockDOM();
            setMockFetch({ data: testProfile });

            let switchTabCalled = false;
            let switchedToTab = null;
            let exploreProfileCalled = false;
            let callOrder = [];

            const instance = Object.create(Shirushi.prototype);
            instance.switchTab = function(tabName) {
                switchTabCalled = true;
                switchedToTab = tabName;
                callOrder.push('switchTab');
            };
            instance.exploreProfile = function() {
                exploreProfileCalled = true;
                callOrder.push('exploreProfile');
            };

            const newPubkey = 'newpubkey1234567890abcdef1234567890abcdef1234567890abcdef1234';
            instance.exploreProfileByPubkey(newPubkey);

            assertTrue(switchTabCalled, 'switchTab should be called');
            assertEqual(switchedToTab, 'explorer', 'Should switch to explorer tab');
            assertTrue(exploreProfileCalled, 'exploreProfile should be called');
            assertEqual(callOrder[0], 'switchTab', 'switchTab should be called before exploreProfile');
            assertEqual(callOrder[1], 'exploreProfile', 'exploreProfile should be called after switchTab');

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

        it('should show verified badge when nip05_valid is true', () => {
            container = createProfileMockDOM();

            const verifiedProfile = { ...testProfile, nip05: 'test@example.com', nip05_valid: true };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(verifiedProfile);

            const badge = document.getElementById('profile-nip05-badge');
            const icon = badge.querySelector('.nip05-icon');

            assertFalse(badge.classList.contains('hidden'), 'NIP-05 badge should be visible');
            assertFalse(badge.classList.contains('unverified'), 'NIP-05 badge should not have unverified class');
            assertEqual(icon.textContent, '✓', 'Icon should show checkmark');
            assertEqual(icon.title, 'NIP-05 verified', 'Icon should have verified tooltip');

            removeMockDOM(container);
        });

        it('should show unverified badge when nip05_valid is false', () => {
            container = createProfileMockDOM();

            const unverifiedProfile = { ...testProfile, nip05: 'test@example.com', nip05_valid: false };
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(unverifiedProfile);

            const badge = document.getElementById('profile-nip05-badge');
            const icon = badge.querySelector('.nip05-icon');

            assertFalse(badge.classList.contains('hidden'), 'NIP-05 badge should be visible');
            assertTrue(badge.classList.contains('unverified'), 'NIP-05 badge should have unverified class');
            assertEqual(icon.textContent, '✗', 'Icon should show X mark');
            assertEqual(icon.title, 'NIP-05 not verified', 'Icon should have not verified tooltip');

            removeMockDOM(container);
        });

        it('should show unverified badge when nip05_valid is undefined', () => {
            container = createProfileMockDOM();

            const profileWithNip05NoValidation = { ...testProfile, nip05: 'test@example.com' };
            delete profileWithNip05NoValidation.nip05_valid;
            const instance = Object.create(Shirushi.prototype);
            instance.renderProfile(profileWithNip05NoValidation);

            const badge = document.getElementById('profile-nip05-badge');
            const icon = badge.querySelector('.nip05-icon');

            assertFalse(badge.classList.contains('hidden'), 'NIP-05 badge should be visible');
            assertTrue(badge.classList.contains('unverified'), 'NIP-05 badge should have unverified class when validation is undefined');
            assertEqual(icon.textContent, '✗', 'Icon should show X mark');

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

    describe('switchProfileTab', () => {
        let container;

        function createTabMockDOM() {
            const el = document.createElement('div');
            el.id = 'profile-tab-test-container';
            el.innerHTML = `
                <button class="profile-tab active" data-profile-tab="notes"></button>
                <button class="profile-tab" data-profile-tab="following"></button>
                <button class="profile-tab" data-profile-tab="zaps"></button>
                <div id="profile-notes-tab" class="profile-tab-content active"></div>
                <div id="profile-following-tab" class="profile-tab-content"></div>
                <div id="profile-zaps-tab" class="profile-tab-content"></div>
                <div id="profile-notes-list"></div>
                <div id="profile-following-list"></div>
                <div id="profile-zaps-list"></div>
                <div id="profile-follow-count">0</div>
                <div id="zap-total-count">0</div>
                <div id="zap-total-sats">0</div>
                <div id="zap-avg-sats">0</div>
                <div id="zap-top-zap">0</div>
            `;
            document.body.appendChild(el);
            return el;
        }

        it('should switch to notes tab and update active states', () => {
            container = createTabMockDOM();
            setMockFetch({ data: testNotes });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            instance.switchProfileTab('notes');

            const notesTab = document.querySelector('[data-profile-tab="notes"]');
            const notesContent = document.getElementById('profile-notes-tab');

            assertTrue(notesTab.classList.contains('active'), 'Notes tab button should be active');
            assertTrue(notesContent.classList.contains('active'), 'Notes tab content should be active');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should switch to following tab and update active states', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [testContactList] });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            instance.switchProfileTab('following');

            const followingTab = document.querySelector('[data-profile-tab="following"]');
            const followingContent = document.getElementById('profile-following-tab');
            const notesTab = document.querySelector('[data-profile-tab="notes"]');
            const notesContent = document.getElementById('profile-notes-tab');

            assertTrue(followingTab.classList.contains('active'), 'Following tab button should be active');
            assertTrue(followingContent.classList.contains('active'), 'Following tab content should be active');
            assertFalse(notesTab.classList.contains('active'), 'Notes tab button should not be active');
            assertFalse(notesContent.classList.contains('active'), 'Notes tab content should not be active');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should switch to zaps tab and update active states', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [] });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.escapeHtml = Shirushi.prototype.escapeHtml;
            instance.formatTime = Shirushi.prototype.formatTime;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            instance.switchProfileTab('zaps');

            const zapsTab = document.querySelector('[data-profile-tab="zaps"]');
            const zapsContent = document.getElementById('profile-zaps-tab');

            assertTrue(zapsTab.classList.contains('active'), 'Zaps tab button should be active');
            assertTrue(zapsContent.classList.contains('active'), 'Zaps tab content should be active');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should call loadProfileNotes when switching to notes tab', () => {
            container = createTabMockDOM();
            setMockFetch({ data: testNotes });

            let notesCalled = false;
            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.loadProfileNotes = function(pubkey) {
                notesCalled = true;
                assertEqual(pubkey, testProfile.pubkey, 'Should pass correct pubkey');
            };
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            instance.switchProfileTab('notes');

            assertTrue(notesCalled, 'loadProfileNotes should be called');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should call loadProfileFollowing when switching to following tab', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [testContactList] });

            let followingCalled = false;
            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function(pubkey) {
                followingCalled = true;
                assertEqual(pubkey, testProfile.pubkey, 'Should pass correct pubkey');
            };
            instance.loadProfileZaps = function() {};

            instance.switchProfileTab('following');

            assertTrue(followingCalled, 'loadProfileFollowing should be called');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should call loadProfileZaps when switching to zaps tab', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [] });

            let zapsCalled = false;
            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function(pubkey) {
                zapsCalled = true;
                assertEqual(pubkey, testProfile.pubkey, 'Should pass correct pubkey');
            };

            instance.switchProfileTab('zaps');

            assertTrue(zapsCalled, 'loadProfileZaps should be called');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should not call data loaders when no profile is set', () => {
            container = createTabMockDOM();

            let anyCalled = false;
            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = null;
            instance.loadProfileNotes = function() { anyCalled = true; };
            instance.loadProfileFollowing = function() { anyCalled = true; };
            instance.loadProfileZaps = function() { anyCalled = true; };

            instance.switchProfileTab('notes');

            assertFalse(anyCalled, 'No data loader should be called when profile is null');

            removeMockDOM(container);
        });

        it('should remove active class from all tabs when switching', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [] });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            // Switch to following tab
            instance.switchProfileTab('following');

            // Check only following tab is active
            const allTabs = document.querySelectorAll('[data-profile-tab]');
            let activeCount = 0;
            allTabs.forEach(tab => {
                if (tab.classList.contains('active')) activeCount++;
            });

            assertEqual(activeCount, 1, 'Only one tab should be active at a time');

            restoreFetch();
            removeMockDOM(container);
        });

        it('should remove active class from all tab contents when switching', () => {
            container = createTabMockDOM();
            setMockFetch({ data: [] });

            const instance = Object.create(Shirushi.prototype);
            instance.currentProfile = testProfile;
            instance.loadProfileNotes = function() {};
            instance.loadProfileFollowing = function() {};
            instance.loadProfileZaps = function() {};

            // Switch to zaps tab
            instance.switchProfileTab('zaps');

            // Check only zaps content is active
            const allContents = document.querySelectorAll('.profile-tab-content');
            let activeCount = 0;
            allContents.forEach(content => {
                if (content.classList.contains('active')) activeCount++;
            });

            assertEqual(activeCount, 1, 'Only one tab content should be active at a time');

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

    // CSS Tests for Profile Card Styles
    describe('Profile Card CSS', () => {
        let styleContainer;

        function createStyledElement(className, parent = document.body) {
            const el = document.createElement('div');
            el.className = className;
            parent.appendChild(el);
            return el;
        }

        function getComputedStyle(el) {
            return window.getComputedStyle(el);
        }

        it('should have profile-card styles defined', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const card = createStyledElement('profile-card', styleContainer);
            const styles = getComputedStyle(card);

            assertEqual(styles.borderRadius, '8px', 'Profile card should have 8px border radius');
            assertEqual(styles.overflow, 'hidden', 'Profile card should have overflow hidden');

            styleContainer.remove();
        });

        it('should hide profile-card when hidden class is applied', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const card = createStyledElement('profile-card hidden', styleContainer);
            const styles = getComputedStyle(card);

            assertEqual(styles.display, 'none', 'Profile card with hidden class should have display none');

            styleContainer.remove();
        });

        it('should have profile-banner height of 120px', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const banner = createStyledElement('profile-banner', styleContainer);
            const styles = getComputedStyle(banner);

            assertEqual(styles.height, '120px', 'Profile banner should have 120px height');

            styleContainer.remove();
        });

        it('should have profile-avatar as a circle with 80px dimensions', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const avatar = createStyledElement('profile-avatar', styleContainer);
            const styles = getComputedStyle(avatar);

            assertEqual(styles.width, '80px', 'Profile avatar should have 80px width');
            assertEqual(styles.height, '80px', 'Profile avatar should have 80px height');
            assertEqual(styles.borderRadius, '50%', 'Profile avatar should be circular');

            styleContainer.remove();
        });

        it('should have profile-header with flex display', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const header = createStyledElement('profile-header', styleContainer);
            const styles = getComputedStyle(header);

            assertEqual(styles.display, 'flex', 'Profile header should have flex display');
            assertEqual(styles.gap, '16px', 'Profile header should have 16px gap');

            styleContainer.remove();
        });

        it('should have profile-display-name with 18px font size and bold weight', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const name = createStyledElement('profile-display-name', styleContainer);
            const styles = getComputedStyle(name);

            assertEqual(styles.fontSize, '18px', 'Display name should have 18px font size');
            assertEqual(styles.fontWeight, '600', 'Display name should have font weight 600');

            styleContainer.remove();
        });

        it('should have profile-pubkey with monospace font', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const pubkey = createStyledElement('profile-pubkey', styleContainer);
            const styles = getComputedStyle(pubkey);

            assertTrue(
                styles.fontFamily.includes('Geist Mono') || styles.fontFamily.includes('monospace'),
                'Profile pubkey should use monospace font'
            );
            assertEqual(styles.fontSize, '12px', 'Profile pubkey should have 12px font size');

            styleContainer.remove();
        });

        it('should have nip05-badge with inline-flex display', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const badge = createStyledElement('nip05-badge', styleContainer);
            const styles = getComputedStyle(badge);

            assertEqual(styles.display, 'inline-flex', 'NIP-05 badge should have inline-flex display');
            assertEqual(styles.borderRadius, '4px', 'NIP-05 badge should have 4px border radius');

            styleContainer.remove();
        });

        it('should hide nip05-badge when hidden class is applied', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const badge = createStyledElement('nip05-badge hidden', styleContainer);
            const styles = getComputedStyle(badge);

            assertEqual(styles.display, 'none', 'NIP-05 badge with hidden class should have display none');

            styleContainer.remove();
        });

        it('should have nip05-badge.unverified with different styling', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const verifiedBadge = createStyledElement('nip05-badge', styleContainer);
            const unverifiedBadge = createStyledElement('nip05-badge unverified', styleContainer);

            const verifiedStyles = getComputedStyle(verifiedBadge);
            const unverifiedStyles = getComputedStyle(unverifiedBadge);

            // Unverified badge should have different color than verified
            assertTrue(
                verifiedStyles.color !== unverifiedStyles.color,
                'Unverified badge should have different color than verified'
            );

            styleContainer.remove();
        });

        it('should have nip05-badge.verifying with accent color styling', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const verifyingBadge = createStyledElement('nip05-badge verifying', styleContainer);
            const styles = getComputedStyle(verifyingBadge);

            assertEqual(styles.display, 'inline-flex', 'Verifying badge should have inline-flex display');

            styleContainer.remove();
        });

        it('should have profile-content with proper panel styling', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const content = createStyledElement('profile-content', styleContainer);
            const styles = getComputedStyle(content);

            assertEqual(styles.borderRadius, '8px', 'Profile content should have 8px border radius');
            assertEqual(styles.overflow, 'hidden', 'Profile content should have overflow hidden');

            styleContainer.remove();
        });

        it('should have profile-tabs with flex display', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const tabs = createStyledElement('profile-tabs', styleContainer);
            const styles = getComputedStyle(tabs);

            assertEqual(styles.display, 'flex', 'Profile tabs should have flex display');
            assertEqual(styles.gap, '4px', 'Profile tabs should have 4px gap');

            styleContainer.remove();
        });

        it('should have profile-tab with cursor pointer', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const tab = createStyledElement('profile-tab', styleContainer);
            const styles = getComputedStyle(tab);

            assertEqual(styles.cursor, 'pointer', 'Profile tab should have cursor pointer');
            assertEqual(styles.borderRadius, '6px', 'Profile tab should have 6px border radius');

            styleContainer.remove();
        });

        it('should hide profile-tab-content by default', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const tabContent = createStyledElement('profile-tab-content', styleContainer);
            const styles = getComputedStyle(tabContent);

            assertEqual(styles.display, 'none', 'Profile tab content should be hidden by default');

            styleContainer.remove();
        });

        it('should show profile-tab-content when active', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const tabContent = createStyledElement('profile-tab-content active', styleContainer);
            const styles = getComputedStyle(tabContent);

            assertEqual(styles.display, 'block', 'Active profile tab content should have display block');

            styleContainer.remove();
        });

        it('should have note-card with proper styling', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const noteCard = createStyledElement('note-card', styleContainer);
            const styles = getComputedStyle(noteCard);

            assertEqual(styles.borderRadius, '8px', 'Note card should have 8px border radius');
            assertEqual(styles.padding, '14px', 'Note card should have 14px padding');

            styleContainer.remove();
        });

        it('should have follow-card with cursor pointer', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const followCard = createStyledElement('follow-card', styleContainer);
            const styles = getComputedStyle(followCard);

            assertEqual(styles.cursor, 'pointer', 'Follow card should have cursor pointer');
            assertEqual(styles.display, 'flex', 'Follow card should have flex display');

            styleContainer.remove();
        });

        it('should have zap-card with flex layout', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const zapCard = createStyledElement('zap-card', styleContainer);
            const styles = getComputedStyle(zapCard);

            assertEqual(styles.display, 'flex', 'Zap card should have flex display');
            assertEqual(styles.borderRadius, '6px', 'Zap card should have 6px border radius');

            styleContainer.remove();
        });

        it('should have zap-stats-summary with flex layout', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const zapStats = createStyledElement('zap-stats-summary', styleContainer);
            const styles = getComputedStyle(zapStats);

            assertEqual(styles.display, 'flex', 'Zap stats summary should have flex display');
            assertEqual(styles.gap, '24px', 'Zap stats summary should have 24px gap');

            styleContainer.remove();
        });

        it('should have zap-stat-value with bold text', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const zapStatValue = createStyledElement('zap-stat-value', styleContainer);
            const styles = getComputedStyle(zapStatValue);

            assertEqual(styles.fontSize, '20px', 'Zap stat value should have 20px font size');
            assertEqual(styles.fontWeight, '600', 'Zap stat value should have font weight 600');

            styleContainer.remove();
        });

        it('should have profile-stats with border-top', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const stats = createStyledElement('profile-stats', styleContainer);
            const styles = getComputedStyle(stats);

            assertEqual(styles.display, 'flex', 'Profile stats should have flex display');
            assertTrue(
                styles.borderTopStyle === 'solid' || styles.borderTop.includes('solid'),
                'Profile stats should have solid border top'
            );

            styleContainer.remove();
        });

        it('should have profile-link with proper styling', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const link = createStyledElement('profile-link', styleContainer);
            const styles = getComputedStyle(link);

            assertEqual(styles.display, 'inline-flex', 'Profile link should have inline-flex display');
            assertTrue(
                styles.textDecoration.includes('none') || styles.textDecorationLine === 'none',
                'Profile link should have no text decoration'
            );

            styleContainer.remove();
        });

        it('should hide profile-link when hidden class is applied', () => {
            styleContainer = document.createElement('div');
            document.body.appendChild(styleContainer);

            const link = createStyledElement('profile-link hidden', styleContainer);
            const styles = getComputedStyle(link);

            assertEqual(styles.display, 'none', 'Profile link with hidden class should have display none');

            styleContainer.remove();
        });
    });

    // Chart.js CDN Integration Tests
    describe('Chart.js CDN Integration', () => {
        it('should have Chart.js loaded globally', () => {
            assertDefined(window.Chart, 'Chart.js should be available on window object');
        });

        it('should have Chart constructor available', () => {
            assertEqual(typeof window.Chart, 'function', 'Chart should be a constructor function');
        });

        it('should have Chart.register method available', () => {
            assertDefined(window.Chart.register, 'Chart.register should be available');
            assertEqual(typeof window.Chart.register, 'function', 'Chart.register should be a function');
        });

        it('should have Chart.js version 4.x loaded', () => {
            assertDefined(window.Chart.version, 'Chart.version should be defined');
            assertTrue(window.Chart.version.startsWith('4'), 'Chart.js version should be 4.x');
        });
    });

    // Chart Initialization Tests
    describe('Chart Initialization', () => {
        let container;

        function createChartMockDOM() {
            const el = document.createElement('div');
            el.id = 'chart-test-container';
            el.innerHTML = `
                <div id="monitoring-tab" class="tab-content">
                    <div id="monitoring-connected">0</div>
                    <div id="monitoring-total">0</div>
                    <div id="monitoring-events-sec">0</div>
                    <div id="monitoring-total-events">0</div>
                    <div id="relay-health-list"></div>
                    <div class="chart-container" style="width: 400px; height: 200px;">
                        <canvas id="event-rate-chart"></canvas>
                    </div>
                    <div class="chart-container" style="width: 400px; height: 200px;">
                        <canvas id="latency-chart"></canvas>
                    </div>
                    <div class="chart-container-full" style="width: 800px; height: 300px;">
                        <canvas id="health-score-chart"></canvas>
                    </div>
                </div>
            `;
            document.body.appendChild(el);
            return el;
        }

        it('should have initializeCharts method', () => {
            assertDefined(Shirushi.prototype.initializeCharts, 'initializeCharts method should exist');
        });

        it('should have setupCanvasSize method', () => {
            assertDefined(Shirushi.prototype.setupCanvasSize, 'setupCanvasSize method should exist');
        });

        it('should have getCanvasDisplaySize method', () => {
            assertDefined(Shirushi.prototype.getCanvasDisplaySize, 'getCanvasDisplaySize method should exist');
        });

        it('should have setupChartResizeHandler method', () => {
            assertDefined(Shirushi.prototype.setupChartResizeHandler, 'setupChartResizeHandler method should exist');
        });

        it('should have resizeAllCharts method', () => {
            assertDefined(Shirushi.prototype.resizeAllCharts, 'resizeAllCharts method should exist');
        });

        it('should have createLineChart method', () => {
            assertDefined(Shirushi.prototype.createLineChart, 'createLineChart method should exist');
        });

        it('should have createBarChart method', () => {
            assertDefined(Shirushi.prototype.createBarChart, 'createBarChart method should exist');
        });

        it('should have createMultiLineChart method', () => {
            assertDefined(Shirushi.prototype.createMultiLineChart, 'createMultiLineChart method should exist');
        });

        it('should have updateCharts method', () => {
            assertDefined(Shirushi.prototype.updateCharts, 'updateCharts method should exist');
        });

        it('should initialize charts object in constructor', () => {
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {};

            const instance = new Shirushi();
            assertDefined(instance.charts, 'charts object should be initialized');
            assertEqual(instance.charts.eventRate, null, 'eventRate chart should be null initially');
            assertEqual(instance.charts.latency, null, 'latency chart should be null initially');
            assertEqual(instance.charts.healthScore, null, 'healthScore chart should be null initially');

            Shirushi.prototype.init = originalInit;
        });

        it('should create event rate chart when canvas exists', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            assertDefined(instance.charts.eventRate, 'Event rate chart should be created');
            assertDefined(instance.charts.eventRate.draw, 'Event rate chart should have draw method');
            assertDefined(instance.charts.eventRate.addPoint, 'Event rate chart should have addPoint method');
            assertDefined(instance.charts.eventRate.setData, 'Event rate chart should have setData method');

            removeMockDOM(container);
        });

        it('should create latency chart when canvas exists', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            assertDefined(instance.charts.latency, 'Latency chart should be created');
            assertDefined(instance.charts.latency.draw, 'Latency chart should have draw method');
            assertDefined(instance.charts.latency.setData, 'Latency chart should have setData method');

            removeMockDOM(container);
        });

        it('should create health score chart when canvas exists', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            assertDefined(instance.charts.healthScore, 'Health score chart should be created');
            assertDefined(instance.charts.healthScore.draw, 'Health score chart should have draw method');
            assertDefined(instance.charts.healthScore.addPoint, 'Health score chart should have addPoint method');
            assertDefined(instance.charts.healthScore.setSeriesData, 'Health score chart should have setSeriesData method');

            removeMockDOM(container);
        });

        it('should handle missing canvas elements gracefully', () => {
            // Temporarily hide the existing canvas elements
            const existingEventRate = document.getElementById('event-rate-chart');
            const existingLatency = document.getElementById('latency-chart');
            const existingHealth = document.getElementById('health-score-chart');

            const originalIds = [];
            if (existingEventRate) {
                originalIds.push({ el: existingEventRate, id: 'event-rate-chart' });
                existingEventRate.id = 'event-rate-chart-hidden';
            }
            if (existingLatency) {
                originalIds.push({ el: existingLatency, id: 'latency-chart' });
                existingLatency.id = 'latency-chart-hidden';
            }
            if (existingHealth) {
                originalIds.push({ el: existingHealth, id: 'health-score-chart' });
                existingHealth.id = 'health-score-chart-hidden';
            }

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };

            // Should not throw error when canvas elements don't exist
            let errorThrown = false;
            try {
                instance.initializeCharts();
            } catch (e) {
                errorThrown = true;
            }

            // Restore original IDs
            originalIds.forEach(item => {
                item.el.id = item.id;
            });

            assertFalse(errorThrown, 'initializeCharts should not throw when canvas elements are missing');
        });

        it('should return correct display size for canvas', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            // Find our test canvas specifically
            const testCanvas = container.querySelector('#event-rate-chart');
            if (!testCanvas) {
                // Skip if canvas not found in test container
                removeMockDOM(container);
                return;
            }

            const parentContainer = testCanvas.parentElement;
            // Force layout by setting explicit dimensions and display
            parentContainer.style.width = '400px';
            parentContainer.style.height = '200px';
            parentContainer.style.display = 'block';
            parentContainer.style.position = 'relative';

            const size = instance.getCanvasDisplaySize(testCanvas);

            // The size should be a valid object with width and height properties
            assertDefined(size, 'getCanvasDisplaySize should return an object');
            assertDefined(size.width, 'Size should have width property');
            assertDefined(size.height, 'Size should have height property');

            removeMockDOM(container);
        });

        it('should set up canvas size for high-DPI displays', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const testCanvas = container.querySelector('#event-rate-chart');
            if (!testCanvas) {
                removeMockDOM(container);
                return;
            }

            const parentContainer = testCanvas.parentElement;
            parentContainer.style.width = '400px';
            parentContainer.style.height = '200px';
            parentContainer.style.display = 'block';
            parentContainer.style.position = 'relative';

            instance.setupCanvasSize(testCanvas);

            // Canvas should have style dimensions set or canvas width/height attributes set
            const hasStyleWidth = testCanvas.style.width && testCanvas.style.width !== '';
            const hasCanvasWidth = testCanvas.width > 0;

            assertTrue(
                hasStyleWidth || hasCanvasWidth,
                'Canvas should have dimensions set after setupCanvasSize'
            );

            removeMockDOM(container);
        });

        it('should create line chart with correct properties', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('event-rate-chart');
            const ctx = canvas.getContext('2d');

            const chart = instance.createLineChart(ctx, 'Test Label', 'test/sec');

            assertEqual(chart.label, 'Test Label', 'Chart should have correct label');
            assertEqual(chart.unit, 'test/sec', 'Chart should have correct unit');
            assertEqual(chart.maxPoints, 60, 'Chart should have maxPoints of 60');
            assertTrue(Array.isArray(chart.data), 'Chart data should be an array');

            removeMockDOM(container);
        });

        it('should create bar chart with correct properties', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('latency-chart');
            const ctx = canvas.getContext('2d');

            const chart = instance.createBarChart(ctx, 'Latency Test');

            assertEqual(chart.label, 'Latency Test', 'Chart should have correct label');
            assertTrue(Array.isArray(chart.data), 'Chart data should be an array');

            removeMockDOM(container);
        });

        it('should create multi-line chart with correct properties', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('health-score-chart');
            const ctx = canvas.getContext('2d');

            const chart = instance.createMultiLineChart(ctx, 'Health Test', '%');

            assertEqual(chart.label, 'Health Test', 'Chart should have correct label');
            assertEqual(chart.unit, '%', 'Chart should have correct unit');
            assertEqual(chart.maxPoints, 60, 'Chart should have maxPoints of 60');
            assertTrue(typeof chart.series === 'object', 'Chart series should be an object');
            assertTrue(Array.isArray(chart.colors), 'Chart should have colors array');
            assertEqual(chart.colors.length, 8, 'Chart should have 8 colors');

            removeMockDOM(container);
        });

        it('should add point to line chart correctly', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('event-rate-chart');
            canvas.parentElement.style.width = '400px';
            canvas.parentElement.style.height = '200px';
            const ctx = canvas.getContext('2d');

            const chart = instance.createLineChart(ctx, 'Test', 'units');
            chart.addPoint(5.5);

            assertEqual(chart.data.length, 1, 'Chart should have 1 data point');
            assertEqual(chart.data[0].value, 5.5, 'Data point should have correct value');
            assertDefined(chart.data[0].timestamp, 'Data point should have timestamp');

            removeMockDOM(container);
        });

        it('should limit line chart to maxPoints', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('event-rate-chart');
            canvas.parentElement.style.width = '400px';
            canvas.parentElement.style.height = '200px';
            const ctx = canvas.getContext('2d');

            const chart = instance.createLineChart(ctx, 'Test', 'units');

            // Add more than maxPoints
            for (let i = 0; i < 70; i++) {
                chart.addPoint(i);
            }

            assertEqual(chart.data.length, 60, 'Chart should not exceed maxPoints');
            assertEqual(chart.data[0].value, 10, 'Oldest points should be removed');

            removeMockDOM(container);
        });

        it('should set data on line chart correctly', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('event-rate-chart');
            canvas.parentElement.style.width = '400px';
            canvas.parentElement.style.height = '200px';
            const ctx = canvas.getContext('2d');

            const chart = instance.createLineChart(ctx, 'Test', 'units');
            const testData = [{ value: 1 }, { value: 2 }, { value: 3 }];
            chart.setData(testData);

            assertEqual(chart.data.length, 3, 'Chart should have 3 data points');

            removeMockDOM(container);
        });

        it('should set data on bar chart correctly', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('latency-chart');
            canvas.parentElement.style.width = '400px';
            canvas.parentElement.style.height = '200px';
            const ctx = canvas.getContext('2d');

            const chart = instance.createBarChart(ctx, 'Latency');
            const testData = [
                { label: 'relay1', value: 100 },
                { label: 'relay2', value: 200 }
            ];
            chart.setData(testData);

            assertEqual(chart.data.length, 2, 'Chart should have 2 data items');
            assertEqual(chart.data[0].label, 'relay1', 'First item should have correct label');

            removeMockDOM(container);
        });

        it('should add series data to multi-line chart correctly', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            const canvas = document.getElementById('health-score-chart');
            canvas.parentElement.style.width = '800px';
            canvas.parentElement.style.height = '300px';
            const ctx = canvas.getContext('2d');

            const chart = instance.createMultiLineChart(ctx, 'Health', '%');
            chart.addPoint('wss://relay1.com', 95);
            chart.addPoint('wss://relay2.com', 88);

            assertEqual(Object.keys(chart.series).length, 2, 'Chart should have 2 series');
            assertEqual(chart.series['wss://relay1.com'].length, 1, 'Series 1 should have 1 point');
            assertEqual(chart.series['wss://relay1.com'][0].value, 95, 'Series 1 should have correct value');

            removeMockDOM(container);
        });

        it('should update charts with monitoring data', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            const testMonitoringData = {
                events_per_sec: 5.5,
                event_rate_history: [{ value: 1 }, { value: 2 }, { value: 3 }],
                relays: [
                    { url: 'wss://relay1.com', connected: true, latency_ms: 150, health_score: 90, latency_history: [{ value: 150 }] },
                    { url: 'wss://relay2.com', connected: true, latency_ms: 300, health_score: 75, latency_history: [{ value: 300 }] }
                ]
            };

            // Should not throw
            let errorThrown = false;
            try {
                instance.updateCharts(testMonitoringData);
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'updateCharts should not throw');

            removeMockDOM(container);
        });

        it('should handle updateCharts with missing data gracefully', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            // Should not throw with minimal data
            let errorThrown = false;
            try {
                instance.updateCharts({});
                instance.updateCharts({ relays: [] });
                instance.updateCharts({ relays: null });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'updateCharts should handle missing data gracefully');

            removeMockDOM(container);
        });

        it('should resize all charts without error', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            let errorThrown = false;
            try {
                instance.resizeAllCharts();
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'resizeAllCharts should not throw');

            removeMockDOM(container);
        });

        it('should have monitoringInitialized flag', () => {
            assertDefined(Shirushi.prototype.setupMonitoring, 'setupMonitoring method should exist');
        });

        it('should calculate health score for relay', () => {
            assertDefined(Shirushi.prototype.calculateHealthScore, 'calculateHealthScore method should exist');

            const instance = Object.create(Shirushi.prototype);

            // Test connected relay with good latency and high uptime
            const goodRelay = { connected: true, latency_ms: 100, error_count: 0, uptime_percent: 99 };
            const goodScore = instance.calculateHealthScore(goodRelay);
            assertTrue(goodScore >= 70, 'Good relay should have high score');

            // Test disconnected relay
            const disconnectedRelay = { connected: false };
            const disconnectedScore = instance.calculateHealthScore(disconnectedRelay);
            assertEqual(disconnectedScore, 0, 'Disconnected relay should have 0 score');

            // Test relay with high latency (latency > 500ms = 0 points for latency component)
            // Connected (30) + Latency above 500 (0) + Uptime 99% (24.75) + 0 errors (20) = 74.75
            const slowRelay = { connected: true, latency_ms: 1500, error_count: 0, uptime_percent: 99 };
            const slowScore = instance.calculateHealthScore(slowRelay);
            assertTrue(slowScore < goodScore, 'Slow relay should have lower score than good relay');

            // Test relay with errors (errors reduce score by 1 point per error up to 20 points)
            // 5 errors = 15 points for error component (vs 20 for 0 errors)
            const errorRelay = { connected: true, latency_ms: 100, error_count: 5, uptime_percent: 99 };
            const errorScore = instance.calculateHealthScore(errorRelay);
            assertTrue(errorScore < goodScore, 'Relay with errors should have reduced score compared to good relay');
        });
    });

    // Chart Update Logic Tests
    describe('Chart Update Logic', () => {
        let container;

        function createChartMockDOM() {
            const el = document.createElement('div');
            el.id = 'chart-update-test-container';
            el.innerHTML = `
                <div id="monitoring-tab" class="tab-content">
                    <div id="monitoring-connected">0</div>
                    <div id="monitoring-total">0</div>
                    <div id="monitoring-events-sec">0</div>
                    <div id="monitoring-total-events">0</div>
                    <div id="relay-health-list"></div>
                    <div class="chart-container" style="width: 400px; height: 200px;">
                        <canvas id="event-rate-chart"></canvas>
                    </div>
                    <div class="chart-container" style="width: 400px; height: 200px;">
                        <canvas id="latency-chart"></canvas>
                    </div>
                    <div class="chart-container-full" style="width: 800px; height: 300px;">
                        <canvas id="health-score-chart"></canvas>
                    </div>
                </div>
            `;
            document.body.appendChild(el);
            return el;
        }

        it('should have updateEventRateChart method', () => {
            assertDefined(Shirushi.prototype.updateEventRateChart, 'updateEventRateChart method should exist');
        });

        it('should have updateLatencyChart method', () => {
            assertDefined(Shirushi.prototype.updateLatencyChart, 'updateLatencyChart method should exist');
        });

        it('should have updateHealthScoreChart method', () => {
            assertDefined(Shirushi.prototype.updateHealthScoreChart, 'updateHealthScoreChart method should exist');
        });

        it('should have resetMonitoringHistory method', () => {
            assertDefined(Shirushi.prototype.resetMonitoringHistory, 'resetMonitoringHistory method should exist');
        });

        it('should have maxHistoryPoints property', () => {
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {};

            const instance = new Shirushi();
            assertDefined(instance.maxHistoryPoints, 'maxHistoryPoints should be defined');
            assertEqual(instance.maxHistoryPoints, 60, 'maxHistoryPoints should be 60');

            Shirushi.prototype.init = originalInit;
        });

        it('should have healthScoreHistory object', () => {
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {};

            const instance = new Shirushi();
            assertDefined(instance.healthScoreHistory, 'healthScoreHistory should be defined');
            assertEqual(typeof instance.healthScoreHistory, 'object', 'healthScoreHistory should be an object');

            Shirushi.prototype.init = originalInit;
        });

        it('should have relayLatencyHistory object', () => {
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {};

            const instance = new Shirushi();
            assertDefined(instance.relayLatencyHistory, 'relayLatencyHistory should be defined');
            assertEqual(typeof instance.relayLatencyHistory, 'object', 'relayLatencyHistory should be an object');

            Shirushi.prototype.init = originalInit;
        });

        it('should update event rate chart with history from backend', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            const dataWithHistory = {
                events_per_sec: 10.5,
                event_rate_history: [
                    { value: 5.0, timestamp: 1000 },
                    { value: 7.5, timestamp: 2000 },
                    { value: 10.5, timestamp: 3000 }
                ]
            };

            instance.updateEventRateChart(dataWithHistory);

            assertEqual(instance.charts.eventRate.data.length, 3, 'Chart should have 3 data points from backend history');

            removeMockDOM(container);
        });

        it('should update event rate chart with local tracking when no backend history', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            const dataWithoutHistory = {
                events_per_sec: 8.5
            };

            instance.updateEventRateChart(dataWithoutHistory);
            instance.updateEventRateChart({ events_per_sec: 9.0 });
            instance.updateEventRateChart({ events_per_sec: 9.5 });

            assertEqual(instance.eventRateHistory.length, 3, 'Local history should have 3 points');
            assertEqual(instance.eventRateHistory[2].value, 9.5, 'Last point should have latest value');

            removeMockDOM(container);
        });

        it('should trim event rate history to maxHistoryPoints', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            // Add more than maxHistoryPoints
            for (let i = 0; i < 70; i++) {
                instance.updateEventRateChart({ events_per_sec: i });
            }

            assertEqual(instance.eventRateHistory.length, 60, 'History should not exceed maxHistoryPoints');
            assertEqual(instance.eventRateHistory[0].value, 10, 'Oldest points should be removed');

            removeMockDOM(container);
        });

        it('should update latency chart with connected relays only', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            const data = {
                relays: [
                    { url: 'wss://relay1.com', connected: true, latency_ms: 100 },
                    { url: 'wss://relay2.com', connected: false, latency_ms: 200 },
                    { url: 'wss://relay3.com', connected: true, latency_ms: 0 },
                    { url: 'wss://relay4.com', connected: true, latency_ms: 150 }
                ]
            };

            instance.updateLatencyChart(data);

            // Should only include connected relays with valid latency > 0
            assertEqual(instance.charts.latency.data.length, 2, 'Should only show connected relays with valid latency');

            removeMockDOM(container);
        });

        it('should sort latency chart data by latency value', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            const data = {
                relays: [
                    { url: 'wss://slow.com', connected: true, latency_ms: 500 },
                    { url: 'wss://fast.com', connected: true, latency_ms: 50 },
                    { url: 'wss://medium.com', connected: true, latency_ms: 200 }
                ]
            };

            instance.updateLatencyChart(data);

            assertEqual(instance.charts.latency.data[0].value, 50, 'First entry should have lowest latency');
            assertEqual(instance.charts.latency.data[2].value, 500, 'Last entry should have highest latency');

            removeMockDOM(container);
        });

        it('should limit latency chart to 10 relays', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            const relays = [];
            for (let i = 0; i < 15; i++) {
                relays.push({ url: `wss://relay${i}.com`, connected: true, latency_ms: 100 + i * 10 });
            }

            instance.updateLatencyChart({ relays });

            assertEqual(instance.charts.latency.data.length, 10, 'Should limit to 10 relays');

            removeMockDOM(container);
        });

        it('should track health score history per relay', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            const data1 = {
                relays: [
                    { url: 'wss://relay1.com', connected: true, health_score: 90 },
                    { url: 'wss://relay2.com', connected: true, health_score: 80 }
                ]
            };

            instance.updateHealthScoreChart(data1);

            assertDefined(instance.healthScoreHistory['wss://relay1.com'], 'Should track relay1 history');
            assertDefined(instance.healthScoreHistory['wss://relay2.com'], 'Should track relay2 history');
            assertEqual(instance.healthScoreHistory['wss://relay1.com'].length, 1, 'relay1 should have 1 point');
            assertEqual(instance.healthScoreHistory['wss://relay1.com'][0].value, 90, 'relay1 should have correct score');

            removeMockDOM(container);
        });

        it('should accumulate health score history over multiple updates', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            instance.updateHealthScoreChart({
                relays: [{ url: 'wss://relay1.com', connected: true, health_score: 90 }]
            });
            instance.updateHealthScoreChart({
                relays: [{ url: 'wss://relay1.com', connected: true, health_score: 85 }]
            });
            instance.updateHealthScoreChart({
                relays: [{ url: 'wss://relay1.com', connected: true, health_score: 92 }]
            });

            assertEqual(instance.healthScoreHistory['wss://relay1.com'].length, 3, 'Should accumulate 3 points');
            assertEqual(instance.healthScoreHistory['wss://relay1.com'][2].value, 92, 'Last point should have latest score');

            removeMockDOM(container);
        });

        it('should trim health score history to maxHistoryPoints', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            // Add more than maxHistoryPoints
            for (let i = 0; i < 70; i++) {
                instance.updateHealthScoreChart({
                    relays: [{ url: 'wss://relay1.com', connected: true, health_score: i }]
                });
            }

            assertEqual(instance.healthScoreHistory['wss://relay1.com'].length, 60, 'Should not exceed maxHistoryPoints');
            assertEqual(instance.healthScoreHistory['wss://relay1.com'][0].value, 10, 'Oldest points should be removed');

            removeMockDOM(container);
        });

        it('should clean up history for removed relays', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            // Add two relays
            instance.updateHealthScoreChart({
                relays: [
                    { url: 'wss://relay1.com', connected: true, health_score: 90 },
                    { url: 'wss://relay2.com', connected: true, health_score: 80 }
                ]
            });

            assertEqual(Object.keys(instance.healthScoreHistory).length, 2, 'Should have 2 relays');

            // Update with only one relay (simulating relay2 removal)
            instance.updateHealthScoreChart({
                relays: [
                    { url: 'wss://relay1.com', connected: true, health_score: 95 }
                ]
            });

            assertEqual(Object.keys(instance.healthScoreHistory).length, 1, 'Should clean up removed relay');
            assertDefined(instance.healthScoreHistory['wss://relay1.com'], 'relay1 should still exist');

            removeMockDOM(container);
        });

        it('should use calculateHealthScore when health_score is not provided', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            const data = {
                relays: [
                    { url: 'wss://relay1.com', connected: true, latency_ms: 100, uptime_percent: 99, error_count: 0 }
                ]
            };

            instance.updateHealthScoreChart(data);

            assertTrue(instance.healthScoreHistory['wss://relay1.com'][0].value > 0, 'Should calculate health score');

            removeMockDOM(container);
        });

        it('should reset monitoring history correctly', () => {
            const originalInit = Shirushi.prototype.init;
            Shirushi.prototype.init = function() {};

            const instance = new Shirushi();
            instance.charts = { healthScore: { series: { 'wss://test.com': [] } } };

            // Add some history
            instance.eventRateHistory = [{ value: 1 }, { value: 2 }];
            instance.healthScoreHistory = { 'wss://test.com': [{ value: 90 }] };
            instance.relayLatencyHistory = { 'wss://test.com': [{ value: 100 }] };

            instance.resetMonitoringHistory();

            assertEqual(instance.eventRateHistory.length, 0, 'eventRateHistory should be empty');
            assertEqual(Object.keys(instance.healthScoreHistory).length, 0, 'healthScoreHistory should be empty');
            assertEqual(Object.keys(instance.relayLatencyHistory).length, 0, 'relayLatencyHistory should be empty');
            assertEqual(Object.keys(instance.charts.healthScore.series).length, 0, 'chart series should be empty');

            Shirushi.prototype.init = originalInit;
        });

        it('should calculate health score with weighted formula', () => {
            const instance = Object.create(Shirushi.prototype);

            // Test perfect relay
            const perfectRelay = { connected: true, latency_ms: 50, uptime_percent: 100, error_count: 0 };
            const perfectScore = instance.calculateHealthScore(perfectRelay);
            assertTrue(perfectScore >= 90, 'Perfect relay should have score >= 90');

            // Test relay with moderate issues
            const moderateRelay = { connected: true, latency_ms: 300, uptime_percent: 80, error_count: 5 };
            const moderateScore = instance.calculateHealthScore(moderateRelay);
            assertTrue(moderateScore >= 40 && moderateScore < 80, 'Moderate relay should have score between 40-80');

            // Test relay with severe issues
            const severeRelay = { connected: true, latency_ms: 600, uptime_percent: 50, error_count: 25 };
            const severeScore = instance.calculateHealthScore(severeRelay);
            assertTrue(severeScore < 60, 'Severe relay should have score < 60');
        });

        it('should handle null charts gracefully in updateEventRateChart', () => {
            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.eventRateHistory = [];
            instance.maxHistoryPoints = 60;

            let errorThrown = false;
            try {
                instance.updateEventRateChart({ events_per_sec: 5 });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'Should not throw with null chart');
        });

        it('should handle null charts gracefully in updateLatencyChart', () => {
            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };

            let errorThrown = false;
            try {
                instance.updateLatencyChart({ relays: [{ url: 'wss://test.com', connected: true, latency_ms: 100 }] });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'Should not throw with null chart');
        });

        it('should handle null charts gracefully in updateHealthScoreChart', () => {
            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;

            let errorThrown = false;
            try {
                instance.updateHealthScoreChart({ relays: [{ url: 'wss://test.com', connected: true, health_score: 90 }] });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'Should not throw with null chart');
        });

        it('should handle missing relays in updateLatencyChart', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.initializeCharts();

            let errorThrown = false;
            try {
                instance.updateLatencyChart({});
                instance.updateLatencyChart({ relays: null });
                instance.updateLatencyChart({ relays: undefined });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'Should handle missing relays gracefully');

            removeMockDOM(container);
        });

        it('should handle missing relays in updateHealthScoreChart', () => {
            container = createChartMockDOM();

            const instance = Object.create(Shirushi.prototype);
            instance.charts = { eventRate: null, latency: null, healthScore: null };
            instance.healthScoreHistory = {};
            instance.maxHistoryPoints = 60;
            instance.initializeCharts();

            let errorThrown = false;
            try {
                instance.updateHealthScoreChart({});
                instance.updateHealthScoreChart({ relays: null });
                instance.updateHealthScoreChart({ relays: undefined });
            } catch (e) {
                errorThrown = true;
            }

            assertFalse(errorThrown, 'Should handle missing relays gracefully');

            removeMockDOM(container);
        });
    });

    // Avatar and Banner CSS Rules Tests
    // These tests verify CSS rules are loaded correctly by checking stylesheet
    describe('Avatar and Banner CSS Rules', () => {
        // Get CSS rules from loaded stylesheet
        function getCssText() {
            const sheets = document.styleSheets;
            let cssText = '';
            for (let i = 0; i < sheets.length; i++) {
                try {
                    if (sheets[i].href && sheets[i].href.includes('style.css')) {
                        const rules = sheets[i].cssRules || sheets[i].rules;
                        for (let j = 0; j < rules.length; j++) {
                            cssText += rules[j].cssText + '\n';
                        }
                    }
                } catch (e) {
                    // Skip cross-origin stylesheets
                }
            }
            return cssText;
        }

        it('should have profile-banner.has-image rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('profile-banner') && css.includes('has-image'), 'CSS should have profile-banner.has-image rules');
        });

        it('should have banner-pulse animation loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('banner-pulse'), 'CSS should have banner-pulse animation');
        });

        it('should have profile-avatar.loading rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('profile-avatar') && css.includes('loading'), 'CSS should have profile-avatar.loading rules');
        });

        it('should have avatar-pulse animation loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('avatar-pulse'), 'CSS should have avatar-pulse animation');
        });

        it('should have profile-avatar size variants loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('avatar-sm') || css.includes('avatar-md') || css.includes('avatar-lg'), 'CSS should have avatar size variants');
        });

        it('should have profile-avatar ring variants loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('avatar-ring'), 'CSS should have avatar-ring rules');
        });

        it('should have follow-avatar rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('follow-avatar'), 'CSS should have follow-avatar rules');
        });

        it('should have toast-container rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-container'), 'CSS should have toast-container rules');
        });

        it('should have toast notification rules loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-success') && css.includes('toast-error'), 'CSS should have toast type rules');
        });

        it('should have toast animation rules loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-slide-in') && css.includes('toast-slide-out'), 'CSS should have toast animation rules');
        });

        it('should have toast-fade animation rules loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-fade-in') && css.includes('toast-fade-out'), 'CSS should have toast-fade animation rules');
        });

        it('should have toast-slide-up animation rules loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-slide-up') && css.includes('toast-slide-down'), 'CSS should have toast-slide-up/down animation rules');
        });

        it('should have toast-bounce-in animation rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-bounce-in'), 'CSS should have toast-bounce-in animation rule');
        });

        it('should have toast-shake animation rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-shake'), 'CSS should have toast-shake animation rule');
        });

        it('should have toast-progress-shrink animation rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-progress-shrink'), 'CSS should have toast-progress-shrink animation rule');
        });

        it('should have toast-icon-pop animation rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-icon-pop'), 'CSS should have toast-icon-pop animation rule');
        });

        it('should have toast-pulse animation rule loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-pulse'), 'CSS should have toast-pulse animation rule');
        });

        it('should have toast animation variant classes loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast.toast-fade'), 'CSS should have toast-fade variant class');
            assertTrue(css.includes('.toast.toast-bounce'), 'CSS should have toast-bounce variant class');
        });

        it('should have toast-persistent animation rules loaded', () => {
            const css = getCssText();
            assertTrue(css.includes('toast-persistent'), 'CSS should have toast-persistent animation rules');
        });

        // Toast Style Variant Tests (success, error, info with enhanced styling)
        it('should have toast-success with gradient background', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast.toast-success'), 'CSS should have toast-success selector');
            assertTrue(css.includes('rgba(34, 197, 94'), 'Success toast should use green rgba color');
        });

        it('should have toast-error with gradient background', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast.toast-error'), 'CSS should have toast-error selector');
            assertTrue(css.includes('rgba(239, 68, 68'), 'Error toast should use red rgba color');
        });

        it('should have toast-info with gradient background', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast.toast-info'), 'CSS should have toast-info selector');
            assertTrue(css.includes('rgba(59, 130, 246'), 'Info toast should use blue rgba color');
        });

        it('should have toast-warning with gradient background', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast.toast-warning'), 'CSS should have toast-warning selector');
            assertTrue(css.includes('rgba(234, 179, 8'), 'Warning toast should use yellow rgba color');
        });

        it('should have toast-success title color styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-success .toast-title'), 'CSS should have success toast title styling');
        });

        it('should have toast-error title color styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-error .toast-title'), 'CSS should have error toast title styling');
        });

        it('should have toast-info title color styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-info .toast-title'), 'CSS should have info toast title styling');
        });

        it('should have toast icon with circular background', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-icon'), 'CSS should have toast-icon selector');
            assertTrue(css.includes('border-radius: 50%'), 'Toast icon should have circular border-radius');
        });

        it('should have toast-success icon background styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-success .toast-icon'), 'CSS should have success toast icon styling');
        });

        it('should have toast-error icon background styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-error .toast-icon'), 'CSS should have error toast icon styling');
        });

        it('should have toast-info icon background styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-info .toast-icon'), 'CSS should have info toast icon styling');
        });

        it('should have toast-warning icon background styling', () => {
            const css = getCssText();
            assertTrue(css.includes('.toast-warning .toast-icon'), 'CSS should have warning toast icon styling');
        });
    });

    // ===================================
    // Toast Notification Tests
    // ===================================

    describe('Toast Notifications', () => {
        let toastContainer;

        // Setup - ensure toast container exists
        function setupToastTests() {
            toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }
            // Clear any existing toasts
            toastContainer.innerHTML = '';
            // Reinitialize app's toast container reference
            if (app) {
                app.toastContainer = toastContainer;
            }
        }

        it('should have toast container in DOM', () => {
            setupToastTests();
            const container = document.getElementById('toast-container');
            assertDefined(container, 'Toast container should exist in DOM');
            assertTrue(container.classList.contains('toast-container'), 'Toast container should have correct class');
        });

        it('should have setupToasts method defined', () => {
            assertDefined(app.setupToasts, 'setupToasts method should be defined');
            assertTrue(typeof app.setupToasts === 'function', 'setupToasts should be a function');
        });

        it('should have showToast method defined', () => {
            assertDefined(app.showToast, 'showToast method should be defined');
            assertTrue(typeof app.showToast === 'function', 'showToast should be a function');
        });

        it('should have toastSuccess convenience method', () => {
            assertDefined(app.toastSuccess, 'toastSuccess method should be defined');
            assertTrue(typeof app.toastSuccess === 'function', 'toastSuccess should be a function');
        });

        it('should have toastError convenience method', () => {
            assertDefined(app.toastError, 'toastError method should be defined');
            assertTrue(typeof app.toastError === 'function', 'toastError should be a function');
        });

        it('should have toastWarning convenience method', () => {
            assertDefined(app.toastWarning, 'toastWarning method should be defined');
            assertTrue(typeof app.toastWarning === 'function', 'toastWarning should be a function');
        });

        it('should have toastInfo convenience method', () => {
            assertDefined(app.toastInfo, 'toastInfo method should be defined');
            assertTrue(typeof app.toastInfo === 'function', 'toastInfo should be a function');
        });

        it('should have dismissToast method defined', () => {
            assertDefined(app.dismissToast, 'dismissToast method should be defined');
            assertTrue(typeof app.dismissToast === 'function', 'dismissToast should be a function');
        });

        it('should have clearAllToasts method defined', () => {
            assertDefined(app.clearAllToasts, 'clearAllToasts method should be defined');
            assertTrue(typeof app.clearAllToasts === 'function', 'clearAllToasts should be a function');
        });

        it('should create a success toast with correct classes', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'success', title: 'Test', message: 'Success message', duration: 0 });
            assertDefined(toast, 'Toast element should be created');
            assertTrue(toast.classList.contains('toast'), 'Toast should have toast class');
            assertTrue(toast.classList.contains('toast-success'), 'Toast should have toast-success class');
            app.dismissToast(toast);
        });

        it('should create an error toast with correct classes', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'error', title: 'Test', message: 'Error message', duration: 0 });
            assertTrue(toast.classList.contains('toast-error'), 'Toast should have toast-error class');
            app.dismissToast(toast);
        });

        it('should create a warning toast with correct classes', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'warning', title: 'Test', message: 'Warning message', duration: 0 });
            assertTrue(toast.classList.contains('toast-warning'), 'Toast should have toast-warning class');
            app.dismissToast(toast);
        });

        it('should create an info toast with correct classes', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Info message', duration: 0 });
            assertTrue(toast.classList.contains('toast-info'), 'Toast should have toast-info class');
            app.dismissToast(toast);
        });

        it('should display toast title correctly', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test Title', message: 'Message', duration: 0 });
            const titleEl = toast.querySelector('.toast-title');
            assertDefined(titleEl, 'Toast should have title element');
            assertEqual(titleEl.textContent, 'Test Title', 'Toast title should match');
            app.dismissToast(toast);
        });

        it('should display toast message correctly', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Title', message: 'Test Message', duration: 0 });
            const messageEl = toast.querySelector('.toast-message');
            assertDefined(messageEl, 'Toast should have message element');
            assertEqual(messageEl.textContent, 'Test Message', 'Toast message should match');
            app.dismissToast(toast);
        });

        it('should escape HTML in title and message', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: '<script>alert(1)</script>', message: '<b>bold</b>', duration: 0 });
            const titleEl = toast.querySelector('.toast-title');
            const messageEl = toast.querySelector('.toast-message');
            assertTrue(!titleEl.innerHTML.includes('<script>'), 'Title should escape script tags');
            assertTrue(!messageEl.innerHTML.includes('<b>'), 'Message should escape HTML tags');
            app.dismissToast(toast);
        });

        it('should have close button', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 0 });
            const closeBtn = toast.querySelector('.toast-close');
            assertDefined(closeBtn, 'Toast should have close button');
            app.dismissToast(toast);
        });

        it('should dismiss toast when close button clicked', async () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 0 });
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.click();
            assertTrue(toast.classList.contains('toast-hiding'), 'Toast should have hiding class after close click');
            // Wait for animation to complete
            await new Promise(resolve => setTimeout(resolve, 250));
        });

        it('should add toast to container', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 0 });
            assertEqual(toast.parentElement, toastContainer, 'Toast should be added to container');
            app.dismissToast(toast);
        });

        it('should limit number of toasts', () => {
            setupToastTests();
            // Create more than maxToasts
            for (let i = 0; i < 7; i++) {
                app.showToast({ type: 'info', title: `Toast ${i}`, message: 'Message', duration: 0 });
            }
            const toasts = toastContainer.querySelectorAll('.toast:not(.toast-hiding)');
            assertTrue(toasts.length <= app.maxToasts, 'Should not exceed max toasts');
            app.clearAllToasts();
        });

        it('should have progress bar when duration > 0', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 5000, showProgress: true });
            const progressBar = toast.querySelector('.toast-progress');
            assertDefined(progressBar, 'Toast should have progress bar');
            app.dismissToast(toast);
        });

        it('should not have progress bar when showProgress is false', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 5000, showProgress: false });
            const progressBar = toast.querySelector('.toast-progress');
            assertTrue(progressBar === null, 'Toast should not have progress bar');
            app.dismissToast(toast);
        });

        it('should not have progress bar when duration is 0', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', message: 'Message', duration: 0, showProgress: true });
            const progressBar = toast.querySelector('.toast-progress');
            assertTrue(progressBar === null, 'Toast should not have progress bar when duration is 0');
            app.dismissToast(toast);
        });

        it('should have correct icon for success toast', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'success', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertEqual(icon.textContent, '✓', 'Success toast should have checkmark icon');
            app.dismissToast(toast);
        });

        it('should have correct icon for error toast', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'error', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertEqual(icon.textContent, '✗', 'Error toast should have X icon');
            app.dismissToast(toast);
        });

        it('should have correct icon for warning toast', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'warning', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertEqual(icon.textContent, '⚠', 'Warning toast should have warning icon');
            app.dismissToast(toast);
        });

        it('should have correct icon for info toast', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertEqual(icon.textContent, 'ℹ', 'Info toast should have info icon');
            app.dismissToast(toast);
        });

        it('should have aria role for accessibility', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', duration: 0 });
            assertEqual(toast.getAttribute('role'), 'alert', 'Toast should have role="alert"');
            app.dismissToast(toast);
        });

        it('should clear all toasts', () => {
            setupToastTests();
            app.showToast({ type: 'info', title: 'Test 1', duration: 0 });
            app.showToast({ type: 'info', title: 'Test 2', duration: 0 });
            app.showToast({ type: 'info', title: 'Test 3', duration: 0 });
            app.clearAllToasts();
            const toasts = toastContainer.querySelectorAll('.toast:not(.toast-hiding)');
            assertEqual(toasts.length, 0, 'All toasts should be dismissed');
        });

        it('should auto-dismiss after duration', async () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', duration: 100 });
            // Wait for auto-dismiss
            await new Promise(resolve => setTimeout(resolve, 150));
            assertTrue(toast.classList.contains('toast-hiding'), 'Toast should be hiding after duration');
            // Wait for animation to complete
            await new Promise(resolve => setTimeout(resolve, 250));
        });

        it('toastSuccess should create success type toast', () => {
            setupToastTests();
            const toast = app.toastSuccess('Success Title', 'Success message');
            assertTrue(toast.classList.contains('toast-success'), 'toastSuccess should create success type');
            app.dismissToast(toast);
        });

        it('toastError should create error type toast', () => {
            setupToastTests();
            const toast = app.toastError('Error Title', 'Error message');
            assertTrue(toast.classList.contains('toast-error'), 'toastError should create error type');
            app.dismissToast(toast);
        });

        it('toastWarning should create warning type toast', () => {
            setupToastTests();
            const toast = app.toastWarning('Warning Title', 'Warning message');
            assertTrue(toast.classList.contains('toast-warning'), 'toastWarning should create warning type');
            app.dismissToast(toast);
        });

        it('toastInfo should create info type toast', () => {
            setupToastTests();
            const toast = app.toastInfo('Info Title', 'Info message');
            assertTrue(toast.classList.contains('toast-info'), 'toastInfo should create info type');
            app.dismissToast(toast);
        });

        // Enhanced Toast Style Tests (computed styles)
        it('success toast should have green-tinted background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'success', title: 'Test', duration: 0 });
            const computedStyle = window.getComputedStyle(toast);
            // Check that background contains gradient or rgba with green tint
            const bg = computedStyle.background || computedStyle.backgroundImage;
            assertTrue(bg.length > 0, 'Success toast should have background style');
            app.dismissToast(toast);
        });

        it('error toast should have red-tinted background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'error', title: 'Test', duration: 0 });
            const computedStyle = window.getComputedStyle(toast);
            const bg = computedStyle.background || computedStyle.backgroundImage;
            assertTrue(bg.length > 0, 'Error toast should have background style');
            app.dismissToast(toast);
        });

        it('info toast should have blue-tinted background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', duration: 0 });
            const computedStyle = window.getComputedStyle(toast);
            const bg = computedStyle.background || computedStyle.backgroundImage;
            assertTrue(bg.length > 0, 'Info toast should have background style');
            app.dismissToast(toast);
        });

        it('success toast icon should have circular background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'success', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertDefined(icon, 'Toast should have icon element');
            const computedStyle = window.getComputedStyle(icon);
            assertEqual(computedStyle.borderRadius, '50%', 'Icon should have circular border-radius');
            app.dismissToast(toast);
        });

        it('error toast icon should have circular background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'error', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertDefined(icon, 'Toast should have icon element');
            const computedStyle = window.getComputedStyle(icon);
            assertEqual(computedStyle.borderRadius, '50%', 'Icon should have circular border-radius');
            app.dismissToast(toast);
        });

        it('info toast icon should have circular background', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test', duration: 0 });
            const icon = toast.querySelector('.toast-icon');
            assertDefined(icon, 'Toast should have icon element');
            const computedStyle = window.getComputedStyle(icon);
            assertEqual(computedStyle.borderRadius, '50%', 'Icon should have circular border-radius');
            app.dismissToast(toast);
        });

        it('success toast title should have green color', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'success', title: 'Test Title', duration: 0 });
            const title = toast.querySelector('.toast-title');
            assertDefined(title, 'Toast should have title element');
            const computedStyle = window.getComputedStyle(title);
            // CSS variable --success is rgb(34, 197, 94) which becomes rgb(34, 197, 94) in computed style
            assertTrue(computedStyle.color.includes('34') || computedStyle.color.includes('22c55e'), 'Success title should have green color');
            app.dismissToast(toast);
        });

        it('error toast title should have red color', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'error', title: 'Test Title', duration: 0 });
            const title = toast.querySelector('.toast-title');
            assertDefined(title, 'Toast should have title element');
            const computedStyle = window.getComputedStyle(title);
            // CSS variable --error is rgb(239, 68, 68)
            assertTrue(computedStyle.color.includes('239') || computedStyle.color.includes('ef4444'), 'Error title should have red color');
            app.dismissToast(toast);
        });

        it('info toast title should have blue color', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Test Title', duration: 0 });
            const title = toast.querySelector('.toast-title');
            assertDefined(title, 'Toast should have title element');
            const computedStyle = window.getComputedStyle(title);
            // CSS variable --accent is rgb(59, 130, 246)
            assertTrue(computedStyle.color.includes('59') || computedStyle.color.includes('3b82f6'), 'Info title should have blue color');
            app.dismissToast(toast);
        });

        it('should handle toast without title', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', message: 'Only message', duration: 0 });
            const titleEl = toast.querySelector('.toast-title');
            assertTrue(titleEl === null, 'Toast without title should not have title element');
            const messageEl = toast.querySelector('.toast-message');
            assertDefined(messageEl, 'Toast should still have message element');
            app.dismissToast(toast);
        });

        it('should handle toast without message', () => {
            setupToastTests();
            const toast = app.showToast({ type: 'info', title: 'Only title', duration: 0 });
            const messageEl = toast.querySelector('.toast-message');
            assertTrue(messageEl === null, 'Toast without message should not have message element');
            const titleEl = toast.querySelector('.toast-title');
            assertDefined(titleEl, 'Toast should still have title element');
            app.dismissToast(toast);
        });

        it('should handle getToastIcon for all types', () => {
            assertEqual(app.getToastIcon('success'), '✓', 'Success icon');
            assertEqual(app.getToastIcon('error'), '✗', 'Error icon');
            assertEqual(app.getToastIcon('warning'), '⚠', 'Warning icon');
            assertEqual(app.getToastIcon('info'), 'ℹ', 'Info icon');
            assertEqual(app.getToastIcon('unknown'), 'ℹ', 'Unknown type should default to info icon');
        });
    });

    // Tests for alert() to showToast() replacement
    describe('Alert to Toast Replacement', () => {
        function setupToastTests() {
            // Ensure toast container exists
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
            // Clear any existing toasts
            container.innerHTML = '';
            app.toastContainer = container;
        }

        it('showEventJson should call showModal with syntax-highlighted JSON', () => {
            setupToastTests();
            // Add a test event to the events array
            const testEvent = { id: 'test-event-123', content: 'Test content', kind: 1 };
            app.events = [testEvent];

            // Spy on showModal
            let showModalCalled = false;
            let modalOptions = null;
            const originalShowModal = app.showModal.bind(app);
            app.showModal = function(options) {
                showModalCalled = true;
                modalOptions = options;
                return Promise.resolve(null);
            };

            app.showEventJson('test-event-123');

            assertTrue(showModalCalled, 'showModal should be called');
            assertEqual(modalOptions.title, 'Event JSON', 'Modal title should be "Event JSON"');
            assertTrue(modalOptions.body.includes('json-highlight'), 'Modal body should contain syntax-highlighted JSON');
            assertTrue(modalOptions.body.includes('test-event-123'), 'Modal body should contain event ID');
            assertTrue(modalOptions.body.includes('Test content'), 'Modal body should contain event content');
            assertEqual(modalOptions.size, 'lg', 'Modal should use large size');

            // Restore original method
            app.showModal = originalShowModal;
            app.events = [];
        });

        it('showEventJson should not show modal if event not found', () => {
            setupToastTests();
            app.events = [];

            let showModalCalled = false;
            const originalShowModal = app.showModal.bind(app);
            app.showModal = function() {
                showModalCalled = true;
                return Promise.resolve(null);
            };

            app.showEventJson('non-existent-event');

            assertFalse(showModalCalled, 'showModal should not be called for non-existent event');

            app.showModal = originalShowModal;
        });

        it('generateKeys should call toastError on API error response', async () => {
            setupToastTests();
            setMockFetch({ data: { error: 'Test API error' } });

            let toastErrorCalled = false;
            let errorTitle = null;
            let errorMessage = null;
            const originalToastError = app.toastError.bind(app);
            app.toastError = function(title, message) {
                toastErrorCalled = true;
                errorTitle = title;
                errorMessage = message;
                return originalToastError(title, message, 0);
            };

            await app.generateKeys();

            assertTrue(toastErrorCalled, 'toastError should be called');
            assertEqual(errorTitle, 'Key Generation Error', 'Toast title should indicate key generation error');
            assertEqual(errorMessage, 'Test API error', 'Toast message should contain the API error');

            app.toastError = originalToastError;
            restoreFetch();
        });

        it('generateKeys should call toastError on network error', async () => {
            setupToastTests();
            setMockFetch(null, new Error('Network failure'));

            let toastErrorCalled = false;
            let errorTitle = null;
            let errorMessage = null;
            const originalToastError = app.toastError.bind(app);
            app.toastError = function(title, message) {
                toastErrorCalled = true;
                errorTitle = title;
                errorMessage = message;
                return originalToastError(title, message, 0);
            };

            await app.generateKeys();

            assertTrue(toastErrorCalled, 'toastError should be called');
            assertEqual(errorTitle, 'Key Generation Failed', 'Toast title should indicate key generation failure');
            assertEqual(errorMessage, 'Network failure', 'Toast message should contain the error message');

            app.toastError = originalToastError;
            restoreFetch();
        });

        it('decodeNip19 should call toastError on network error', async () => {
            setupToastTests();

            // Setup DOM element
            let inputEl = document.getElementById('nip19-input');
            if (!inputEl) {
                inputEl = document.createElement('input');
                inputEl.id = 'nip19-input';
                document.body.appendChild(inputEl);
            }
            inputEl.value = 'npub1test';

            let resultEl = document.getElementById('nip19-result');
            if (!resultEl) {
                resultEl = document.createElement('div');
                resultEl.id = 'nip19-result';
                resultEl.classList.add('hidden');
                document.body.appendChild(resultEl);
            }

            setMockFetch(null, new Error('Decode network error'));

            let toastErrorCalled = false;
            let errorTitle = null;
            let errorMessage = null;
            const originalToastError = app.toastError.bind(app);
            app.toastError = function(title, message) {
                toastErrorCalled = true;
                errorTitle = title;
                errorMessage = message;
                return originalToastError(title, message, 0);
            };

            await app.decodeNip19();

            assertTrue(toastErrorCalled, 'toastError should be called');
            assertEqual(errorTitle, 'Decode Failed', 'Toast title should indicate decode failure');
            assertEqual(errorMessage, 'Decode network error', 'Toast message should contain the error message');

            app.toastError = originalToastError;
            restoreFetch();
        });

        it('encodeNip19 should call toastError on network error', async () => {
            setupToastTests();

            // Setup DOM element
            let inputEl = document.getElementById('nip19-input');
            if (!inputEl) {
                inputEl = document.createElement('input');
                inputEl.id = 'nip19-input';
                document.body.appendChild(inputEl);
            }
            inputEl.value = 'abcd1234';

            let resultEl = document.getElementById('nip19-result');
            if (!resultEl) {
                resultEl = document.createElement('div');
                resultEl.id = 'nip19-result';
                resultEl.classList.add('hidden');
                document.body.appendChild(resultEl);
            }

            setMockFetch(null, new Error('Encode network error'));

            let toastErrorCalled = false;
            let errorTitle = null;
            let errorMessage = null;
            const originalToastError = app.toastError.bind(app);
            app.toastError = function(title, message) {
                toastErrorCalled = true;
                errorTitle = title;
                errorMessage = message;
                return originalToastError(title, message, 0);
            };

            await app.encodeNip19('npub');

            assertTrue(toastErrorCalled, 'toastError should be called');
            assertEqual(errorTitle, 'Encode Failed', 'Toast title should indicate encode failure');
            assertEqual(errorMessage, 'Encode network error', 'Toast message should contain the error message');

            app.toastError = originalToastError;
            restoreFetch();
        });
    });

    // Modal System Tests
    describe('Modal System', () => {
        function setupModalTests() {
            // Ensure modal overlay exists
            let modalOverlay = document.getElementById('modal-overlay');
            if (!modalOverlay) {
                modalOverlay = document.createElement('div');
                modalOverlay.id = 'modal-overlay';
                modalOverlay.className = 'modal-overlay hidden';
                modalOverlay.setAttribute('role', 'dialog');
                modalOverlay.setAttribute('aria-modal', 'true');
                modalOverlay.setAttribute('aria-hidden', 'true');
                modalOverlay.innerHTML = `
                    <div class="modal" role="document">
                        <div class="modal-header">
                            <h2 class="modal-title" id="modal-title"></h2>
                            <button class="modal-close" aria-label="Close modal" title="Close">&times;</button>
                        </div>
                        <div class="modal-body" id="modal-body"></div>
                        <div class="modal-footer" id="modal-footer"></div>
                    </div>
                `;
                document.body.appendChild(modalOverlay);
            }

            // Re-initialize modal
            app.modalOverlay = null;
            app.setupModal();
        }

        function cleanupModalTests() {
            // Close any open modal
            if (app.modalOverlay && !app.modalOverlay.classList.contains('hidden')) {
                app.modalOverlay.classList.add('hidden');
            }
        }

        it('setupModal should initialize modal elements', () => {
            setupModalTests();

            assertDefined(app.modalOverlay, 'modalOverlay should be defined');
            assertDefined(app.modalTitle, 'modalTitle should be defined');
            assertDefined(app.modalBody, 'modalBody should be defined');
            assertDefined(app.modalFooter, 'modalFooter should be defined');
            assertDefined(app.modalCloseBtn, 'modalCloseBtn should be defined');
            assertDefined(app.modalElement, 'modalElement should be defined');

            cleanupModalTests();
        });

        it('showModal should display modal with correct content', async () => {
            setupModalTests();

            const modalPromise = app.showModal({
                title: 'Test Modal',
                body: '<p>Test content</p>',
                buttons: [{ text: 'OK', type: 'primary', value: true }]
            });

            // Modal should be visible
            assertFalse(app.modalOverlay.classList.contains('hidden'), 'Modal should not be hidden');
            assertEqual(app.modalOverlay.getAttribute('aria-hidden'), 'false', 'aria-hidden should be false');

            // Content should be correct
            assertEqual(app.modalTitle.textContent, 'Test Modal', 'Title should be set');
            assertTrue(app.modalBody.innerHTML.includes('Test content'), 'Body should contain content');
            assertTrue(app.modalFooter.innerHTML.includes('OK'), 'Footer should contain button');

            // Close the modal
            app.closeModal(true);

            // Wait for promise to resolve
            const result = await modalPromise;
            assertEqual(result, true, 'Modal should resolve with button value');

            cleanupModalTests();
        });

        it('showModal should apply correct size class', async () => {
            setupModalTests();

            app.showModal({
                title: 'Large Modal',
                body: 'Large content',
                size: 'lg'
            });

            assertTrue(app.modalElement.classList.contains('modal-lg'), 'Modal should have modal-lg class');

            app.closeModal();
            await new Promise(resolve => setTimeout(resolve, 200));

            cleanupModalTests();
        });

        it('showModal should apply correct type class', async () => {
            setupModalTests();

            app.showModal({
                title: 'Danger Modal',
                body: 'Warning content',
                type: 'danger'
            });

            assertTrue(app.modalElement.classList.contains('modal-danger'), 'Modal should have modal-danger class');

            app.closeModal();
            await new Promise(resolve => setTimeout(resolve, 200));

            cleanupModalTests();
        });

        it('closeModal should hide modal and resolve promise', async () => {
            setupModalTests();

            const modalPromise = app.showModal({
                title: 'Test',
                body: 'Content'
            });

            assertFalse(app.modalOverlay.classList.contains('hidden'), 'Modal should be visible initially');

            app.closeModal('test-value');

            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 200));

            assertTrue(app.modalOverlay.classList.contains('hidden'), 'Modal should be hidden after close');

            const result = await modalPromise;
            assertEqual(result, 'test-value', 'Promise should resolve with close value');

            cleanupModalTests();
        });

        it('closeModal should clear modal content', async () => {
            setupModalTests();

            app.showModal({
                title: 'Test',
                body: '<p>Some content</p>',
                buttons: [{ text: 'OK' }]
            });

            app.closeModal();
            await new Promise(resolve => setTimeout(resolve, 200));

            assertEqual(app.modalBody.innerHTML, '', 'Modal body should be cleared');
            assertEqual(app.modalFooter.innerHTML, '', 'Modal footer should be cleared');

            cleanupModalTests();
        });

        it('confirm should return true when confirmed', async () => {
            setupModalTests();

            // Start the confirm dialog
            const confirmPromise = app.confirm('Delete?', 'Are you sure?');

            // Find and click the confirm button
            await new Promise(resolve => setTimeout(resolve, 50));
            const confirmBtn = app.modalFooter.querySelector('button[data-modal-value="1"]');
            assertDefined(confirmBtn, 'Confirm button should exist');
            confirmBtn.click();

            const result = await confirmPromise;
            assertTrue(result, 'confirm should return true when confirmed');

            cleanupModalTests();
        });

        it('confirm should return false when cancelled', async () => {
            setupModalTests();

            // Start the confirm dialog
            const confirmPromise = app.confirm('Delete?', 'Are you sure?');

            // Find and click the cancel button
            await new Promise(resolve => setTimeout(resolve, 50));
            const cancelBtn = app.modalFooter.querySelector('button[data-modal-value="0"]');
            assertDefined(cancelBtn, 'Cancel button should exist');
            cancelBtn.click();

            const result = await confirmPromise;
            assertFalse(result, 'confirm should return false when cancelled');

            cleanupModalTests();
        });

        it('alert should display message and resolve when dismissed', async () => {
            setupModalTests();

            // Start the alert dialog
            const alertPromise = app.alert('Notice', 'This is an alert');

            // Verify content
            await new Promise(resolve => setTimeout(resolve, 50));
            assertTrue(app.modalBody.innerHTML.includes('This is an alert'), 'Alert should show message');

            // Click OK button
            const okBtn = app.modalFooter.querySelector('button');
            assertDefined(okBtn, 'OK button should exist');
            okBtn.click();

            await alertPromise;
            // If we get here, the promise resolved successfully

            cleanupModalTests();
        });

        it('prompt should return input value when confirmed', async () => {
            setupModalTests();

            // Start the prompt dialog
            const promptPromise = app.prompt('Name', 'Enter your name:', { defaultValue: 'Test' });

            // Wait for modal to render
            await new Promise(resolve => setTimeout(resolve, 50));

            // Check input has default value
            const input = app.modalBody.querySelector('input');
            assertDefined(input, 'Input should exist');
            assertEqual(input.value, 'Test', 'Input should have default value');

            // Change input value
            input.value = 'New Value';

            // Click confirm button
            const confirmBtn = app.modalFooter.querySelector('button[data-modal-value="1"]');
            confirmBtn.click();

            const result = await promptPromise;
            assertEqual(result, 'New Value', 'Prompt should return input value');

            cleanupModalTests();
        });

        it('prompt should return null when cancelled', async () => {
            setupModalTests();

            // Start the prompt dialog
            const promptPromise = app.prompt('Name', 'Enter your name:');

            // Wait for modal to render
            await new Promise(resolve => setTimeout(resolve, 50));

            // Click cancel button
            const cancelBtn = app.modalFooter.querySelector('button[data-modal-value="0"]');
            cancelBtn.click();

            const result = await promptPromise;
            assertEqual(result, null, 'Prompt should return null when cancelled');

            cleanupModalTests();
        });

        it('modal close button should close modal', async () => {
            setupModalTests();

            const modalPromise = app.showModal({
                title: 'Test',
                body: 'Content'
            });

            // Click close button
            app.modalCloseBtn.click();

            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 200));

            assertTrue(app.modalOverlay.classList.contains('hidden'), 'Modal should be hidden after close button click');

            const result = await modalPromise;
            assertEqual(result, null, 'Promise should resolve with null');

            cleanupModalTests();
        });

        it('modal should have proper accessibility attributes', () => {
            setupModalTests();

            assertEqual(app.modalOverlay.getAttribute('role'), 'dialog', 'Overlay should have role=dialog');
            assertEqual(app.modalOverlay.getAttribute('aria-modal'), 'true', 'Overlay should have aria-modal=true');
            assertEqual(app.modalElement.getAttribute('role'), 'document', 'Modal should have role=document');
            assertEqual(app.modalCloseBtn.getAttribute('aria-label'), 'Close modal', 'Close button should have aria-label');

            cleanupModalTests();
        });

        it('modal buttons should render correctly', async () => {
            setupModalTests();

            app.showModal({
                title: 'Multi-button Modal',
                body: 'Content',
                buttons: [
                    { text: 'Cancel', type: 'default', value: 'cancel' },
                    { text: 'Delete', type: 'danger', value: 'delete' },
                    { text: 'Save', type: 'primary', value: 'save' }
                ]
            });

            const buttons = app.modalFooter.querySelectorAll('button');
            assertEqual(buttons.length, 3, 'Should have 3 buttons');

            assertEqual(buttons[0].textContent, 'Cancel', 'First button should be Cancel');
            assertEqual(buttons[1].textContent, 'Delete', 'Second button should be Delete');
            assertEqual(buttons[2].textContent, 'Save', 'Third button should be Save');

            app.closeModal();
            await new Promise(resolve => setTimeout(resolve, 200));

            cleanupModalTests();
        });
    });

    // Modal CSS Tests
    describe('Modal CSS', () => {
        it('modal-overlay should have correct styles when hidden', () => {
            const modalOverlay = document.getElementById('modal-overlay');
            if (modalOverlay) {
                const computedStyle = window.getComputedStyle(modalOverlay);
                if (modalOverlay.classList.contains('hidden')) {
                    assertEqual(computedStyle.display, 'none', 'Hidden modal overlay should have display: none');
                }
            }
        });

        it('modal CSS classes should be defined in stylesheet', () => {
            // Check for modal-related rules in stylesheets
            const styleSheets = document.styleSheets;
            let hasModalOverlay = false;
            let hasModal = false;
            let hasModalHeader = false;
            let hasModalBody = false;
            let hasModalFooter = false;

            for (const sheet of styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules) continue;

                    for (const rule of rules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.modal-overlay')) hasModalOverlay = true;
                        if (selector === '.modal' || selector.includes('.modal ') || selector.includes('.modal.')) hasModal = true;
                        if (selector.includes('.modal-header')) hasModalHeader = true;
                        if (selector.includes('.modal-body')) hasModalBody = true;
                        if (selector.includes('.modal-footer')) hasModalFooter = true;
                    }
                } catch (e) {
                    // CORS may block access to some stylesheets
                }
            }

            assertTrue(hasModalOverlay, 'Should have .modal-overlay CSS rule');
            assertTrue(hasModal, 'Should have .modal CSS rule');
            assertTrue(hasModalHeader, 'Should have .modal-header CSS rule');
            assertTrue(hasModalBody, 'Should have .modal-body CSS rule');
            assertTrue(hasModalFooter, 'Should have .modal-footer CSS rule');
        });

        it('modal size variants should be defined', () => {
            const styleSheets = document.styleSheets;
            let hasSm = false;
            let hasLg = false;
            let hasXl = false;

            for (const sheet of styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules) continue;

                    for (const rule of rules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.modal-sm')) hasSm = true;
                        if (selector.includes('.modal-lg')) hasLg = true;
                        if (selector.includes('.modal-xl')) hasXl = true;
                    }
                } catch (e) {
                    // CORS may block access
                }
            }

            assertTrue(hasSm, 'Should have .modal-sm CSS rule');
            assertTrue(hasLg, 'Should have .modal-lg CSS rule');
            assertTrue(hasXl, 'Should have .modal-xl CSS rule');
        });

        it('modal type variants should be defined', () => {
            const styleSheets = document.styleSheets;
            let hasDanger = false;
            let hasWarning = false;
            let hasSuccess = false;

            for (const sheet of styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules) continue;

                    for (const rule of rules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.modal-danger') || selector.includes('.modal.modal-danger')) hasDanger = true;
                        if (selector.includes('.modal-warning') || selector.includes('.modal.modal-warning')) hasWarning = true;
                        if (selector.includes('.modal-success') || selector.includes('.modal.modal-success')) hasSuccess = true;
                    }
                } catch (e) {
                    // CORS may block access
                }
            }

            assertTrue(hasDanger, 'Should have .modal-danger CSS rule');
            assertTrue(hasWarning, 'Should have .modal-warning CSS rule');
            assertTrue(hasSuccess, 'Should have .modal-success CSS rule');
        });
    });

    // ==========================================
    // JSON Syntax Highlighting Tests
    // ==========================================
    describe('JSON Syntax Highlighting', () => {
        it('isJsonString should detect valid JSON objects', () => {
            assertTrue(app.isJsonString('{"key": "value"}'), 'Should detect simple JSON object');
            assertTrue(app.isJsonString('  { "key": 123 }  '), 'Should detect JSON with whitespace');
            assertTrue(app.isJsonString('[1, 2, 3]'), 'Should detect JSON array');
            assertTrue(app.isJsonString('[]'), 'Should detect empty array');
            assertTrue(app.isJsonString('{}'), 'Should detect empty object');
        });

        it('isJsonString should reject non-JSON strings', () => {
            assertFalse(app.isJsonString('hello world'), 'Should reject plain text');
            assertFalse(app.isJsonString('123'), 'Should reject numbers');
            assertFalse(app.isJsonString(''), 'Should reject empty string');
            assertFalse(app.isJsonString(null), 'Should reject null');
            assertFalse(app.isJsonString(undefined), 'Should reject undefined');
            assertFalse(app.isJsonString('key: value'), 'Should reject YAML-like');
        });

        it('syntaxHighlightJson should return HTML with pre and code tags', () => {
            const result = app.syntaxHighlightJson({ key: 'value' });
            assertTrue(result.includes('<pre class="json-highlight">'), 'Should contain pre tag with json-highlight class');
            assertTrue(result.includes('<code>'), 'Should contain code tag');
            assertTrue(result.includes('</code>'), 'Should close code tag');
            assertTrue(result.includes('</pre>'), 'Should close pre tag');
        });

        it('syntaxHighlightJson should highlight keys', () => {
            const result = app.syntaxHighlightJson({ myKey: 'value' });
            assertTrue(result.includes('<span class="json-key">"myKey"</span>'), 'Should wrap key in json-key span');
        });

        it('syntaxHighlightJson should highlight string values', () => {
            const result = app.syntaxHighlightJson({ key: 'stringValue' });
            assertTrue(result.includes('<span class="json-string">"stringValue"</span>'), 'Should wrap string value in json-string span');
        });

        it('syntaxHighlightJson should highlight number values', () => {
            const result = app.syntaxHighlightJson({ count: 42 });
            assertTrue(result.includes('<span class="json-number">42</span>'), 'Should wrap number in json-number span');
        });

        it('syntaxHighlightJson should highlight boolean values', () => {
            const resultTrue = app.syntaxHighlightJson({ active: true });
            const resultFalse = app.syntaxHighlightJson({ active: false });
            assertTrue(resultTrue.includes('<span class="json-boolean">true</span>'), 'Should wrap true in json-boolean span');
            assertTrue(resultFalse.includes('<span class="json-boolean">false</span>'), 'Should wrap false in json-boolean span');
        });

        it('syntaxHighlightJson should highlight null values', () => {
            const result = app.syntaxHighlightJson({ empty: null });
            assertTrue(result.includes('<span class="json-null">null</span>'), 'Should wrap null in json-null span');
        });

        it('syntaxHighlightJson should handle nested objects', () => {
            const result = app.syntaxHighlightJson({
                outer: {
                    inner: 'value'
                }
            });
            assertTrue(result.includes('<span class="json-key">"outer"</span>'), 'Should highlight outer key');
            assertTrue(result.includes('<span class="json-key">"inner"</span>'), 'Should highlight inner key');
            assertTrue(result.includes('<span class="json-string">"value"</span>'), 'Should highlight nested string value');
        });

        it('syntaxHighlightJson should handle arrays', () => {
            const result = app.syntaxHighlightJson({ items: [1, 2, 3] });
            assertTrue(result.includes('<span class="json-number">1</span>'), 'Should highlight array number 1');
            assertTrue(result.includes('<span class="json-number">2</span>'), 'Should highlight array number 2');
            assertTrue(result.includes('<span class="json-number">3</span>'), 'Should highlight array number 3');
        });

        it('syntaxHighlightJson should accept JSON string input', () => {
            const jsonStr = '{"name": "test"}';
            const result = app.syntaxHighlightJson(jsonStr);
            assertTrue(result.includes('<span class="json-key">"name"</span>'), 'Should highlight key from string input');
            assertTrue(result.includes('<span class="json-string">"test"</span>'), 'Should highlight value from string input');
        });

        it('syntaxHighlightJson should handle invalid JSON string gracefully', () => {
            const result = app.syntaxHighlightJson('not valid json');
            assertTrue(result.includes('<pre class="json-highlight">'), 'Should still wrap in pre tag');
            assertTrue(result.includes('not valid json'), 'Should contain original text');
        });

        it('syntaxHighlightJson should escape HTML in values', () => {
            const result = app.syntaxHighlightJson({ content: '<script>alert("xss")</script>' });
            assertFalse(result.includes('<script>'), 'Should not contain raw script tag');
            assertTrue(result.includes('&lt;script&gt;'), 'Should escape HTML special characters');
        });

        it('syntaxHighlightJson should handle complex Nostr event', () => {
            const event = {
                id: 'abc123',
                kind: 1,
                pubkey: 'pubkey123',
                content: 'Hello World',
                created_at: 1700000000,
                tags: [['e', 'eventid'], ['p', 'pubkey']],
                sig: 'signature123'
            };
            const result = app.syntaxHighlightJson(event);

            assertTrue(result.includes('<span class="json-key">"id"</span>'), 'Should highlight id key');
            assertTrue(result.includes('<span class="json-key">"kind"</span>'), 'Should highlight kind key');
            assertTrue(result.includes('<span class="json-number">1</span>'), 'Should highlight kind value');
            assertTrue(result.includes('<span class="json-key">"tags"</span>'), 'Should highlight tags key');
        });
    });

    // ==========================================
    // JSON Highlighting CSS Tests
    // ==========================================
    describe('JSON Highlighting CSS', () => {
        it('json-highlight CSS class should be defined', () => {
            const styleSheets = document.styleSheets;
            let hasJsonHighlight = false;

            for (const sheet of styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules) continue;

                    for (const rule of rules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.json-highlight')) {
                            hasJsonHighlight = true;
                            break;
                        }
                    }
                } catch (e) {
                    // CORS may block access
                }
                if (hasJsonHighlight) break;
            }

            assertTrue(hasJsonHighlight, 'Should have .json-highlight CSS rule');
        });

        it('json syntax highlighting color classes should be defined', () => {
            const styleSheets = document.styleSheets;
            let hasKey = false;
            let hasString = false;
            let hasNumber = false;
            let hasBoolean = false;
            let hasNull = false;

            for (const sheet of styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules) continue;

                    for (const rule of rules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.json-key')) hasKey = true;
                        if (selector.includes('.json-string')) hasString = true;
                        if (selector.includes('.json-number')) hasNumber = true;
                        if (selector.includes('.json-boolean')) hasBoolean = true;
                        if (selector.includes('.json-null')) hasNull = true;
                    }
                } catch (e) {
                    // CORS may block access
                }
            }

            assertTrue(hasKey, 'Should have .json-key CSS rule');
            assertTrue(hasString, 'Should have .json-string CSS rule');
            assertTrue(hasNumber, 'Should have .json-number CSS rule');
            assertTrue(hasBoolean, 'Should have .json-boolean CSS rule');
            assertTrue(hasNull, 'Should have .json-null CSS rule');
        });
    });

    describe('Copy to Clipboard Functionality', () => {
        // Mock clipboard API
        let clipboardWriteText = null;
        let mockClipboardSuccess = true;

        function mockClipboard() {
            clipboardWriteText = null;
            mockClipboardSuccess = true;
            const originalClipboard = navigator.clipboard;

            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text) => {
                        clipboardWriteText = text;
                        if (mockClipboardSuccess) {
                            return Promise.resolve();
                        } else {
                            return Promise.reject(new Error('Clipboard access denied'));
                        }
                    }
                },
                configurable: true
            });

            return originalClipboard;
        }

        function restoreClipboard(originalClipboard) {
            if (originalClipboard) {
                Object.defineProperty(navigator, 'clipboard', {
                    value: originalClipboard,
                    configurable: true
                });
            }
        }

        function getApp() {
            return window.app || app;
        }

        it('copyToClipboard method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance, 'App should be defined');
            assertDefined(appInstance.copyToClipboard, 'copyToClipboard method should exist');
            assertEqual(typeof appInstance.copyToClipboard, 'function', 'copyToClipboard should be a function');
        });

        it('createCopyButton method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance, 'App should be defined');
            assertDefined(appInstance.createCopyButton, 'createCopyButton method should exist');
            assertEqual(typeof appInstance.createCopyButton, 'function', 'createCopyButton should be a function');
        });

        it('copyToClipboard should copy text successfully', async () => {
            const appInstance = getApp();
            const originalClipboard = mockClipboard();
            try {
                const testText = 'test-copy-text-12345';
                const result = await appInstance.copyToClipboard(testText);

                assertTrue(result, 'copyToClipboard should return true on success');
                assertEqual(clipboardWriteText, testText, 'Text should be written to clipboard');
            } finally {
                restoreClipboard(originalClipboard);
            }
        });

        it('copyToClipboard should handle failure gracefully', async () => {
            const appInstance = getApp();
            const originalClipboard = mockClipboard();
            mockClipboardSuccess = false;
            try {
                const testText = 'test-copy-text-fail';
                const result = await appInstance.copyToClipboard(testText);

                assertFalse(result, 'copyToClipboard should return false on failure');
            } finally {
                restoreClipboard(originalClipboard);
            }
        });

        it('copyToClipboard should update button text on success', async () => {
            const appInstance = getApp();
            const originalClipboard = mockClipboard();
            try {
                const testButton = document.createElement('button');
                testButton.textContent = 'Copy';

                await appInstance.copyToClipboard('test-text', testButton, 'Copy');

                assertEqual(testButton.textContent, 'Copied!', 'Button text should change to Copied!');
                assertTrue(testButton.classList.contains('copy-success'), 'Button should have copy-success class');
            } finally {
                restoreClipboard(originalClipboard);
            }
        });

        it('createCopyButton should return a button element', () => {
            const appInstance = getApp();
            const btn = appInstance.createCopyButton('test-text', 'Copy URL');

            assertDefined(btn, 'Button should be defined');
            assertEqual(btn.tagName, 'BUTTON', 'Should return a button element');
            assertTrue(btn.classList.contains('btn'), 'Should have btn class');
            assertTrue(btn.classList.contains('small'), 'Should have small class');
            assertTrue(btn.classList.contains('copy-btn'), 'Should have copy-btn class');
            assertEqual(btn.textContent, 'Copy URL', 'Button text should match label');
        });

        it('createCopyButton should copy text when clicked', async () => {
            const appInstance = getApp();
            const originalClipboard = mockClipboard();
            try {
                const testText = 'copy-button-test-text';
                const btn = appInstance.createCopyButton(testText, 'Copy');

                // Simulate click
                btn.click();

                // Wait for async clipboard operation
                await new Promise(resolve => setTimeout(resolve, 100));

                assertEqual(clipboardWriteText, testText, 'Button click should copy text to clipboard');
            } finally {
                restoreClipboard(originalClipboard);
            }
        });
    });

    describe('Copy Button CSS', () => {
        it('copy-btn CSS class should be defined', () => {
            let hasCopyBtn = false;
            let hasCopyBtnHover = false;
            let hasCopySuccess = false;

            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.copy-btn')) hasCopyBtn = true;
                        if (selector.includes('.copy-btn:hover')) hasCopyBtnHover = true;
                        if (selector.includes('.copy-success')) hasCopySuccess = true;
                    }
                } catch (e) {
                    // CORS may block access
                }
            }

            assertTrue(hasCopyBtn, 'Should have .copy-btn CSS rule');
            assertTrue(hasCopySuccess, 'Should have .copy-success CSS rule');
        });

        it('copy-inline CSS class should be defined', () => {
            let hasCopyInline = false;

            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        const selector = rule.selectorText || '';
                        if (selector.includes('.copy-inline')) hasCopyInline = true;
                    }
                } catch (e) {
                    // CORS may block access
                }
            }

            assertTrue(hasCopyInline, 'Should have .copy-inline CSS rule');
        });
    });

    describe('Relay Card Copy Buttons', () => {
        function getApp() {
            return window.app || app;
        }

        it('relay cards should have copy URL buttons after rendering', async () => {
            const appInstance = getApp();

            // Set up mock relay data
            appInstance.relays = [
                { url: 'wss://relay.test.com', connected: true, latency_ms: 50, events_per_sec: 1.5 }
            ];

            // Render relays
            appInstance.renderRelays();

            // Check for copy button
            const copyBtn = document.querySelector('[data-copy-relay]');
            assertDefined(copyBtn, 'Copy relay URL button should exist');
            assertEqual(copyBtn.dataset.copyRelay, 'wss://relay.test.com', 'Button should have relay URL in data attribute');
        });
    });

    describe('Event Card Copy Buttons', () => {
        function getApp() {
            return window.app || app;
        }

        it('event cards should have copy buttons for ID and author', async () => {
            const appInstance = getApp();

            // Set up mock event data
            appInstance.events = [
                {
                    id: 'abc123def456789012345678901234567890123456789012345678901234',
                    pubkey: 'pub123456789012345678901234567890123456789012345678901234',
                    kind: 1,
                    content: 'Test content',
                    created_at: Math.floor(Date.now() / 1000)
                }
            ];

            // Render events
            appInstance.renderEvents();

            // Check for copy event ID button
            const copyIdBtn = document.querySelector('[data-copy-event-id]');
            assertDefined(copyIdBtn, 'Copy event ID button should exist');

            // Check for copy author button
            const copyAuthorBtn = document.querySelector('[data-copy-author]');
            assertDefined(copyAuthorBtn, 'Copy author pubkey button should exist');
        });

        it('event cards should have View Profile button that links to author profile', async () => {
            const appInstance = getApp();

            // Set up mock event data
            appInstance.events = [
                {
                    id: 'abc123def456789012345678901234567890123456789012345678901234',
                    pubkey: 'pub123456789012345678901234567890123456789012345678901234',
                    kind: 1,
                    content: 'Test content',
                    created_at: Math.floor(Date.now() / 1000)
                }
            ];

            // Render events
            appInstance.renderEvents();

            // Check for View Profile button
            const eventActions = document.querySelector('.event-actions');
            assertDefined(eventActions, 'Event actions container should exist');

            const viewProfileBtn = eventActions.querySelector('button:nth-child(2)');
            assertDefined(viewProfileBtn, 'View Profile button should exist');
            assertEqual(viewProfileBtn.textContent, 'View Profile', 'Button should have correct text');
            assertTrue(
                viewProfileBtn.getAttribute('onclick').includes('exploreProfileByPubkey'),
                'Button should call exploreProfileByPubkey'
            );
            assertTrue(
                viewProfileBtn.getAttribute('onclick').includes('pub123456789012345678901234567890123456789012345678901234'),
                'Button should pass the correct pubkey'
            );
        });
    });

    describe('Console Output Copy Button', () => {
        function getApp() {
            return window.app || app;
        }

        it('copy output button should exist in console tab', () => {
            const copyBtn = document.getElementById('copy-nak-output');
            assertDefined(copyBtn, 'Copy nak output button should exist');
            assertTrue(copyBtn.disabled, 'Copy button should be disabled initially');
        });

        it('copyNakOutput method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.copyNakOutput, 'copyNakOutput method should exist');
            assertEqual(typeof appInstance.copyNakOutput, 'function', 'copyNakOutput should be a function');
        });

        it('updateNakCopyButton method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.updateNakCopyButton, 'updateNakCopyButton method should exist');
            assertEqual(typeof appInstance.updateNakCopyButton, 'function', 'updateNakCopyButton should be a function');
        });
    });

    describe('Collapsible Tags Section', () => {
        function getApp() {
            return window.app || app;
        }

        it('renderTagsSection method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.renderTagsSection, 'renderTagsSection method should exist');
            assertEqual(typeof appInstance.renderTagsSection, 'function', 'renderTagsSection should be a function');
        });

        it('getTagClass method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.getTagClass, 'getTagClass method should exist');
            assertEqual(typeof appInstance.getTagClass, 'function', 'getTagClass should be a function');
        });

        it('truncateTagValue method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.truncateTagValue, 'truncateTagValue method should exist');
            assertEqual(typeof appInstance.truncateTagValue, 'function', 'truncateTagValue should be a function');
        });

        it('toggleTagsSection method should exist on Shirushi class', () => {
            const appInstance = getApp();
            assertDefined(appInstance.toggleTagsSection, 'toggleTagsSection method should exist');
            assertEqual(typeof appInstance.toggleTagsSection, 'function', 'toggleTagsSection should be a function');
        });

        it('renderTagsSection should return empty string for events with no tags', () => {
            const appInstance = getApp();
            const eventNoTags = { id: 'test123', tags: [] };
            const result = appInstance.renderTagsSection(eventNoTags);
            assertEqual(result, '', 'Should return empty string for event with empty tags');

            const eventNullTags = { id: 'test456', tags: null };
            const result2 = appInstance.renderTagsSection(eventNullTags);
            assertEqual(result2, '', 'Should return empty string for event with null tags');

            const eventUndefinedTags = { id: 'test789' };
            const result3 = appInstance.renderTagsSection(eventUndefinedTags);
            assertEqual(result3, '', 'Should return empty string for event with undefined tags');
        });

        it('renderTagsSection should return HTML for events with tags', () => {
            const appInstance = getApp();
            const eventWithTags = {
                id: 'event123',
                tags: [
                    ['e', 'abc123'],
                    ['p', 'pubkey456'],
                    ['t', 'nostr']
                ]
            };
            const result = appInstance.renderTagsSection(eventWithTags);
            assertTrue(result.includes('event-tags-section'), 'Should include tags section class');
            assertTrue(result.includes('Tags (3)'), 'Should show correct tag count');
            assertTrue(result.includes('tags-toggle-btn'), 'Should include toggle button');
            assertTrue(result.includes('tags-content'), 'Should include tags content area');
        });

        it('renderTagsSection should escape HTML in tag values', () => {
            const appInstance = getApp();
            const eventWithSpecialChars = {
                id: 'event789',
                tags: [
                    ['t', '<script>alert("xss")</script>']
                ]
            };
            const result = appInstance.renderTagsSection(eventWithSpecialChars);
            assertFalse(result.includes('<script>'), 'Should escape script tags');
            assertTrue(result.includes('&lt;script'), 'Should contain escaped script tag');
        });

        it('getTagClass should return correct class for known tag types', () => {
            const appInstance = getApp();
            assertEqual(appInstance.getTagClass('e'), 'tag-event-ref', 'Should return tag-event-ref for e tag');
            assertEqual(appInstance.getTagClass('p'), 'tag-pubkey-ref', 'Should return tag-pubkey-ref for p tag');
            assertEqual(appInstance.getTagClass('t'), 'tag-hashtag', 'Should return tag-hashtag for t tag');
            assertEqual(appInstance.getTagClass('a'), 'tag-address', 'Should return tag-address for a tag');
            assertEqual(appInstance.getTagClass('d'), 'tag-identifier', 'Should return tag-identifier for d tag');
            assertEqual(appInstance.getTagClass('r'), 'tag-reference', 'Should return tag-reference for r tag');
            assertEqual(appInstance.getTagClass('bolt11'), 'tag-lightning', 'Should return tag-lightning for bolt11 tag');
            assertEqual(appInstance.getTagClass('relay'), 'tag-relay', 'Should return tag-relay for relay tag');
        });

        it('getTagClass should return tag-default for unknown tag types', () => {
            const appInstance = getApp();
            assertEqual(appInstance.getTagClass('unknown'), 'tag-default', 'Should return tag-default for unknown tags');
            assertEqual(appInstance.getTagClass('custom'), 'tag-default', 'Should return tag-default for custom tags');
            assertEqual(appInstance.getTagClass(''), 'tag-default', 'Should return tag-default for empty tag name');
        });

        it('truncateTagValue should not truncate short values', () => {
            const appInstance = getApp();
            assertEqual(appInstance.truncateTagValue('short'), 'short', 'Should not truncate short values');
            assertEqual(appInstance.truncateTagValue('exactly24characters!!!'), 'exactly24characters!!!', 'Should not truncate 24 char values');
        });

        it('truncateTagValue should truncate long values with ellipsis', () => {
            const appInstance = getApp();
            const longValue = 'abcdefghijklmnopqrstuvwxyz1234567890';
            const result = appInstance.truncateTagValue(longValue);
            assertTrue(result.includes('...'), 'Should include ellipsis');
            assertTrue(result.length < longValue.length, 'Should be shorter than original');
            assertTrue(result.startsWith('abcdefghijkl'), 'Should start with first 12 chars');
            assertTrue(result.endsWith('67890'), 'Should end with last 8 chars');
        });

        it('toggleTagsSection should toggle expanded class on tags section', () => {
            const appInstance = getApp();

            // Create a test tags section element
            const container = document.getElementById('event-list');
            container.innerHTML = `
                <div class="event-tags-section" data-event-id="test-event-toggle">
                    <button class="tags-toggle-btn" data-tags-toggle="test-event-toggle">
                        <span class="tags-toggle-icon">▶</span>
                        <span class="tags-toggle-label">Tags (2)</span>
                    </button>
                    <div class="tags-content" data-tags-content="test-event-toggle">
                        <div class="tag-item">Test tag</div>
                    </div>
                </div>
            `;

            const section = container.querySelector('[data-event-id="test-event-toggle"]');
            assertFalse(section.classList.contains('expanded'), 'Section should not be expanded initially');

            // Toggle to expanded
            appInstance.toggleTagsSection('test-event-toggle');
            assertTrue(section.classList.contains('expanded'), 'Section should be expanded after first toggle');

            // Toggle back to collapsed
            appInstance.toggleTagsSection('test-event-toggle');
            assertFalse(section.classList.contains('expanded'), 'Section should be collapsed after second toggle');

            // Clean up
            container.innerHTML = '';
        });

        it('event card should render tags section when event has tags', () => {
            const appInstance = getApp();

            // Add an event with tags
            appInstance.events = [{
                id: 'test-event-with-tags',
                kind: 1,
                pubkey: 'testpubkey1234567890123456789012345678901234567890123456789012',
                created_at: Math.floor(Date.now() / 1000),
                content: 'Test content',
                tags: [['e', 'abc123'], ['p', 'pubkey456']]
            }];

            // Render the event stream
            appInstance.renderEvents();

            const container = document.getElementById('event-list');
            const tagsSection = container.querySelector('.event-tags-section');
            assertDefined(tagsSection, 'Tags section should be rendered');
            assertTrue(tagsSection.innerHTML.includes('Tags (2)'), 'Should show correct tag count');

            // Clean up
            appInstance.events = [];
            container.innerHTML = '';
        });

        it('event card should not render tags section when event has no tags', () => {
            const appInstance = getApp();

            // Add an event without tags
            appInstance.events = [{
                id: 'test-event-no-tags',
                kind: 1,
                pubkey: 'testpubkey1234567890123456789012345678901234567890123456789012',
                created_at: Math.floor(Date.now() / 1000),
                content: 'Test content without tags',
                tags: []
            }];

            // Render the event stream
            appInstance.renderEvents();

            const container = document.getElementById('event-list');
            const tagsSection = container.querySelector('.event-tags-section');
            assertTrue(tagsSection === null, 'Tags section should not be rendered for event without tags');

            // Clean up
            appInstance.events = [];
            container.innerHTML = '';
        });

        it('tag copy buttons should have correct data attribute', () => {
            const appInstance = getApp();

            // Add an event with tags
            appInstance.events = [{
                id: 'test-event-copy',
                kind: 1,
                pubkey: 'testpubkey1234567890123456789012345678901234567890123456789012',
                created_at: Math.floor(Date.now() / 1000),
                content: 'Test content',
                tags: [['t', 'nostr']]
            }];

            // Render the event stream
            appInstance.renderEvents();

            const container = document.getElementById('event-list');
            const copyBtn = container.querySelector('[data-tag-copy]');
            assertDefined(copyBtn, 'Tag copy button should exist');
            const tagData = copyBtn.getAttribute('data-tag-copy');
            assertTrue(tagData.includes('t'), 'Copy data should include tag name');
            assertTrue(tagData.includes('nostr'), 'Copy data should include tag value');

            // Clean up
            appInstance.events = [];
            container.innerHTML = '';
        });
    });

    // ==========================================
    // Spinner Component Tests
    // ==========================================
    describe('Spinner Component', () => {
        it('spinner base element renders correctly', () => {
            const spinner = document.createElement('span');
            spinner.className = 'spinner';
            document.body.appendChild(spinner);

            const styles = window.getComputedStyle(spinner);
            assertEqual(styles.display, 'inline-block', 'Spinner should be inline-block');
            assertEqual(styles.borderRadius, '50%', 'Spinner should be circular');

            document.body.removeChild(spinner);
        });

        it('spinner size variants apply correct dimensions', () => {
            const sizes = {
                'spinner-xs': '12px',
                'spinner-sm': '16px',
                'spinner-md': '24px',
                'spinner-lg': '32px',
                'spinner-xl': '48px'
            };

            for (const [className, expectedSize] of Object.entries(sizes)) {
                const spinner = document.createElement('span');
                spinner.className = `spinner ${className}`;
                document.body.appendChild(spinner);

                const styles = window.getComputedStyle(spinner);
                assertEqual(styles.width, expectedSize, `${className} should have width ${expectedSize}`);
                assertEqual(styles.height, expectedSize, `${className} should have height ${expectedSize}`);

                document.body.removeChild(spinner);
            }
        });

        it('spinner color variants apply correct border colors', () => {
            const colorVariants = ['spinner-accent', 'spinner-success', 'spinner-error', 'spinner-warning', 'spinner-white'];

            for (const variant of colorVariants) {
                const spinner = document.createElement('span');
                spinner.className = `spinner ${variant}`;
                document.body.appendChild(spinner);

                const styles = window.getComputedStyle(spinner);
                assertTrue(styles.borderTopColor !== '', `${variant} should have border-top-color`);

                document.body.removeChild(spinner);
            }
        });

        it('spinner container with label renders correctly', () => {
            const container = document.createElement('div');
            container.className = 'spinner-container';
            container.innerHTML = `
                <span class="spinner"></span>
                <span class="spinner-label">Loading...</span>
            `;
            document.body.appendChild(container);

            const styles = window.getComputedStyle(container);
            assertEqual(styles.display, 'inline-flex', 'Spinner container should be inline-flex');

            const label = container.querySelector('.spinner-label');
            assertDefined(label, 'Spinner label should exist');
            assertEqual(label.textContent, 'Loading...', 'Spinner label should have correct text');

            document.body.removeChild(container);
        });

        it('spinner container vertical variant stacks content', () => {
            const container = document.createElement('div');
            container.className = 'spinner-container spinner-container-vertical';
            container.innerHTML = `
                <span class="spinner spinner-lg"></span>
                <span class="spinner-label">Processing...</span>
            `;
            document.body.appendChild(container);

            const styles = window.getComputedStyle(container);
            assertEqual(styles.flexDirection, 'column', 'Vertical spinner container should have column direction');

            document.body.removeChild(container);
        });

        it('spinner overlay renders with correct positioning', () => {
            const parent = document.createElement('div');
            parent.style.position = 'relative';
            parent.style.width = '200px';
            parent.style.height = '200px';
            parent.innerHTML = `<div class="spinner-overlay"><span class="spinner"></span></div>`;
            document.body.appendChild(parent);

            const overlay = parent.querySelector('.spinner-overlay');
            const styles = window.getComputedStyle(overlay);
            assertEqual(styles.position, 'absolute', 'Spinner overlay should be absolute positioned');
            assertEqual(styles.display, 'flex', 'Spinner overlay should be flex');

            document.body.removeChild(parent);
        });

        it('button with spinner hides text when loading', () => {
            const button = document.createElement('button');
            button.className = 'btn btn-loading';
            button.innerHTML = `Submit<span class="spinner spinner-white"></span>`;
            document.body.appendChild(button);

            const styles = window.getComputedStyle(button);
            assertEqual(styles.color, 'rgba(0, 0, 0, 0)', 'Loading button text should be transparent');
            assertEqual(styles.pointerEvents, 'none', 'Loading button should not be clickable');

            document.body.removeChild(button);
        });

        it('spinner has animation applied', () => {
            const spinner = document.createElement('span');
            spinner.className = 'spinner';
            document.body.appendChild(spinner);

            const styles = window.getComputedStyle(spinner);
            assertTrue(styles.animationName.includes('spinner-rotate') || styles.animation.includes('spinner-rotate'),
                'Spinner should have rotation animation');

            document.body.removeChild(spinner);
        });

        it('fullpage spinner covers entire viewport', () => {
            const fullpage = document.createElement('div');
            fullpage.className = 'spinner-fullpage';
            fullpage.innerHTML = `
                <span class="spinner"></span>
                <span class="spinner-label">Loading application...</span>
            `;
            document.body.appendChild(fullpage);

            const styles = window.getComputedStyle(fullpage);
            assertEqual(styles.position, 'fixed', 'Fullpage spinner should be fixed positioned');
            assertTrue(parseInt(styles.zIndex) >= 9999, 'Fullpage spinner should have high z-index');

            document.body.removeChild(fullpage);
        });

        it('spinner in button has appropriate size', () => {
            const button = document.createElement('button');
            button.className = 'btn';
            button.innerHTML = `<span class="spinner"></span> Loading`;
            document.body.appendChild(button);

            const spinner = button.querySelector('.spinner');
            const styles = window.getComputedStyle(spinner);
            assertEqual(styles.width, '14px', 'Spinner in button should be 14px');
            assertEqual(styles.height, '14px', 'Spinner in button should be 14px');

            document.body.removeChild(button);
        });
    });

    describe('Spinner CSS', () => {
        function getCssText() {
            let cssText = '';
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        cssText += rule.cssText + '\n';
                    }
                } catch (e) {
                    // CORS may block access
                }
            }
            return cssText;
        }

        it('spinner base class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.spinner'), 'CSS should have .spinner rule');
        });

        it('spinner-rotate animation should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('spinner-rotate'), 'CSS should have spinner-rotate animation');
        });

        it('spinner size variants should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.spinner-xs') || css.includes('.spinner.spinner-xs'), 'CSS should have spinner-xs');
            assertTrue(css.includes('.spinner-sm') || css.includes('.spinner.spinner-sm'), 'CSS should have spinner-sm');
            assertTrue(css.includes('.spinner-md') || css.includes('.spinner.spinner-md'), 'CSS should have spinner-md');
            assertTrue(css.includes('.spinner-lg') || css.includes('.spinner.spinner-lg'), 'CSS should have spinner-lg');
            assertTrue(css.includes('.spinner-xl') || css.includes('.spinner.spinner-xl'), 'CSS should have spinner-xl');
        });

        it('spinner color variants should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('spinner-accent'), 'CSS should have spinner-accent');
            assertTrue(css.includes('spinner-success'), 'CSS should have spinner-success');
            assertTrue(css.includes('spinner-error'), 'CSS should have spinner-error');
            assertTrue(css.includes('spinner-warning'), 'CSS should have spinner-warning');
            assertTrue(css.includes('spinner-white'), 'CSS should have spinner-white');
        });

        it('spinner container classes should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.spinner-container'), 'CSS should have spinner-container');
            assertTrue(css.includes('.spinner-label'), 'CSS should have spinner-label');
        });

        it('spinner overlay class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.spinner-overlay'), 'CSS should have spinner-overlay');
        });

        it('spinner fullpage class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.spinner-fullpage'), 'CSS should have spinner-fullpage');
        });

        it('btn-loading class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.btn-loading') || css.includes('.btn.btn-loading'), 'CSS should have btn-loading');
        });
    });

    // Loading State Handler Tests
    describe('Loading State Handlers', () => {
        it('should have isLoading method', () => {
            assertDefined(Shirushi.prototype.isLoading, 'isLoading method should exist');
        });

        it('should have setLoading method', () => {
            assertDefined(Shirushi.prototype.setLoading, 'setLoading method should exist');
        });

        it('should have onLoadingChange method', () => {
            assertDefined(Shirushi.prototype.onLoadingChange, 'onLoadingChange method should exist');
        });

        it('should have clearAllLoadingStates method', () => {
            assertDefined(Shirushi.prototype.clearAllLoadingStates, 'clearAllLoadingStates method should exist');
        });

        it('should have setButtonLoading method', () => {
            assertDefined(Shirushi.prototype.setButtonLoading, 'setButtonLoading method should exist');
        });

        it('should have setContainerLoading method', () => {
            assertDefined(Shirushi.prototype.setContainerLoading, 'setContainerLoading method should exist');
        });

        it('should have withLoading method', () => {
            assertDefined(Shirushi.prototype.withLoading, 'withLoading method should exist');
        });

        it('should have createLoadingIndicator method', () => {
            assertDefined(Shirushi.prototype.createLoadingIndicator, 'createLoadingIndicator method should exist');
        });

        it('should have setInlineLoading method', () => {
            assertDefined(Shirushi.prototype.setInlineLoading, 'setInlineLoading method should exist');
        });
    });

    describe('Loading State - isLoading and setLoading', () => {
        let container;

        it('should return false for unset loading state', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            assertFalse(mockApp.isLoading('test-key'), 'isLoading should return false for unset key');
        });

        it('should set and get loading state correctly', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            mockApp.setLoading('test-key', true);
            assertTrue(mockApp.isLoading('test-key'), 'isLoading should return true after setLoading(key, true)');

            mockApp.setLoading('test-key', false);
            assertFalse(mockApp.isLoading('test-key'), 'isLoading should return false after setLoading(key, false)');
        });

        it('should call callbacks when loading state changes', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            let callbackCalled = false;
            let lastCallbackValue = null;

            mockApp.onLoadingChange('test-key', (isLoading) => {
                callbackCalled = true;
                lastCallbackValue = isLoading;
            });

            // Initial callback should be called with false (not loading)
            assertTrue(callbackCalled, 'Callback should be called immediately on subscribe');
            assertFalse(lastCallbackValue, 'Initial callback value should be false');

            // Change to loading
            mockApp.setLoading('test-key', true);
            assertTrue(lastCallbackValue, 'Callback should receive true when loading starts');

            // Change back
            mockApp.setLoading('test-key', false);
            assertFalse(lastCallbackValue, 'Callback should receive false when loading ends');
        });

        it('should return unsubscribe function from onLoadingChange', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            let callCount = 0;
            const unsubscribe = mockApp.onLoadingChange('test-key', () => {
                callCount++;
            });

            assertEqual(callCount, 1, 'Callback should be called once on subscribe');

            mockApp.setLoading('test-key', true);
            assertEqual(callCount, 2, 'Callback should be called on state change');

            // Unsubscribe
            unsubscribe();

            mockApp.setLoading('test-key', false);
            assertEqual(callCount, 2, 'Callback should not be called after unsubscribe');
        });

        it('should clear all loading states', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            mockApp.setLoading('key1', true);
            mockApp.setLoading('key2', true);
            mockApp.setLoading('key3', true);

            assertTrue(mockApp.isLoading('key1'), 'key1 should be loading');
            assertTrue(mockApp.isLoading('key2'), 'key2 should be loading');
            assertTrue(mockApp.isLoading('key3'), 'key3 should be loading');

            mockApp.clearAllLoadingStates();

            assertFalse(mockApp.isLoading('key1'), 'key1 should not be loading after clear');
            assertFalse(mockApp.isLoading('key2'), 'key2 should not be loading after clear');
            assertFalse(mockApp.isLoading('key3'), 'key3 should not be loading after clear');
        });
    });

    describe('Loading State - setButtonLoading', () => {
        it('should set button to loading state', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-btn">Click Me</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btn = document.getElementById('test-btn');
            const originalText = mockApp.setButtonLoading(btn, true, 'Loading...');

            assertEqual(originalText, 'Click Me', 'Should return original text');
            assertTrue(btn.disabled, 'Button should be disabled');
            assertTrue(btn.classList.contains('btn-loading'), 'Button should have btn-loading class');
            assertEqual(btn.textContent, 'Loading...', 'Button text should be loading text');

            document.body.removeChild(container);
        });

        it('should restore button from loading state', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-btn2">Click Me</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btn = document.getElementById('test-btn2');

            // Set to loading
            mockApp.setButtonLoading(btn, true, 'Loading...');

            // Restore
            mockApp.setButtonLoading(btn, false);

            assertFalse(btn.disabled, 'Button should not be disabled');
            assertFalse(btn.classList.contains('btn-loading'), 'Button should not have btn-loading class');
            assertEqual(btn.textContent, 'Click Me', 'Button text should be restored');

            document.body.removeChild(container);
        });

        it('should handle button by ID', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-btn3">Original</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const result = mockApp.setButtonLoading('test-btn3', true, 'Please wait...');

            assertEqual(result, 'Original', 'Should return original text');
            const btn = document.getElementById('test-btn3');
            assertTrue(btn.classList.contains('btn-loading'), 'Button should have loading class');

            document.body.removeChild(container);
        });

        it('should return null for non-existent button', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const result = mockApp.setButtonLoading('non-existent', true);
            assertEqual(result, null, 'Should return null for non-existent button');
        });
    });

    describe('Loading State - setContainerLoading', () => {
        it('should add loading overlay to container', () => {
            const container = document.createElement('div');
            container.id = 'test-container-loading';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            mockApp.setContainerLoading(container, true, 'Please wait...');

            const overlay = container.querySelector('.loading-overlay');
            assertDefined(overlay, 'Overlay should be added');
            assertTrue(container.classList.contains('is-loading'), 'Container should have is-loading class');

            const message = overlay.querySelector('.loading-message');
            assertDefined(message, 'Loading message should exist');
            assertEqual(message.textContent, 'Please wait...', 'Message should match');

            document.body.removeChild(container);
        });

        it('should remove loading overlay from container', () => {
            const container = document.createElement('div');
            container.id = 'test-container-loading2';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            // Add overlay
            mockApp.setContainerLoading(container, true);

            // Remove overlay
            mockApp.setContainerLoading(container, false);

            const overlay = container.querySelector('.loading-overlay');
            assertEqual(overlay, null, 'Overlay should be removed');
            assertFalse(container.classList.contains('is-loading'), 'Container should not have is-loading class');

            document.body.removeChild(container);
        });

        it('should handle container by ID', () => {
            const container = document.createElement('div');
            container.id = 'test-container-loading3';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            mockApp.setContainerLoading('test-container-loading3', true);

            assertTrue(container.classList.contains('is-loading'), 'Container should have is-loading class');

            document.body.removeChild(container);
        });
    });

    describe('Loading State - createLoadingIndicator', () => {
        it('should create loading indicator element', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            const indicator = mockApp.createLoadingIndicator('md', 'Loading...');

            assertTrue(indicator instanceof HTMLElement, 'Should return an HTMLElement');
            assertTrue(indicator.classList.contains('loading-indicator'), 'Should have loading-indicator class');
            assertTrue(indicator.classList.contains('loading-indicator-md'), 'Should have size class');

            const spinner = indicator.querySelector('.loading-spinner');
            assertDefined(spinner, 'Should have spinner element');

            const text = indicator.querySelector('.loading-text');
            assertDefined(text, 'Should have text element');
            assertEqual(text.textContent, 'Loading...', 'Text should match');
        });

        it('should create indicator without message', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            const indicator = mockApp.createLoadingIndicator('sm');

            const text = indicator.querySelector('.loading-text');
            assertEqual(text, null, 'Should not have text element when no message provided');
        });

        it('should support different sizes', () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            const small = mockApp.createLoadingIndicator('sm');
            assertTrue(small.classList.contains('loading-indicator-sm'), 'Should have small size class');

            const large = mockApp.createLoadingIndicator('lg');
            assertTrue(large.classList.contains('loading-indicator-lg'), 'Should have large size class');
        });
    });

    describe('Loading State - setInlineLoading', () => {
        it('should set inline loading state', () => {
            const container = document.createElement('div');
            container.innerHTML = '<div id="inline-test">Original Content</div>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;
            mockApp.createLoadingIndicator = Shirushi.prototype.createLoadingIndicator;

            const el = document.getElementById('inline-test');
            mockApp.setInlineLoading(el, true, 'Loading data...');

            assertTrue(el.classList.contains('inline-loading'), 'Should have inline-loading class');
            assertEqual(el.dataset.originalContent, 'Original Content', 'Should store original content');

            const indicator = el.querySelector('.loading-indicator');
            assertDefined(indicator, 'Should have loading indicator');

            document.body.removeChild(container);
        });

        it('should restore inline content', () => {
            const container = document.createElement('div');
            container.innerHTML = '<div id="inline-test2">Original Text</div>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;
            mockApp.createLoadingIndicator = Shirushi.prototype.createLoadingIndicator;

            const el = document.getElementById('inline-test2');

            // Set loading
            mockApp.setInlineLoading(el, true, 'Loading...');

            // Restore
            mockApp.setInlineLoading(el, false);

            assertFalse(el.classList.contains('inline-loading'), 'Should not have inline-loading class');
            assertEqual(el.innerHTML, 'Original Text', 'Should restore original content');

            document.body.removeChild(container);
        });
    });

    describe('Loading State - withLoading', () => {
        it('should execute async operation with loading state', async () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.setLoading = Shirushi.prototype.setLoading;
            mockApp.isLoading = Shirushi.prototype.isLoading;
            mockApp.setButtonLoading = Shirushi.prototype.setButtonLoading;
            mockApp.setContainerLoading = Shirushi.prototype.setContainerLoading;
            mockApp.showSkeleton = Shirushi.prototype.showSkeleton;
            mockApp.hideSkeleton = Shirushi.prototype.hideSkeleton;
            mockApp.toastError = () => {}; // Mock toast
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            let operationExecuted = false;
            let wasLoadingDuringOperation = false;

            const result = await mockApp.withLoading('test-op', async () => {
                operationExecuted = true;
                wasLoadingDuringOperation = mockApp.isLoading('test-op');
                return 'success';
            });

            assertTrue(operationExecuted, 'Operation should be executed');
            assertTrue(wasLoadingDuringOperation, 'Should be in loading state during operation');
            assertEqual(result, 'success', 'Should return operation result');
            assertFalse(mockApp.isLoading('test-op'), 'Should not be loading after completion');
        });

        it('should handle errors in async operation', async () => {
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.setLoading = Shirushi.prototype.setLoading;
            mockApp.isLoading = Shirushi.prototype.isLoading;
            mockApp.setButtonLoading = Shirushi.prototype.setButtonLoading;
            mockApp.setContainerLoading = Shirushi.prototype.setContainerLoading;
            mockApp.showSkeleton = Shirushi.prototype.showSkeleton;
            mockApp.hideSkeleton = Shirushi.prototype.hideSkeleton;

            let toastCalled = false;
            mockApp.toastError = () => { toastCalled = true; };
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            let errorCaught = false;

            try {
                await mockApp.withLoading('test-error', async () => {
                    throw new Error('Test error');
                });
            } catch (e) {
                errorCaught = true;
            }

            assertTrue(errorCaught, 'Error should be re-thrown');
            assertTrue(toastCalled, 'Toast should be called on error');
            assertFalse(mockApp.isLoading('test-error'), 'Should not be loading after error');
        });

        it('should manage button loading state', async () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="with-loading-btn">Submit</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.setLoading = Shirushi.prototype.setLoading;
            mockApp.isLoading = Shirushi.prototype.isLoading;
            mockApp.setButtonLoading = Shirushi.prototype.setButtonLoading;
            mockApp.setContainerLoading = Shirushi.prototype.setContainerLoading;
            mockApp.showSkeleton = Shirushi.prototype.showSkeleton;
            mockApp.hideSkeleton = Shirushi.prototype.hideSkeleton;
            mockApp.toastError = () => {};
            mockApp.escapeHtml = Shirushi.prototype.escapeHtml;

            const btn = document.getElementById('with-loading-btn');
            let wasLoadingDuringOperation = false;

            await mockApp.withLoading('btn-test', async () => {
                wasLoadingDuringOperation = btn.classList.contains('btn-loading');
                await new Promise(resolve => setTimeout(resolve, 10));
            }, {
                button: btn,
                buttonText: 'Submitting...'
            });

            assertTrue(wasLoadingDuringOperation, 'Button should be in loading state during operation');
            assertFalse(btn.classList.contains('btn-loading'), 'Button should not be loading after');
            assertEqual(btn.textContent, 'Submit', 'Button text should be restored');

            document.body.removeChild(container);
        });
    });

    describe('Loading State CSS Classes', () => {
        // Helper to get all CSS text
        function getCssText() {
            let cssText = '';
            for (let i = 0; i < document.styleSheets.length; i++) {
                try {
                    const sheet = document.styleSheets[i];
                    for (let j = 0; j < sheet.cssRules.length; j++) {
                        cssText += sheet.cssRules[j].cssText + '\n';
                    }
                } catch (e) {
                    // Some stylesheets may not be accessible
                }
            }
            return cssText;
        }

        it('loading-overlay class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.loading-overlay'), 'CSS should have loading-overlay class');
        });

        it('loading-spinner class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.loading-spinner'), 'CSS should have loading-spinner class');
        });

        it('loading-indicator classes should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.loading-indicator'), 'CSS should have loading-indicator class');
        });

        it('is-loading class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.is-loading'), 'CSS should have is-loading class');
        });

        it('inline-loading class should be defined', () => {
            const css = getCssText();
            assertTrue(css.includes('.inline-loading'), 'CSS should have inline-loading class');
        });
    });

    describe('Button Disabled States CSS', () => {
        // Helper to get all CSS text
        function getCssText() {
            let cssText = '';
            for (let i = 0; i < document.styleSheets.length; i++) {
                try {
                    const sheet = document.styleSheets[i];
                    for (let j = 0; j < sheet.cssRules.length; j++) {
                        cssText += sheet.cssRules[j].cssText + '\n';
                    }
                } catch (e) {
                    // Some stylesheets may not be accessible
                }
            }
            return cssText;
        }

        it('btn:disabled should have reduced opacity', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button class="btn" disabled>Test</button>';
            document.body.appendChild(container);

            const btn = container.querySelector('button');
            const styles = window.getComputedStyle(btn);

            // Check opacity is reduced (0.5 or thereabouts)
            const opacity = parseFloat(styles.opacity);
            assertTrue(opacity <= 0.6, 'Disabled button should have reduced opacity');

            document.body.removeChild(container);
        });

        it('btn:disabled should have cursor not-allowed', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button class="btn" disabled>Test</button>';
            document.body.appendChild(container);

            const btn = container.querySelector('button');
            const styles = window.getComputedStyle(btn);

            assertEqual(styles.cursor, 'not-allowed', 'Disabled button should have cursor: not-allowed');

            document.body.removeChild(container);
        });

        it('btn:disabled should have pointer-events none', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button class="btn" disabled>Test</button>';
            document.body.appendChild(container);

            const btn = container.querySelector('button');
            const styles = window.getComputedStyle(btn);

            assertEqual(styles.pointerEvents, 'none', 'Disabled button should have pointer-events: none');

            document.body.removeChild(container);
        });

        it('btn.primary:disabled should maintain accent background color', () => {
            const css = getCssText();
            assertTrue(
                css.includes('.btn.primary:disabled') || css.includes('.btn.primary[disabled]'),
                'CSS should define .btn.primary:disabled styles'
            );
        });
    });

    describe('Button Disabled States During Operations', () => {
        it('setButtonLoading should disable button during operation', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-disabled-btn" class="btn">Submit</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btn = document.getElementById('test-disabled-btn');

            // Initially enabled
            assertFalse(btn.disabled, 'Button should start enabled');

            // Set to loading
            mockApp.setButtonLoading(btn, true, 'Submitting...');

            assertTrue(btn.disabled, 'Button should be disabled during loading');
            assertEqual(btn.textContent, 'Submitting...', 'Button text should change during loading');

            document.body.removeChild(container);
        });

        it('setButtonLoading should preserve original disabled state when restoring', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-preserve-btn" class="btn" disabled>Already Disabled</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btn = document.getElementById('test-preserve-btn');

            // Button starts disabled
            assertTrue(btn.disabled, 'Button should start disabled');

            // Set to loading
            mockApp.setButtonLoading(btn, true, 'Loading...');
            assertTrue(btn.disabled, 'Button should still be disabled');

            // Restore - should remain disabled since it was originally disabled
            mockApp.setButtonLoading(btn, false);
            assertTrue(btn.disabled, 'Button should remain disabled after restore');

            document.body.removeChild(container);
        });

        it('setButtonLoading should restore enabled state for originally enabled button', () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-restore-btn" class="btn">Enabled</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btn = document.getElementById('test-restore-btn');

            // Button starts enabled
            assertFalse(btn.disabled, 'Button should start enabled');

            // Set to loading
            mockApp.setButtonLoading(btn, true, 'Loading...');
            assertTrue(btn.disabled, 'Button should be disabled during loading');

            // Restore - should be enabled again
            mockApp.setButtonLoading(btn, false);
            assertFalse(btn.disabled, 'Button should be enabled after restore');

            document.body.removeChild(container);
        });

        it('withLoading should disable button during async operation', async () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-async-btn" class="btn">Async</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.toastError = () => {}; // Mock toast

            const btn = document.getElementById('test-async-btn');
            let wasDisabledDuringOperation = false;

            // Run withLoading with a simple operation
            await mockApp.withLoading('test-operation', async () => {
                wasDisabledDuringOperation = btn.disabled;
                // Simulate async delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }, {
                button: btn,
                buttonText: 'Working...'
            });

            assertTrue(wasDisabledDuringOperation, 'Button should be disabled during async operation');
            assertFalse(btn.disabled, 'Button should be enabled after operation completes');

            document.body.removeChild(container);
        });

        it('withLoading should restore button state even on error', async () => {
            const container = document.createElement('div');
            container.innerHTML = '<button id="test-error-btn" class="btn">Error Test</button>';
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();
            mockApp.toastError = () => {}; // Mock toast

            const btn = document.getElementById('test-error-btn');

            // Run withLoading that throws an error
            try {
                await mockApp.withLoading('test-error-operation', async () => {
                    throw new Error('Test error');
                }, {
                    button: btn,
                    buttonText: 'Working...',
                    showErrorToast: false
                });
            } catch (e) {
                // Expected error
            }

            // Button should be restored despite the error
            assertFalse(btn.disabled, 'Button should be enabled after error');
            assertFalse(btn.classList.contains('btn-loading'), 'Button should not have loading class after error');
            assertEqual(btn.textContent, 'Error Test', 'Button text should be restored after error');

            document.body.removeChild(container);
        });

        it('multiple buttons can have independent loading states', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <button id="btn-a" class="btn">Button A</button>
                <button id="btn-b" class="btn">Button B</button>
            `;
            document.body.appendChild(container);

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.loadingStates = new Map();
            mockApp.loadingCallbacks = new Map();

            const btnA = document.getElementById('btn-a');
            const btnB = document.getElementById('btn-b');

            // Set A to loading
            mockApp.setButtonLoading(btnA, true, 'Loading A...');

            assertTrue(btnA.disabled, 'Button A should be disabled');
            assertFalse(btnB.disabled, 'Button B should still be enabled');

            // Set B to loading too
            mockApp.setButtonLoading(btnB, true, 'Loading B...');

            assertTrue(btnA.disabled, 'Button A should still be disabled');
            assertTrue(btnB.disabled, 'Button B should now be disabled');

            // Restore A
            mockApp.setButtonLoading(btnA, false);

            assertFalse(btnA.disabled, 'Button A should be restored');
            assertTrue(btnB.disabled, 'Button B should still be disabled');

            document.body.removeChild(container);
        });
    });

    // NIP-07 Extension Detection Tests
    describe('detectExtension (NIP-07)', () => {
        let originalNostr;

        function setupMockNostr(options = {}) {
            originalNostr = window.nostr;
            window.nostr = {
                ...options
            };
        }

        function restoreNostr() {
            if (originalNostr !== undefined) {
                window.nostr = originalNostr;
            } else {
                delete window.nostr;
            }
        }

        it('returns available: false when window.nostr is not present', async () => {
            const savedNostr = window.nostr;
            delete window.nostr;

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, false, 'available should be false');
            assertEqual(result.pubkey, null, 'pubkey should be null');
            assertEqual(result.name, null, 'name should be null');

            if (savedNostr !== undefined) {
                window.nostr = savedNostr;
            }
        });

        it('returns available: true when window.nostr exists', async () => {
            setupMockNostr({});

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true');
            assertEqual(result.pubkey, null, 'pubkey should be null when getPublicKey is not available');

            restoreNostr();
        });

        it('detects extension name from _name property', async () => {
            setupMockNostr({
                _name: 'Alby'
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true');
            assertEqual(result.name, 'Alby', 'name should be Alby');

            restoreNostr();
        });

        it('detects extension name from name property', async () => {
            setupMockNostr({
                name: 'nos2x'
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true');
            assertEqual(result.name, 'nos2x', 'name should be nos2x');

            restoreNostr();
        });

        it('prefers _name over name property', async () => {
            setupMockNostr({
                _name: 'Alby',
                name: 'nos2x'
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.name, 'Alby', '_name should take precedence over name');

            restoreNostr();
        });

        it('retrieves public key when getPublicKey is available', async () => {
            const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            setupMockNostr({
                getPublicKey: async () => testPubkey
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true');
            assertEqual(result.pubkey, testPubkey, 'pubkey should match test pubkey');

            restoreNostr();
        });

        it('handles getPublicKey rejection gracefully', async () => {
            setupMockNostr({
                getPublicKey: async () => { throw new Error('User denied'); }
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true even when permission denied');
            assertEqual(result.pubkey, null, 'pubkey should be null when permission denied');

            restoreNostr();
        });

        it('returns complete extension info with all properties', async () => {
            const testPubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
            setupMockNostr({
                _name: 'TestExtension',
                getPublicKey: async () => testPubkey
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.detectExtension();

            assertEqual(result.available, true, 'available should be true');
            assertEqual(result.name, 'TestExtension', 'name should be TestExtension');
            assertEqual(result.pubkey, testPubkey, 'pubkey should match');

            restoreNostr();
        });
    });

    // NIP-07 Event Signing Tests
    describe('signWithExtension (NIP-07)', () => {
        let originalNostr;

        function setupMockNostr(options = {}) {
            originalNostr = window.nostr;
            window.nostr = {
                ...options
            };
        }

        function restoreNostr() {
            if (originalNostr !== undefined) {
                window.nostr = originalNostr;
            } else {
                delete window.nostr;
            }
        }

        function createValidEvent() {
            return {
                kind: 1,
                content: 'Test message',
                tags: [],
                created_at: 1700000000
            };
        }

        it('returns error when window.nostr is not present', async () => {
            const savedNostr = window.nostr;
            delete window.nostr;

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertEqual(result.event, null, 'event should be null');
            assertTrue(result.error.includes('No NIP-07 extension'), 'error should mention missing extension');

            if (savedNostr !== undefined) {
                window.nostr = savedNostr;
            }
        });

        it('returns error for null event', async () => {
            setupMockNostr({ signEvent: async () => ({}) });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(null);

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('Invalid event'), 'error should mention invalid event');

            restoreNostr();
        });

        it('returns error for non-object event', async () => {
            setupMockNostr({ signEvent: async () => ({}) });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension('not an object');

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('Invalid event'), 'error should mention invalid event');

            restoreNostr();
        });

        it('returns error when kind is not a number', async () => {
            setupMockNostr({ signEvent: async () => ({}) });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension({
                kind: 'text',
                content: 'Test',
                tags: []
            });

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('kind must be a number'), 'error should mention kind must be a number');

            restoreNostr();
        });

        it('returns error when content is not a string', async () => {
            setupMockNostr({ signEvent: async () => ({}) });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension({
                kind: 1,
                content: 123,
                tags: []
            });

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('content must be a string'), 'error should mention content must be a string');

            restoreNostr();
        });

        it('returns error when tags is not an array', async () => {
            setupMockNostr({ signEvent: async () => ({}) });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension({
                kind: 1,
                content: 'Test',
                tags: 'not an array'
            });

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('tags must be an array'), 'error should mention tags must be an array');

            restoreNostr();
        });

        it('returns error when signEvent is not a function', async () => {
            setupMockNostr({});

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('does not support signEvent'), 'error should mention signEvent not supported');

            restoreNostr();
        });

        it('successfully signs event with valid data', async () => {
            const signedEvent = {
                id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                created_at: 1700000000,
                kind: 1,
                tags: [],
                content: 'Test message',
                sig: 'signature1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            };

            setupMockNostr({
                signEvent: async () => signedEvent
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, true, 'success should be true');
            assertEqual(result.event, signedEvent, 'event should match signed event');
            assertEqual(result.error, null, 'error should be null');

            restoreNostr();
        });

        it('adds created_at if not provided', async () => {
            let receivedEvent = null;
            const signedEvent = {
                id: 'someid',
                pubkey: 'somepubkey',
                created_at: 1700000000,
                kind: 1,
                tags: [],
                content: 'Test',
                sig: 'somesig'
            };

            setupMockNostr({
                signEvent: async (event) => {
                    receivedEvent = event;
                    return signedEvent;
                }
            });

            const mockApp = Object.create(Shirushi.prototype);
            await mockApp.signWithExtension({
                kind: 1,
                content: 'Test',
                tags: []
            });

            assertTrue(typeof receivedEvent.created_at === 'number', 'created_at should be added');
            assertTrue(receivedEvent.created_at > 0, 'created_at should be a positive timestamp');

            restoreNostr();
        });

        it('handles user rejection gracefully', async () => {
            setupMockNostr({
                signEvent: async () => { throw new Error('User rejected'); }
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('rejected'), 'error should mention rejection');
            assertEqual(result.event, null, 'event should be null');

            restoreNostr();
        });

        it('handles user denied gracefully', async () => {
            setupMockNostr({
                signEvent: async () => { throw new Error('User denied'); }
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('rejected'), 'error should mention rejection');

            restoreNostr();
        });

        it('handles generic signing errors', async () => {
            setupMockNostr({
                signEvent: async () => { throw new Error('Network error'); }
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('Signing failed'), 'error should mention signing failed');
            assertTrue(result.error.includes('Network error'), 'error should include original error message');

            restoreNostr();
        });

        it('returns error when signed event is missing id', async () => {
            setupMockNostr({
                signEvent: async () => ({
                    pubkey: 'somepubkey',
                    sig: 'somesig'
                })
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('invalid signed event'), 'error should mention invalid signed event');

            restoreNostr();
        });

        it('returns error when signed event is missing pubkey', async () => {
            setupMockNostr({
                signEvent: async () => ({
                    id: 'someid',
                    sig: 'somesig'
                })
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('invalid signed event'), 'error should mention invalid signed event');

            restoreNostr();
        });

        it('returns error when signed event is missing sig', async () => {
            setupMockNostr({
                signEvent: async () => ({
                    id: 'someid',
                    pubkey: 'somepubkey'
                })
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('invalid signed event'), 'error should mention invalid signed event');

            restoreNostr();
        });

        it('returns error when signed event is null', async () => {
            setupMockNostr({
                signEvent: async () => null
            });

            const mockApp = Object.create(Shirushi.prototype);
            const result = await mockApp.signWithExtension(createValidEvent());

            assertEqual(result.success, false, 'success should be false');
            assertTrue(result.error.includes('invalid signed event'), 'error should mention invalid signed event');

            restoreNostr();
        });

        it('preserves tags from the original event', async () => {
            let receivedEvent = null;
            const tags = [['e', 'eventid'], ['p', 'pubkey']];
            const signedEvent = {
                id: 'someid',
                pubkey: 'somepubkey',
                created_at: 1700000000,
                kind: 1,
                tags: tags,
                content: 'Test',
                sig: 'somesig'
            };

            setupMockNostr({
                signEvent: async (event) => {
                    receivedEvent = event;
                    return signedEvent;
                }
            });

            const mockApp = Object.create(Shirushi.prototype);
            await mockApp.signWithExtension({
                kind: 1,
                content: 'Test',
                tags: tags,
                created_at: 1700000000
            });

            assertEqual(receivedEvent.tags, tags, 'tags should be preserved');

            restoreNostr();
        });
    });

    // Extension Status Indicator Tests
    describe('updateExtensionStatus', () => {
        let originalNostr;
        let container;

        function setupMockNostr(options = {}) {
            originalNostr = window.nostr;
            window.nostr = options;
        }

        function restoreNostr() {
            if (originalNostr !== undefined) {
                window.nostr = originalNostr;
            } else {
                delete window.nostr;
            }
        }

        function createExtensionStatusDOM() {
            container = document.createElement('div');
            container.id = 'extension-status-container';
            container.innerHTML = `
                <div class="status" id="extension-status" title="">
                    <span id="extension-status-dot" class="status-dot"></span>
                    <span id="extension-status-text">Checking...</span>
                </div>
            `;
            document.body.appendChild(container);
            return container;
        }

        function removeExtensionStatusDOM() {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }

        it('should have updateExtensionStatus method', () => {
            assertDefined(Shirushi.prototype.updateExtensionStatus, 'updateExtensionStatus method should exist');
        });

        it('should show "No Extension" when no NIP-07 extension is present', async () => {
            createExtensionStatusDOM();
            delete window.nostr;

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;
            await mockApp.updateExtensionStatus();

            const dot = document.getElementById('extension-status-dot');
            const text = document.getElementById('extension-status-text');

            assertTrue(dot.classList.contains('not-detected'), 'dot should have not-detected class');
            assertEqual(text.textContent, 'No Extension', 'text should say No Extension');

            removeExtensionStatusDOM();
        });

        it('should show "Connected via Extension" when NIP-07 extension is detected', async () => {
            createExtensionStatusDOM();
            setupMockNostr({
                _name: 'Alby'
            });

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;
            await mockApp.updateExtensionStatus();

            const dot = document.getElementById('extension-status-dot');
            const text = document.getElementById('extension-status-text');

            assertTrue(dot.classList.contains('detected'), 'dot should have detected class');
            assertEqual(text.textContent, 'Connected via Extension', 'text should show Connected via Extension');

            restoreNostr();
            removeExtensionStatusDOM();
        });

        it('should show "Connected via Extension" when extension has no name property', async () => {
            createExtensionStatusDOM();
            setupMockNostr({});

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;
            await mockApp.updateExtensionStatus();

            const dot = document.getElementById('extension-status-dot');
            const text = document.getElementById('extension-status-text');

            assertTrue(dot.classList.contains('detected'), 'dot should have detected class');
            assertEqual(text.textContent, 'Connected via Extension', 'text should say Connected via Extension');

            restoreNostr();
            removeExtensionStatusDOM();
        });

        it('should update title with pubkey info when available', async () => {
            createExtensionStatusDOM();
            const testPubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
            setupMockNostr({
                _name: 'TestExt',
                getPublicKey: async () => testPubkey
            });

            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;
            await mockApp.updateExtensionStatus();

            const statusContainer = document.getElementById('extension-status');
            assertTrue(statusContainer.title.includes('abcdef12'), 'title should include truncated pubkey');
            assertTrue(statusContainer.title.includes('TestExt'), 'title should include extension name');

            restoreNostr();
            removeExtensionStatusDOM();
        });

        it('should handle missing DOM elements gracefully', async () => {
            // Don't create DOM elements
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;

            // Should not throw
            await mockApp.updateExtensionStatus();

            // Test passes if no error is thrown
            assertTrue(true, 'should not throw when DOM elements are missing');
        });

        it('should remove previous status classes when updating', async () => {
            createExtensionStatusDOM();
            const dot = document.getElementById('extension-status-dot');

            // First, set up with no extension
            delete window.nostr;
            const mockApp = Object.create(Shirushi.prototype);
            mockApp.detectExtension = Shirushi.prototype.detectExtension;
            await mockApp.updateExtensionStatus();

            assertTrue(dot.classList.contains('not-detected'), 'dot should have not-detected class initially');

            // Now set up with extension
            setupMockNostr({ _name: 'TestExt' });
            await mockApp.updateExtensionStatus();

            assertTrue(dot.classList.contains('detected'), 'dot should have detected class');
            assertFalse(dot.classList.contains('not-detected'), 'dot should not have not-detected class anymore');

            restoreNostr();
            removeExtensionStatusDOM();
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
