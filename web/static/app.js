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

        // Monitoring state
        this.monitoringData = null;
        this.eventRateHistory = [];
        this.healthScoreHistory = {};
        this.charts = {
            eventRate: null,
            latency: null,
            healthScore: null
        };

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
        this.setupMonitoring();
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
            case 'monitoring_update':
                this.handleMonitoringUpdate(data.data);
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

        // Set NIP-05 badge with verification status
        const nip05Badge = document.getElementById('profile-nip05-badge');
        const nip05Icon = nip05Badge.querySelector('.nip05-icon');
        if (profile.nip05) {
            nip05Badge.classList.remove('hidden');
            document.getElementById('profile-nip05').textContent = profile.nip05;

            // Update badge based on verification status
            if (profile.nip05_valid) {
                nip05Badge.classList.remove('unverified', 'verifying');
                nip05Icon.textContent = '✓';
                nip05Icon.title = 'NIP-05 verified';
            } else {
                nip05Badge.classList.add('unverified');
                nip05Badge.classList.remove('verifying');
                nip05Icon.textContent = '✗';
                nip05Icon.title = 'NIP-05 not verified';
            }
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

    // Monitoring Tab
    setupMonitoring() {
        // Initialize charts when tab is first shown
        this.monitoringInitialized = false;

        // Start polling for monitoring data
        this.startMonitoringPolling();
    }

    startMonitoringPolling() {
        // Load initial data
        this.loadMonitoringData();

        // Poll every 5 seconds
        setInterval(() => {
            if (document.getElementById('monitoring-tab').classList.contains('active')) {
                this.loadMonitoringData();
            }
        }, 5000);
    }

    async loadMonitoringData() {
        try {
            const response = await fetch('/api/monitoring/history');
            const data = await response.json();

            if (data) {
                this.monitoringData = data;
                this.updateMonitoringUI(data);
            }
        } catch (error) {
            console.error('Failed to load monitoring data:', error);
        }
    }

    handleMonitoringUpdate(data) {
        this.monitoringData = data;
        this.updateMonitoringUI(data);
    }

    updateMonitoringUI(data) {
        // Update summary stats
        document.getElementById('monitoring-connected').textContent = data.connected_count || 0;
        document.getElementById('monitoring-total').textContent = data.total_count || 0;
        document.getElementById('monitoring-events-sec').textContent =
            (data.events_per_sec || 0).toFixed(1);
        document.getElementById('monitoring-total-events').textContent =
            this.formatNumber(data.total_events || 0);

        // Update relay health grid
        this.renderRelayHealthGrid(data.relays || []);

        // Initialize or update charts
        if (!this.monitoringInitialized) {
            this.initializeCharts();
            this.monitoringInitialized = true;
        }

        // Update charts with new data
        this.updateCharts(data);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    renderRelayHealthGrid(relays) {
        const container = document.getElementById('relay-health-list');

        if (relays.length === 0) {
            container.innerHTML = '<p class="hint">No relays connected. Add relays from the Relays tab.</p>';
            return;
        }

        container.innerHTML = relays.map(relay => {
            const healthClass = this.getHealthClass(relay.health_score, relay.connected);
            const scoreClass = this.getScoreClass(relay.health_score);

            return `
                <div class="relay-health-card ${healthClass}">
                    <div class="relay-health-header">
                        <span class="relay-health-url" title="${relay.url}">${relay.url}</span>
                        <div class="relay-health-score">
                            <span class="health-score-value ${scoreClass}">${Math.round(relay.health_score || 0)}%</span>
                            <div class="health-score-bar">
                                <div class="health-score-fill ${scoreClass}" style="width: ${relay.health_score || 0}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="relay-health-metrics">
                        <div class="relay-health-metric">
                            <span class="metric-label">Status</span>
                            <span class="metric-value ${relay.connected ? 'connected' : 'disconnected'}">
                                ${relay.connected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div class="relay-health-metric">
                            <span class="metric-label">Latency</span>
                            <span class="metric-value">${relay.latency_ms > 0 ? relay.latency_ms + 'ms' : 'N/A'}</span>
                        </div>
                        <div class="relay-health-metric">
                            <span class="metric-label">Events/sec</span>
                            <span class="metric-value">${(relay.events_per_sec || 0).toFixed(1)}</span>
                        </div>
                        <div class="relay-health-metric">
                            <span class="metric-label">Uptime</span>
                            <span class="metric-value">${(relay.uptime_percent || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${relay.last_error ? `
                        <div class="relay-health-error">
                            ${this.escapeHtml(relay.last_error)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    getHealthClass(score, connected) {
        if (!connected) return 'offline';
        if (score >= 80) return 'healthy';
        if (score >= 50) return 'degraded';
        return 'unhealthy';
    }

    getScoreClass(score) {
        if (score >= 80) return 'good';
        if (score >= 50) return 'medium';
        return 'poor';
    }

    initializeCharts() {
        // Event Rate Chart
        const eventRateCanvas = document.getElementById('event-rate-chart');
        if (eventRateCanvas) {
            const ctx = eventRateCanvas.getContext('2d');
            this.charts.eventRate = this.createLineChart(ctx, 'Event Rate', 'events/sec');
        }

        // Latency Distribution Chart
        const latencyCanvas = document.getElementById('latency-chart');
        if (latencyCanvas) {
            const ctx = latencyCanvas.getContext('2d');
            this.charts.latency = this.createBarChart(ctx, 'Latency Distribution');
        }

        // Health Score History Chart
        const healthCanvas = document.getElementById('health-score-chart');
        if (healthCanvas) {
            const ctx = healthCanvas.getContext('2d');
            this.charts.healthScore = this.createMultiLineChart(ctx, 'Health Score', '%');
        }
    }

    createLineChart(ctx, label, unit) {
        return {
            ctx,
            label,
            unit,
            data: [],
            maxPoints: 60,
            draw() {
                const { width, height } = ctx.canvas;
                ctx.clearRect(0, 0, width, height);

                if (this.data.length < 2) {
                    ctx.fillStyle = '#666666';
                    ctx.font = '13px Geist, system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('Collecting data...', width / 2, height / 2);
                    return;
                }

                const padding = { top: 20, right: 20, bottom: 30, left: 50 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;

                // Find data range
                const values = this.data.map(d => d.value);
                const maxValue = Math.max(...values, 1);
                const minValue = 0;

                // Draw grid lines
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 1;
                for (let i = 0; i <= 4; i++) {
                    const y = padding.top + (chartHeight * i / 4);
                    ctx.beginPath();
                    ctx.moveTo(padding.left, y);
                    ctx.lineTo(width - padding.right, y);
                    ctx.stroke();

                    // Y-axis labels
                    const labelValue = maxValue - (maxValue * i / 4);
                    ctx.fillStyle = '#666666';
                    ctx.font = '11px Geist Mono, monospace';
                    ctx.textAlign = 'right';
                    ctx.fillText(labelValue.toFixed(1), padding.left - 8, y + 4);
                }

                // Draw line
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.beginPath();

                this.data.forEach((point, i) => {
                    const x = padding.left + (chartWidth * i / (this.data.length - 1));
                    const y = padding.top + chartHeight - (chartHeight * (point.value - minValue) / (maxValue - minValue));

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.stroke();

                // Draw area under line
                ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
                ctx.lineTo(padding.left, padding.top + chartHeight);
                ctx.closePath();
                ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
                ctx.fill();

                // Draw unit label
                ctx.fillStyle = '#666666';
                ctx.font = '11px Geist, system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(this.unit, padding.left, padding.top - 8);
            },
            addPoint(value) {
                this.data.push({ value, timestamp: Date.now() });
                if (this.data.length > this.maxPoints) {
                    this.data.shift();
                }
                this.draw();
            },
            setData(points) {
                this.data = points.slice(-this.maxPoints);
                this.draw();
            }
        };
    }

    createBarChart(ctx, label) {
        return {
            ctx,
            label,
            data: [],
            draw() {
                const { width, height } = ctx.canvas;
                ctx.clearRect(0, 0, width, height);

                if (this.data.length === 0) {
                    ctx.fillStyle = '#666666';
                    ctx.font = '13px Geist, system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('No data available', width / 2, height / 2);
                    return;
                }

                const padding = { top: 20, right: 20, bottom: 40, left: 50 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;

                const maxValue = Math.max(...this.data.map(d => d.value), 1);
                const barWidth = (chartWidth / this.data.length) * 0.7;
                const barGap = (chartWidth / this.data.length) * 0.3;

                // Draw bars
                this.data.forEach((item, i) => {
                    const barHeight = (item.value / maxValue) * chartHeight;
                    const x = padding.left + (i * (barWidth + barGap)) + barGap / 2;
                    const y = padding.top + chartHeight - barHeight;

                    // Color based on latency value
                    let color = '#22c55e'; // green for low latency
                    if (item.value > 500) color = '#ef4444'; // red for high
                    else if (item.value > 200) color = '#eab308'; // yellow for medium

                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, barWidth, barHeight);

                    // Draw label
                    ctx.fillStyle = '#666666';
                    ctx.font = '10px Geist Mono, monospace';
                    ctx.textAlign = 'center';
                    ctx.save();
                    ctx.translate(x + barWidth / 2, height - 5);
                    ctx.rotate(-Math.PI / 4);
                    ctx.fillText(item.label.substring(0, 15) + (item.label.length > 15 ? '...' : ''), 0, 0);
                    ctx.restore();

                    // Draw value on top
                    ctx.fillStyle = '#a1a1a1';
                    ctx.font = '10px Geist Mono, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(item.value + 'ms', x + barWidth / 2, y - 4);
                });

                // Y-axis label
                ctx.fillStyle = '#666666';
                ctx.font = '11px Geist, system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('ms', padding.left, padding.top - 8);
            },
            setData(items) {
                this.data = items;
                this.draw();
            }
        };
    }

    createMultiLineChart(ctx, label, unit) {
        return {
            ctx,
            label,
            unit,
            series: {},
            colors: ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
            maxPoints: 60,
            draw() {
                const { width, height } = ctx.canvas;
                ctx.clearRect(0, 0, width, height);

                const seriesNames = Object.keys(this.series);
                if (seriesNames.length === 0) {
                    ctx.fillStyle = '#666666';
                    ctx.font = '13px Geist, system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('Collecting data...', width / 2, height / 2);
                    return;
                }

                const padding = { top: 20, right: 20, bottom: 30, left: 50 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;

                // Draw grid
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 1;
                for (let i = 0; i <= 4; i++) {
                    const y = padding.top + (chartHeight * i / 4);
                    ctx.beginPath();
                    ctx.moveTo(padding.left, y);
                    ctx.lineTo(width - padding.right, y);
                    ctx.stroke();

                    const labelValue = 100 - (100 * i / 4);
                    ctx.fillStyle = '#666666';
                    ctx.font = '11px Geist Mono, monospace';
                    ctx.textAlign = 'right';
                    ctx.fillText(labelValue.toFixed(0) + '%', padding.left - 8, y + 4);
                }

                // Draw each series
                seriesNames.forEach((name, seriesIndex) => {
                    const data = this.series[name];
                    if (data.length < 2) return;

                    const color = this.colors[seriesIndex % this.colors.length];
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();

                    data.forEach((point, i) => {
                        const x = padding.left + (chartWidth * i / (data.length - 1));
                        const y = padding.top + chartHeight - (chartHeight * point.value / 100);

                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.stroke();
                });

                // Draw legend
                const legendY = height - 10;
                let legendX = padding.left;
                seriesNames.slice(0, 4).forEach((name, i) => {
                    const color = this.colors[i % this.colors.length];
                    ctx.fillStyle = color;
                    ctx.fillRect(legendX, legendY - 8, 10, 10);
                    ctx.fillStyle = '#666666';
                    ctx.font = '10px Geist, system-ui, sans-serif';
                    ctx.textAlign = 'left';
                    const shortName = name.replace('wss://', '').substring(0, 20);
                    ctx.fillText(shortName, legendX + 14, legendY);
                    legendX += ctx.measureText(shortName).width + 30;
                });

                if (seriesNames.length > 4) {
                    ctx.fillText(`+${seriesNames.length - 4} more`, legendX, legendY);
                }
            },
            addPoint(seriesName, value) {
                if (!this.series[seriesName]) {
                    this.series[seriesName] = [];
                }
                this.series[seriesName].push({ value, timestamp: Date.now() });
                if (this.series[seriesName].length > this.maxPoints) {
                    this.series[seriesName].shift();
                }
                this.draw();
            },
            setSeriesData(seriesName, points) {
                this.series[seriesName] = points.slice(-this.maxPoints);
                this.draw();
            }
        };
    }

    updateCharts(data) {
        // Update event rate chart
        if (this.charts.eventRate) {
            if (data.event_rate_history && data.event_rate_history.length > 0) {
                const points = data.event_rate_history.map(p => ({ value: p.value }));
                this.charts.eventRate.setData(points);
            } else {
                this.charts.eventRate.addPoint(data.events_per_sec || 0);
            }
        }

        // Update latency distribution chart
        if (this.charts.latency && data.relays) {
            const latencyData = data.relays
                .filter(r => r.connected && r.latency_ms > 0)
                .map(r => ({
                    label: r.url.replace('wss://', ''),
                    value: r.latency_ms
                }))
                .sort((a, b) => a.value - b.value)
                .slice(0, 10);
            this.charts.latency.setData(latencyData);
        }

        // Update health score history chart
        if (this.charts.healthScore && data.relays) {
            data.relays.forEach(relay => {
                if (relay.latency_history && relay.latency_history.length > 0) {
                    // Use health score if available, or derive from other metrics
                    const healthPoints = relay.latency_history.map((p, i) => ({
                        value: relay.health_score || this.calculateHealthScore(relay)
                    }));
                    this.charts.healthScore.setSeriesData(relay.url, healthPoints);
                } else {
                    this.charts.healthScore.addPoint(relay.url, relay.health_score || 0);
                }
            });
        }
    }

    calculateHealthScore(relay) {
        if (!relay.connected) return 0;
        let score = 100;

        // Penalize high latency
        if (relay.latency_ms > 1000) score -= 40;
        else if (relay.latency_ms > 500) score -= 20;
        else if (relay.latency_ms > 200) score -= 10;

        // Penalize errors
        if (relay.error_count > 0) {
            score -= Math.min(relay.error_count * 5, 30);
        }

        return Math.max(0, score);
    }
}

// Initialize app
const app = new Shirushi();
