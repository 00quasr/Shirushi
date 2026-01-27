// Shirushi - Nostr Protocol Explorer
// Main Application

class Shirushi {
    constructor() {
        this.ws = null;
        this.relays = [];
        this.events = [];
        this.nips = [];
        this.commandHistory = [];
        this.historyIndex = -1;
        this.selectedNip = null;

        this.currentProfile = null;

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupTabs();
        this.setupRelays();
        this.setupExplorer();
        this.setupEvents();
        this.setupTesting();
        this.setupKeys();
        this.setupConsole();
        this.loadInitialData();
    }

    // WebSocket Connection
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.setConnectionStatus(true);
        };

        this.ws.onclose = () => {
            this.setConnectionStatus(false);
            setTimeout(() => this.setupWebSocket(), 3000);
        };

        this.ws.onerror = () => {
            this.setConnectionStatus(false);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
    }

    setConnectionStatus(connected) {
        const dot = document.getElementById('connection-status');
        const text = document.getElementById('connection-text');

        if (connected) {
            dot.classList.remove('disconnected');
            dot.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            dot.classList.remove('connected');
            dot.classList.add('disconnected');
            text.textContent = 'Disconnected';
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'init':
                this.nips = data.data.nips || [];
                this.renderNipList();
                break;
            case 'event':
                this.addEvent(data.data);
                break;
            case 'relay_status':
                this.updateRelayStatus(data.data);
                break;
            case 'test_result':
                this.showTestResult(data.data);
                break;
        }
    }

    // Tab Navigation
    setupTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    // Relays Tab
    setupRelays() {
        document.getElementById('add-relay-btn').addEventListener('click', () => {
            const url = document.getElementById('relay-url').value.trim();
            if (url) this.addRelay(url);
        });

        document.getElementById('relay-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value.trim();
                if (url) this.addRelay(url);
            }
        });

        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.loadPreset(btn.dataset.preset);
            });
        });
    }

    async loadInitialData() {
        await this.loadRelays();
    }

    async loadRelays() {
        try {
            const response = await fetch('/api/relays');
            this.relays = await response.json();
            this.renderRelays();
        } catch (error) {
            console.error('Failed to load relays:', error);
        }
    }

    renderRelays() {
        const container = document.getElementById('relay-list');
        if (this.relays.length === 0) {
            container.innerHTML = '<p class="hint">No relays connected. Add one below.</p>';
            return;
        }

        container.innerHTML = this.relays.map(relay => `
            <div class="relay-card ${relay.connected ? 'connected' : 'disconnected'}">
                <div class="relay-header">
                    <span class="relay-url">${relay.url}</span>
                    <span class="relay-status ${relay.connected ? 'connected' : 'error'}">
                        ${relay.connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div class="relay-stats">
                    <span>Latency: ${relay.latency_ms > 0 ? relay.latency_ms + 'ms' : 'N/A'}</span>
                    <span>Events: ${(relay.events_per_sec || 0).toFixed(1)}/sec</span>
                </div>
                ${relay.error ? `<div class="relay-error">${relay.error}</div>` : ''}
                <div class="relay-actions">
                    <button class="btn small" onclick="app.removeRelay('${relay.url}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    async addRelay(url) {
        try {
            await fetch('/api/relays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            document.getElementById('relay-url').value = '';
            await this.loadRelays();
        } catch (error) {
            console.error('Failed to add relay:', error);
        }
    }

    async removeRelay(url) {
        try {
            await fetch(`/api/relays?url=${encodeURIComponent(url)}`, {
                method: 'DELETE'
            });
            await this.loadRelays();
        } catch (error) {
            console.error('Failed to remove relay:', error);
        }
    }

    async loadPreset(presetName) {
        try {
            const response = await fetch('/api/relays/presets');
            const presets = await response.json();
            const relays = presets[presetName] || [];

            for (const url of relays) {
                await this.addRelay(url);
            }
        } catch (error) {
            console.error('Failed to load preset:', error);
        }
    }

    updateRelayStatus(status) {
        const relay = this.relays.find(r => r.url === status.url);
        if (relay) {
            Object.assign(relay, status);
            this.renderRelays();
        }
    }

    // Explorer Tab
    setupExplorer() {
        document.getElementById('explore-profile-btn').addEventListener('click', () => {
            this.exploreProfile();
        });

        document.getElementById('profile-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.exploreProfile();
            }
        });

        // Profile sub-tab navigation
        document.querySelectorAll('[data-profile-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.profileTab;
                this.switchProfileTab(tabName);
            });
        });
    }

    async exploreProfile() {
        const input = document.getElementById('profile-search').value.trim();
        if (!input) return;

        const profileCard = document.getElementById('profile-card');
        const profileContent = document.getElementById('profile-content');

        // Show loading state
        profileCard.classList.remove('hidden');
        profileCard.innerHTML = '<p class="loading">Loading profile...</p>';
        profileContent.classList.add('hidden');

        try {
            const response = await fetch(`/api/profile/${encodeURIComponent(input)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load profile');
            }

            const profile = await response.json();
            this.currentProfile = profile;
            this.renderProfile(profile);
            profileContent.classList.remove('hidden');

            // Load profile notes by default
            this.loadProfileNotes(profile.pubkey);
        } catch (error) {
            profileCard.innerHTML = `<p class="error">${this.escapeHtml(error.message)}</p>`;
        }
    }

    renderProfile(profile) {
        const profileCard = document.getElementById('profile-card');

        // Reset card structure
        profileCard.innerHTML = `
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
                    <a id="profile-website" class="profile-link hidden" target="_blank" rel="noopener noreferrer">
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
        `;

        // Set banner
        const banner = document.getElementById('profile-banner');
        if (profile.banner) {
            banner.style.backgroundImage = `url(${profile.banner})`;
        } else {
            banner.style.backgroundImage = '';
        }

        // Set avatar
        const avatar = document.getElementById('profile-avatar');
        if (profile.picture) {
            avatar.style.backgroundImage = `url(${profile.picture})`;
        } else {
            avatar.style.backgroundImage = '';
            avatar.textContent = (profile.name || profile.pubkey || '?')[0].toUpperCase();
        }

        // Set display name and username
        document.getElementById('profile-display-name').textContent =
            profile.display_name || profile.name || 'Anonymous';
        document.getElementById('profile-name').textContent =
            profile.name ? `@${profile.name}` : '';

        // Set pubkey (shortened)
        document.getElementById('profile-pubkey').textContent =
            profile.pubkey.substring(0, 8) + '...' + profile.pubkey.substring(56);

        // Set NIP-05 badge
        const nip05Badge = document.getElementById('profile-nip05-badge');
        if (profile.nip05) {
            nip05Badge.classList.remove('hidden');
            document.getElementById('profile-nip05').textContent = profile.nip05;
        } else {
            nip05Badge.classList.add('hidden');
        }

        // Set about
        document.getElementById('profile-about').textContent = profile.about || '';

        // Set website
        const websiteEl = document.getElementById('profile-website');
        if (profile.website) {
            websiteEl.classList.remove('hidden');
            websiteEl.href = profile.website;
            websiteEl.querySelector('.link-text').textContent = profile.website.replace(/^https?:\/\//, '');
        } else {
            websiteEl.classList.add('hidden');
        }

        // Set lightning address
        const lightningEl = document.getElementById('profile-lightning');
        if (profile.lud16) {
            lightningEl.classList.remove('hidden');
            lightningEl.querySelector('.link-text').textContent = profile.lud16;
        } else {
            lightningEl.classList.add('hidden');
        }

        // Set follow count
        document.getElementById('profile-follow-count').textContent = profile.follow_count || 0;

        // Setup copy button
        document.getElementById('copy-npub-btn').addEventListener('click', async () => {
            try {
                const response = await fetch('/api/keys/encode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'npub', hex: profile.pubkey })
                });
                const result = await response.json();
                if (result.encoded) {
                    navigator.clipboard.writeText(result.encoded);
                    document.getElementById('copy-npub-btn').textContent = 'Copied!';
                    setTimeout(() => {
                        document.getElementById('copy-npub-btn').textContent = 'Copy npub';
                    }, 1500);
                }
            } catch (error) {
                console.error('Failed to copy npub:', error);
            }
        });
    }

    switchProfileTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('[data-profile-tab]').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-profile-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`profile-${tabName}-tab`).classList.add('active');

        // Load tab data if needed
        if (this.currentProfile) {
            switch (tabName) {
                case 'notes':
                    this.loadProfileNotes(this.currentProfile.pubkey);
                    break;
                case 'following':
                    this.loadProfileFollowing(this.currentProfile.pubkey);
                    break;
                case 'zaps':
                    this.loadProfileZaps(this.currentProfile.pubkey);
                    break;
            }
        }
    }

    async loadProfileNotes(pubkey) {
        const container = document.getElementById('profile-notes-list');
        container.innerHTML = '<p class="loading">Loading notes...</p>';

        try {
            const response = await fetch(`/api/events?kind=1&author=${pubkey}&limit=20`);
            const notes = await response.json() || [];

            if (notes.length === 0) {
                container.innerHTML = '<p class="hint">No notes found</p>';
                return;
            }

            container.innerHTML = notes.map(note => `
                <div class="note-card">
                    <div class="note-content">${this.escapeHtml(note.content)}</div>
                    <div class="note-meta">
                        <span class="note-time">${this.formatTime(note.created_at)}</span>
                        <span class="note-id">${note.id.substring(0, 8)}...</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error">Failed to load notes: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    async loadProfileFollowing(pubkey) {
        const container = document.getElementById('profile-following-list');
        container.innerHTML = '<p class="loading">Loading following list...</p>';

        try {
            // Query kind 3 (contact list) for this pubkey
            const response = await fetch(`/api/events?kind=3&author=${pubkey}&limit=1`);
            const events = await response.json() || [];

            if (events.length === 0) {
                container.innerHTML = '<p class="hint">No following list found</p>';
                return;
            }

            // Parse contact list from tags
            const event = events[0];
            const follows = event.tags
                .filter(tag => tag[0] === 'p')
                .map(tag => ({
                    pubkey: tag[1],
                    relay: tag[2] || null,
                    petname: tag[3] || null
                }));

            // Update follow count
            document.getElementById('profile-follow-count').textContent = follows.length;

            if (follows.length === 0) {
                container.innerHTML = '<p class="hint">Not following anyone</p>';
                return;
            }

            container.innerHTML = follows.slice(0, 50).map(follow => `
                <div class="follow-card" onclick="app.exploreProfileByPubkey('${follow.pubkey}')">
                    <span class="follow-pubkey">${follow.pubkey.substring(0, 16)}...</span>
                    ${follow.petname ? `<span class="follow-petname">${this.escapeHtml(follow.petname)}</span>` : ''}
                    ${follow.relay ? `<span class="follow-relay">${this.escapeHtml(follow.relay)}</span>` : ''}
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error">Failed to load following: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    async loadProfileZaps(pubkey) {
        const container = document.getElementById('profile-zaps-list');
        container.innerHTML = '<p class="loading">Loading zap history...</p>';

        try {
            // Query kind 9735 (zap receipts) where this pubkey is the recipient
            const response = await fetch(`/api/events?kind=9735&limit=50`);
            const allZaps = await response.json() || [];

            // Filter zaps for this pubkey (check 'p' tag)
            const zaps = allZaps.filter(zap =>
                zap.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey)
            );

            // Parse zap amounts from bolt11 tags
            let totalSats = 0;
            let topZap = 0;
            const parsedZaps = zaps.map(zap => {
                const bolt11Tag = zap.tags.find(t => t[0] === 'bolt11');
                const descTag = zap.tags.find(t => t[0] === 'description');
                let amount = 0;
                let senderPubkey = '';

                // Try to extract amount from description
                if (descTag && descTag[1]) {
                    try {
                        const desc = JSON.parse(descTag[1]);
                        if (desc.amount) {
                            amount = Math.floor(parseInt(desc.amount) / 1000); // msats to sats
                        }
                        senderPubkey = desc.pubkey || '';
                    } catch (e) {
                        // Ignore parse errors
                    }
                }

                totalSats += amount;
                if (amount > topZap) topZap = amount;

                return {
                    id: zap.id,
                    amount,
                    sender: senderPubkey,
                    content: zap.content,
                    created_at: zap.created_at
                };
            });

            // Update stats
            document.getElementById('zap-total-count').textContent = zaps.length;
            document.getElementById('zap-total-sats').textContent = totalSats.toLocaleString();
            document.getElementById('zap-avg-sats').textContent =
                zaps.length > 0 ? Math.round(totalSats / zaps.length).toLocaleString() : '0';
            document.getElementById('zap-top-zap').textContent = topZap.toLocaleString();

            if (parsedZaps.length === 0) {
                container.innerHTML = '<p class="hint">No zaps found</p>';
                return;
            }

            container.innerHTML = parsedZaps.map(zap => `
                <div class="zap-card">
                    <span class="zap-amount">⚡ ${zap.amount.toLocaleString()} sats</span>
                    <span class="zap-sender">${zap.sender ? zap.sender.substring(0, 16) + '...' : 'Anonymous'}</span>
                    <span class="zap-time">${this.formatTime(zap.created_at)}</span>
                    ${zap.content ? `<span class="zap-message">${this.escapeHtml(zap.content)}</span>` : ''}
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error">Failed to load zaps: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    exploreProfileByPubkey(pubkey) {
        document.getElementById('profile-search').value = pubkey;
        this.exploreProfile();
    }

    // Events Tab
    setupEvents() {
        document.getElementById('apply-filter-btn').addEventListener('click', () => {
            this.applyEventFilter();
        });

        document.getElementById('clear-filter-btn').addEventListener('click', () => {
            document.getElementById('filter-kind').value = '';
            document.getElementById('filter-author').value = '';
            this.loadEvents();
        });

        document.getElementById('clear-events-btn').addEventListener('click', () => {
            this.events = [];
            this.renderEvents();
        });
    }

    async loadEvents() {
        try {
            const kind = document.getElementById('filter-kind').value;
            const author = document.getElementById('filter-author').value;

            let url = '/api/events?';
            if (kind) url += `kind=${kind}&`;
            if (author) url += `author=${author}&`;

            const response = await fetch(url);
            this.events = await response.json() || [];
            this.renderEvents();
        } catch (error) {
            console.error('Failed to load events:', error);
        }
    }

    applyEventFilter() {
        this.loadEvents();
    }

    addEvent(event) {
        this.events.unshift(event);
        if (this.events.length > 100) {
            this.events.pop();
        }
        this.renderEvents();

        if (document.getElementById('auto-scroll').checked) {
            const container = document.getElementById('event-list');
            container.scrollTop = 0;
        }
    }

    renderEvents() {
        const container = document.getElementById('event-list');
        if (this.events.length === 0) {
            container.innerHTML = '<p class="hint">No events yet. Apply filters or wait for events.</p>';
            return;
        }

        container.innerHTML = this.events.map(event => `
            <div class="event-card">
                <div class="event-header">
                    <span class="event-kind">kind:${event.kind}</span>
                    <span class="event-time">${this.formatTime(event.created_at)}</span>
                </div>
                <div class="event-id">ID: ${event.id.substring(0, 16)}...</div>
                <div class="event-author">Author: ${event.pubkey.substring(0, 16)}...</div>
                <div class="event-content">${this.escapeHtml(event.content.substring(0, 200))}${event.content.length > 200 ? '...' : ''}</div>
                ${event.relay ? `<div class="event-relay">via ${event.relay}</div>` : ''}
                <div class="event-actions">
                    <button class="btn small" onclick="app.showEventJson('${event.id}')">Raw JSON</button>
                </div>
            </div>
        `).join('');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showEventJson(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            alert(JSON.stringify(event, null, 2));
        }
    }

    // Testing Tab
    setupTesting() {
        // NIP list click handler will be set up after rendering
    }

    renderNipList() {
        const container = document.getElementById('nip-test-list');
        container.innerHTML = this.nips.map(nip => `
            <div class="nip-item ${this.selectedNip === nip.id ? 'selected' : ''}" data-nip="${nip.id}">
                <span class="nip-name">${nip.name}</span>
                <span class="nip-title">${nip.title}</span>
            </div>
        `).join('');

        container.querySelectorAll('.nip-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectNip(item.dataset.nip);
            });
        });
    }

    selectNip(nipId) {
        this.selectedNip = nipId;
        this.renderNipList();

        const nip = this.nips.find(n => n.id === nipId);
        if (nip) {
            this.renderTestForm(nip);
        }
    }

    renderTestForm(nip) {
        const container = document.getElementById('test-form');
        let formFields = '';

        // Add NIP-specific form fields
        switch (nip.id) {
            case 'nip05':
                formFields = `
                    <div class="form-group">
                        <label>NIP-05 Address:</label>
                        <input type="text" id="test-param-address" placeholder="user@domain.com" value="_@fiatjaf.com">
                    </div>
                `;
                break;
            case 'nip02':
            case 'nip57':
                formFields = `
                    <div class="form-group">
                        <label>Public Key (npub or hex):</label>
                        <input type="text" id="test-param-pubkey" placeholder="npub1... or hex">
                    </div>
                `;
                break;
            case 'nip19':
                formFields = `
                    <div class="form-group">
                        <label>Input to decode:</label>
                        <input type="text" id="test-param-input" placeholder="npub1..., nsec1..., note1...">
                    </div>
                `;
                break;
            case 'nip90':
                formFields = `
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="test-param-submit">
                            Submit test job (will publish event)
                        </label>
                    </div>
                `;
                break;
        }

        container.innerHTML = `
            <h3>${nip.name}: ${nip.title}</h3>
            <p class="nip-description">${nip.description}</p>
            <a href="${nip.specUrl}" target="_blank" class="spec-link">View Specification</a>
            ${formFields}
            <button class="btn primary" id="run-test-btn">Run Test</button>
        `;

        document.getElementById('run-test-btn').addEventListener('click', () => {
            this.runTest(nip.id);
        });

        document.getElementById('test-results').innerHTML = '';
    }

    async runTest(nipId) {
        const params = this.getTestParams(nipId);
        const resultsContainer = document.getElementById('test-results');

        resultsContainer.innerHTML = '<p class="loading">Running test...</p>';

        try {
            const response = await fetch(`/api/test/${nipId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            const result = await response.json();
            this.showTestResult(result);
        } catch (error) {
            resultsContainer.innerHTML = `<p class="error">Test failed: ${error.message}</p>`;
        }
    }

    getTestParams(nipId) {
        const params = {};

        switch (nipId) {
            case 'nip05':
                params.address = document.getElementById('test-param-address')?.value;
                break;
            case 'nip02':
            case 'nip57':
                params.pubkey = document.getElementById('test-param-pubkey')?.value;
                break;
            case 'nip19':
                params.input = document.getElementById('test-param-input')?.value;
                break;
            case 'nip90':
                params.submit = document.getElementById('test-param-submit')?.checked;
                break;
        }

        return params;
    }

    showTestResult(result) {
        const container = document.getElementById('test-results');
        const statusClass = result.success ? 'success' : 'failure';

        container.innerHTML = `
            <div class="test-result ${statusClass}">
                <div class="result-header">
                    <span class="result-status">${result.success ? 'PASSED' : 'FAILED'}</span>
                    <span class="result-message">${result.message}</span>
                </div>
                <div class="result-steps">
                    ${result.steps.map(step => `
                        <div class="step ${step.success ? 'success' : 'failure'}">
                            <span class="step-icon">${step.success ? '✓' : '✗'}</span>
                            <span class="step-name">${step.name}</span>
                            ${step.output ? `<span class="step-output">${this.escapeHtml(step.output)}</span>` : ''}
                            ${step.error ? `<span class="step-error">${this.escapeHtml(step.error)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Keys Tab
    setupKeys() {
        document.getElementById('generate-key-btn').addEventListener('click', () => {
            this.generateKeys();
        });

        document.getElementById('toggle-nsec').addEventListener('click', (e) => {
            const input = document.getElementById('nsec-value');
            if (input.type === 'password') {
                input.type = 'text';
                e.target.textContent = 'Hide';
            } else {
                input.type = 'password';
                e.target.textContent = 'Show';
            }
        });

        document.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.copy);
                navigator.clipboard.writeText(input.value);
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 1500);
            });
        });

        document.getElementById('decode-btn').addEventListener('click', () => {
            this.decodeNip19();
        });

        document.querySelectorAll('[data-encode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.encodeNip19(btn.dataset.encode);
            });
        });
    }

    async generateKeys() {
        try {
            const response = await fetch('/api/keys/generate', { method: 'POST' });
            const keypair = await response.json();

            if (keypair.error) {
                alert(keypair.error);
                return;
            }

            document.getElementById('nsec-value').value = keypair.private_key;
            document.getElementById('npub-value').value = keypair.public_key;
            document.getElementById('hex-pubkey-value').value = keypair.hex_pubkey;
            document.getElementById('keypair-result').classList.remove('hidden');
        } catch (error) {
            alert('Failed to generate keys: ' + error.message);
        }
    }

    async decodeNip19() {
        const input = document.getElementById('nip19-input').value.trim();
        if (!input) return;

        try {
            const response = await fetch('/api/keys/decode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input })
            });
            const result = await response.json();

            const container = document.getElementById('nip19-result');
            container.classList.remove('hidden');

            if (result.error) {
                container.innerHTML = `<p class="error">${result.error}</p>`;
            } else {
                container.innerHTML = `
                    <p><strong>Type:</strong> ${result.type}</p>
                    <p><strong>Hex:</strong> ${result.hex}</p>
                    ${result.relays?.length ? `<p><strong>Relays:</strong> ${result.relays.join(', ')}</p>` : ''}
                    ${result.author ? `<p><strong>Author:</strong> ${result.author}</p>` : ''}
                `;
            }
        } catch (error) {
            alert('Failed to decode: ' + error.message);
        }
    }

    async encodeNip19(type) {
        const input = document.getElementById('nip19-input').value.trim();
        if (!input) return;

        try {
            const response = await fetch('/api/keys/encode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, hex: input })
            });
            const result = await response.json();

            const container = document.getElementById('nip19-result');
            container.classList.remove('hidden');

            if (result.error) {
                container.innerHTML = `<p class="error">${result.error}</p>`;
            } else {
                container.innerHTML = `
                    <p><strong>Encoded (${type}):</strong></p>
                    <p class="encoded-value">${result.encoded}</p>
                    <button class="btn small" onclick="navigator.clipboard.writeText('${result.encoded}')">Copy</button>
                `;
            }
        } catch (error) {
            alert('Failed to encode: ' + error.message);
        }
    }

    // Console Tab
    setupConsole() {
        const input = document.getElementById('nak-command');

        document.getElementById('run-nak-btn').addEventListener('click', () => {
            this.runNakCommand();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.runNakCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
    }

    async runNakCommand() {
        const input = document.getElementById('nak-command');
        const command = input.value.trim();
        if (!command) return;

        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        this.renderCommandHistory();

        const output = document.getElementById('nak-output');
        output.textContent = 'Running...';

        try {
            const args = command.split(' ').filter(s => s);
            const response = await fetch('/api/nak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args })
            });
            const result = await response.json();

            if (result.error) {
                output.textContent = `Error: ${result.error}`;
            } else {
                output.textContent = result.output || '(no output)';
            }
        } catch (error) {
            output.textContent = `Error: ${error.message}`;
        }

        input.value = '';
    }

    navigateHistory(direction) {
        const input = document.getElementById('nak-command');
        this.historyIndex += direction;

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            input.value = '';
            return;
        }

        input.value = this.commandHistory[this.historyIndex] || '';
    }

    renderCommandHistory() {
        const container = document.getElementById('command-history');
        container.innerHTML = this.commandHistory.slice(-10).reverse().map(cmd => `
            <div class="history-item" onclick="document.getElementById('nak-command').value='${this.escapeHtml(cmd)}'">
                nak ${this.escapeHtml(cmd)}
            </div>
        `).join('');
    }
}

// Initialize app
const app = new Shirushi();
