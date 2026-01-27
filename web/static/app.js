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
        this.relayLatencyHistory = {};
        this.charts = {
            eventRate: null,
            latency: null,
            healthScore: null
        };
        this.maxHistoryPoints = 60;

        // Toast notification state
        this.toastContainer = null;
        this.toastQueue = [];
        this.maxToasts = 5;

        // Loading state management
        this.loadingStates = new Map();
        this.loadingCallbacks = new Map();

        // Publish state
        this.publishTags = [];
        this.publishHistory = [];

        this.init();
    }

    init() {
        this.setupToasts();
        this.setupModal();
        this.setupWebSocket();
        this.setupTabs();
        this.setupRelays();
        this.setupExplorer();
        this.setupEvents();
        this.setupPublish();
        this.setupTesting();
        this.setupKeys();
        this.setupConsole();
        this.setupMonitoring();
        this.loadInitialData();
        this.updateExtensionStatus();
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

    async updateExtensionStatus() {
        const dot = document.getElementById('extension-status-dot');
        const text = document.getElementById('extension-status-text');
        const container = document.getElementById('extension-status');

        if (!dot || !text || !container) return;

        const result = await this.detectExtension();

        dot.classList.remove('detected', 'not-detected');

        if (result.available) {
            dot.classList.add('detected');
            const name = result.name || 'NIP-07';
            text.textContent = 'Connected via Extension';
            container.title = result.pubkey
                ? `${name} extension detected\nPublic key: ${result.pubkey.slice(0, 8)}...`
                : `${name} extension detected`;
        } else {
            dot.classList.add('not-detected');
            text.textContent = 'No Extension';
            container.title = 'No NIP-07 browser extension detected. Install Alby, nos2x, or another compatible extension to sign events.';
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
                this.loadPreset(btn.dataset.preset, btn);
            });
        });
    }

    async loadInitialData() {
        await this.loadRelays();
    }

    async loadRelays() {
        // Show skeleton while loading
        this.showSkeleton('relay-list-skeleton');
        try {
            const response = await fetch('/api/relays');
            this.relays = await response.json();
            this.hideSkeleton('relay-list-skeleton');
            this.renderRelays();
        } catch (error) {
            this.hideSkeleton('relay-list-skeleton');
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
                    <span class="relay-url">${this.escapeHtml(relay.url)}</span>
                    <span class="relay-status ${relay.connected ? 'connected' : 'error'}">
                        ${relay.connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div class="relay-stats">
                    <span>Latency: ${relay.latency_ms > 0 ? relay.latency_ms + 'ms' : 'N/A'}</span>
                    <span>Events: ${(relay.events_per_sec || 0).toFixed(1)}/sec</span>
                </div>
                ${relay.error ? `<div class="relay-error">${this.escapeHtml(relay.error)}</div>` : ''}
                <div class="relay-actions">
                    <button class="btn small copy-btn" data-copy-relay="${this.escapeHtml(relay.url)}">Copy URL</button>
                    <button class="btn small" onclick="app.removeRelay('${this.escapeHtml(relay.url)}')">Remove</button>
                </div>
            </div>
        `).join('');

        // Attach copy handlers to relay URL buttons
        container.querySelectorAll('[data-copy-relay]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.copyRelay;
                this.copyToClipboard(url, btn, 'Copy URL');
            });
        });
    }

    async addRelay(url) {
        const addBtn = document.getElementById('add-relay-btn');

        await this.withLoading('add-relay', async () => {
            const response = await fetch('/api/relays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to add relay' }));
                throw new Error(error.error || 'Failed to add relay');
            }

            document.getElementById('relay-url').value = '';
            await this.loadRelays();
            this.toastSuccess('Relay Added', `Connected to ${url}`);
        }, {
            button: addBtn,
            buttonText: 'Adding...',
            showErrorToast: true
        });
    }

    async removeRelay(url) {
        await this.withLoading('remove-relay', async () => {
            const response = await fetch(`/api/relays?url=${encodeURIComponent(url)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to remove relay' }));
                throw new Error(error.error || 'Failed to remove relay');
            }

            await this.loadRelays();
            this.toastSuccess('Relay Removed', `Disconnected from ${url}`);
        }, {
            showErrorToast: true
        });
    }

    async loadPreset(presetName, buttonElement) {
        await this.withLoading(`load-preset-${presetName}`, async () => {
            const response = await fetch('/api/relays/presets');
            const presets = await response.json();
            const relays = presets[presetName] || [];

            for (const url of relays) {
                await this.addRelay(url);
            }
        }, {
            button: buttonElement,
            buttonText: 'Loading...',
            showErrorToast: true
        });
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

        const exploreBtn = document.getElementById('explore-profile-btn');
        const profileCard = document.getElementById('profile-card');
        const profileContent = document.getElementById('profile-content');
        const profileSkeleton = document.getElementById('profile-card-skeleton');

        // Show skeleton loading state
        profileCard.classList.add('hidden');
        profileSkeleton.classList.remove('hidden');
        profileContent.classList.add('hidden');

        await this.withLoading('explore-profile', async () => {
            const response = await fetch(`/api/profile/${encodeURIComponent(input)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load profile');
            }

            const profile = await response.json();
            this.currentProfile = profile;

            // Hide skeleton, show actual content
            profileSkeleton.classList.add('hidden');
            profileCard.classList.remove('hidden');
            this.renderProfile(profile);
            profileContent.classList.remove('hidden');

            // Load profile notes by default
            this.loadProfileNotes(profile.pubkey);
        }, {
            button: exploreBtn,
            buttonText: 'Searching...',
            showErrorToast: false
        }).catch(error => {
            profileSkeleton.classList.add('hidden');
            profileCard.classList.remove('hidden');
            profileCard.innerHTML = `<p class="error">${this.escapeHtml(error.message)}</p>`;
        });
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
        const skeleton = document.getElementById('profile-notes-skeleton');

        // Show skeleton while loading
        this.showSkeleton('profile-notes-skeleton');
        container.innerHTML = '';

        try {
            const response = await fetch(`/api/events?kind=1&author=${pubkey}&limit=20`);
            const notes = await response.json() || [];

            this.hideSkeleton('profile-notes-skeleton');

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
            this.hideSkeleton('profile-notes-skeleton');
            container.innerHTML = `<p class="error">Failed to load notes: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    async loadProfileFollowing(pubkey) {
        const container = document.getElementById('profile-following-list');

        // Show skeleton while loading
        this.showSkeleton('profile-following-skeleton');
        container.innerHTML = '';

        try {
            // Query kind 3 (contact list) for this pubkey
            const response = await fetch(`/api/events?kind=3&author=${pubkey}&limit=1`);
            const events = await response.json() || [];

            this.hideSkeleton('profile-following-skeleton');

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
            this.hideSkeleton('profile-following-skeleton');
            container.innerHTML = `<p class="error">Failed to load following: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    async loadProfileZaps(pubkey) {
        const container = document.getElementById('profile-zaps-list');

        // Show skeleton while loading
        this.showSkeleton('profile-zaps-skeleton');
        container.innerHTML = '';

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

            this.hideSkeleton('profile-zaps-skeleton');

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
            this.hideSkeleton('profile-zaps-skeleton');
            container.innerHTML = `<p class="error">Failed to load zaps: ${this.escapeHtml(error.message)}</p>`;
        }
    }

    exploreProfileByPubkey(pubkey) {
        this.switchTab('explorer');
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
        // Show skeleton while loading
        this.showSkeleton('event-list-skeleton');

        try {
            const kind = document.getElementById('filter-kind').value;
            const author = document.getElementById('filter-author').value;

            let url = '/api/events?';
            if (kind) url += `kind=${kind}&`;
            if (author) url += `author=${author}&`;

            const response = await fetch(url);
            this.events = await response.json() || [];
            this.hideSkeleton('event-list-skeleton');
            this.renderEvents();
        } catch (error) {
            this.hideSkeleton('event-list-skeleton');
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
                <div class="event-id">
                    ID: ${event.id.substring(0, 16)}...
                    <button class="btn small copy-btn" data-copy-event-id="${event.id}" title="Copy full event ID">Copy</button>
                </div>
                <div class="event-author">
                    Author: ${event.pubkey.substring(0, 16)}...
                    <button class="btn small copy-btn" data-copy-author="${event.pubkey}" title="Copy author pubkey">Copy</button>
                </div>
                <div class="event-content">${this.escapeHtml(event.content.substring(0, 200))}${event.content.length > 200 ? '...' : ''}</div>
                ${event.relay ? `<div class="event-relay">via ${this.escapeHtml(event.relay)}</div>` : ''}
                ${this.renderTagsSection(event)}
                <div class="event-actions">
                    <button class="btn small" onclick="app.showEventJson('${event.id}')">Raw JSON</button>
                    <button class="btn small" onclick="app.exploreProfileByPubkey('${event.pubkey}')">View Profile</button>
                </div>
            </div>
        `).join('');

        // Attach copy handlers for event IDs
        container.querySelectorAll('[data-copy-event-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.copyEventId, btn, 'Copy');
            });
        });

        // Attach copy handlers for author pubkeys
        container.querySelectorAll('[data-copy-author]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.copyAuthor, btn, 'Copy');
            });
        });

        // Attach toggle handlers for collapsible tag sections
        container.querySelectorAll('[data-tags-toggle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTagsSection(btn.dataset.tagsToggle);
            });
        });

        // Attach copy handlers for individual tags
        container.querySelectorAll('[data-tag-copy]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.tagCopy, btn, 'Copy');
            });
        });
    }

    /**
     * Toggle the visibility of a tags section
     * @param {string} eventId - The event ID whose tags to toggle
     */
    toggleTagsSection(eventId) {
        const section = document.querySelector(`[data-event-id="${eventId}"]`);
        if (!section) return;

        const content = section.querySelector('[data-tags-content]');
        const toggleBtn = section.querySelector('[data-tags-toggle]');
        const icon = toggleBtn?.querySelector('.tags-toggle-icon');

        if (content && toggleBtn) {
            const isExpanded = section.classList.toggle('expanded');
            if (icon) {
                icon.textContent = isExpanded ? '\u25BE' : '\u25B6';
            }
        }
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

    /**
     * Render collapsible tags section for an event
     * @param {Object} event - The Nostr event object
     * @returns {string} - HTML string for the tags section
     */
    renderTagsSection(event) {
        if (!event.tags || event.tags.length === 0) {
            return '';
        }

        const tagCount = event.tags.length;
        const tagsHtml = event.tags.map((tag, index) => {
            const tagName = tag[0] || '';
            const tagValues = tag.slice(1);
            const tagClass = this.getTagClass(tagName);

            return `
                <div class="tag-item ${tagClass}">
                    <span class="tag-name">${this.escapeHtml(tagName)}</span>
                    ${tagValues.map(val => `<span class="tag-value" title="${this.escapeHtml(val)}">${this.escapeHtml(this.truncateTagValue(val))}</span>`).join('')}
                    <button class="btn small copy-btn tag-copy-btn" data-tag-copy='${this.escapeHtml(JSON.stringify(tag))}' title="Copy tag">Copy</button>
                </div>
            `;
        }).join('');

        return `
            <div class="event-tags-section" data-event-id="${event.id}">
                <button class="tags-toggle-btn" data-tags-toggle="${event.id}">
                    <span class="tags-toggle-icon">&#9656;</span>
                    <span class="tags-toggle-label">Tags (${tagCount})</span>
                </button>
                <div class="tags-content" data-tags-content="${event.id}">
                    ${tagsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Get CSS class for a tag based on its type
     * @param {string} tagName - The tag name (first element)
     * @returns {string} - CSS class name
     */
    getTagClass(tagName) {
        const tagClasses = {
            'e': 'tag-event-ref',
            'p': 'tag-pubkey-ref',
            't': 'tag-hashtag',
            'a': 'tag-address',
            'd': 'tag-identifier',
            'r': 'tag-reference',
            'bolt11': 'tag-lightning',
            'amount': 'tag-amount',
            'relay': 'tag-relay',
            'expiration': 'tag-expiration',
            'subject': 'tag-subject',
            'content-warning': 'tag-warning',
            'client': 'tag-client'
        };
        return tagClasses[tagName] || 'tag-default';
    }

    /**
     * Truncate long tag values for display
     * @param {string} value - The tag value
     * @returns {string} - Truncated value
     */
    truncateTagValue(value) {
        if (value.length > 24) {
            return value.substring(0, 12) + '...' + value.substring(value.length - 8);
        }
        return value;
    }

    /**
     * Copy text to clipboard with visual feedback
     * @param {string} text - The text to copy
     * @param {HTMLElement} [button] - Optional button element for visual feedback
     * @param {string} [originalText='Copy'] - Original button text to restore
     * @returns {Promise<boolean>} - True if copy succeeded
     */
    async copyToClipboard(text, button = null, originalText = 'Copy') {
        try {
            await navigator.clipboard.writeText(text);

            if (button) {
                const prevText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copy-success');
                setTimeout(() => {
                    button.textContent = originalText || prevText;
                    button.classList.remove('copy-success');
                }, 1500);
            }

            this.toastSuccess('Copied', 'Copied to clipboard');
            return true;
        } catch (error) {
            console.error('Failed to copy:', error);
            this.toastError('Copy Failed', 'Could not copy to clipboard');
            return false;
        }
    }

    /**
     * Create a copy button element
     * @param {string} text - The text to copy when clicked
     * @param {string} [label='Copy'] - Button label
     * @returns {HTMLButtonElement}
     */
    createCopyButton(text, label = 'Copy') {
        const btn = document.createElement('button');
        btn.className = 'btn small copy-btn';
        btn.textContent = label;
        btn.title = 'Copy to clipboard';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyToClipboard(text, btn, label);
        });
        return btn;
    }

    /**
     * Syntax highlight JSON string
     * @param {string|object} json - JSON string or object to highlight
     * @returns {string} HTML with syntax-highlighted JSON
     */
    syntaxHighlightJson(json) {
        let jsonString;
        if (typeof json === 'string') {
            try {
                // Parse and re-stringify to ensure proper formatting
                jsonString = JSON.stringify(JSON.parse(json), null, 2);
            } catch (e) {
                // If it's not valid JSON, just escape and return
                return `<pre class="json-highlight"><code>${this.escapeHtml(json)}</code></pre>`;
            }
        } else {
            jsonString = JSON.stringify(json, null, 2);
        }

        // Escape HTML first
        const escaped = this.escapeHtml(jsonString);

        // Apply syntax highlighting with regex
        const highlighted = escaped
            // Strings (property values) - must be after keys to not double-match
            .replace(/("(?:\\.|[^"\\])*")(\s*[,\n\r\]])/g, '<span class="json-string">$1</span>$2')
            // Property keys
            .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="json-key">$1</span>$2')
            // Numbers (standalone values - after colon, comma, or opening bracket)
            .replace(/(?<=[:\[,]\s*)(-?\d+\.?\d*)(?=\s*[,\]\n\r])/g, '<span class="json-number">$1</span>')
            // Booleans
            .replace(/(?<=[:\[,]\s*)(true|false)(?=\s*[,\]\n\r])/g, '<span class="json-boolean">$1</span>')
            // Null
            .replace(/(?<=[:\[,]\s*)(null)(?=\s*[,\]\n\r])/g, '<span class="json-null">$1</span>');

        return `<pre class="json-highlight"><code>${highlighted}</code></pre>`;
    }

    /**
     * Check if a string looks like JSON
     * @param {string} str - String to check
     * @returns {boolean} True if string appears to be JSON
     */
    isJsonString(str) {
        if (typeof str !== 'string') return false;
        const trimmed = str.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
    }

    showEventJson(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            this.showModal({
                title: 'Event JSON',
                body: this.syntaxHighlightJson(event),
                size: 'lg',
                buttons: [
                    { text: 'Copy', type: 'default', value: 'copy' },
                    { text: 'Close', type: 'primary', value: null }
                ]
            }).then(value => {
                if (value === 'copy') {
                    navigator.clipboard.writeText(JSON.stringify(event, null, 2))
                        .then(() => this.toastSuccess('Copied', 'JSON copied to clipboard'))
                        .catch(() => this.toastError('Error', 'Failed to copy to clipboard'));
                }
            });
        }
    }

    // Publish Tab
    setupPublish() {
        // Kind selector
        const kindSelect = document.getElementById('publish-kind');
        const customKindInput = document.getElementById('publish-custom-kind');
        if (kindSelect) {
            kindSelect.addEventListener('change', () => {
                if (kindSelect.value === 'custom') {
                    customKindInput.classList.remove('hidden');
                    customKindInput.focus();
                } else {
                    customKindInput.classList.add('hidden');
                }
                this.updateEventPreview();
            });
        }
        if (customKindInput) {
            customKindInput.addEventListener('input', () => this.updateEventPreview());
        }

        // Content textarea
        const contentTextarea = document.getElementById('publish-content');
        const charCount = document.getElementById('content-char-count');
        if (contentTextarea) {
            contentTextarea.addEventListener('input', () => {
                if (charCount) {
                    charCount.textContent = contentTextarea.value.length;
                }
                this.updateEventPreview();
            });
        }

        // Tag management
        const addTagBtn = document.getElementById('add-tag-btn');
        if (addTagBtn) {
            addTagBtn.addEventListener('click', () => this.addPublishTag());
        }

        // Allow Enter key to add tags
        const tagKeyInput = document.getElementById('tag-key');
        const tagValueInput = document.getElementById('tag-value');
        if (tagKeyInput) {
            tagKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    tagValueInput.focus();
                }
            });
        }
        if (tagValueInput) {
            tagValueInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addPublishTag();
                }
            });
        }

        // Signing method toggle
        const signExtension = document.getElementById('sign-extension');
        const signNsec = document.getElementById('sign-nsec');
        const nsecInputGroup = document.getElementById('nsec-input-group');

        if (signExtension && signNsec && nsecInputGroup) {
            signExtension.addEventListener('change', () => {
                if (signExtension.checked) {
                    nsecInputGroup.classList.add('hidden');
                }
            });
            signNsec.addEventListener('change', () => {
                if (signNsec.checked) {
                    nsecInputGroup.classList.remove('hidden');
                    document.getElementById('publish-nsec').focus();
                }
            });
        }

        // Toggle nsec visibility
        const toggleNsecBtn = document.getElementById('toggle-publish-nsec');
        const nsecInput = document.getElementById('publish-nsec');
        if (toggleNsecBtn && nsecInput) {
            toggleNsecBtn.addEventListener('click', () => {
                if (nsecInput.type === 'password') {
                    nsecInput.type = 'text';
                    toggleNsecBtn.textContent = 'Hide';
                } else {
                    nsecInput.type = 'password';
                    toggleNsecBtn.textContent = 'Show';
                }
            });
        }

        // Preview and publish buttons
        const previewBtn = document.getElementById('preview-event-btn');
        const publishBtn = document.getElementById('publish-event-btn');

        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.updateEventPreview());
        }

        if (publishBtn) {
            publishBtn.addEventListener('click', () => this.publishEvent());
        }

        // Update extension status in signing options
        this.updatePublishExtensionStatus();

        // Load relays for the checkbox list when tab is shown
        document.querySelector('[data-tab="publish"]').addEventListener('click', () => {
            this.loadPublishRelays();
        });
    }

    async updatePublishExtensionStatus() {
        const statusEl = document.getElementById('extension-sign-status');
        const extensionRadio = document.getElementById('sign-extension');
        if (!statusEl) return;

        const result = await this.detectExtension();

        if (result.available) {
            const name = result.name || 'NIP-07 Extension';
            statusEl.textContent = result.pubkey
                ? `${name} - ${result.pubkey.slice(0, 8)}...`
                : `${name} detected`;
            statusEl.classList.add('available');
            statusEl.classList.remove('unavailable');
            if (extensionRadio) {
                extensionRadio.disabled = false;
            }
        } else {
            statusEl.textContent = 'No extension detected';
            statusEl.classList.add('unavailable');
            statusEl.classList.remove('available');
            // Auto-select nsec if no extension
            const nsecRadio = document.getElementById('sign-nsec');
            if (nsecRadio && extensionRadio) {
                nsecRadio.checked = true;
                extensionRadio.disabled = true;
                document.getElementById('nsec-input-group').classList.remove('hidden');
            }
        }
    }

    loadPublishRelays() {
        const container = document.getElementById('publish-relay-list');
        if (!container) return;

        if (this.relays.length === 0) {
            container.innerHTML = '<p class="hint">No relays connected. Add relays from the Relays tab.</p>';
            return;
        }

        container.innerHTML = this.relays.map((relay, index) => `
            <label class="relay-checkbox-item">
                <input type="checkbox" name="publish-relay" value="${this.escapeHtml(relay.url)}" ${relay.connected ? 'checked' : ''}>
                <span class="relay-status-dot ${relay.connected ? 'connected' : 'disconnected'}"></span>
                <span class="relay-url">${this.escapeHtml(relay.url)}</span>
            </label>
        `).join('');
    }

    addPublishTag() {
        const keyInput = document.getElementById('tag-key');
        const valueInput = document.getElementById('tag-value');
        const container = document.getElementById('publish-tags');

        const key = keyInput.value.trim();
        const value = valueInput.value.trim();

        if (!key) {
            this.toastWarning('Missing Tag Key', 'Please enter a tag key');
            keyInput.focus();
            return;
        }

        this.publishTags.push([key, value]);
        this.renderPublishTags();

        keyInput.value = '';
        valueInput.value = '';
        keyInput.focus();

        this.updateEventPreview();
    }

    removePublishTag(index) {
        this.publishTags.splice(index, 1);
        this.renderPublishTags();
        this.updateEventPreview();
    }

    renderPublishTags() {
        const container = document.getElementById('publish-tags');
        if (!container) return;

        if (this.publishTags.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.publishTags.map((tag, index) => `
            <span class="tag-item">
                <span class="tag-key">${this.escapeHtml(tag[0])}</span>
                <span class="tag-value">${this.escapeHtml(tag[1] || '(empty)')}</span>
                <button class="remove-tag" onclick="app.removePublishTag(${index})" title="Remove tag">&times;</button>
            </span>
        `).join('');
    }

    getPublishEventKind() {
        const kindSelect = document.getElementById('publish-kind');
        const customKindInput = document.getElementById('publish-custom-kind');

        if (kindSelect.value === 'custom') {
            return parseInt(customKindInput.value) || 1;
        }
        return parseInt(kindSelect.value) || 1;
    }

    updateEventPreview() {
        const previewContainer = document.getElementById('event-preview');
        if (!previewContainer) return;

        const kind = this.getPublishEventKind();
        const content = document.getElementById('publish-content').value;
        const tags = this.publishTags;

        const eventPreview = {
            kind: kind,
            content: content,
            tags: tags,
            created_at: Math.floor(Date.now() / 1000),
            pubkey: '(will be set by signer)',
            id: '(will be computed)',
            sig: '(will be computed)'
        };

        previewContainer.innerHTML = `
            <div class="preview-field">
                <div class="preview-label">Kind</div>
                <div class="preview-value">${kind}</div>
            </div>
            <div class="preview-field">
                <div class="preview-label">Content</div>
                <div class="preview-value content">${this.escapeHtml(content) || '(empty)'}</div>
            </div>
            <div class="preview-field">
                <div class="preview-label">Tags</div>
                <div class="preview-value">${tags.length > 0 ? tags.map(t => `[${t.map(v => `"${this.escapeHtml(v)}"`).join(', ')}]`).join(', ') : '(none)'}</div>
            </div>
            <div class="preview-field">
                <div class="preview-label">JSON Preview</div>
                <pre>${this.escapeHtml(JSON.stringify(eventPreview, null, 2))}</pre>
            </div>
        `;
    }

    getSelectedPublishRelays() {
        const checkboxes = document.querySelectorAll('input[name="publish-relay"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    async publishEvent() {
        const publishBtn = document.getElementById('publish-event-btn');
        const kind = this.getPublishEventKind();
        const content = document.getElementById('publish-content').value;
        const tags = this.publishTags;
        const selectedRelays = this.getSelectedPublishRelays();

        // Validate
        if (selectedRelays.length === 0) {
            this.toastError('No Relays Selected', 'Please select at least one relay to publish to');
            return;
        }

        // Get signing method
        const useExtension = document.getElementById('sign-extension').checked;
        const nsecInput = document.getElementById('publish-nsec');

        if (!useExtension && !nsecInput.value.trim()) {
            this.toastError('Missing Private Key', 'Please enter your nsec private key');
            nsecInput.focus();
            return;
        }

        await this.withLoading('publish-event', async () => {
            let signedEvent;

            if (useExtension) {
                // Sign with NIP-07 extension
                const unsignedEvent = {
                    kind: kind,
                    content: content,
                    tags: tags,
                    created_at: Math.floor(Date.now() / 1000)
                };

                const signResult = await this.signWithExtension(unsignedEvent);
                if (!signResult.success) {
                    throw new Error(signResult.error || 'Failed to sign with extension');
                }
                signedEvent = signResult.event;
            } else {
                // Sign with provided nsec via backend
                const signResponse = await fetch('/api/events/sign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        kind: kind,
                        content: content,
                        tags: tags,
                        privateKey: nsecInput.value.trim()
                    })
                });

                if (!signResponse.ok) {
                    const error = await signResponse.json();
                    throw new Error(error.error || 'Failed to sign event');
                }

                signedEvent = await signResponse.json();
            }

            // Publish to selected relays
            const publishResults = [];
            for (const relay of selectedRelays) {
                try {
                    const publishResponse = await fetch('/api/events/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(signedEvent)
                    });

                    if (publishResponse.ok) {
                        const result = await publishResponse.json();
                        publishResults.push({ relay, success: true, result });
                    } else {
                        const error = await publishResponse.json();
                        publishResults.push({ relay, success: false, error: error.error });
                    }
                } catch (err) {
                    publishResults.push({ relay, success: false, error: err.message });
                }
            }

            // Check results
            const successCount = publishResults.filter(r => r.success).length;
            const failCount = publishResults.length - successCount;

            // Add to history
            this.addToPublishHistory({
                event: signedEvent,
                results: publishResults,
                timestamp: Date.now()
            });

            // Clear form on success
            if (successCount > 0) {
                document.getElementById('publish-content').value = '';
                document.getElementById('content-char-count').textContent = '0';
                this.publishTags = [];
                this.renderPublishTags();
                this.updateEventPreview();

                if (failCount === 0) {
                    this.toastSuccess('Event Published', `Successfully published to ${successCount} relay${successCount > 1 ? 's' : ''}`);
                } else {
                    this.toastWarning('Partially Published', `Published to ${successCount} relay(s), failed on ${failCount}`);
                }
            } else {
                throw new Error('Failed to publish to any relay');
            }
        }, {
            button: publishBtn,
            buttonText: 'Publishing...',
            showErrorToast: true
        });
    }

    addToPublishHistory(entry) {
        this.publishHistory.unshift(entry);
        // Keep only last 10 entries
        if (this.publishHistory.length > 10) {
            this.publishHistory.pop();
        }
        this.renderPublishHistory();
    }

    renderPublishHistory() {
        const container = document.getElementById('publish-history');
        if (!container) return;

        if (this.publishHistory.length === 0) {
            container.innerHTML = '<p class="hint">No events published yet</p>';
            return;
        }

        container.innerHTML = this.publishHistory.map(entry => {
            const successCount = entry.results.filter(r => r.success).length;
            const totalCount = entry.results.length;
            const isSuccess = successCount > 0;

            return `
                <div class="publish-history-item">
                    <div class="history-header">
                        <span class="history-kind">Kind ${entry.event.kind}</span>
                        <span class="history-time">${this.formatTime(Math.floor(entry.timestamp / 1000))}</span>
                    </div>
                    <div class="history-content">${this.escapeHtml(entry.event.content.substring(0, 100))}${entry.event.content.length > 100 ? '...' : ''}</div>
                    <div class="history-status ${isSuccess ? 'success' : 'error'}">
                        ${isSuccess ? '✓' : '✗'} ${successCount}/${totalCount} relays
                    </div>
                </div>
            `;
        }).join('');
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

        // Tests that create/sign events can use different signing modes
        const signingTestIds = ['nip01', 'nip44', 'nip90'];
        const needsSigningMode = signingTestIds.includes(nip.id);

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

        // Add signing mode selector for tests that create events
        let signingModeFields = '';
        if (needsSigningMode) {
            signingModeFields = `
                <div class="form-group signing-mode-section">
                    <label>Signing Mode:</label>
                    <div class="signing-mode-options">
                        <label class="radio-option">
                            <input type="radio" name="signing-mode" value="generated" checked>
                            <span class="radio-label">Generated Keys</span>
                            <span class="radio-description">Create temporary keypair for testing</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="signing-mode" value="provided">
                            <span class="radio-label">Your Keys (nsec)</span>
                            <span class="radio-description">Sign with your own private key</span>
                        </label>
                        <label class="radio-option" id="extension-signing-option">
                            <input type="radio" name="signing-mode" value="extension">
                            <span class="radio-label">NIP-07 Extension</span>
                            <span class="radio-description">Sign via browser extension (Alby, nos2x, etc.)</span>
                        </label>
                    </div>
                </div>
                <div class="form-group hidden" id="nsec-input-group">
                    <label>Private Key (nsec):</label>
                    <div class="key-input-row">
                        <input type="password" id="test-param-privatekey" placeholder="nsec1...">
                        <button type="button" class="btn small" id="toggle-test-nsec">Show</button>
                    </div>
                    <p class="hint warning">Your key is sent to the backend for signing. Only use for testing!</p>
                </div>
            `;
        }

        container.innerHTML = `
            <h3>${nip.name}: ${nip.title}</h3>
            <p class="nip-description">${nip.description}</p>
            <a href="${nip.specUrl}" target="_blank" class="spec-link">View Specification</a>
            ${signingModeFields}
            ${formFields}
            <button class="btn primary" id="run-test-btn">Run Test</button>
        `;

        document.getElementById('run-test-btn').addEventListener('click', () => {
            this.runTest(nip.id);
        });

        // Setup signing mode handlers
        if (needsSigningMode) {
            this.setupSigningModeHandlers();
        }

        document.getElementById('test-results').innerHTML = '';
    }

    /**
     * Setup event handlers for signing mode selection in test forms
     */
    setupSigningModeHandlers() {
        const signingModeRadios = document.querySelectorAll('input[name="signing-mode"]');
        const nsecInputGroup = document.getElementById('nsec-input-group');
        const toggleNsecBtn = document.getElementById('toggle-test-nsec');
        const extensionOption = document.getElementById('extension-signing-option');

        // Check extension availability and update UI
        this.detectExtension().then(result => {
            if (!result.available && extensionOption) {
                const radio = extensionOption.querySelector('input[type="radio"]');
                radio.disabled = true;
                extensionOption.classList.add('disabled');
                extensionOption.querySelector('.radio-description').textContent = 'No NIP-07 extension detected';
            }
        });

        // Handle signing mode changes
        signingModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'provided') {
                    nsecInputGroup.classList.remove('hidden');
                } else {
                    nsecInputGroup.classList.add('hidden');
                }
            });
        });

        // Toggle nsec visibility
        if (toggleNsecBtn) {
            toggleNsecBtn.addEventListener('click', () => {
                const input = document.getElementById('test-param-privatekey');
                if (input.type === 'password') {
                    input.type = 'text';
                    toggleNsecBtn.textContent = 'Hide';
                } else {
                    input.type = 'password';
                    toggleNsecBtn.textContent = 'Show';
                }
            });
        }
    }

    async runTest(nipId) {
        const resultsContainer = document.getElementById('test-results');
        const runBtn = document.getElementById('run-test-btn');

        // Check if this test uses signing modes
        const signingTestIds = ['nip01', 'nip44', 'nip90'];
        const needsSigningMode = signingTestIds.includes(nipId);

        // Get selected signing mode
        const signingMode = document.querySelector('input[name="signing-mode"]:checked')?.value || 'generated';

        // Handle NIP-07 extension signing client-side
        if (needsSigningMode && signingMode === 'extension') {
            await this.runTestWithExtension(nipId, resultsContainer, runBtn);
            return;
        }

        // Get params for other modes
        const params = this.getTestParams(nipId);

        await this.withLoading(`test-${nipId}`, async () => {
            const response = await fetch(`/api/test/${nipId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Test request failed' }));
                throw new Error(error.error || 'Test request failed');
            }

            const result = await response.json();
            this.showTestResult(result);
        }, {
            button: runBtn,
            buttonText: 'Running...',
            container: resultsContainer,
            containerMessage: 'Running test...',
            showErrorToast: false
        }).catch(error => {
            resultsContainer.innerHTML = `<p class="error">Test failed: ${this.escapeHtml(error.message)}</p>`;
        });
    }

    /**
     * Run a test using NIP-07 browser extension for signing
     * @param {string} nipId - The NIP test ID
     * @param {HTMLElement} resultsContainer - Container for results
     * @param {HTMLElement} runBtn - The run button element
     */
    async runTestWithExtension(nipId, resultsContainer, runBtn) {
        await this.withLoading(`test-${nipId}-extension`, async () => {
            // First check extension is available
            const extResult = await this.detectExtension();
            if (!extResult.available) {
                throw new Error('No NIP-07 browser extension detected');
            }

            // Create the unsigned event for the test
            const content = 'Shirushi NIP-01 test event (signed via NIP-07 extension)';
            const unsignedEvent = {
                kind: 1,
                content: content,
                tags: [],
                created_at: Math.floor(Date.now() / 1000)
            };

            // Sign with extension (will prompt user)
            resultsContainer.innerHTML = '<p class="info">Please approve the signing request in your browser extension...</p>';
            const signResult = await this.signWithExtension(unsignedEvent);

            if (!signResult.success) {
                throw new Error(signResult.error || 'Extension signing failed');
            }

            // Now send the pre-signed event to the backend for verification and publishing
            const params = {
                signingMode: 'extension',
                signedEvent: JSON.stringify(signResult.event)
            };

            const response = await fetch(`/api/test/${nipId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Test request failed' }));
                throw new Error(error.error || 'Test request failed');
            }

            const result = await response.json();
            this.showTestResult(result);
        }, {
            button: runBtn,
            buttonText: 'Signing...',
            container: resultsContainer,
            containerMessage: 'Waiting for extension...',
            showErrorToast: false
        }).catch(error => {
            resultsContainer.innerHTML = `<p class="error">Test failed: ${this.escapeHtml(error.message)}</p>`;
        });
    }

    getTestParams(nipId) {
        const params = {};

        // Get signing mode for tests that support it
        const signingTestIds = ['nip01', 'nip44', 'nip90'];
        if (signingTestIds.includes(nipId)) {
            const signingMode = document.querySelector('input[name="signing-mode"]:checked')?.value || 'generated';
            params.signingMode = signingMode;

            if (signingMode === 'provided') {
                const privateKey = document.getElementById('test-param-privatekey')?.value?.trim();
                if (privateKey) {
                    params.privateKey = privateKey;
                }
            }
        }

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

    // NIP-07 Extension Detection
    /**
     * Detect NIP-07 compatible browser extensions (Alby, nos2x, etc.)
     * @returns {Promise<{available: boolean, pubkey: string|null, name: string|null}>}
     */
    async detectExtension() {
        const result = {
            available: false,
            pubkey: null,
            name: null
        };

        // Check if window.nostr exists (NIP-07 interface)
        if (typeof window !== 'undefined' && window.nostr) {
            result.available = true;

            // Try to get the extension name if available
            if (window.nostr._name) {
                result.name = window.nostr._name;
            } else if (window.nostr.name) {
                result.name = window.nostr.name;
            }

            // Try to get the public key (requires user permission)
            try {
                if (typeof window.nostr.getPublicKey === 'function') {
                    result.pubkey = await window.nostr.getPublicKey();
                }
            } catch (error) {
                // User denied permission or extension error
                console.warn('NIP-07: Could not get public key:', error.message);
            }
        }

        return result;
    }

    /**
     * Sign an event using NIP-07 browser extension
     * @param {Object} event - Unsigned Nostr event (must have kind, content, tags, created_at)
     * @returns {Promise<{success: boolean, event: Object|null, error: string|null}>}
     */
    async signWithExtension(event) {
        const result = {
            success: false,
            event: null,
            error: null
        };

        // Check if NIP-07 extension is available
        if (typeof window === 'undefined' || !window.nostr) {
            result.error = 'No NIP-07 extension detected. Please install Alby, nos2x, or another compatible extension.';
            return result;
        }

        // Validate required event fields
        if (!event || typeof event !== 'object') {
            result.error = 'Invalid event: must be an object';
            return result;
        }

        if (typeof event.kind !== 'number') {
            result.error = 'Invalid event: kind must be a number';
            return result;
        }

        if (typeof event.content !== 'string') {
            result.error = 'Invalid event: content must be a string';
            return result;
        }

        if (!Array.isArray(event.tags)) {
            result.error = 'Invalid event: tags must be an array';
            return result;
        }

        // Ensure created_at is set
        const unsignedEvent = {
            kind: event.kind,
            content: event.content,
            tags: event.tags,
            created_at: event.created_at || Math.floor(Date.now() / 1000)
        };

        try {
            // Check if signEvent method exists
            if (typeof window.nostr.signEvent !== 'function') {
                result.error = 'NIP-07 extension does not support signEvent';
                return result;
            }

            // Request signature from extension (will prompt user)
            const signedEvent = await window.nostr.signEvent(unsignedEvent);

            // Validate the signed event has required fields
            if (!signedEvent || !signedEvent.id || !signedEvent.pubkey || !signedEvent.sig) {
                result.error = 'Extension returned invalid signed event';
                return result;
            }

            result.success = true;
            result.event = signedEvent;
        } catch (error) {
            // User rejected or extension error
            if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                result.error = 'User rejected the signing request';
            } else {
                result.error = `Signing failed: ${error.message || 'Unknown error'}`;
            }
            console.warn('NIP-07: Signing failed:', error);
        }

        return result;
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
                this.encodeNip19(btn.dataset.encode, btn);
            });
        });
    }

    async generateKeys() {
        const generateBtn = document.getElementById('generate-key-btn');

        await this.withLoading('generate-keys', async () => {
            const response = await fetch('/api/keys/generate', { method: 'POST' });
            const keypair = await response.json();

            if (keypair.error) {
                throw new Error(keypair.error);
            }

            document.getElementById('nsec-value').value = keypair.private_key;
            document.getElementById('npub-value').value = keypair.public_key;
            document.getElementById('hex-pubkey-value').value = keypair.hex_pubkey;
            document.getElementById('keypair-result').classList.remove('hidden');
            this.toastSuccess('Keys Generated', 'New keypair generated successfully');
        }, {
            button: generateBtn,
            buttonText: 'Generating...',
            showErrorToast: true
        });
    }

    async decodeNip19() {
        const input = document.getElementById('nip19-input').value.trim();
        if (!input) return;

        const decodeBtn = document.getElementById('decode-btn');
        const container = document.getElementById('nip19-result');

        await this.withLoading('decode-nip19', async () => {
            const response = await fetch('/api/keys/decode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input })
            });
            const result = await response.json();

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
        }, {
            button: decodeBtn,
            buttonText: 'Decoding...',
            showErrorToast: true
        });
    }

    async encodeNip19(type, buttonElement) {
        const input = document.getElementById('nip19-input').value.trim();
        if (!input) return;

        const container = document.getElementById('nip19-result');

        await this.withLoading(`encode-nip19-${type}`, async () => {
            const response = await fetch('/api/keys/encode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, hex: input })
            });
            const result = await response.json();

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
        }, {
            button: buttonElement,
            buttonText: 'Encoding...',
            showErrorToast: true
        });
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
        const runBtn = document.getElementById('run-nak-btn');

        // Store last output for copy functionality
        this.lastNakOutput = null;

        await this.withLoading('nak-command', async () => {
            const args = command.split(' ').filter(s => s);
            const response = await fetch('/api/nak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args })
            });
            const result = await response.json();

            if (result.error) {
                output.textContent = `Error: ${result.error}`;
                this.lastNakOutput = `Error: ${result.error}`;
            } else {
                const outputText = result.output || '(no output)';
                this.lastNakOutput = outputText;
                // Apply syntax highlighting if output looks like JSON
                if (this.isJsonString(outputText)) {
                    output.innerHTML = this.syntaxHighlightJson(outputText);
                } else {
                    output.textContent = outputText;
                }
            }

            // Update copy button state
            this.updateNakCopyButton();
        }, {
            button: runBtn,
            buttonText: 'Running...',
            showErrorToast: false
        }).catch(error => {
            output.textContent = `Error: ${error.message}`;
            this.lastNakOutput = `Error: ${error.message}`;
            this.updateNakCopyButton();
        });

        input.value = '';
    }

    updateNakCopyButton() {
        const copyBtn = document.getElementById('copy-nak-output');
        if (copyBtn) {
            copyBtn.disabled = !this.lastNakOutput;
        }
    }

    copyNakOutput() {
        if (this.lastNakOutput) {
            const copyBtn = document.getElementById('copy-nak-output');
            this.copyToClipboard(this.lastNakOutput, copyBtn, 'Copy Output');
        }
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
        // Show skeleton while loading (only on first load)
        if (!this.monitoringInitialized) {
            this.showSkeleton('relay-health-skeleton');
        }

        try {
            const response = await fetch('/api/monitoring/history');
            const data = await response.json();

            if (data) {
                this.hideSkeleton('relay-health-skeleton');
                this.monitoringData = data;
                this.updateMonitoringUI(data);
            }
        } catch (error) {
            this.hideSkeleton('relay-health-skeleton');
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
        // Set up canvas elements with proper sizing
        const canvasConfigs = [
            { id: 'event-rate-chart', type: 'line', label: 'Event Rate', unit: 'events/sec' },
            { id: 'latency-chart', type: 'bar', label: 'Latency Distribution', unit: 'ms' },
            { id: 'health-score-chart', type: 'multiLine', label: 'Health Score', unit: '%' }
        ];

        canvasConfigs.forEach(config => {
            const canvas = document.getElementById(config.id);
            if (!canvas) {
                console.warn(`Chart canvas not found: ${config.id}`);
                return;
            }

            // Set up proper canvas sizing for high-DPI displays
            this.setupCanvasSize(canvas);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error(`Failed to get 2D context for canvas: ${config.id}`);
                return;
            }

            // Create the appropriate chart type
            switch (config.type) {
                case 'line':
                    this.charts.eventRate = this.createLineChart(ctx, config.label, config.unit);
                    break;
                case 'bar':
                    this.charts.latency = this.createBarChart(ctx, config.label);
                    break;
                case 'multiLine':
                    this.charts.healthScore = this.createMultiLineChart(ctx, config.label, config.unit);
                    break;
            }
        });

        // Set up resize handler for responsive charts
        this.setupChartResizeHandler();
    }

    setupCanvasSize(canvas) {
        const container = canvas.parentElement;
        if (!container) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();

        // Set display size (CSS pixels)
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        // Set actual size in memory (scaled for high-DPI)
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);

        // Scale context to ensure correct drawing operations
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
    }

    setupChartResizeHandler() {
        // Debounce resize events
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeAllCharts();
            }, 250);
        };

        window.addEventListener('resize', handleResize);

        // Also handle when the monitoring tab becomes visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const monitoringTab = document.getElementById('monitoring-tab');
                    if (monitoringTab && monitoringTab.classList.contains('active')) {
                        // Small delay to ensure layout is complete
                        setTimeout(() => this.resizeAllCharts(), 100);
                    }
                }
            });
        });

        const monitoringTab = document.getElementById('monitoring-tab');
        if (monitoringTab) {
            observer.observe(monitoringTab, { attributes: true });
        }
    }

    resizeAllCharts() {
        const canvasIds = ['event-rate-chart', 'latency-chart', 'health-score-chart'];

        canvasIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) {
                this.setupCanvasSize(canvas);
            }
        });

        // Redraw all charts with new sizes
        if (this.charts.eventRate) {
            this.charts.eventRate.draw();
        }
        if (this.charts.latency) {
            this.charts.latency.draw();
        }
        if (this.charts.healthScore) {
            this.charts.healthScore.draw();
        }
    }

    getCanvasDisplaySize(canvas) {
        // Get display size in CSS pixels (not scaled canvas size)
        const rect = canvas.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    createLineChart(ctx, label, unit) {
        const self = this;
        return {
            ctx,
            label,
            unit,
            data: [],
            maxPoints: 60,
            draw() {
                const { width, height } = self.getCanvasDisplaySize(ctx.canvas);
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
        const self = this;
        return {
            ctx,
            label,
            data: [],
            draw() {
                const { width, height } = self.getCanvasDisplaySize(ctx.canvas);
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
        const self = this;
        return {
            ctx,
            label,
            unit,
            series: {},
            colors: ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
            maxPoints: 60,
            draw() {
                const { width, height } = self.getCanvasDisplaySize(ctx.canvas);
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
        // Update event rate chart with aggregated event rate
        this.updateEventRateChart(data);

        // Update latency distribution chart
        this.updateLatencyChart(data);

        // Update health score history chart
        this.updateHealthScoreChart(data);
    }

    updateEventRateChart(data) {
        if (!this.charts.eventRate) return;

        // If backend provides event rate history, use it
        if (data.event_rate_history && data.event_rate_history.length > 0) {
            const points = data.event_rate_history.map(p => ({
                value: p.value,
                timestamp: p.timestamp
            }));
            this.charts.eventRate.setData(points);
        } else {
            // Otherwise, track history locally
            const currentRate = data.events_per_sec || 0;
            this.eventRateHistory.push({
                value: currentRate,
                timestamp: Date.now()
            });

            // Trim to max points
            if (this.eventRateHistory.length > this.maxHistoryPoints) {
                this.eventRateHistory.shift();
            }

            this.charts.eventRate.setData(this.eventRateHistory);
        }
    }

    updateLatencyChart(data) {
        if (!this.charts.latency || !data.relays) return;

        // Filter connected relays with valid latency
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

    updateHealthScoreChart(data) {
        if (!this.charts.healthScore || !data.relays) return;

        const timestamp = Date.now();

        data.relays.forEach(relay => {
            const relayUrl = relay.url;
            const healthScore = relay.health_score || this.calculateHealthScore(relay);

            // Initialize history array for this relay if needed
            if (!this.healthScoreHistory[relayUrl]) {
                this.healthScoreHistory[relayUrl] = [];
            }

            // Add current health score to history
            this.healthScoreHistory[relayUrl].push({
                value: healthScore,
                timestamp: timestamp
            });

            // Trim to max points
            if (this.healthScoreHistory[relayUrl].length > this.maxHistoryPoints) {
                this.healthScoreHistory[relayUrl].shift();
            }

            // Update chart with the accumulated history
            this.charts.healthScore.setSeriesData(relayUrl, this.healthScoreHistory[relayUrl]);
        });

        // Clean up history for relays that no longer exist
        const currentRelayUrls = new Set(data.relays.map(r => r.url));
        Object.keys(this.healthScoreHistory).forEach(url => {
            if (!currentRelayUrls.has(url)) {
                delete this.healthScoreHistory[url];
                // Also remove from chart series
                if (this.charts.healthScore.series) {
                    delete this.charts.healthScore.series[url];
                }
            }
        });

        // Redraw the chart after all series updates
        this.charts.healthScore.draw();
    }

    calculateHealthScore(relay) {
        if (!relay.connected) return 0;

        // Weighted health score calculation (matches backend logic)
        let score = 0;

        // Connection status (30%)
        score += relay.connected ? 30 : 0;

        // Latency score (25%) - <100ms = 25, >500ms = 0, linear scale
        const latency = relay.latency_ms || 0;
        if (latency > 0 && latency < 500) {
            score += 25 * (1 - Math.min(latency, 500) / 500);
        } else if (latency === 0) {
            score += 12.5; // Unknown latency gets half points
        }

        // Uptime percentage (25%)
        const uptime = relay.uptime_percent || 0;
        score += 25 * (uptime / 100);

        // Error rate score (20%) - 0 errors = 20, >20 errors = 0
        const errorCount = relay.error_count || 0;
        score += 20 * Math.max(0, 1 - errorCount / 20);

        return Math.max(0, Math.min(100, score));
    }

    // Reset monitoring history when relays change significantly
    resetMonitoringHistory() {
        this.eventRateHistory = [];
        this.healthScoreHistory = {};
        this.relayLatencyHistory = {};

        if (this.charts.healthScore && this.charts.healthScore.series) {
            this.charts.healthScore.series = {};
        }
    }

    // Toast Notifications
    setupToasts() {
        this.toastContainer = document.getElementById('toast-container');
    }

    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.type - Toast type: 'success', 'error', 'warning', 'info'
     * @param {string} options.title - Toast title
     * @param {string} options.message - Toast message
     * @param {number} options.duration - Duration in ms (default: 5000, 0 = no auto-dismiss)
     * @param {boolean} options.showProgress - Show progress bar (default: true)
     * @returns {HTMLElement} The toast element
     */
    showToast({ type = 'info', title = '', message = '', duration = 5000, showProgress = true }) {
        if (!this.toastContainer) {
            this.toastContainer = document.getElementById('toast-container');
        }

        // Limit number of toasts
        const existingToasts = this.toastContainer.querySelectorAll('.toast:not(.toast-hiding)');
        if (existingToasts.length >= this.maxToasts) {
            this.dismissToast(existingToasts[0]);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        const icon = this.getToastIcon(type);

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                ${message ? `<div class="toast-message">${this.escapeHtml(message)}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Close notification">&times;</button>
            ${showProgress && duration > 0 ? '<div class="toast-progress"></div>' : ''}
        `;

        // Add close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismissToast(toast));

        // Add to container
        this.toastContainer.appendChild(toast);

        // Set up auto-dismiss with progress bar
        if (duration > 0) {
            const progressBar = toast.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.style.transitionDuration = `${duration}ms`;
                // Trigger reflow to start animation
                progressBar.offsetHeight;
                progressBar.style.width = '0%';
            }

            toast.dismissTimeout = setTimeout(() => {
                this.dismissToast(toast);
            }, duration);
        }

        return toast;
    }

    getToastIcon(type) {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✗';
            case 'warning':
                return '⚠';
            case 'info':
            default:
                return 'ℹ';
        }
    }

    dismissToast(toast) {
        if (!toast || toast.classList.contains('toast-hiding')) return;

        // Clear timeout if exists
        if (toast.dismissTimeout) {
            clearTimeout(toast.dismissTimeout);
        }

        // Add hiding class for animation
        toast.classList.add('toast-hiding');

        // Remove after animation
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 200);
    }

    // Convenience methods for common toast types
    toastSuccess(title, message, duration = 5000) {
        return this.showToast({ type: 'success', title, message, duration });
    }

    toastError(title, message, duration = 7000) {
        return this.showToast({ type: 'error', title, message, duration });
    }

    toastWarning(title, message, duration = 6000) {
        return this.showToast({ type: 'warning', title, message, duration });
    }

    toastInfo(title, message, duration = 5000) {
        return this.showToast({ type: 'info', title, message, duration });
    }

    clearAllToasts() {
        if (!this.toastContainer) return;
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.dismissToast(toast));
    }

    // Modal System
    setupModal() {
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.modalFooter = document.getElementById('modal-footer');
        this.modalCloseBtn = this.modalOverlay.querySelector('.modal-close');
        this.modalElement = this.modalOverlay.querySelector('.modal');
        this.modalResolve = null;
        this.previousActiveElement = null;

        // Close on overlay click
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        });

        // Close on close button click
        this.modalCloseBtn.addEventListener('click', () => {
            this.closeModal();
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalOverlay.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    /**
     * Show a modal dialog
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.body - Modal body content (HTML)
     * @param {Array} options.buttons - Array of button configs [{text, type, value}]
     * @param {string} options.size - Modal size: 'sm', 'md', 'lg', 'xl', 'full'
     * @param {string} options.type - Modal type: 'default', 'danger', 'warning', 'success'
     * @param {boolean} options.closeOnOverlay - Close when clicking overlay (default: true)
     * @returns {Promise} Resolves with button value when modal is closed
     */
    showModal({
        title = '',
        body = '',
        buttons = [{ text: 'Close', type: 'default', value: null }],
        size = 'md',
        type = 'default',
        closeOnOverlay = true
    } = {}) {
        if (!this.modalOverlay) {
            this.setupModal();
        }

        // Store current focus
        this.previousActiveElement = document.activeElement;

        // Set modal content
        this.modalTitle.textContent = title;
        this.modalBody.innerHTML = body;

        // Set modal size
        this.modalElement.className = 'modal';
        if (size !== 'md') {
            this.modalElement.classList.add(`modal-${size}`);
        }
        if (type !== 'default') {
            this.modalElement.classList.add(`modal-${type}`);
        }

        // Render buttons
        this.modalFooter.innerHTML = buttons.map((btn, index) => {
            const btnClass = btn.type === 'primary' ? 'btn primary' :
                            btn.type === 'danger' ? 'btn primary' :
                            'btn';
            const style = btn.type === 'danger' ? 'style="background: var(--error); border-color: var(--error);"' : '';
            return `<button class="${btnClass}" ${style} data-modal-value="${index}">${this.escapeHtml(btn.text)}</button>`;
        }).join('');

        // Set up button handlers
        this.modalFooter.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.modalValue);
                const value = buttons[index].value !== undefined ? buttons[index].value : buttons[index].text;
                this.closeModal(value);
            });
        });

        // Store closeOnOverlay setting
        this.modalCloseOnOverlay = closeOnOverlay;

        // Update overlay click handler
        this.modalOverlay.onclick = (e) => {
            if (e.target === this.modalOverlay && this.modalCloseOnOverlay) {
                this.closeModal();
            }
        };

        // Show modal
        this.modalOverlay.classList.remove('hidden');
        this.modalOverlay.classList.remove('modal-hiding');
        this.modalOverlay.setAttribute('aria-hidden', 'false');

        // Focus first button or close button
        const firstButton = this.modalFooter.querySelector('button') || this.modalCloseBtn;
        setTimeout(() => firstButton.focus(), 50);

        // Return promise that resolves when modal closes
        return new Promise(resolve => {
            this.modalResolve = resolve;
        });
    }

    closeModal(value = null) {
        if (!this.modalOverlay || this.modalOverlay.classList.contains('hidden')) return;

        // Add hiding animation
        this.modalOverlay.classList.add('modal-hiding');

        // Remove after animation
        setTimeout(() => {
            this.modalOverlay.classList.add('hidden');
            this.modalOverlay.classList.remove('modal-hiding');
            this.modalOverlay.setAttribute('aria-hidden', 'true');

            // Clear content
            this.modalBody.innerHTML = '';
            this.modalFooter.innerHTML = '';

            // Restore focus
            if (this.previousActiveElement) {
                this.previousActiveElement.focus();
            }

            // Resolve promise
            if (this.modalResolve) {
                this.modalResolve(value);
                this.modalResolve = null;
            }
        }, 150);
    }

    /**
     * Show a confirmation dialog
     * @param {string} title - Confirmation title
     * @param {string} message - Confirmation message
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>} Resolves true if confirmed, false otherwise
     */
    async confirm(title, message, options = {}) {
        const result = await this.showModal({
            title: title || 'Confirm',
            body: `<p>${this.escapeHtml(message)}</p>`,
            buttons: [
                { text: options.cancelText || 'Cancel', type: 'default', value: false },
                { text: options.confirmText || 'Confirm', type: options.danger ? 'danger' : 'primary', value: true }
            ],
            type: options.danger ? 'danger' : 'default',
            ...options
        });
        return result === true;
    }

    /**
     * Show an alert dialog
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @param {Object} options - Additional options
     * @returns {Promise} Resolves when dismissed
     */
    async alert(title, message, options = {}) {
        await this.showModal({
            title: title || 'Alert',
            body: `<p>${this.escapeHtml(message)}</p>`,
            buttons: [
                { text: options.buttonText || 'OK', type: 'primary', value: true }
            ],
            ...options
        });
    }

    /**
     * Show a prompt dialog
     * @param {string} title - Prompt title
     * @param {string} message - Prompt message
     * @param {Object} options - Additional options
     * @returns {Promise<string|null>} Resolves with input value or null if cancelled
     */
    async prompt(title, message, options = {}) {
        const inputId = 'modal-prompt-input-' + Date.now();
        let inputValue = options.defaultValue || '';

        // Create promise that handles getting the input value before modal closes
        return new Promise((resolve) => {
            this.showModal({
                title: title || 'Input',
                body: `
                    <p>${this.escapeHtml(message)}</p>
                    <div class="form-group">
                        <input type="${options.type || 'text'}"
                               id="${inputId}"
                               class="modal-input"
                               value="${this.escapeHtml(options.defaultValue || '')}"
                               placeholder="${this.escapeHtml(options.placeholder || '')}">
                    </div>
                `,
                buttons: [
                    { text: options.cancelText || 'Cancel', type: 'default', value: 'cancel' },
                    { text: options.confirmText || 'OK', type: 'primary', value: 'confirm' }
                ],
                ...options
            }).then((result) => {
                // This runs after modal resolves but before content is cleared
                // But actually content IS cleared - we need to capture earlier
                resolve(result === 'confirm' ? inputValue : null);
            });

            // Set up listener to capture input value on button click (before modal closes)
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) {
                    // Update inputValue whenever input changes
                    input.addEventListener('input', (e) => {
                        inputValue = e.target.value;
                    });
                    // Set initial value
                    inputValue = input.value;

                    // Also capture on confirm button click
                    const confirmBtn = this.modalFooter.querySelector('button[data-modal-value="1"]');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', () => {
                            inputValue = input.value;
                        }, { capture: true });
                    }
                }
            }, 0);
        });
    }

    // Loading State Management
    /**
     * Check if a specific loading key is currently loading
     * @param {string} key - The loading state key
     * @returns {boolean} True if loading
     */
    isLoading(key) {
        return this.loadingStates.get(key) === true;
    }

    /**
     * Set loading state for a key
     * @param {string} key - The loading state key
     * @param {boolean} isLoading - Whether loading is active
     */
    setLoading(key, isLoading) {
        const wasLoading = this.loadingStates.get(key);
        this.loadingStates.set(key, isLoading);

        // Notify callbacks if state changed
        if (wasLoading !== isLoading) {
            const callbacks = this.loadingCallbacks.get(key);
            if (callbacks) {
                callbacks.forEach(callback => {
                    try {
                        callback(isLoading);
                    } catch (e) {
                        console.error('Loading callback error:', e);
                    }
                });
            }
        }
    }

    /**
     * Subscribe to loading state changes for a key
     * @param {string} key - The loading state key
     * @param {Function} callback - Function called with (isLoading) when state changes
     * @returns {Function} Unsubscribe function
     */
    onLoadingChange(key, callback) {
        if (!this.loadingCallbacks.has(key)) {
            this.loadingCallbacks.set(key, new Set());
        }
        this.loadingCallbacks.get(key).add(callback);

        // Call immediately with current state
        callback(this.isLoading(key));

        // Return unsubscribe function
        return () => {
            const callbacks = this.loadingCallbacks.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    /**
     * Clear all loading states
     */
    clearAllLoadingStates() {
        this.loadingStates.forEach((_, key) => {
            this.setLoading(key, false);
        });
    }

    /**
     * Set a button to loading state
     * @param {HTMLButtonElement|string} button - Button element or ID
     * @param {boolean} isLoading - Whether to show loading state
     * @param {string} [loadingText] - Text to show while loading
     * @returns {string|null} Original button text (if loading) or null
     */
    setButtonLoading(button, isLoading, loadingText = 'Loading...') {
        const btn = typeof button === 'string' ? document.getElementById(button) : button;
        if (!btn) return null;

        if (isLoading) {
            // Store original state
            const originalText = btn.textContent;
            btn.dataset.originalText = originalText;
            btn.dataset.wasDisabled = btn.disabled;

            // Apply loading state
            btn.disabled = true;
            btn.classList.add('btn-loading');
            btn.textContent = loadingText;

            return originalText;
        } else {
            // Restore original state
            if (btn.dataset.originalText !== undefined) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
            if (btn.dataset.wasDisabled !== undefined) {
                btn.disabled = btn.dataset.wasDisabled === 'true';
                delete btn.dataset.wasDisabled;
            }
            btn.classList.remove('btn-loading');

            return null;
        }
    }

    /**
     * Show loading overlay on a container
     * @param {HTMLElement|string} container - Container element or ID
     * @param {boolean} show - Whether to show the overlay
     * @param {string} [message] - Optional loading message
     */
    setContainerLoading(container, show, message = '') {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        // Look for existing overlay
        let overlay = el.querySelector('.loading-overlay');

        if (show) {
            // Create overlay if needed
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    ${message ? `<div class="loading-message">${this.escapeHtml(message)}</div>` : ''}
                `;

                // Ensure container is positioned for overlay
                const position = window.getComputedStyle(el).position;
                if (position === 'static') {
                    el.style.position = 'relative';
                    el.dataset.wasStatic = 'true';
                }

                el.appendChild(overlay);
            } else if (message) {
                // Update message if overlay exists
                let msgEl = overlay.querySelector('.loading-message');
                if (!msgEl) {
                    msgEl = document.createElement('div');
                    msgEl.className = 'loading-message';
                    overlay.appendChild(msgEl);
                }
                msgEl.textContent = message;
            }

            el.classList.add('is-loading');
        } else {
            // Remove overlay
            if (overlay) {
                overlay.remove();
            }

            // Restore position if we changed it
            if (el.dataset.wasStatic) {
                el.style.position = '';
                delete el.dataset.wasStatic;
            }

            el.classList.remove('is-loading');
        }
    }

    /**
     * Execute an async operation with loading state management
     * @param {string} key - Loading state key
     * @param {Function} operation - Async function to execute
     * @param {Object} [options] - Options
     * @param {HTMLElement|string} [options.button] - Button to show loading on
     * @param {string} [options.buttonText] - Loading text for button
     * @param {HTMLElement|string} [options.container] - Container to show overlay on
     * @param {string} [options.containerMessage] - Message for container overlay
     * @param {string} [options.skeletonId] - Skeleton element ID to show
     * @param {boolean} [options.showErrorToast=true] - Show toast on error
     * @returns {Promise<*>} Result of the operation
     */
    async withLoading(key, operation, options = {}) {
        const {
            button,
            buttonText = 'Loading...',
            container,
            containerMessage = '',
            skeletonId,
            showErrorToast = true
        } = options;

        // Start loading
        this.setLoading(key, true);

        if (button) {
            this.setButtonLoading(button, true, buttonText);
        }

        if (container) {
            this.setContainerLoading(container, true, containerMessage);
        }

        if (skeletonId) {
            this.showSkeleton(skeletonId);
        }

        try {
            const result = await operation();
            return result;
        } catch (error) {
            if (showErrorToast) {
                this.toastError('Error', error.message || 'An error occurred');
            }
            throw error;
        } finally {
            // End loading
            this.setLoading(key, false);

            if (button) {
                this.setButtonLoading(button, false);
            }

            if (container) {
                this.setContainerLoading(container, false);
            }

            if (skeletonId) {
                this.hideSkeleton(skeletonId);
            }
        }
    }

    /**
     * Create a loading indicator element
     * @param {string} [size='md'] - Size: 'sm', 'md', 'lg'
     * @param {string} [message] - Optional message
     * @returns {HTMLElement} Loading indicator element
     */
    createLoadingIndicator(size = 'md', message = '') {
        const indicator = document.createElement('div');
        indicator.className = `loading-indicator loading-indicator-${size}`;
        indicator.innerHTML = `
            <div class="loading-spinner"></div>
            ${message ? `<span class="loading-text">${this.escapeHtml(message)}</span>` : ''}
        `;
        return indicator;
    }

    /**
     * Show inline loading state in an element
     * @param {HTMLElement|string} element - Element or ID to show loading in
     * @param {boolean} show - Whether to show loading
     * @param {string} [message='Loading...'] - Loading message
     */
    setInlineLoading(element, show, message = 'Loading...') {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        if (show) {
            // Store original content
            if (!el.dataset.originalContent) {
                el.dataset.originalContent = el.innerHTML;
            }

            el.innerHTML = '';
            el.appendChild(this.createLoadingIndicator('sm', message));
            el.classList.add('inline-loading');
        } else {
            // Restore original content
            if (el.dataset.originalContent) {
                el.innerHTML = el.dataset.originalContent;
                delete el.dataset.originalContent;
            }
            el.classList.remove('inline-loading');
        }
    }

    // Skeleton Loader Helpers
    /**
     * Show a skeleton loader by ID
     * @param {string} skeletonId - The ID of the skeleton container element
     */
    showSkeleton(skeletonId) {
        const skeleton = document.getElementById(skeletonId);
        if (skeleton) {
            skeleton.classList.remove('hidden');
        }
    }

    /**
     * Hide a skeleton loader by ID
     * @param {string} skeletonId - The ID of the skeleton container element
     */
    hideSkeleton(skeletonId) {
        const skeleton = document.getElementById(skeletonId);
        if (skeleton) {
            skeleton.classList.add('hidden');
        }
    }
}

// Initialize app
const app = new Shirushi();
