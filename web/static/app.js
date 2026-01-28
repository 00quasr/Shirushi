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
        this.expandedNipCards = new Set();

        this.currentProfile = null;

        // Monitoring state
        this.monitoringData = null;
        this.healthScoreHistory = {};
        this.relayLatencyHistory = {};
        this.charts = {
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

        // Test history state
        this.testHistory = [];

        // Keyboard shortcut state
        this.pendingKeySequence = null;
        this.keySequenceTimeout = null;

        // Event stream throttling
        this.eventBuffer = [];
        this.eventRenderScheduled = false;
        this.maxEventsPerRender = 5;
        this.eventRenderInterval = 150; // ms between renders
        this.maxBufferSize = 50; // Discard oldest events if buffer exceeds this
        this.maxDisplayedEvents = 100;

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
        this.setupKeyboardShortcuts();
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
            this.subscribeToEvents().catch(err => {
                console.error('Failed to subscribe to events on connect:', err);
            });
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
            case 'events_batch':
                // Handle batched events from server
                if (Array.isArray(data.data)) {
                    for (const event of data.data) {
                        this.addEvent(event);
                    }
                }
                break;
            case 'relay_status':
                this.updateRelayStatus(data.data);
                break;
            case 'relay_info':
                this.updateRelayInfo(data.data);
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
                // Close mobile menu after selecting a tab
                this.closeMobileMenu();
            });
        });

        // Mobile menu setup
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('mobile-nav-overlay');

        if (!menuBtn || !nav || !overlay) return;

        // Toggle menu on button click
        menuBtn.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Close menu on overlay click
        overlay.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileMenu();
            }
        });

        // Close menu on window resize if going to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileMenu();
            }
        });

        // Handle swipe to close on touch devices
        let touchStartX = 0;
        let touchStartY = 0;

        nav.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        nav.addEventListener('touchmove', (e) => {
            if (!nav.classList.contains('open')) return;

            const touchEndX = e.touches[0].clientX;
            const touchEndY = e.touches[0].clientY;
            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - e.touches[0].clientY);

            // Swipe left to close (at least 50px horizontal, less than 50px vertical)
            if (diffX > 50 && diffY < 50) {
                this.closeMobileMenu();
            }
        }, { passive: true });
    }

    toggleMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('mobile-nav-overlay');

        if (!menuBtn || !nav || !overlay) return;

        const isOpen = nav.classList.contains('open');

        if (isOpen) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }

    openMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('mobile-nav-overlay');

        if (!menuBtn || !nav || !overlay) return;

        menuBtn.classList.add('active');
        menuBtn.setAttribute('aria-expanded', 'true');
        nav.classList.add('open');
        overlay.classList.add('active');

        // Prevent body scroll when menu is open
        document.body.style.overflow = 'hidden';
    }

    closeMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('mobile-nav-overlay');

        if (!menuBtn || !nav || !overlay) return;

        menuBtn.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        overlay.classList.remove('active');

        // Restore body scroll
        document.body.style.overflow = '';
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
                ${this.renderRelayMeta(relay)}
                <div class="relay-stats">
                    <span>Latency: ${relay.latency_ms > 0 ? relay.latency_ms + 'ms' : 'N/A'}</span>
                </div>
                ${this.renderSupportedNIPs(relay.supported_nips)}
                ${relay.error ? `<div class="relay-error">${this.escapeHtml(relay.error)}</div>` : ''}
                ${this.renderRelayInfoPanel(relay)}
                <div class="relay-actions">
                    <button class="btn small copy-btn" data-copy-relay="${this.escapeHtml(relay.url)}">Copy URL</button>
                    <button class="btn small" data-toggle-info="${this.escapeHtml(relay.url)}">Info</button>
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

        // Attach info toggle button handlers
        container.querySelectorAll('[data-toggle-info]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.toggleInfo;
                this.toggleRelayInfoPanel(url, btn);
            });
        });
    }

    renderRelayMeta(relay) {
        const info = relay.relay_info;
        if (!info) {
            return '';
        }

        const parts = [];

        // Relay name (displayed prominently)
        if (info.name) {
            parts.push(`<div class="relay-meta-name">${this.escapeHtml(info.name)}</div>`);
        }

        // Relay description (truncated if too long)
        if (info.description) {
            const truncatedDesc = info.description.length > 150
                ? info.description.substring(0, 150) + '...'
                : info.description;
            parts.push(`<div class="relay-meta-description">${this.escapeHtml(truncatedDesc)}</div>`);
        }

        // Operator info (pubkey and contact in a row)
        const operatorParts = [];
        if (info.pubkey) {
            const shortPubkey = info.pubkey.substring(0, 12) + '...';
            operatorParts.push(`<span class="relay-meta-item" title="Operator pubkey: ${this.escapeHtml(info.pubkey)}"><span class="relay-meta-icon">&#128100;</span><code>${shortPubkey}</code></span>`);
        }
        if (info.contact) {
            const contactDisplay = info.contact.startsWith('mailto:')
                ? info.contact.substring(7)
                : info.contact;
            operatorParts.push(`<span class="relay-meta-item" title="Contact: ${this.escapeHtml(info.contact)}"><span class="relay-meta-icon">&#9993;</span>${this.escapeHtml(contactDisplay)}</span>`);
        }
        if (operatorParts.length > 0) {
            parts.push(`<div class="relay-meta-operator">${operatorParts.join('')}</div>`);
        }

        // Key limitations summary (displayed prominently on card)
        const limitationsSummary = this.renderRelayLimitationsSummary(info.limitation, info.fees, info.payments_url);
        if (limitationsSummary) {
            parts.push(limitationsSummary);
        }

        if (parts.length === 0) {
            return '';
        }

        return `<div class="relay-meta">${parts.join('')}</div>`;
    }

    renderRelayLimitationsSummary(limitation, fees, paymentsUrl) {
        const items = [];
        const hasPaymentInfo = fees && (fees.admission?.length > 0 || fees.subscription?.length > 0 || fees.publication?.length > 0);
        const paymentRequired = limitation?.payment_required || hasPaymentInfo;

        // Payment required badge with fees summary (highest priority - shown first)
        if (paymentRequired) {
            let feeDetails = [];
            if (fees?.admission?.length > 0) {
                const fee = fees.admission[0];
                feeDetails.push(`Admission: ${this.formatSats(fee.amount, fee.unit)}`);
            }
            if (fees?.subscription?.length > 0) {
                const fee = fees.subscription[0];
                const period = this.formatPeriod(fee.period);
                feeDetails.push(`Subscription: ${this.formatSats(fee.amount, fee.unit)}${period}`);
            }
            const tooltip = feeDetails.length > 0 ? feeDetails.join(', ') : 'Payment required';
            const paymentLink = paymentsUrl
                ? `<a href="${this.escapeHtml(paymentsUrl)}" target="_blank" rel="noopener noreferrer" class="relay-limit-item relay-limit-payment" title="${tooltip}">💰 Paid</a>`
                : `<span class="relay-limit-item relay-limit-payment" title="${tooltip}">💰 Paid</span>`;
            items.push(paymentLink);
        }

        // Auth required badge
        if (limitation?.auth_required) {
            items.push(`<span class="relay-limit-item relay-limit-auth" title="Authentication required (NIP-42)">🔐 Auth</span>`);
        }

        // Restricted writes badge
        if (limitation?.restricted_writes) {
            items.push(`<span class="relay-limit-item relay-limit-restricted" title="Restricted writes - conditions must be met to publish">✍️ Restricted</span>`);
        }

        // Max message length
        if (limitation?.max_message_length) {
            const size = this.formatBytes(limitation.max_message_length);
            items.push(`<span class="relay-limit-item" title="Maximum message size"><span class="relay-limit-icon">📦</span>${size}</span>`);
        }

        // Max subscriptions
        if (limitation?.max_subscriptions) {
            items.push(`<span class="relay-limit-item" title="Maximum concurrent subscriptions"><span class="relay-limit-icon">🔔</span>${limitation.max_subscriptions} subs</span>`);
        }

        if (items.length === 0) {
            return '';
        }

        return `<div class="relay-meta-limits">${items.join('')}</div>`;
    }

    formatSats(amount, unit) {
        if (!amount) return '';
        const lowerUnit = (unit || 'msats').toLowerCase();
        if (lowerUnit === 'msats' || lowerUnit === 'millisatoshis') {
            // Convert millisatoshis to sats
            const sats = amount / 1000;
            if (sats >= 1000000) {
                return `${(sats / 1000000).toFixed(2)}M sats`;
            } else if (sats >= 1000) {
                return `${(sats / 1000).toFixed(1)}k sats`;
            }
            return `${sats.toLocaleString()} sats`;
        } else if (lowerUnit === 'sats' || lowerUnit === 'satoshis') {
            if (amount >= 1000000) {
                return `${(amount / 1000000).toFixed(2)}M sats`;
            } else if (amount >= 1000) {
                return `${(amount / 1000).toFixed(1)}k sats`;
            }
            return `${amount.toLocaleString()} sats`;
        }
        return `${amount.toLocaleString()} ${unit}`;
    }

    formatPeriod(seconds) {
        if (!seconds) return '';
        const days = Math.floor(seconds / 86400);
        if (days >= 365) {
            const years = Math.floor(days / 365);
            return ` / ${years} year${years > 1 ? 's' : ''}`;
        } else if (days >= 30) {
            const months = Math.floor(days / 30);
            return ` / ${months} month${months > 1 ? 's' : ''}`;
        } else if (days >= 7) {
            const weeks = Math.floor(days / 7);
            return ` / ${weeks} week${weeks > 1 ? 's' : ''}`;
        } else if (days > 0) {
            return ` / ${days} day${days > 1 ? 's' : ''}`;
        }
        return ` / ${seconds}s`;
    }

    renderPaymentSection(info) {
        const fees = info?.fees;
        const paymentsUrl = info?.payments_url;
        const paymentRequired = info?.limitation?.payment_required;
        const hasPaymentInfo = fees && (fees.admission?.length > 0 || fees.subscription?.length > 0 || fees.publication?.length > 0);

        if (!paymentRequired && !hasPaymentInfo && !paymentsUrl) {
            return '';
        }

        let rows = [];

        // Payment status
        if (paymentRequired) {
            rows.push('<span class="label">Payment Required:</span><span class="value payment-required-yes">Yes</span>');
        }

        // Payments URL
        if (paymentsUrl) {
            rows.push(`<span class="label">Payment Page:</span><span class="value"><a href="${this.escapeHtml(paymentsUrl)}" target="_blank" rel="noopener noreferrer" class="payment-link">${this.escapeHtml(paymentsUrl)}</a></span>`);
        }

        // Admission fees
        if (fees?.admission?.length > 0) {
            const admissionFees = fees.admission.map(fee =>
                `${this.formatSats(fee.amount, fee.unit)} (one-time)`
            ).join(', ');
            rows.push(`<span class="label">Admission Fee:</span><span class="value">${admissionFees}</span>`);
        }

        // Subscription fees
        if (fees?.subscription?.length > 0) {
            const subscriptionFees = fees.subscription.map(fee => {
                const period = this.formatPeriod(fee.period).replace(' / ', '');
                return `${this.formatSats(fee.amount, fee.unit)} / ${period}`;
            }).join(', ');
            rows.push(`<span class="label">Subscription:</span><span class="value">${subscriptionFees}</span>`);
        }

        // Publication fees
        if (fees?.publication?.length > 0) {
            const publicationFees = fees.publication.map(fee => {
                const kindsStr = fee.kinds?.length > 0 ? ` (kinds: ${fee.kinds.join(', ')})` : '';
                return `${this.formatSats(fee.amount, fee.unit)} per event${kindsStr}`;
            }).join(', ');
            rows.push(`<span class="label">Publication Fee:</span><span class="value">${publicationFees}</span>`);
        }

        return `
            <div class="relay-info-section relay-payment-section">
                <h4>💰 Payment Requirements</h4>
                <div class="relay-info-grid">
                    ${rows.join('')}
                </div>
            </div>
        `;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    renderSupportedNIPs(nips) {
        if (!nips || nips.length === 0) {
            return '<div class="relay-nips"><span class="relay-nips-label">NIPs:</span> <span class="relay-nips-loading">Loading...</span></div>';
        }

        // Sort NIPs numerically
        const sortedNips = [...nips].sort((a, b) => a - b);

        // Show first 10 NIPs, with "..." if more
        const displayNips = sortedNips.slice(0, 10);
        const hasMore = sortedNips.length > 10;

        const nipBadges = displayNips.map(nip => {
            const nipNumber = String(nip).padStart(2, '0');
            const specUrl = `https://github.com/nostr-protocol/nips/blob/master/${nipNumber}.md`;
            return `<a href="${specUrl}" target="_blank" rel="noopener noreferrer" class="nip-badge" title="NIP-${nipNumber} - Click to view spec">${nip}</a>`;
        }).join('');

        return `
            <div class="relay-nips">
                <span class="relay-nips-label">NIPs:</span>
                <div class="relay-nips-list">
                    ${nipBadges}
                    ${hasMore ? `<span class="nip-badge more" title="${sortedNips.length} NIPs total">+${sortedNips.length - 10}</span>` : ''}
                </div>
            </div>
        `;
    }

    renderRelayInfoPanel(relay) {
        const info = relay.relay_info || {};
        const hasInfo = info.description || info.software || info.version || info.contact || info.pubkey || info.limitation;

        if (!hasInfo) {
            return `
                <div class="relay-info-panel" data-relay-info-panel="${this.escapeHtml(relay.url)}" style="display: none;">
                    <div class="relay-info-panel-content">
                        <p class="hint">No additional information available for this relay.</p>
                    </div>
                </div>
            `;
        }

        const limitation = info.limitation || {};

        return `
            <div class="relay-info-panel" data-relay-info-panel="${this.escapeHtml(relay.url)}" style="display: none;">
                <div class="relay-info-panel-content">
                    ${info.description ? `
                        <div class="relay-info-row">
                            <span class="relay-info-label">Description</span>
                            <span class="relay-info-value">${this.escapeHtml(info.description)}</span>
                        </div>
                    ` : ''}
                    ${info.software || info.version ? `
                        <div class="relay-info-row">
                            <span class="relay-info-label">Software</span>
                            <span class="relay-info-value">${this.escapeHtml(info.software || '')}${info.version ? ` v${this.escapeHtml(info.version)}` : ''}</span>
                        </div>
                    ` : ''}
                    ${info.contact ? `
                        <div class="relay-info-row">
                            <span class="relay-info-label">Contact</span>
                            <span class="relay-info-value">${this.escapeHtml(info.contact)}</span>
                        </div>
                    ` : ''}
                    ${info.pubkey ? `
                        <div class="relay-info-row">
                            <span class="relay-info-label">Operator</span>
                            <span class="relay-info-value"><code>${info.pubkey.substring(0, 16)}...</code></span>
                        </div>
                    ` : ''}
                    ${this.renderRelayLimitations(limitation)}
                </div>
            </div>
        `;
    }

    renderRelayLimitations(limitation) {
        const limits = [];

        if (limitation.max_message_length) {
            limits.push(`Max message: ${limitation.max_message_length.toLocaleString()} bytes`);
        }
        if (limitation.max_subscriptions) {
            limits.push(`Max subs: ${limitation.max_subscriptions}`);
        }
        if (limitation.max_limit) {
            limits.push(`Max limit: ${limitation.max_limit}`);
        }
        if (limitation.max_event_tags) {
            limits.push(`Max tags: ${limitation.max_event_tags}`);
        }
        if (limitation.max_content_length) {
            limits.push(`Max content: ${limitation.max_content_length.toLocaleString()}`);
        }
        if (limitation.auth_required) {
            limits.push('🔐 Auth required');
        }
        if (limitation.payment_required) {
            limits.push('💰 Payment required');
        }
        if (limitation.restricted_writes) {
            limits.push('✍️ Restricted writes');
        }

        if (limits.length === 0) {
            return '';
        }

        return `
            <div class="relay-info-row">
                <span class="relay-info-label">Limits</span>
                <span class="relay-info-value relay-limits">${limits.join(' · ')}</span>
            </div>
        `;
    }

    toggleRelayInfoPanel(url, button) {
        const panel = document.querySelector(`[data-relay-info-panel="${CSS.escape(url)}"]`);
        if (!panel) return;

        const isVisible = panel.style.display !== 'none';

        if (isVisible) {
            panel.style.display = 'none';
            button.textContent = 'Info';
            button.classList.remove('active');
        } else {
            panel.style.display = 'block';
            button.textContent = 'Hide';
            button.classList.add('active');
        }
    }

    async showRelayInfo(url) {
        const relay = this.relays.find(r => r.url === url);
        if (!relay) return;

        const info = relay.relay_info || {};
        const nips = relay.supported_nips || [];

        // Build modal content
        let content = `
            <div class="relay-info-modal">
                <h3>${this.escapeHtml(info.name || url)}</h3>
                ${info.description ? `<p class="relay-description">${this.escapeHtml(info.description)}</p>` : ''}

                <div class="relay-info-section">
                    <h4>Connection</h4>
                    <div class="relay-info-grid">
                        <span class="label">URL:</span>
                        <span class="value"><code>${this.escapeHtml(url)}</code></span>
                        <span class="label">Status:</span>
                        <span class="value ${relay.connected ? 'success' : 'error'}">${relay.connected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>

                ${info.software || info.version ? `
                <div class="relay-info-section">
                    <h4>Software</h4>
                    <div class="relay-info-grid">
                        ${info.software ? `<span class="label">Software:</span><span class="value">${this.escapeHtml(info.software)}</span>` : ''}
                        ${info.version ? `<span class="label">Version:</span><span class="value">${this.escapeHtml(info.version)}</span>` : ''}
                    </div>
                </div>
                ` : ''}

                ${info.contact || info.pubkey ? `
                <div class="relay-info-section">
                    <h4>Contact</h4>
                    <div class="relay-info-grid">
                        ${info.contact ? `<span class="label">Contact:</span><span class="value">${this.escapeHtml(info.contact)}</span>` : ''}
                        ${info.pubkey ? `<span class="label">Pubkey:</span><span class="value"><code>${info.pubkey.substring(0, 16)}...</code></span>` : ''}
                    </div>
                </div>
                ` : ''}

                ${this.renderPaymentSection(info)}

                ${info.limitation ? `
                <div class="relay-info-section">
                    <h4>Limitations</h4>
                    <div class="relay-info-grid">
                        ${info.limitation.max_message_length ? `<span class="label">Max Message:</span><span class="value">${this.formatBytes(info.limitation.max_message_length)} (${info.limitation.max_message_length.toLocaleString()} bytes)</span>` : ''}
                        ${info.limitation.max_subscriptions ? `<span class="label">Max Subscriptions:</span><span class="value">${info.limitation.max_subscriptions}</span>` : ''}
                        ${info.limitation.max_limit ? `<span class="label">Max Limit:</span><span class="value">${info.limitation.max_limit}</span>` : ''}
                        ${info.limitation.max_event_tags ? `<span class="label">Max Event Tags:</span><span class="value">${info.limitation.max_event_tags}</span>` : ''}
                        ${info.limitation.max_content_length ? `<span class="label">Max Content Length:</span><span class="value">${this.formatBytes(info.limitation.max_content_length)} (${info.limitation.max_content_length.toLocaleString()} bytes)</span>` : ''}
                        ${info.limitation.min_pow_difficulty ? `<span class="label">Min PoW Difficulty:</span><span class="value">${info.limitation.min_pow_difficulty}</span>` : ''}
                        ${info.limitation.auth_required ? `<span class="label">Auth Required:</span><span class="value">Yes</span>` : ''}
                        ${info.limitation.payment_required ? `<span class="label">Payment Required:</span><span class="value">Yes</span>` : ''}
                        ${info.limitation.restricted_writes ? `<span class="label">Restricted Writes:</span><span class="value">Yes</span>` : ''}
                    </div>
                </div>
                ` : ''}

                <div class="relay-info-section">
                    <h4>Supported NIPs (${nips.length})</h4>
                    ${nips.length > 0 ? `
                        <div class="relay-nips-full">
                            ${[...nips].sort((a, b) => a - b).map(nip => {
                                const nipNumber = String(nip).padStart(2, '0');
                                const specUrl = `https://github.com/nostr-protocol/nips/blob/master/${nipNumber}.md`;
                                return `<a href="${specUrl}" target="_blank" rel="noopener noreferrer" class="nip-badge" title="NIP-${nipNumber} - Click to view spec">NIP-${nipNumber}</a>`;
                            }).join('')}
                        </div>
                    ` : '<p class="hint">No NIP information available</p>'}
                </div>

                <div class="relay-info-actions">
                    <button class="btn" onclick="app.refreshRelayInfo('${this.escapeHtml(url)}')">Refresh Info</button>
                </div>
            </div>
        `;

        this.showModal({
            title: 'Relay Information',
            body: content,
            size: 'lg',
            buttons: [
                { text: 'Close', type: 'primary', value: null }
            ]
        });
    }

    async refreshRelayInfo(url) {
        try {
            const response = await fetch(`/api/relays/info?url=${encodeURIComponent(url)}`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to refresh relay info');
            }

            await this.loadRelays();
            this.closeModal();
            this.showRelayInfo(url);
            this.toastSuccess('Relay Info Updated', `Refreshed info for ${url}`);
        } catch (error) {
            this.toastError('Refresh Failed', error.message);
        }
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

    updateRelayInfo(data) {
        const relay = this.relays.find(r => r.url === data.url);
        if (relay) {
            relay.relay_info = data.info;
            if (data.info && data.info.supported_nips) {
                relay.supported_nips = data.info.supported_nips;
            }
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

            container.innerHTML = parsedZaps.map((zap, index) => `
                <div class="zap-card zap-animate zap-stagger">
                    <span class="zap-amount">${this.renderLightningBolt(true)} ${zap.amount.toLocaleString()} sats</span>
                    <span class="zap-sender">${zap.sender ? zap.sender.substring(0, 16) + '...' : 'Anonymous'}</span>
                    <span class="zap-time">${this.formatTime(zap.created_at)}</span>
                    ${zap.content ? `<span class="zap-message">${this.escapeHtml(zap.content)}</span>` : ''}
                </div>
            `).join('');

            // Add glow animation after initial strike animation completes
            setTimeout(() => {
                container.querySelectorAll('.zap-lightning').forEach(bolt => {
                    bolt.classList.remove('animate');
                    bolt.classList.add('animate-glow');
                });
            }, 600);
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

        // Verify event handlers
        document.getElementById('verify-event-btn').addEventListener('click', () => {
            this.verifyEvent();
        });

        document.getElementById('clear-verify-btn').addEventListener('click', () => {
            this.clearVerifyInput();
        });

        document.getElementById('paste-verify-btn').addEventListener('click', () => {
            this.pasteVerifyInput();
        });

        // Allow Enter key in textarea to trigger verification (Ctrl/Cmd + Enter)
        document.getElementById('verify-event-input').addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.verifyEvent();
            }
        });

        // Diff event handlers
        document.getElementById('compare-events-btn').addEventListener('click', () => {
            this.compareEvents();
        });

        document.getElementById('swap-events-btn').addEventListener('click', () => {
            this.swapDiffEvents();
        });

        document.getElementById('clear-diff-btn').addEventListener('click', () => {
            this.clearDiffInputs();
        });

        // Event lookup handlers
        document.getElementById('event-lookup-btn').addEventListener('click', () => {
            this.lookupEvent();
        });

        document.getElementById('fetch-all-relays-btn').addEventListener('click', () => {
            this.fetchEventFromAllRelays();
        });

        document.getElementById('clear-lookup-btn').addEventListener('click', () => {
            this.clearLookupInput();
        });

        // Allow Enter key in lookup input to trigger lookup
        document.getElementById('event-lookup-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.lookupEvent();
            }
        });

        // Batch query handlers
        document.getElementById('batch-query-btn').addEventListener('click', () => {
            this.batchQueryEvents();
        });

        document.getElementById('clear-batch-btn').addEventListener('click', () => {
            this.clearBatchQuery();
        });

        // Update batch query ID count on input
        document.getElementById('batch-query-input').addEventListener('input', () => {
            this.updateBatchIdCount();
        });
    }

    async loadEvents() {
        try {
            const kind = document.getElementById('filter-kind').value;
            const author = document.getElementById('filter-author').value;
            const showTiming = document.getElementById('show-timing')?.checked || false;

            let url = '/api/events?';
            if (kind) url += `kind=${kind}&`;
            if (author) url += `author=${author}&`;
            if (showTiming) url += 'timing=true&';

            const response = await fetch(url);
            const data = await response.json();

            if (showTiming && data.relay_timings) {
                // Response includes timing data
                this.events = data.events || [];
                this.renderFetchTiming(data);
            } else {
                // Legacy response format (just events array)
                this.events = data || [];
                this.hideFetchTiming();
            }
            this.renderEvents();
        } catch (error) {
            console.error('Failed to load events:', error);
        }
    }

    /**
     * Render fetch timing panel with per-relay timing data
     * @param {Object} data - EventsQueryResponse with relay_timings
     */
    renderFetchTiming(data) {
        const panel = document.getElementById('fetch-timing-panel');
        const content = panel.querySelector('.fetch-timing-content');
        const totalSpan = panel.querySelector('.fetch-timing-total');

        if (!data.relay_timings || data.relay_timings.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        // Sort by latency (fastest first)
        const sortedTimings = [...data.relay_timings].sort((a, b) => a.latency_ms - b.latency_ms);

        // Calculate max latency for progress bar scaling
        const maxLatency = Math.max(...sortedTimings.map(t => t.latency_ms), 1);

        // Find fastest relay (exclude errors)
        const successfulTimings = sortedTimings.filter(t => !t.error);
        const fastest = successfulTimings.length > 0 ? successfulTimings[0] : null;

        totalSpan.textContent = `Total: ${data.total_time_ms}ms`;

        content.innerHTML = sortedTimings.map(t => {
            const isFastest = fastest && t.url === fastest.url;
            const hasError = !!t.error;
            const latencyPct = Math.min(100, (t.latency_ms / maxLatency) * 100);

            // Determine status class
            let statusClass = 'normal';
            if (hasError) {
                statusClass = 'error';
            } else if (isFastest) {
                statusClass = 'fastest';
            } else if (t.latency_ms > 2000) {
                statusClass = 'slow';
            } else if (t.latency_ms > 500) {
                statusClass = 'medium';
            }

            const truncatedUrl = t.url.length > 35 ? t.url.substring(0, 32) + '...' : t.url;

            return `
                <div class="fetch-timing-row ${statusClass}">
                    <div class="fetch-timing-relay">
                        <span class="fetch-timing-url" title="${this.escapeHtml(t.url)}">${this.escapeHtml(truncatedUrl)}</span>
                        ${isFastest ? '<span class="fetch-timing-badge fastest">Fastest</span>' : ''}
                        ${hasError ? `<span class="fetch-timing-badge error" title="${this.escapeHtml(t.error)}">Error</span>` : ''}
                    </div>
                    <div class="fetch-timing-stats">
                        <span class="fetch-timing-events">${t.event_count} event${t.event_count !== 1 ? 's' : ''}</span>
                        ${t.first_event_ms > 0 ? `<span class="fetch-timing-first">First: ${t.first_event_ms}ms</span>` : ''}
                        <span class="fetch-timing-latency">${t.latency_ms}ms</span>
                    </div>
                    <div class="fetch-timing-bar-container">
                        <div class="fetch-timing-bar ${statusClass}" style="width: ${latencyPct}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        panel.classList.remove('hidden');
    }

    /**
     * Hide the fetch timing panel
     */
    hideFetchTiming() {
        const panel = document.getElementById('fetch-timing-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    applyEventFilter() {
        this.loadEvents();
    }

    addEvent(event) {
        // Mark as new for animation purposes
        event._isNew = true;

        // Add to buffer instead of rendering immediately
        this.eventBuffer.push(event);

        // Discard oldest events if buffer is too large (prevent memory/lag issues)
        if (this.eventBuffer.length > this.maxBufferSize) {
            this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
        }

        // Schedule a batched render if not already scheduled
        if (!this.eventRenderScheduled) {
            this.eventRenderScheduled = true;
            setTimeout(() => this.flushEventBuffer(), this.eventRenderInterval);
        }
    }

    flushEventBuffer() {
        this.eventRenderScheduled = false;

        if (this.eventBuffer.length === 0) {
            return;
        }

        // Take up to maxEventsPerRender events from the buffer
        const eventsToAdd = this.eventBuffer.splice(0, this.maxEventsPerRender);

        // Add events to the main list
        for (const event of eventsToAdd) {
            this.events.unshift(event);
        }

        // Trim to max displayed events
        if (this.events.length > this.maxDisplayedEvents) {
            this.events.length = this.maxDisplayedEvents;
        }

        // Use incremental DOM updates instead of full re-render
        this.renderEventsIncremental(eventsToAdd);

        // Clear the _isNew flag after animation completes
        for (const event of eventsToAdd) {
            setTimeout(() => {
                event._isNew = false;
            }, 1000);
        }

        if (document.getElementById('auto-scroll').checked) {
            const container = document.getElementById('event-list');
            container.scrollTop = 0;
        }

        // If there are still events in the buffer, schedule another render
        if (this.eventBuffer.length > 0) {
            this.eventRenderScheduled = true;
            setTimeout(() => this.flushEventBuffer(), this.eventRenderInterval);
        }
    }

    renderEvents() {
        const container = document.getElementById('event-list');
        if (this.events.length === 0) {
            container.innerHTML = '<p class="hint">No events yet. Apply filters or wait for events.</p>';
            return;
        }

        container.innerHTML = this.events.map(event => {
            const isZapEvent = event.kind === 9734 || event.kind === 9735;
            const isNewZap = isZapEvent && event._isNew;
            const zapClass = isZapEvent ? 'zap-event' : '';
            const newZapClass = isNewZap ? 'zap-new' : '';
            const kindLabel = isZapEvent
                ? `${this.renderLightningBolt(isNewZap)} kind:${event.kind}`
                : `kind:${event.kind}`;

            return `
            <div class="event-card ${zapClass} ${newZapClass}">
                <div class="event-header">
                    <span class="event-kind">${kindLabel}</span>
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
                    <button class="btn small" onclick="app.showEventDetails('${event.id}')">View Details</button>
                    <button class="btn small" onclick="app.showEventJson('${event.id}')">Raw JSON</button>
                    <button class="btn small" onclick="app.showThreadViewer('${event.id}')">View Thread</button>
                    <button class="btn small" onclick="app.exploreProfileByPubkey('${event.pubkey}')">View Profile</button>
                </div>
            </div>
        `}).join('');

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
     * Render events incrementally - only add new events to the DOM
     * This is much faster than re-rendering the entire list
     * @param {Array} newEvents - Array of new events to prepend
     */
    renderEventsIncremental(newEvents) {
        const container = document.getElementById('event-list');

        // If no events yet, just do a full render
        if (this.events.length === newEvents.length) {
            this.renderEvents();
            return;
        }

        // Remove the "no events" hint if present
        const hint = container.querySelector('.hint');
        if (hint) {
            hint.remove();
        }

        // Create a document fragment for efficient DOM insertion
        const fragment = document.createDocumentFragment();

        // Create event cards for new events (in reverse order since we prepend)
        for (let i = newEvents.length - 1; i >= 0; i--) {
            const event = newEvents[i];
            const card = this.createEventCard(event);
            fragment.appendChild(card);
        }

        // Prepend all new cards at once
        container.insertBefore(fragment, container.firstChild);

        // Trim excess events from the DOM to match maxDisplayedEvents
        while (container.children.length > this.maxDisplayedEvents) {
            container.removeChild(container.lastChild);
        }
    }

    /**
     * Create a single event card DOM element
     * @param {Object} event - The event data
     * @returns {HTMLElement} - The event card element
     */
    createEventCard(event) {
        const isZapEvent = event.kind === 9734 || event.kind === 9735;
        const isNewZap = isZapEvent && event._isNew;

        const card = document.createElement('div');
        card.className = `event-card${isZapEvent ? ' zap-event' : ''}${isNewZap ? ' zap-new' : ''}`;

        const kindLabel = isZapEvent
            ? `${this.renderLightningBolt(isNewZap)} kind:${event.kind}`
            : `kind:${event.kind}`;

        card.innerHTML = `
            <div class="event-header">
                <span class="event-kind">${kindLabel}</span>
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
                <button class="btn small" data-action="details" data-event-id="${event.id}">View Details</button>
                <button class="btn small" data-action="json" data-event-id="${event.id}">Raw JSON</button>
                <button class="btn small" data-action="thread" data-event-id="${event.id}">View Thread</button>
                <button class="btn small" data-action="profile" data-pubkey="${event.pubkey}">View Profile</button>
            </div>
        `;

        // Attach event listeners directly to this card's elements
        this.attachEventCardListeners(card);

        return card;
    }

    /**
     * Attach event listeners to a single event card
     * @param {HTMLElement} card - The event card element
     */
    attachEventCardListeners(card) {
        // Copy event ID
        card.querySelectorAll('[data-copy-event-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.copyEventId, btn, 'Copy');
            });
        });

        // Copy author pubkey
        card.querySelectorAll('[data-copy-author]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.copyAuthor, btn, 'Copy');
            });
        });

        // Tags toggle
        card.querySelectorAll('[data-tags-toggle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTagsSection(btn.dataset.tagsToggle);
            });
        });

        // Tag copy buttons
        card.querySelectorAll('[data-tag-copy]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.tagCopy, btn, 'Copy');
            });
        });

        // Action buttons
        card.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const eventId = btn.dataset.eventId;
                const pubkey = btn.dataset.pubkey;

                switch (action) {
                    case 'details':
                        this.showEventDetails(eventId);
                        break;
                    case 'json':
                        this.showEventJson(eventId);
                        break;
                    case 'thread':
                        this.showThreadViewer(eventId);
                        break;
                    case 'profile':
                        this.exploreProfileByPubkey(pubkey);
                        break;
                }
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
     * Generate lightning bolt SVG for zap animations
     * @param {boolean} animate - Whether to animate the lightning bolt
     * @returns {string} - HTML string for the lightning bolt
     */
    renderLightningBolt(animate = false) {
        const animateClass = animate ? 'animate' : '';
        return `
            <span class="zap-lightning ${animateClass}">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
            </span>
        `;
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

    /**
     * Show decoded event fields in a detailed modal view
     * @param {string} eventId - The event ID to display details for
     */
    showEventDetails(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) {
            this.toastError('Error', 'Event not found');
            return;
        }

        const truncate = (str, len = 32) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len / 2) + '...' + str.substring(str.length - len / 2) : str;
        };

        const formatTimestamp = (timestamp) => {
            const date = new Date(timestamp * 1000);
            return `${date.toLocaleString()} (${timestamp})`;
        };

        const getKindDescription = (kind) => {
            const kindDescriptions = {
                0: 'Metadata (Profile)',
                1: 'Short Text Note',
                2: 'Recommend Relay',
                3: 'Follow List',
                4: 'Encrypted Direct Message',
                5: 'Event Deletion',
                6: 'Repost',
                7: 'Reaction',
                8: 'Badge Award',
                40: 'Channel Creation',
                41: 'Channel Metadata',
                42: 'Channel Message',
                43: 'Channel Hide Message',
                44: 'Channel Mute User',
                1984: 'Report',
                9734: 'Zap Request',
                9735: 'Zap Receipt',
                10000: 'Mute List',
                10001: 'Pin List',
                10002: 'Relay List Metadata',
                30000: 'Categorized People List',
                30001: 'Categorized Bookmark List',
                30023: 'Long-form Content',
                30078: 'Application-specific Data'
            };
            return kindDescriptions[kind] || 'Unknown';
        };

        const renderTagsDetails = (tags) => {
            if (!tags || tags.length === 0) {
                return '<span class="event-detail-empty">No tags</span>';
            }
            return tags.map((tag, index) => {
                const tagName = tag[0] || '';
                const tagValues = tag.slice(1);
                return `
                    <div class="event-detail-tag">
                        <span class="event-detail-tag-index">[${index}]</span>
                        <span class="event-detail-tag-name">${this.escapeHtml(tagName)}</span>
                        ${tagValues.map(val => `<span class="event-detail-tag-value" title="${this.escapeHtml(val)}">${this.escapeHtml(truncate(val, 40))}</span>`).join('')}
                        <button class="btn small copy-btn" data-copy-tag='${this.escapeHtml(JSON.stringify(tag))}'>Copy</button>
                    </div>
                `;
            }).join('');
        };

        const modalBody = `
            <div class="event-details-modal">
                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Event Identification</h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Event ID:</span>
                        <span class="event-detail-value monospace" title="${this.escapeHtml(event.id)}">${this.escapeHtml(event.id)}</span>
                        <button class="btn small copy-btn" data-copy-field="${this.escapeHtml(event.id)}">Copy</button>
                    </div>
                </div>

                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Author</h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Public Key (hex):</span>
                        <span class="event-detail-value monospace" title="${this.escapeHtml(event.pubkey)}">${this.escapeHtml(event.pubkey)}</span>
                        <button class="btn small copy-btn" data-copy-field="${this.escapeHtml(event.pubkey)}">Copy</button>
                    </div>
                    <div class="event-detail-row clickable" onclick="app.exploreProfileByPubkey('${event.pubkey}'); app.closeModal();">
                        <span class="event-detail-label">View Profile:</span>
                        <span class="event-detail-value link">Click to explore author's profile →</span>
                    </div>
                </div>

                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Event Type</h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Kind:</span>
                        <span class="event-detail-value">${event.kind}</span>
                    </div>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Description:</span>
                        <span class="event-detail-value">${this.escapeHtml(getKindDescription(event.kind))}</span>
                    </div>
                </div>

                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Timestamp</h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Created At:</span>
                        <span class="event-detail-value">${this.escapeHtml(formatTimestamp(event.created_at))}</span>
                        <button class="btn small copy-btn" data-copy-field="${event.created_at}">Copy</button>
                    </div>
                </div>

                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Content</h4>
                    <div class="event-detail-content-box">
                        <pre class="event-detail-content">${this.escapeHtml(event.content || '(empty)')}</pre>
                        ${event.content ? `<button class="btn small copy-btn content-copy-btn" data-copy-field="${this.escapeHtml(event.content)}">Copy Content</button>` : ''}
                    </div>
                </div>

                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Tags (${event.tags?.length || 0})</h4>
                    <div class="event-detail-tags-container">
                        ${renderTagsDetails(event.tags)}
                    </div>
                </div>

                ${event.relay ? `
                <div class="event-detail-section">
                    <h4 class="event-detail-section-title">Source</h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Relay:</span>
                        <span class="event-detail-value">${this.escapeHtml(event.relay)}</span>
                        <button class="btn small copy-btn" data-copy-field="${this.escapeHtml(event.relay)}">Copy</button>
                    </div>
                </div>
                ` : ''}

                ${event.sig ? `
                <div class="event-detail-section signature-section" data-event-id="${this.escapeHtml(event.id)}" data-pubkey="${this.escapeHtml(event.pubkey)}">
                    <h4 class="event-detail-section-title">
                        Signature
                        <span class="signature-status" data-status="pending">
                            <span class="signature-status-icon">⏳</span>
                            <span class="signature-status-text">Verifying...</span>
                        </span>
                    </h4>
                    <div class="event-detail-row">
                        <span class="event-detail-label">Signature:</span>
                        <span class="event-detail-value monospace signature-value" title="${this.escapeHtml(event.sig)}">${this.escapeHtml(event.sig)}</span>
                        <button class="btn small copy-btn" data-copy-field="${this.escapeHtml(event.sig)}">Copy</button>
                    </div>
                    <div class="event-detail-row clickable view-author-profile-row" style="display: none;">
                        <span class="event-detail-label">Verified Author:</span>
                        <span class="event-detail-value link view-author-profile-link">View Author Profile →</span>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        this.showModal({
            title: 'Decoded Event Fields',
            body: modalBody,
            size: 'lg',
            buttons: [
                { text: 'View JSON', type: 'default', value: 'json' },
                { text: 'Close', type: 'primary', value: null }
            ]
        }).then(value => {
            if (value === 'json') {
                this.showEventJson(eventId);
            }
        });

        // Attach copy handlers after modal is shown
        setTimeout(() => {
            document.querySelectorAll('.event-details-modal [data-copy-field]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = btn.dataset.copyField;
                    navigator.clipboard.writeText(value)
                        .then(() => this.toastSuccess('Copied', 'Value copied to clipboard'))
                        .catch(() => this.toastError('Error', 'Failed to copy to clipboard'));
                });
            });
            document.querySelectorAll('.event-details-modal [data-copy-tag]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = btn.dataset.copyTag;
                    navigator.clipboard.writeText(value)
                        .then(() => this.toastSuccess('Copied', 'Tag copied to clipboard'))
                        .catch(() => this.toastError('Error', 'Failed to copy to clipboard'));
                });
            });

            // Verify signature and update status
            if (event.sig) {
                this.verifyEventSignatureInModal(event);
            }
        }, 50);
    }

    /**
     * Verify event signature and update the modal UI
     * @param {Object} event - The event to verify
     */
    async verifyEventSignatureInModal(event) {
        const signatureSection = document.querySelector(`.signature-section[data-event-id="${event.id}"]`);
        if (!signatureSection) return;

        const statusSpan = signatureSection.querySelector('.signature-status');
        const statusIcon = signatureSection.querySelector('.signature-status-icon');
        const statusText = signatureSection.querySelector('.signature-status-text');
        const signatureValue = signatureSection.querySelector('.signature-value');

        try {
            // Build the event JSON for verification
            const eventJson = JSON.stringify({
                id: event.id,
                pubkey: event.pubkey,
                created_at: event.created_at,
                kind: event.kind,
                tags: event.tags || [],
                content: event.content || '',
                sig: event.sig
            });

            const response = await fetch('/api/events/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: eventJson
            });

            const result = await response.json();

            if (result.valid) {
                statusSpan.setAttribute('data-status', 'valid');
                statusIcon.textContent = '✓';
                statusText.textContent = 'Valid';
                signatureSection.classList.add('signature-valid');
                signatureValue.classList.add('signature-verified');

                // Show the View Author Profile link
                const viewAuthorRow = signatureSection.querySelector('.view-author-profile-row');
                if (viewAuthorRow) {
                    viewAuthorRow.style.display = '';
                    const pubkey = signatureSection.dataset.pubkey;
                    viewAuthorRow.onclick = () => {
                        this.exploreProfileByPubkey(pubkey);
                        this.closeModal();
                    };
                }
            } else {
                statusSpan.setAttribute('data-status', 'invalid');
                statusIcon.textContent = '✗';
                statusText.textContent = result.error || 'Invalid';
                signatureSection.classList.add('signature-invalid');
                signatureValue.classList.add('signature-failed');
            }
        } catch (err) {
            statusSpan.setAttribute('data-status', 'error');
            statusIcon.textContent = '?';
            statusText.textContent = 'Verification failed';
            signatureSection.classList.add('signature-error');
        }
    }

    /**
     * Subscribe to events with optional filters.
     * Events matching the subscription will be broadcast via WebSocket.
     * @param {Object} options - Subscription options
     * @param {number[]} [options.kinds] - Event kinds to subscribe to
     * @param {string[]} [options.authors] - Author pubkeys to filter by
     * @returns {Promise<{subscription_id: string}>} - The subscription ID
     */
    async subscribeToEvents(options = {}) {
        const { kinds = [], authors = [] } = options;

        const response = await fetch('/api/events/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kinds, authors })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to subscribe to events' }));
            throw new Error(error.error || 'Failed to subscribe to events');
        }

        const result = await response.json();
        this.toastSuccess('Subscribed', `Subscription created: ${result.subscription_id.substring(0, 8)}...`);
        return result;
    }

    /**
     * Verify a Nostr event signature
     * Parses the input JSON and sends it to the /api/events/verify endpoint
     */
    async verifyEvent() {
        const input = document.getElementById('verify-event-input');
        const resultDiv = document.getElementById('verify-result');
        const resultContent = resultDiv.querySelector('.verify-result-content');
        const verifyBtn = document.getElementById('verify-event-btn');
        const eventJson = input.value.trim();

        if (!eventJson) {
            this.toastError('Error', 'Please enter an event JSON to verify');
            return;
        }

        // Parse and validate JSON
        let event;
        try {
            event = JSON.parse(eventJson);
        } catch (e) {
            this.showVerifyResult(false, 'Invalid JSON format', null, e.message);
            return;
        }

        // Validate required event fields
        const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];
        const missingFields = requiredFields.filter(field => !(field in event));
        if (missingFields.length > 0) {
            this.showVerifyResult(false, 'Missing required fields', null, `Missing: ${missingFields.join(', ')}`);
            return;
        }

        // Disable button during verification
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const response = await fetch('/api/events/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: eventJson
            });

            const result = await response.json();

            if (result.valid) {
                this.showVerifyResult(true, 'Signature is valid', event);
                this.toastSuccess('Valid', 'Event signature verified successfully');
            } else {
                const errorMsg = result.error || 'Signature verification failed';
                this.showVerifyResult(false, 'Signature is invalid', event, errorMsg);
                this.toastError('Invalid', errorMsg);
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.showVerifyResult(false, 'Verification failed', event, error.message);
            this.toastError('Error', 'Failed to verify event');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Signature';
        }
    }

    /**
     * Display the verification result
     * @param {boolean} valid - Whether the signature is valid
     * @param {string} title - Title message
     * @param {Object|null} event - The parsed event object
     * @param {string} [errorDetail] - Error detail message if invalid
     */
    showVerifyResult(valid, title, event, errorDetail = null) {
        const resultDiv = document.getElementById('verify-result');
        const resultContent = resultDiv.querySelector('.verify-result-content');

        // Update CSS classes
        resultDiv.classList.remove('hidden', 'valid', 'invalid');
        resultDiv.classList.add(valid ? 'valid' : 'invalid');

        // Build the result HTML
        let html = `
            <div class="verify-result-header">
                <span class="verify-result-icon ${valid ? 'valid' : 'invalid'}">${valid ? '&#10003;' : '&#10007;'}</span>
                <div class="verify-result-text">
                    <span class="verify-result-title">${this.escapeHtml(title)}</span>
                    ${errorDetail ? `<span class="verify-result-subtitle">${this.escapeHtml(errorDetail)}</span>` : ''}
                </div>
            </div>
        `;

        if (event) {
            const truncate = (str, len = 24) => {
                if (!str) return '';
                return str.length > len ? str.substring(0, len / 2) + '...' + str.substring(str.length - len / 2) : str;
            };

            html += `
                <div class="verify-result-details">
                    <div class="verify-detail-row">
                        <span class="verify-detail-label">Event ID:</span>
                        <span class="verify-detail-value truncated" title="${this.escapeHtml(event.id)}">${this.escapeHtml(truncate(event.id, 32))}</span>
                    </div>
                    <div class="verify-detail-row">
                        <span class="verify-detail-label">Author:</span>
                        <span class="verify-detail-value truncated" title="${this.escapeHtml(event.pubkey)}">${this.escapeHtml(truncate(event.pubkey, 32))}</span>
                    </div>
                    <div class="verify-detail-row">
                        <span class="verify-detail-label">Kind:</span>
                        <span class="verify-detail-value">${event.kind}</span>
                    </div>
                    <div class="verify-detail-row">
                        <span class="verify-detail-label">Created:</span>
                        <span class="verify-detail-value">${new Date(event.created_at * 1000).toLocaleString()}</span>
                    </div>
                    <div class="verify-detail-row">
                        <span class="verify-detail-label">Signature:</span>
                        <span class="verify-detail-value truncated" title="${this.escapeHtml(event.sig)}">${this.escapeHtml(truncate(event.sig, 32))}</span>
                    </div>
                </div>
            `;
        }

        resultContent.innerHTML = html;
    }

    /**
     * Clear the verify input and result
     */
    clearVerifyInput() {
        document.getElementById('verify-event-input').value = '';
        const resultDiv = document.getElementById('verify-result');
        resultDiv.classList.add('hidden');
        resultDiv.classList.remove('valid', 'invalid');
    }

    /**
     * Lookup an event by ID (hex or note1.../nevent1... format)
     */
    async lookupEvent() {
        const input = document.getElementById('event-lookup-input');
        const lookupBtn = document.getElementById('event-lookup-btn');
        const eventId = input.value.trim();

        if (!eventId) {
            this.toastError('Error', 'Please enter an event ID to lookup');
            return;
        }

        // Validate format (should be hex or note1.../nevent1...)
        const isHex = /^[0-9a-fA-F]{64}$/.test(eventId);
        const isNote = eventId.startsWith('note1');
        const isNevent = eventId.startsWith('nevent1');

        if (!isHex && !isNote && !isNevent) {
            this.toastError('Error', 'Invalid format. Use 64-char hex, note1..., or nevent1...');
            return;
        }

        // Disable button during lookup
        lookupBtn.disabled = true;
        lookupBtn.textContent = 'Looking up...';

        try {
            const response = await fetch(`/api/events/lookup?id=${encodeURIComponent(eventId)}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to lookup event' }));
                throw new Error(error.error || 'Failed to lookup event');
            }

            const event = await response.json();
            this.showLookupResult(event);
            this.toastSuccess('Found', 'Event found successfully');
        } catch (error) {
            console.error('Lookup error:', error);
            this.showLookupError(error.message);
            this.toastError('Error', error.message);
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.textContent = 'Lookup';
        }
    }

    /**
     * Display the lookup result
     * @param {Object} event - The event object
     */
    showLookupResult(event) {
        const resultDiv = document.getElementById('lookup-result');
        const resultContent = resultDiv.querySelector('.lookup-result-content');

        const truncate = (str, len = 32) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len / 2) + '...' + str.substring(str.length - len / 2) : str;
        };

        const getKindDescription = (kind) => {
            const kindDescriptions = {
                0: 'Metadata (Profile)',
                1: 'Short Text Note',
                2: 'Recommend Relay',
                3: 'Follow List',
                4: 'Encrypted Direct Message',
                5: 'Event Deletion',
                6: 'Repost',
                7: 'Reaction',
                8: 'Badge Award',
                40: 'Channel Creation',
                41: 'Channel Metadata',
                42: 'Channel Message',
                43: 'Channel Hide Message',
                44: 'Channel Mute User',
                1984: 'Report',
                9734: 'Zap Request',
                9735: 'Zap Receipt',
                10000: 'Mute List',
                10001: 'Pin List',
                10002: 'Relay List Metadata',
                30000: 'Categorized People List',
                30001: 'Categorized Bookmark List',
                30023: 'Long-form Content',
                30078: 'Application-specific Data'
            };
            return kindDescriptions[kind] || 'Unknown';
        };

        const formatTimestamp = (timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString();
        };

        const renderTags = (tags) => {
            if (!tags || tags.length === 0) {
                return '<span class="lookup-empty">No tags</span>';
            }
            return tags.slice(0, 5).map((tag, index) => {
                const tagName = tag[0] || '';
                const tagValue = tag[1] || '';
                return `<div class="lookup-tag"><span class="lookup-tag-name">${this.escapeHtml(tagName)}</span><span class="lookup-tag-value">${this.escapeHtml(truncate(tagValue, 24))}</span></div>`;
            }).join('') + (tags.length > 5 ? `<div class="lookup-tag-more">+${tags.length - 5} more tags</div>` : '');
        };

        const html = `
            <div class="lookup-result-header">
                <span class="lookup-result-icon success">&#10003;</span>
                <span class="lookup-result-title">Event Found</span>
            </div>
            <div class="lookup-result-details">
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Event ID:</span>
                    <span class="lookup-detail-value monospace" title="${this.escapeHtml(event.id)}">${this.escapeHtml(truncate(event.id, 32))}</span>
                    <button class="btn small copy-btn" onclick="app.copyToClipboard('${this.escapeHtml(event.id)}')">Copy</button>
                </div>
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Kind:</span>
                    <span class="lookup-detail-value">${event.kind} - ${getKindDescription(event.kind)}</span>
                </div>
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Author:</span>
                    <span class="lookup-detail-value monospace" title="${this.escapeHtml(event.pubkey)}">${this.escapeHtml(truncate(event.pubkey, 32))}</span>
                    <button class="btn small" onclick="app.viewProfile('${this.escapeHtml(event.pubkey)}')">View Profile</button>
                </div>
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Created:</span>
                    <span class="lookup-detail-value">${formatTimestamp(event.created_at)}</span>
                </div>
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Content:</span>
                    <span class="lookup-detail-value lookup-content">${this.escapeHtml(event.content.substring(0, 200))}${event.content.length > 200 ? '...' : ''}</span>
                </div>
                <div class="lookup-detail-row">
                    <span class="lookup-detail-label">Tags:</span>
                    <div class="lookup-detail-tags">${renderTags(event.tags)}</div>
                </div>
            </div>
            <div class="lookup-result-actions">
                <button class="btn primary" onclick="app.showEventJsonFromLookup('${this.escapeHtml(event.id)}')">View Raw JSON</button>
                <button class="btn" onclick="app.copyEventToVerify('${this.escapeHtml(event.id)}')">Copy to Verify</button>
            </div>
        `;

        // Store the event for later use
        this.lastLookupEvent = event;

        resultDiv.classList.remove('hidden', 'error');
        resultDiv.classList.add('success');
        resultContent.innerHTML = html;
    }

    /**
     * Display a lookup error
     * @param {string} message - The error message
     */
    showLookupError(message) {
        const resultDiv = document.getElementById('lookup-result');
        const resultContent = resultDiv.querySelector('.lookup-result-content');

        const html = `
            <div class="lookup-result-header">
                <span class="lookup-result-icon error">&#10007;</span>
                <span class="lookup-result-title">Lookup Failed</span>
            </div>
            <div class="lookup-result-details">
                <span class="lookup-error-message">${this.escapeHtml(message)}</span>
            </div>
        `;

        resultDiv.classList.remove('hidden', 'success');
        resultDiv.classList.add('error');
        resultContent.innerHTML = html;
    }

    /**
     * Clear the lookup input and result
     */
    clearLookupInput() {
        document.getElementById('event-lookup-input').value = '';
        const resultDiv = document.getElementById('lookup-result');
        resultDiv.classList.add('hidden');
        resultDiv.classList.remove('success', 'error');
        const allRelaysResult = document.getElementById('all-relays-result');
        allRelaysResult.classList.add('hidden');
        this.lastLookupEvent = null;
        this.lastAllRelaysResult = null;
    }

    /**
     * Fetch an event from all connected relays and show per-relay results
     */
    async fetchEventFromAllRelays() {
        const input = document.getElementById('event-lookup-input');
        const fetchBtn = document.getElementById('fetch-all-relays-btn');
        const eventId = input.value.trim();

        if (!eventId) {
            this.toastError('Error', 'Please enter an event ID to fetch');
            return;
        }

        // Validate format (should be hex or note1.../nevent1...)
        const isHex = /^[0-9a-fA-F]{64}$/.test(eventId);
        const isNote = eventId.startsWith('note1');
        const isNevent = eventId.startsWith('nevent1');

        if (!isHex && !isNote && !isNevent) {
            this.toastError('Error', 'Invalid format. Use 64-char hex, note1..., or nevent1...');
            return;
        }

        // Disable button during fetch
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Fetching...';

        try {
            const response = await fetch(`/api/events/fetch-all-relays?id=${encodeURIComponent(eventId)}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to fetch event' }));
                throw new Error(error.error || 'Failed to fetch event');
            }

            const result = await response.json();
            this.showAllRelaysResult(result);
            this.toastSuccess('Complete', `Found on ${result.found_count}/${result.total_relays} relays`);
        } catch (error) {
            console.error('Fetch all relays error:', error);
            this.showAllRelaysError(error.message);
            this.toastError('Error', error.message);
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch from All Relays';
        }
    }

    /**
     * Display the results of fetching from all relays
     * @param {Object} result - The fetch result object
     */
    showAllRelaysResult(result) {
        const resultDiv = document.getElementById('all-relays-result');
        const resultContent = resultDiv.querySelector('.all-relays-result-content');

        const truncate = (str, len = 32) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len / 2) + '...' + str.substring(str.length - len / 2) : str;
        };

        // Calculate counts for availability summary
        const hasEventCount = result.found_count;
        const errorCount = result.results.filter(r => r.error).length;
        const missingCount = result.total_relays - hasEventCount - errorCount;
        const total = result.total_relays;

        // Calculate percentages for progress bar
        const hasEventPct = total > 0 ? (hasEventCount / total) * 100 : 0;
        const missingPct = total > 0 ? (missingCount / total) * 100 : 0;
        const errorPct = total > 0 ? (errorCount / total) * 100 : 0;

        // Sort results: found first, then not-found, then errors, each sorted by latency
        const sortedResults = [...result.results].sort((a, b) => {
            // Sort order: found (0) > not-found (1) > error (2)
            const getPriority = (r) => r.found ? 0 : (r.error ? 2 : 1);
            const priorityDiff = getPriority(a) - getPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            return a.latency_ms - b.latency_ms;
        });

        // Collect events from relays that have them for diff comparison
        const eventsWithRelays = sortedResults
            .filter(r => r.found && r.event)
            .map(r => ({ relay: r.url, event: r.event }));

        // Compute data differences between events from different relays
        const dataDiff = this.computeRelayEventDifferences(eventsWithRelays);

        const renderRelayResults = () => {
            return sortedResults.map(r => {
                const statusIcon = r.found ? '&#10003;' : (r.error ? '&#10007;' : '&#10060;');
                const statusClass = r.found ? 'found' : (r.error ? 'error' : 'not-found');
                const badgeClass = r.found ? 'has-event' : (r.error ? 'error' : 'missing');
                const badgeText = r.found ? 'Has Event' : (r.error ? 'Error' : 'Missing');
                const statusTitle = r.error ? this.escapeHtml(r.error) : (r.found ? 'Event found on this relay' : 'Event not found on this relay');

                return `
                    <div class="relay-result-row ${statusClass}">
                        <span class="relay-result-icon ${statusClass}" title="${statusTitle}">${statusIcon}</span>
                        <span class="relay-result-url" title="${this.escapeHtml(r.url)}">${this.escapeHtml(truncate(r.url, 40))}</span>
                        <span class="relay-result-status"><span class="relay-status-badge ${badgeClass}">${badgeText}</span></span>
                        <span class="relay-result-latency">${r.latency_ms}ms</span>
                    </div>
                `;
            }).join('');
        };

        // Render data differences section if we have multiple events to compare
        const renderDataDifferences = () => {
            if (eventsWithRelays.length < 2) {
                return ''; // Need at least 2 events to compare
            }

            const summaryClass = dataDiff.hasDifferences ? 'has-differences' : 'no-differences';
            const summaryIcon = dataDiff.hasDifferences ? '&#9888;' : '&#10003;';
            const summaryText = dataDiff.hasDifferences
                ? `${dataDiff.differingFields.length} field${dataDiff.differingFields.length !== 1 ? 's' : ''} differ${dataDiff.differingFields.length === 1 ? 's' : ''} across relays`
                : 'All relays returned identical event data';

            let html = `
                <div class="relay-data-diff">
                    <div class="relay-data-diff-header">
                        <span class="relay-data-diff-title">Data Consistency Check</span>
                        <span class="relay-data-diff-summary ${summaryClass}">
                            <span class="relay-data-diff-icon">${summaryIcon}</span>
                            ${summaryText}
                        </span>
                    </div>
            `;

            if (dataDiff.hasDifferences) {
                const fieldLabels = {
                    id: 'Event ID',
                    pubkey: 'Author',
                    created_at: 'Created At',
                    kind: 'Kind',
                    content: 'Content',
                    sig: 'Signature',
                    tags: 'Tags'
                };

                html += `
                    <div class="relay-data-diff-details">
                        <table class="relay-data-diff-table">
                            <thead>
                                <tr>
                                    <th class="relay-data-diff-field">Field</th>
                                    ${eventsWithRelays.map(e => `<th class="relay-data-diff-relay" title="${this.escapeHtml(e.relay)}">${this.escapeHtml(truncate(e.relay, 24))}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                `;

                // Show all fields, highlighting differences
                const fields = ['id', 'pubkey', 'created_at', 'kind', 'content', 'sig'];
                for (const field of fields) {
                    const isDifferent = dataDiff.differingFields.includes(field);
                    const rowClass = isDifferent ? 'different' : 'same';
                    const label = fieldLabels[field] || field;

                    html += `<tr class="relay-data-diff-row ${rowClass}">`;
                    html += `<td class="relay-data-diff-field">${this.escapeHtml(label)}</td>`;

                    for (const e of eventsWithRelays) {
                        let value = e.event[field];
                        // Format timestamps
                        if (field === 'created_at' && value) {
                            value = new Date(value * 1000).toLocaleString();
                        }
                        const displayValue = this.truncateForDiff(value);
                        const fullValue = String(value || '');
                        html += `<td class="relay-data-diff-value" title="${this.escapeHtml(fullValue)}">${this.escapeHtml(displayValue)}</td>`;
                    }

                    html += '</tr>';
                }

                // Tags comparison
                const tagsAreDifferent = dataDiff.differingFields.includes('tags');
                const tagsRowClass = tagsAreDifferent ? 'different' : 'same';
                html += `<tr class="relay-data-diff-row ${tagsRowClass}">`;
                html += `<td class="relay-data-diff-field">${fieldLabels.tags}</td>`;
                for (const e of eventsWithRelays) {
                    const tagCount = e.event.tags ? e.event.tags.length : 0;
                    html += `<td class="relay-data-diff-value">${tagCount} tag${tagCount !== 1 ? 's' : ''}</td>`;
                }
                html += '</tr>';

                html += `
                            </tbody>
                        </table>
                    </div>
                `;

                // If tags differ, show detailed tag comparison
                if (tagsAreDifferent) {
                    html += this.renderTagDifferencesAcrossRelays(eventsWithRelays, truncate);
                }
            }

            html += '</div>';
            return html;
        };

        const html = `
            <div class="all-relays-header">
                <span class="all-relays-title">Relay Availability</span>
                <span class="all-relays-summary">${hasEventCount} of ${total} relays have this event</span>
            </div>
            <div class="all-relays-event-id">
                <span class="all-relays-label">Event ID:</span>
                <span class="all-relays-id monospace" title="${this.escapeHtml(result.event_id)}">${this.escapeHtml(truncate(result.event_id, 40))}</span>
                <button class="btn small copy-btn" onclick="app.copyToClipboard('${this.escapeHtml(result.event_id)}')">Copy</button>
            </div>
            <div class="relay-availability-bar">
                <div class="relay-availability-progress">
                    <div class="has-event-bar" style="width: ${hasEventPct}%"></div>
                    <div class="missing-bar" style="width: ${missingPct}%"></div>
                    <div class="error-bar" style="width: ${errorPct}%"></div>
                </div>
                <div class="relay-availability-legend">
                    <div class="relay-availability-legend-item">
                        <span class="legend-dot has-event"></span>
                        <span class="legend-count">${hasEventCount}</span>
                        <span>Has Event</span>
                    </div>
                    <div class="relay-availability-legend-item">
                        <span class="legend-dot missing"></span>
                        <span class="legend-count">${missingCount}</span>
                        <span>Missing</span>
                    </div>
                    ${errorCount > 0 ? `
                    <div class="relay-availability-legend-item">
                        <span class="legend-dot error"></span>
                        <span class="legend-count">${errorCount}</span>
                        <span>Error</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ${renderDataDifferences()}
            <div class="all-relays-list">
                <div class="relay-results-header">
                    <span class="relay-header-status">Status</span>
                    <span class="relay-header-url">Relay</span>
                    <span class="relay-header-result">Availability</span>
                    <span class="relay-header-latency">Latency</span>
                </div>
                ${renderRelayResults()}
            </div>
        `;

        // Store the result for later use
        this.lastAllRelaysResult = result;

        resultDiv.classList.remove('hidden', 'error');
        resultDiv.classList.add('success');
        resultContent.innerHTML = html;
    }

    /**
     * Display an error for the all-relays fetch
     * @param {string} message - The error message
     */
    showAllRelaysError(message) {
        const resultDiv = document.getElementById('all-relays-result');
        const resultContent = resultDiv.querySelector('.all-relays-result-content');

        const html = `
            <div class="all-relays-header error">
                <span class="all-relays-title">Fetch Failed</span>
            </div>
            <div class="all-relays-error">
                <span class="all-relays-error-message">${this.escapeHtml(message)}</span>
            </div>
        `;

        resultDiv.classList.remove('hidden', 'success');
        resultDiv.classList.add('error');
        resultContent.innerHTML = html;
    }

    /**
     * Compute differences between events from multiple relays
     * @param {Array} eventsWithRelays - Array of {relay, event} objects
     * @returns {Object} - Object with hasDifferences flag and list of differing fields
     */
    computeRelayEventDifferences(eventsWithRelays) {
        const result = {
            hasDifferences: false,
            differingFields: []
        };

        if (eventsWithRelays.length < 2) {
            return result;
        }

        const fields = ['id', 'pubkey', 'created_at', 'kind', 'content', 'sig'];
        const referenceEvent = eventsWithRelays[0].event;

        // Check each scalar field
        for (const field of fields) {
            const referenceValue = referenceEvent[field];
            for (let i = 1; i < eventsWithRelays.length; i++) {
                const compareValue = eventsWithRelays[i].event[field];
                if (referenceValue !== compareValue) {
                    result.hasDifferences = true;
                    result.differingFields.push(field);
                    break;
                }
            }
        }

        // Check tags
        const referenceTags = JSON.stringify(referenceEvent.tags || []);
        for (let i = 1; i < eventsWithRelays.length; i++) {
            const compareTags = JSON.stringify(eventsWithRelays[i].event.tags || []);
            if (referenceTags !== compareTags) {
                result.hasDifferences = true;
                result.differingFields.push('tags');
                break;
            }
        }

        return result;
    }

    /**
     * Render detailed tag differences across relays
     * @param {Array} eventsWithRelays - Array of {relay, event} objects
     * @param {Function} truncate - Truncate function for display
     * @returns {string} - HTML string
     */
    renderTagDifferencesAcrossRelays(eventsWithRelays, truncate) {
        // Find max tag count across all events
        let maxTagCount = 0;
        for (const e of eventsWithRelays) {
            const count = e.event.tags ? e.event.tags.length : 0;
            if (count > maxTagCount) maxTagCount = count;
        }

        if (maxTagCount === 0) {
            return '';
        }

        let html = `
            <div class="relay-data-diff-tags">
                <div class="relay-data-diff-tags-header">Tag Details</div>
                <table class="relay-data-diff-table relay-data-diff-tags-table">
                    <thead>
                        <tr>
                            <th class="relay-data-diff-field">#</th>
                            ${eventsWithRelays.map(e => `<th class="relay-data-diff-relay" title="${this.escapeHtml(e.relay)}">${this.escapeHtml(truncate(e.relay, 24))}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let i = 0; i < maxTagCount; i++) {
            // Check if this tag row has any differences
            const tagValues = eventsWithRelays.map(e => {
                const tags = e.event.tags || [];
                return tags[i] ? JSON.stringify(tags[i]) : null;
            });
            const firstValue = tagValues[0];
            const hasDiff = tagValues.some(v => v !== firstValue);
            const rowClass = hasDiff ? 'different' : 'same';

            html += `<tr class="relay-data-diff-row ${rowClass}">`;
            html += `<td class="relay-data-diff-field">${i + 1}</td>`;

            for (const e of eventsWithRelays) {
                const tags = e.event.tags || [];
                const tag = tags[i];
                if (tag) {
                    const tagStr = JSON.stringify(tag);
                    const displayValue = this.truncateForDiff(tagStr);
                    html += `<td class="relay-data-diff-value" title="${this.escapeHtml(tagStr)}">${this.escapeHtml(displayValue)}</td>`;
                } else {
                    html += `<td class="relay-data-diff-value empty"><span class="diff-empty">—</span></td>`;
                }
            }

            html += '</tr>';
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    /**
     * Show raw JSON for the looked up event
     * @param {string} eventId - The event ID
     */
    showEventJsonFromLookup(eventId) {
        if (this.lastLookupEvent && this.lastLookupEvent.id === eventId) {
            this.showModal('Raw Event JSON', `<pre class="event-json">${this.escapeHtml(JSON.stringify(this.lastLookupEvent, null, 2))}</pre>`);
        }
    }

    /**
     * Copy the looked up event to the verify textarea
     * @param {string} eventId - The event ID
     */
    copyEventToVerify(eventId) {
        if (this.lastLookupEvent && this.lastLookupEvent.id === eventId) {
            document.getElementById('verify-event-input').value = JSON.stringify(this.lastLookupEvent, null, 2);
            this.toastSuccess('Copied', 'Event copied to Verify section');
        }
    }

    /**
     * Paste from clipboard into verify input
     */
    async pasteVerifyInput() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('verify-event-input').value = text;
            this.toastSuccess('Pasted', 'Content pasted from clipboard');
        } catch (error) {
            console.error('Failed to paste:', error);
            this.toastError('Paste Failed', 'Could not read from clipboard');
        }
    }

    /**
     * Compare two Nostr events and show their differences
     */
    compareEvents() {
        const inputA = document.getElementById('diff-event-a');
        const inputB = document.getElementById('diff-event-b');
        const jsonA = inputA.value.trim();
        const jsonB = inputB.value.trim();

        if (!jsonA || !jsonB) {
            this.toastError('Error', 'Please enter both events to compare');
            return;
        }

        let eventA, eventB;
        try {
            eventA = JSON.parse(jsonA);
        } catch (e) {
            this.toastError('Error', 'Event A has invalid JSON format');
            return;
        }

        try {
            eventB = JSON.parse(jsonB);
        } catch (e) {
            this.toastError('Error', 'Event B has invalid JSON format');
            return;
        }

        const diff = this.computeEventDiff(eventA, eventB);
        this.showDiffResult(diff, eventA, eventB);
    }

    /**
     * Compute the differences between two event objects
     * @param {Object} eventA - First event
     * @param {Object} eventB - Second event
     * @returns {Object} - Diff object with field comparisons
     */
    computeEventDiff(eventA, eventB) {
        const fields = ['id', 'pubkey', 'created_at', 'kind', 'content', 'sig'];
        const diff = {
            fields: {},
            tags: { added: [], removed: [], modified: [] },
            identical: true
        };

        // Compare scalar fields
        for (const field of fields) {
            const valueA = eventA[field];
            const valueB = eventB[field];
            const isEqual = valueA === valueB;

            diff.fields[field] = {
                a: valueA,
                b: valueB,
                equal: isEqual
            };

            if (!isEqual) {
                diff.identical = false;
            }
        }

        // Compare tags
        const tagsA = eventA.tags || [];
        const tagsB = eventB.tags || [];
        const tagSetA = new Set(tagsA.map(t => JSON.stringify(t)));
        const tagSetB = new Set(tagsB.map(t => JSON.stringify(t)));

        // Tags in B but not in A (added)
        for (const tag of tagsB) {
            const tagStr = JSON.stringify(tag);
            if (!tagSetA.has(tagStr)) {
                diff.tags.added.push(tag);
                diff.identical = false;
            }
        }

        // Tags in A but not in B (removed)
        for (const tag of tagsA) {
            const tagStr = JSON.stringify(tag);
            if (!tagSetB.has(tagStr)) {
                diff.tags.removed.push(tag);
                diff.identical = false;
            }
        }

        return diff;
    }

    /**
     * Display the diff result
     * @param {Object} diff - The computed diff
     * @param {Object} eventA - First event
     * @param {Object} eventB - Second event
     */
    showDiffResult(diff, eventA, eventB) {
        const resultDiv = document.getElementById('diff-result');
        const resultContent = resultDiv.querySelector('.diff-result-content');

        resultDiv.classList.remove('hidden');
        resultDiv.classList.remove('identical', 'different');
        resultDiv.classList.add(diff.identical ? 'identical' : 'different');

        let html = '';

        // Summary header
        if (diff.identical) {
            html += `
                <div class="diff-summary identical">
                    <span class="diff-summary-icon">&#61;</span>
                    <span class="diff-summary-text">Events are identical</span>
                </div>
            `;
        } else {
            const changedCount = Object.values(diff.fields).filter(f => !f.equal).length;
            const tagChanges = diff.tags.added.length + diff.tags.removed.length;
            html += `
                <div class="diff-summary different">
                    <span class="diff-summary-icon">&#8800;</span>
                    <span class="diff-summary-text">${changedCount} field${changedCount !== 1 ? 's' : ''} differ${changedCount === 1 ? 's' : ''}, ${tagChanges} tag change${tagChanges !== 1 ? 's' : ''}</span>
                </div>
            `;
        }

        // Side-by-side comparison table
        const fieldLabels = {
            id: 'Event ID',
            pubkey: 'Author',
            created_at: 'Created At',
            kind: 'Kind',
            content: 'Content',
            sig: 'Signature'
        };

        html += `
            <div class="diff-table-container">
                <table class="diff-table">
                    <thead>
                        <tr>
                            <th class="diff-table-field">Field</th>
                            <th class="diff-table-value diff-table-a">Event A</th>
                            <th class="diff-table-value diff-table-b">Event B</th>
                            <th class="diff-table-status">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const [field, info] of Object.entries(diff.fields)) {
            const statusClass = info.equal ? 'equal' : 'changed';
            const label = fieldLabels[field] || field;

            let valueA = info.a;
            let valueB = info.b;

            // Format timestamps
            if (field === 'created_at') {
                valueA = valueA ? new Date(valueA * 1000).toLocaleString() : 'N/A';
                valueB = valueB ? new Date(valueB * 1000).toLocaleString() : 'N/A';
            }

            // Truncate long strings for display
            const displayA = this.truncateForDiff(valueA);
            const displayB = this.truncateForDiff(valueB);

            html += `
                <tr class="diff-table-row ${statusClass}">
                    <td class="diff-table-field">${this.escapeHtml(label)}</td>
                    <td class="diff-table-value diff-table-a" title="${this.escapeHtml(String(info.a || ''))}">${this.escapeHtml(displayA)}</td>
                    <td class="diff-table-value diff-table-b" title="${this.escapeHtml(String(info.b || ''))}">${this.escapeHtml(displayB)}</td>
                    <td class="diff-table-status"><span class="diff-status-badge ${statusClass}">${info.equal ? 'Same' : 'Different'}</span></td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // Tag changes comparison table
        if (diff.tags.added.length > 0 || diff.tags.removed.length > 0 || (eventA.tags && eventA.tags.length > 0) || (eventB.tags && eventB.tags.length > 0)) {
            html += '<div class="diff-tags">';
            html += '<div class="diff-tags-header">Tags Comparison</div>';

            // Build a combined tag comparison table
            const tagsA = eventA.tags || [];
            const tagsB = eventB.tags || [];
            const maxTags = Math.max(tagsA.length, tagsB.length);

            if (maxTags > 0) {
                html += `
                    <div class="diff-table-container">
                        <table class="diff-table diff-tags-table">
                            <thead>
                                <tr>
                                    <th class="diff-table-index">#</th>
                                    <th class="diff-table-value diff-table-a">Event A Tags</th>
                                    <th class="diff-table-value diff-table-b">Event B Tags</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                for (let i = 0; i < maxTags; i++) {
                    const tagA = tagsA[i];
                    const tagB = tagsB[i];
                    const tagAStr = tagA ? JSON.stringify(tagA) : '';
                    const tagBStr = tagB ? JSON.stringify(tagB) : '';
                    const tagsEqual = tagAStr === tagBStr;
                    const rowClass = tagsEqual ? 'equal' : 'changed';

                    html += `
                        <tr class="diff-table-row ${rowClass}">
                            <td class="diff-table-index">${i + 1}</td>
                            <td class="diff-table-value diff-table-a ${!tagA ? 'empty' : ''}" title="${this.escapeHtml(tagAStr)}">${tagA ? this.escapeHtml(this.truncateForDiff(tagAStr)) : '<span class="diff-empty">—</span>'}</td>
                            <td class="diff-table-value diff-table-b ${!tagB ? 'empty' : ''}" title="${this.escapeHtml(tagBStr)}">${tagB ? this.escapeHtml(this.truncateForDiff(tagBStr)) : '<span class="diff-empty">—</span>'}</td>
                        </tr>
                    `;
                }

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // Summary of tag changes
            if (diff.tags.removed.length > 0 || diff.tags.added.length > 0) {
                html += '<div class="diff-tags-summary">';
                if (diff.tags.removed.length > 0) {
                    html += `<span class="diff-tags-count removed">${diff.tags.removed.length} removed</span>`;
                }
                if (diff.tags.added.length > 0) {
                    html += `<span class="diff-tags-count added">${diff.tags.added.length} added</span>`;
                }
                html += '</div>';
            }

            html += '</div>';
        }

        resultContent.innerHTML = html;
    }

    /**
     * Truncate a value for diff display
     * @param {*} value - The value to truncate
     * @returns {string} - Truncated string representation
     */
    truncateForDiff(value) {
        if (value === null || value === undefined) {
            return 'N/A';
        }
        const str = String(value);
        if (str.length > 60) {
            return str.substring(0, 28) + '...' + str.substring(str.length - 28);
        }
        return str;
    }

    /**
     * Swap the two diff input values
     */
    swapDiffEvents() {
        const inputA = document.getElementById('diff-event-a');
        const inputB = document.getElementById('diff-event-b');
        const tempValue = inputA.value;
        inputA.value = inputB.value;
        inputB.value = tempValue;
        this.toastSuccess('Swapped', 'Events A and B have been swapped');
    }

    /**
     * Clear the diff inputs and result
     */
    clearDiffInputs() {
        document.getElementById('diff-event-a').value = '';
        document.getElementById('diff-event-b').value = '';
        const resultDiv = document.getElementById('diff-result');
        resultDiv.classList.add('hidden');
        resultDiv.classList.remove('identical', 'different');
    }

    /**
     * Update the batch query ID count display
     */
    updateBatchIdCount() {
        const input = document.getElementById('batch-query-input');
        const countSpan = document.getElementById('batch-id-count');
        const ids = input.value.trim().split(/[\n,]+/).filter(id => id.trim().length > 0);
        countSpan.textContent = ids.length;
    }

    /**
     * Fetch multiple events by their IDs (batch query)
     */
    async batchQueryEvents() {
        const input = document.getElementById('batch-query-input');
        const queryBtn = document.getElementById('batch-query-btn');
        const rawInput = input.value.trim();

        if (!rawInput) {
            this.toastError('Error', 'Please enter at least one event ID');
            return;
        }

        // Parse IDs (split by newlines or commas)
        const ids = rawInput.split(/[\n,]+/)
            .map(id => id.trim())
            .filter(id => id.length > 0);

        if (ids.length === 0) {
            this.toastError('Error', 'No valid event IDs found');
            return;
        }

        if (ids.length > 100) {
            this.toastError('Error', 'Maximum 100 event IDs allowed per batch');
            return;
        }

        // Validate each ID format
        for (const id of ids) {
            const isHex = /^[0-9a-fA-F]{64}$/.test(id);
            const isNote = id.startsWith('note1');
            const isNevent = id.startsWith('nevent1');
            if (!isHex && !isNote && !isNevent) {
                this.toastError('Error', `Invalid format for ID: ${id.substring(0, 20)}...`);
                return;
            }
        }

        // Disable button during query
        queryBtn.disabled = true;
        queryBtn.textContent = 'Fetching...';

        try {
            const response = await fetch('/api/events/batch-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to batch query events' }));
                throw new Error(error.error || 'Failed to batch query events');
            }

            const result = await response.json();
            this.showBatchQueryResult(result);
            this.toastSuccess('Complete', `Found ${result.total_found}/${result.total_queried} events`);
        } catch (error) {
            console.error('Batch query error:', error);
            this.toastError('Error', error.message);
        } finally {
            queryBtn.disabled = false;
            queryBtn.textContent = 'Fetch Events';
        }
    }

    /**
     * Display batch query results
     * @param {Object} result - The batch query response
     */
    showBatchQueryResult(result) {
        const resultDiv = document.getElementById('batch-query-result');
        const resultsContainer = document.getElementById('batch-query-results');

        // Update summary
        document.getElementById('batch-found-count').textContent = result.total_found;
        document.getElementById('batch-missing-count').textContent = result.total_queried - result.total_found;
        document.getElementById('batch-query-time').textContent = result.total_time_ms;

        const truncate = (str, len = 32) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len / 2) + '...' + str.substring(str.length - len / 2) : str;
        };

        const getKindDescription = (kind) => {
            const kindDescriptions = {
                0: 'Metadata',
                1: 'Note',
                3: 'Follow List',
                4: 'DM',
                5: 'Delete',
                6: 'Repost',
                7: 'Reaction',
                9735: 'Zap',
                30023: 'Article'
            };
            return kindDescriptions[kind] || `Kind ${kind}`;
        };

        // Render results
        const html = result.results.map((r, index) => {
            const statusClass = r.found ? 'found' : 'not-found';
            const statusIcon = r.found ? '&#10003;' : '&#10007;';
            const foundOnCount = r.found_on ? r.found_on.length : 0;
            const missingOnCount = r.missing_on ? r.missing_on.length : 0;
            const totalRelays = foundOnCount + missingOnCount;

            let eventInfo = '';
            if (r.found && r.event) {
                eventInfo = `
                    <div class="batch-event-info">
                        <span class="batch-event-kind">${getKindDescription(r.event.kind)}</span>
                        <span class="batch-event-author" title="${this.escapeHtml(r.event.pubkey)}">by ${this.escapeHtml(truncate(r.event.pubkey, 16))}</span>
                        <span class="batch-event-content" title="${this.escapeHtml(r.event.content)}">${this.escapeHtml(truncate(r.event.content, 40))}</span>
                    </div>
                `;
            }

            const relayAvailability = totalRelays > 0 ? `
                <div class="batch-relay-availability">
                    <span class="batch-relay-found">${foundOnCount} relays</span>
                    ${missingOnCount > 0 ? `<span class="batch-relay-missing">${missingOnCount} missing</span>` : ''}
                </div>
            ` : '';

            return `
                <div class="batch-result-item ${statusClass}" data-index="${index}">
                    <div class="batch-result-main">
                        <span class="batch-result-icon ${statusClass}">${statusIcon}</span>
                        <span class="batch-result-id monospace" title="${this.escapeHtml(r.event_id)}">${this.escapeHtml(truncate(r.event_id, 24))}</span>
                        ${eventInfo}
                        ${relayAvailability}
                    </div>
                    <div class="batch-result-actions">
                        ${r.found ? `
                            <button class="btn small" onclick="app.showBatchEventJson(${index})">JSON</button>
                            <button class="btn small" onclick="app.copyToClipboard('${this.escapeHtml(r.event_id)}')">Copy ID</button>
                        ` : `
                            <span class="batch-not-found-label">Not Found</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = html;
        resultDiv.classList.remove('hidden');

        // Store results for later reference
        this.lastBatchQueryResult = result;
    }

    /**
     * Show JSON for a batch query result event
     * @param {number} index - Index of the event in batch results
     */
    showBatchEventJson(index) {
        if (!this.lastBatchQueryResult || !this.lastBatchQueryResult.results[index]) {
            this.toastError('Error', 'Event not found');
            return;
        }

        const result = this.lastBatchQueryResult.results[index];
        if (!result.found || !result.event) {
            this.toastError('Error', 'Event data not available');
            return;
        }

        const eventJson = JSON.stringify(result.event, null, 2);
        this.showModal('Event JSON', `
            <div class="event-json-container">
                <pre class="event-json">${this.escapeHtml(eventJson)}</pre>
                <div class="event-json-actions">
                    <button class="btn primary" onclick="app.copyToClipboard(\`${eventJson.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`); app.closeModal();">Copy JSON</button>
                </div>
            </div>
        `);
    }

    /**
     * Clear the batch query input and results
     */
    clearBatchQuery() {
        document.getElementById('batch-query-input').value = '';
        document.getElementById('batch-id-count').textContent = '0';
        document.getElementById('batch-query-result').classList.add('hidden');
        document.getElementById('batch-query-results').innerHTML = '';
        this.lastBatchQueryResult = null;
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

        // Tag builder management
        const addTagRowBtn = document.getElementById('add-tag-row-btn');
        if (addTagRowBtn) {
            addTagRowBtn.addEventListener('click', () => this.addTagBuilderRow());
        }

        // Event delegation for tag builder interactions
        const tagBuilderRows = document.getElementById('tag-builder-rows');
        if (tagBuilderRows) {
            tagBuilderRows.addEventListener('click', (e) => {
                const target = e.target;
                if (target.classList.contains('tag-row-remove')) {
                    const row = target.closest('.tag-builder-row');
                    const index = parseInt(row.dataset.index);
                    this.removeTagBuilderRow(index);
                } else if (target.classList.contains('tag-value-add')) {
                    const row = target.closest('.tag-builder-row');
                    const index = parseInt(row.dataset.index);
                    this.addTagValue(index);
                } else if (target.classList.contains('tag-value-remove')) {
                    const row = target.closest('.tag-builder-row');
                    const rowIndex = parseInt(row.dataset.index);
                    const valueIndex = parseInt(target.dataset.valueIndex);
                    this.removeTagValue(rowIndex, valueIndex);
                }
            });

            tagBuilderRows.addEventListener('input', (e) => {
                const target = e.target;
                if (target.classList.contains('tag-key-input') || target.classList.contains('tag-value-input')) {
                    this.syncTagsFromBuilder();
                    this.updateEventPreview();
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

        // Preview, sign only, and sign & publish buttons
        const previewBtn = document.getElementById('preview-event-btn');
        const signOnlyBtn = document.getElementById('sign-only-btn');
        const signPublishBtn = document.getElementById('sign-publish-btn');

        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.updateEventPreview());
        }

        if (signOnlyBtn) {
            signOnlyBtn.addEventListener('click', () => this.signOnlyEvent());
        }

        if (signPublishBtn) {
            signPublishBtn.addEventListener('click', () => this.signAndPublishEvent());
        }

        // Update extension status in signing options
        this.updatePublishExtensionStatus();

        // Load relays for the checkbox list when tab is shown
        document.querySelector('[data-tab="publish"]').addEventListener('click', () => {
            this.loadPublishRelays();
        });

        // Relay selector controls
        const selectAllBtn = document.getElementById('select-all-relays');
        const selectNoneBtn = document.getElementById('select-none-relays');
        const selectConnectedBtn = document.getElementById('select-connected-relays');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllRelays());
        }
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => this.selectNoRelays());
        }
        if (selectConnectedBtn) {
            selectConnectedBtn.addEventListener('click', () => this.selectConnectedRelays());
        }
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
            this.updateRelaySelectionCount();
            return;
        }

        container.innerHTML = this.relays.map((relay, index) => `
            <label class="relay-checkbox-item">
                <input type="checkbox" name="publish-relay" value="${this.escapeHtml(relay.url)}" ${relay.connected ? 'checked' : ''}>
                <span class="relay-status-dot ${relay.connected ? 'connected' : 'disconnected'}"></span>
                <span class="relay-url">${this.escapeHtml(relay.url)}</span>
            </label>
        `).join('');

        // Add change listeners to update count
        container.querySelectorAll('input[name="publish-relay"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateRelaySelectionCount());
        });

        this.updateRelaySelectionCount();
    }

    updateRelaySelectionCount() {
        const countEl = document.getElementById('relay-selection-count');
        if (!countEl) return;

        const checkboxes = document.querySelectorAll('input[name="publish-relay"]');
        const checked = document.querySelectorAll('input[name="publish-relay"]:checked');

        if (checkboxes.length === 0) {
            countEl.textContent = '';
            return;
        }

        countEl.textContent = `(${checked.length}/${checkboxes.length} selected)`;
    }

    selectAllRelays() {
        document.querySelectorAll('input[name="publish-relay"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateRelaySelectionCount();
    }

    selectNoRelays() {
        document.querySelectorAll('input[name="publish-relay"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateRelaySelectionCount();
    }

    selectConnectedRelays() {
        const connectedUrls = new Set(
            this.relays.filter(r => r.connected).map(r => r.url)
        );
        document.querySelectorAll('input[name="publish-relay"]').forEach(checkbox => {
            checkbox.checked = connectedUrls.has(checkbox.value);
        });
        this.updateRelaySelectionCount();
    }

    addPublishTag() {
        // Legacy method for backwards compatibility
        this.addTagBuilderRow();
    }

    addTagBuilderRow(key = '', values = ['']) {
        // Ensure values is always an array with at least one element
        if (!Array.isArray(values) || values.length === 0) {
            values = [''];
        }
        this.publishTags.push([key, ...values]);
        this.renderPublishTags();
        this.updateEventPreview();

        // Focus on the new row's key input
        const container = document.getElementById('tag-builder-rows');
        if (container) {
            const rows = container.querySelectorAll('.tag-builder-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                const keyInput = lastRow.querySelector('.tag-key-input');
                if (keyInput) {
                    keyInput.focus();
                }
            }
        }
    }

    removePublishTag(index) {
        this.removeTagBuilderRow(index);
    }

    removeTagBuilderRow(index) {
        this.publishTags.splice(index, 1);
        this.renderPublishTags();
        this.updateEventPreview();
    }

    addTagValue(rowIndex) {
        if (this.publishTags[rowIndex]) {
            this.publishTags[rowIndex].push('');
            this.renderPublishTags();
            this.updateEventPreview();

            // Focus on the new value input
            const container = document.getElementById('tag-builder-rows');
            if (container) {
                const row = container.querySelector(`.tag-builder-row[data-index="${rowIndex}"]`);
                if (row) {
                    const valueInputs = row.querySelectorAll('.tag-value-input');
                    const lastInput = valueInputs[valueInputs.length - 1];
                    if (lastInput) {
                        lastInput.focus();
                    }
                }
            }
        }
    }

    removeTagValue(rowIndex, valueIndex) {
        if (this.publishTags[rowIndex] && this.publishTags[rowIndex].length > 2) {
            // valueIndex is 0-based for values, but index 0 in the array is the key
            // so valueIndex 0 corresponds to array index 1
            this.publishTags[rowIndex].splice(valueIndex + 1, 1);
            this.renderPublishTags();
            this.updateEventPreview();
        }
    }

    syncTagsFromBuilder() {
        const container = document.getElementById('tag-builder-rows');
        if (!container) return;

        const rows = container.querySelectorAll('.tag-builder-row');
        this.publishTags = Array.from(rows).map(row => {
            const keyInput = row.querySelector('.tag-key-input');
            const valueInputs = row.querySelectorAll('.tag-value-input');
            const key = keyInput ? keyInput.value : '';
            const values = Array.from(valueInputs).map(input => input.value);
            return [key, ...values];
        });
    }

    renderPublishTags() {
        const container = document.getElementById('tag-builder-rows');
        if (!container) return;

        if (this.publishTags.length === 0) {
            container.innerHTML = '<p class="hint tag-builder-empty">No tags added yet. Click "+ Add Tag" to add a tag.</p>';
            return;
        }

        container.innerHTML = this.publishTags.map((tag, index) => {
            const key = tag[0] || '';
            const values = tag.slice(1);
            // Ensure at least one value field
            if (values.length === 0) {
                values.push('');
            }

            return `
                <div class="tag-builder-row" data-index="${index}">
                    <div class="tag-row-key">
                        <input type="text" class="form-input tag-key-input" value="${this.escapeHtml(key)}" placeholder="Key" title="Tag key (e.g., p, e, t)">
                    </div>
                    <div class="tag-row-values">
                        ${values.map((value, valueIndex) => `
                            <div class="tag-value-wrapper">
                                <input type="text" class="form-input tag-value-input" value="${this.escapeHtml(value)}" placeholder="Value ${valueIndex + 1}" data-value-index="${valueIndex}">
                                ${values.length > 1 ? `<button type="button" class="btn small tag-value-remove" data-value-index="${valueIndex}" title="Remove value">&times;</button>` : ''}
                            </div>
                        `).join('')}
                        <button type="button" class="btn small tag-value-add" title="Add another value">+</button>
                    </div>
                    <button type="button" class="btn small tag-row-remove" title="Remove tag row">&times;</button>
                </div>
            `;
        }).join('');
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

    async signOnlyEvent() {
        const signOnlyBtn = document.getElementById('sign-only-btn');
        const kind = this.getPublishEventKind();
        const content = document.getElementById('publish-content').value;
        const tags = this.publishTags;

        // Get signing method
        const useExtension = document.getElementById('sign-extension').checked;
        const nsecInput = document.getElementById('publish-nsec');

        if (!useExtension && !nsecInput.value.trim()) {
            this.toastError('Missing Private Key', 'Please enter your nsec private key');
            nsecInput.focus();
            return;
        }

        await this.withLoading('sign-only', async () => {
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

            // Store the signed event for potential publishing
            this.lastSignedEvent = signedEvent;

            // Display signed event in the preview panel
            this.displaySignedEvent(signedEvent);

            this.toastSuccess('Event Signed', 'Event signed successfully. You can now publish it.');
        }, {
            button: signOnlyBtn,
            buttonText: 'Signing...',
            showErrorToast: true
        });
    }

    displaySignedEvent(event) {
        const signedEventPreview = document.getElementById('signed-event-preview');
        if (!signedEventPreview) return;

        const eventJson = JSON.stringify(event, null, 2);

        signedEventPreview.innerHTML = `
            <div class="signed-event-content">
                <div class="signed-event-header">
                    <span class="signed-badge">Signed</span>
                    <button class="btn small copy-signed-event" title="Copy to clipboard">Copy JSON</button>
                </div>
                <div class="signed-event-details">
                    <div class="detail-row">
                        <span class="label">Event ID:</span>
                        <span class="value mono">${event.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Pubkey:</span>
                        <span class="value mono">${event.pubkey}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Signature:</span>
                        <span class="value mono">${event.sig.slice(0, 32)}...</span>
                    </div>
                </div>
                <pre class="signed-event-json">${this.escapeHtml(eventJson)}</pre>
            </div>
        `;

        // Add copy handler
        const copyBtn = signedEventPreview.querySelector('.copy-signed-event');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(eventJson).then(() => {
                    this.toastSuccess('Copied', 'Signed event JSON copied to clipboard');
                }).catch(() => {
                    this.toastError('Copy Failed', 'Failed to copy to clipboard');
                });
            });
        }
    }

    async signAndPublishEvent() {
        const signPublishBtn = document.getElementById('sign-publish-btn');
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

        let signedEvent;

        // First, sign the event
        await this.withLoading('sign-publish', async () => {
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
        }, {
            button: signPublishBtn,
            buttonText: 'Signing...',
            showErrorToast: true
        });

        // If signing failed, signedEvent will be undefined
        if (!signedEvent) {
            return;
        }

        // Show event preview modal and wait for user confirmation
        const shouldPublish = await this.showEventPreviewModal(signedEvent, selectedRelays);

        if (!shouldPublish) {
            this.toastInfo('Cancelled', 'Event publishing cancelled');
            return;
        }

        // User confirmed, now publish
        await this.withLoading('sign-publish', async () => {
            // Display signed event in sidebar
            this.displaySignedEvent(signedEvent);

            // Publish to selected relays (single API call)
            const publishResponse = await fetch('/api/events/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: signedEvent,
                    relays: selectedRelays
                })
            });

            if (!publishResponse.ok) {
                const error = await publishResponse.json();
                throw new Error(error.error || 'Failed to publish event');
            }

            const publishData = await publishResponse.json();
            const eventId = publishData.event_id;
            const publishResults = publishData.results || [];

            // Check results
            const successCount = publishResults.filter(r => r.success).length;
            const failCount = publishResults.length - successCount;

            // Add to history with event ID
            this.addToPublishHistory({
                event: signedEvent,
                eventId: eventId,
                results: publishResults,
                timestamp: Date.now()
            });

            // Show publish result modal
            this.showPublishResult(eventId, publishResults);

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
            button: signPublishBtn,
            buttonText: 'Publishing...',
            showErrorToast: true
        });
    }

    /**
     * Show event preview modal before publishing
     * @param {Object} signedEvent - The signed Nostr event
     * @param {string[]} selectedRelays - Array of relay URLs to publish to
     * @returns {Promise<boolean>} True if user confirms, false if cancelled
     */
    showEventPreviewModal(signedEvent, selectedRelays) {
        const eventJson = JSON.stringify(signedEvent, null, 2);
        const kindDescription = this.getEventKindDescription(signedEvent.kind) || 'Unknown';

        const modalBody = `
            <div class="event-preview-modal">
                <div class="event-preview-summary">
                    <div class="preview-summary-row">
                        <span class="preview-label">Kind</span>
                        <span class="preview-value">${signedEvent.kind} (${this.escapeHtml(kindDescription)})</span>
                    </div>
                    <div class="preview-summary-row">
                        <span class="preview-label">Event ID</span>
                        <span class="preview-value mono">${signedEvent.id}</span>
                    </div>
                    <div class="preview-summary-row">
                        <span class="preview-label">Pubkey</span>
                        <span class="preview-value mono">${signedEvent.pubkey}</span>
                    </div>
                    <div class="preview-summary-row">
                        <span class="preview-label">Created</span>
                        <span class="preview-value">${this.formatTime(signedEvent.created_at)}</span>
                    </div>
                    ${signedEvent.content ? `
                    <div class="preview-summary-row">
                        <span class="preview-label">Content</span>
                        <span class="preview-value content-preview">${this.escapeHtml(signedEvent.content.substring(0, 200))}${signedEvent.content.length > 200 ? '...' : ''}</span>
                    </div>
                    ` : ''}
                    ${signedEvent.tags.length > 0 ? `
                    <div class="preview-summary-row">
                        <span class="preview-label">Tags</span>
                        <span class="preview-value">${signedEvent.tags.length} tag${signedEvent.tags.length !== 1 ? 's' : ''}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="event-preview-json-section">
                    <div class="json-section-header">
                        <span class="json-section-title">Event JSON</span>
                        <button class="btn btn-small copy-preview-json" title="Copy JSON">Copy</button>
                    </div>
                    <pre class="event-preview-json">${this.escapeHtml(eventJson)}</pre>
                </div>

                <div class="event-preview-relays">
                    <span class="relays-label">Publishing to ${selectedRelays.length} relay${selectedRelays.length !== 1 ? 's' : ''}:</span>
                    <div class="relays-list">
                        ${selectedRelays.map(url => `<span class="relay-tag">${this.escapeHtml(this.shortenRelayUrl(url))}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;

        // Show modal and return promise
        const modalPromise = this.showModal({
            title: 'Review Event Before Publishing',
            body: modalBody,
            buttons: [
                { text: 'Cancel', type: 'default', value: false },
                { text: 'Publish', type: 'primary', value: true }
            ],
            size: 'lg',
            closeOnOverlay: true
        });

        // Add copy handler after modal is shown
        setTimeout(() => {
            const copyBtn = document.querySelector('.event-preview-modal .copy-preview-json');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(eventJson).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                    }).catch(() => {
                        this.toastError('Copy Failed', 'Failed to copy to clipboard');
                    });
                });
            }
        }, 50);

        return modalPromise;
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
            const eventId = entry.eventId || entry.event?.id || '';
            const shortEventId = eventId ? eventId.substring(0, 8) + '...' + eventId.substring(eventId.length - 8) : '';

            return `
                <div class="publish-history-item" data-event-id="${this.escapeHtml(eventId)}">
                    <div class="history-header">
                        <span class="history-kind">Kind ${entry.event.kind}</span>
                        <span class="history-time">${this.formatTime(Math.floor(entry.timestamp / 1000))}</span>
                    </div>
                    ${eventId ? `<div class="history-event-id" title="${this.escapeHtml(eventId)}"><span class="label">Event ID:</span> <code class="copyable" data-copy="${this.escapeHtml(eventId)}">${shortEventId}</code></div>` : ''}
                    <div class="history-content">${this.escapeHtml(entry.event.content.substring(0, 100))}${entry.event.content.length > 100 ? '...' : ''}</div>
                    <div class="history-relays-detail">
                        ${entry.results.map(r => `
                            <div class="relay-result ${r.success ? 'success' : 'error'}" title="${r.error || 'Success'}">
                                <span class="relay-icon">${r.success ? '✓' : '✗'}</span>
                                <span class="relay-url">${this.escapeHtml(this.shortenRelayUrl(r.url))}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers for copyable elements
        container.querySelectorAll('.copyable').forEach(el => {
            el.addEventListener('click', () => {
                const text = el.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    this.toastSuccess('Copied', 'Event ID copied to clipboard');
                });
            });
        });
    }

    /**
     * Shorten a relay URL for display
     */
    shortenRelayUrl(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url);
            return parsed.hostname;
        } catch {
            return url.substring(0, 30) + (url.length > 30 ? '...' : '');
        }
    }

    /**
     * Show publish result with event ID and relay confirmations
     */
    showPublishResult(eventId, results) {
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        const isFullSuccess = failCount === 0;

        const modalContent = `
            <div class="publish-result">
                <div class="publish-result-header ${isFullSuccess ? 'success' : (successCount > 0 ? 'partial' : 'error')}">
                    <span class="result-icon">${isFullSuccess ? '✓' : (successCount > 0 ? '⚠' : '✗')}</span>
                    <span class="result-title">${isFullSuccess ? 'Event Published' : (successCount > 0 ? 'Partially Published' : 'Publish Failed')}</span>
                </div>

                <div class="publish-result-event-id">
                    <label>Event ID</label>
                    <div class="event-id-display">
                        <code class="event-id-code">${this.escapeHtml(eventId)}</code>
                        <button class="btn btn-small copy-btn" data-copy="${this.escapeHtml(eventId)}" title="Copy Event ID">Copy</button>
                    </div>
                </div>

                <div class="publish-result-relays">
                    <label>Relay Confirmations</label>
                    <div class="relay-results-list">
                        ${results.map(r => `
                            <div class="relay-result-item ${r.success ? 'success' : 'error'}">
                                <span class="relay-status-icon">${r.success ? '✓' : '✗'}</span>
                                <span class="relay-url-full">${this.escapeHtml(r.url)}</span>
                                ${r.error ? `<span class="relay-error" title="${this.escapeHtml(r.error)}">${this.escapeHtml(r.error.substring(0, 50))}${r.error.length > 50 ? '...' : ''}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="publish-result-summary">
                    <span class="summary-text">${successCount}/${results.length} relays confirmed</span>
                </div>
            </div>
        `;

        this.showModal('Publish Result', modalContent);

        // Add copy handler
        document.querySelector('.publish-result .copy-btn')?.addEventListener('click', (e) => {
            const text = e.target.dataset.copy;
            navigator.clipboard.writeText(text).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => e.target.textContent = 'Copy', 2000);
            });
        });
    }

    // Testing Tab
    setupTesting() {
        // NIP list click handler will be set up after rendering

        // Load test history from server
        this.loadTestHistory();

        // Setup clear history button
        const clearBtn = document.getElementById('clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearTestHistory());
        }
    }

    /**
     * Get display label for a category
     */
    getCategoryLabel(category) {
        const labels = {
            'core': 'Core',
            'identity': 'Identity',
            'encoding': 'Encoding',
            'encryption': 'Encryption',
            'payments': 'Payments',
            'dvms': 'DVMs',
            'social': 'Social'
        };
        return labels[category] || category;
    }

    /**
     * Get description for an event kind
     */
    getEventKindDescription(kind) {
        const descriptions = {
            0: 'User Metadata',
            1: 'Short Text Note',
            2: 'Recommend Relay (deprecated)',
            3: 'Follow List',
            4: 'Encrypted Direct Message (deprecated)',
            5: 'Event Deletion Request',
            6: 'Repost',
            7: 'Reaction',
            8: 'Badge Award',
            9: 'Group Chat Message',
            10: 'Group Chat Threaded Reply',
            11: 'Group Thread',
            12: 'Group Thread Reply',
            13: 'Seal',
            14: 'Direct Message',
            16: 'Generic Repost',
            17: 'Reaction to Website',
            40: 'Channel Creation',
            41: 'Channel Metadata',
            42: 'Channel Message',
            43: 'Channel Hide Message',
            44: 'Channel Mute User',
            1059: 'Gift Wrap',
            1063: 'File Metadata',
            1311: 'Live Chat Message',
            1971: 'Problem Tracker',
            1984: 'Report',
            1985: 'Label',
            4550: 'Community Post Approval',
            5000: 'DVM Job Request (Text)',
            5001: 'DVM Job Request (Image)',
            6000: 'DVM Job Result (Text)',
            6001: 'DVM Job Result (Image)',
            7000: 'DVM Job Feedback',
            9734: 'Zap Request',
            9735: 'Zap Receipt',
            10000: 'Mute List',
            10001: 'Pin List',
            10002: 'Relay List Metadata',
            10003: 'Bookmark List',
            10004: 'Communities List',
            10005: 'Public Chats List',
            10006: 'Blocked Relays List',
            10007: 'Search Relays List',
            10009: 'User Groups List',
            10015: 'Interests List',
            10030: 'User Emoji List',
            10050: 'DM Relays List',
            10096: 'File Storage Servers List',
            13194: 'Wallet Info',
            21000: 'Lightning Pub RPC',
            22242: 'Client Authentication',
            23194: 'Wallet Request',
            23195: 'Wallet Response',
            24133: 'Nostr Connect',
            27235: 'HTTP Auth',
            30000: 'Follow Sets',
            30001: 'Generic Lists',
            30002: 'Relay Sets',
            30003: 'Bookmark Sets',
            30004: 'Curation Sets',
            30008: 'Profile Badges',
            30009: 'Badge Definition',
            30015: 'Interest Sets',
            30017: 'Stall',
            30018: 'Product',
            30023: 'Long-form Content',
            30024: 'Draft Long-form Content',
            30030: 'User Emoji Sets',
            30078: 'App-specific Data',
            30311: 'Live Event',
            30315: 'User Status',
            30402: 'Classified Listing',
            30403: 'Draft Classified Listing',
            31922: 'Date Event',
            31923: 'Time Event',
            31924: 'Calendar',
            31925: 'Calendar RSVP',
            31989: 'Handler Recommendation',
            31990: 'Handler Information',
            34235: 'Video Event',
            34236: 'Short-form Video',
            34237: 'Video View'
        };
        return descriptions[kind] || `Event Kind ${kind}`;
    }

    renderNipList() {
        const container = document.getElementById('nip-test-list');
        container.innerHTML = this.nips.map(nip => this.renderNipCard(nip)).join('');

        // Setup click handlers for NIP cards
        container.querySelectorAll('.nip-card').forEach(card => {
            const nipId = card.dataset.nip;

            // Header click selects the NIP
            card.querySelector('.nip-card-header').addEventListener('click', (e) => {
                // Don't select if clicking the expand button
                if (e.target.closest('.nip-card-expand-btn')) return;
                this.selectNip(nipId);
            });

            // Expand button toggles expanded state
            const expandBtn = card.querySelector('.nip-card-expand-btn');
            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleNipCardExpanded(card, nipId);
                });
            }

            // Related NIP links in the expanded view
            card.querySelectorAll('.nip-card-related-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectNip(link.dataset.nip);
                });
            });
        });
    }

    /**
     * Render an enhanced NIP card with expandable details
     * @param {Object} nip - NIP info object
     * @returns {string} HTML string for the card
     */
    renderNipCard(nip) {
        const isSelected = this.selectedNip === nip.id;
        const isExpanded = this.expandedNipCards && this.expandedNipCards.has(nip.id);

        // Build event kinds badges for expanded view
        let eventKindsHtml = '';
        if (nip.eventKinds && nip.eventKinds.length > 0) {
            const kindBadges = nip.eventKinds.map(kind =>
                `<span class="nip-card-kind-badge" title="${this.getEventKindDescription(kind)}">Kind ${kind}</span>`
            ).join('');
            eventKindsHtml = `
                <div class="nip-card-kinds">
                    <span class="nip-card-section-label">Event Kinds:</span>
                    ${kindBadges}
                </div>
            `;
        }

        // Build related NIPs section for expanded view
        let relatedNIPsHtml = '';
        if (nip.relatedNIPs && nip.relatedNIPs.length > 0) {
            const relatedLinks = nip.relatedNIPs.map(relatedId => {
                const relatedNip = this.nips.find(n => n.id === relatedId);
                if (relatedNip) {
                    return `<button class="nip-card-related-link" data-nip="${relatedId}">${relatedNip.name}</button>`;
                }
                return '';
            }).filter(Boolean).join('');

            if (relatedLinks) {
                relatedNIPsHtml = `
                    <div class="nip-card-related">
                        <span class="nip-card-section-label">Related:</span>
                        ${relatedLinks}
                    </div>
                `;
            }
        }

        // Build example events count indicator
        let examplesIndicator = '';
        if (nip.exampleEvents && nip.exampleEvents.length > 0) {
            examplesIndicator = `<span class="nip-card-examples-count" title="${nip.exampleEvents.length} example event(s)">${nip.exampleEvents.length} example${nip.exampleEvents.length > 1 ? 's' : ''}</span>`;
        }

        // Build expanded content
        const hasExpandableContent = (nip.eventKinds && nip.eventKinds.length > 0) ||
                                     (nip.relatedNIPs && nip.relatedNIPs.length > 0) ||
                                     (nip.exampleEvents && nip.exampleEvents.length > 0);

        let expandedContent = '';
        if (hasExpandableContent) {
            expandedContent = `
                <div class="nip-card-expanded ${isExpanded ? 'visible' : ''}">
                    ${eventKindsHtml}
                    ${relatedNIPsHtml}
                    ${nip.exampleEvents && nip.exampleEvents.length > 0 ? `
                        <div class="nip-card-examples-preview">
                            <span class="nip-card-section-label">Examples:</span>
                            <span class="nip-card-examples-list">${nip.exampleEvents.map(ex => ex.description).join(', ')}</span>
                        </div>
                    ` : ''}
                    <a href="${nip.specUrl}" target="_blank" class="nip-card-spec-link" onclick="event.stopPropagation()">View Spec →</a>
                </div>
            `;
        }

        return `
            <div class="nip-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" data-nip="${nip.id}">
                <div class="nip-card-header">
                    <div class="nip-card-main">
                        <div class="nip-card-title-row">
                            <span class="nip-card-name">${nip.name}</span>
                            <span class="nip-card-title">${nip.title}</span>
                        </div>
                        <div class="nip-card-meta">
                            ${nip.category ? `<span class="category-badge ${nip.category}">${this.getCategoryLabel(nip.category)}</span>` : ''}
                            ${examplesIndicator}
                        </div>
                    </div>
                    ${hasExpandableContent ? `
                        <button class="nip-card-expand-btn ${isExpanded ? 'expanded' : ''}" title="${isExpanded ? 'Collapse' : 'Expand'} details">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                ${expandedContent}
            </div>
        `;
    }

    /**
     * Toggle the expanded state of a NIP card
     * @param {HTMLElement} card - The card element
     * @param {string} nipId - The NIP ID
     */
    toggleNipCardExpanded(card, nipId) {
        // Initialize expanded cards set if needed
        if (!this.expandedNipCards) {
            this.expandedNipCards = new Set();
        }

        const expandedContent = card.querySelector('.nip-card-expanded');
        const expandBtn = card.querySelector('.nip-card-expand-btn');

        if (this.expandedNipCards.has(nipId)) {
            // Collapse
            this.expandedNipCards.delete(nipId);
            card.classList.remove('expanded');
            expandBtn.classList.remove('expanded');
            expandedContent.classList.remove('visible');
        } else {
            // Expand
            this.expandedNipCards.add(nipId);
            card.classList.add('expanded');
            expandBtn.classList.add('expanded');
            expandedContent.classList.add('visible');
        }
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

        // Build event kinds section
        let eventKindsHtml = '';
        if (nip.eventKinds && nip.eventKinds.length > 0) {
            const kindBadges = nip.eventKinds.map(kind =>
                `<span class="event-kind-badge" title="${this.getEventKindDescription(kind)}">Kind ${kind}</span>`
            ).join('');

            eventKindsHtml = `
                <div class="event-kinds">
                    <span class="event-kinds-label">Event Kinds:</span>
                    ${kindBadges}
                </div>
            `;
        }

        // Build related NIPs section
        let relatedNIPsHtml = '';
        if (nip.relatedNIPs && nip.relatedNIPs.length > 0) {
            const relatedLinks = nip.relatedNIPs.map(relatedId => {
                const relatedNip = this.nips.find(n => n.id === relatedId);
                if (relatedNip) {
                    return `<button class="related-nip-link" data-nip="${relatedId}">${relatedNip.name}</button>`;
                }
                return '';
            }).filter(Boolean).join('');

            if (relatedLinks) {
                relatedNIPsHtml = `
                    <div class="related-nips">
                        <span class="related-nips-label">Related:</span>
                        ${relatedLinks}
                    </div>
                `;
            }
        }

        // Build example events section
        let exampleEventsHtml = '';
        if (nip.exampleEvents && nip.exampleEvents.length > 0) {
            const examplesContent = nip.exampleEvents.map((example, index) => `
                <div class="example-event">
                    <div class="example-event-header">
                        <span class="example-event-description">${example.description}</span>
                        <button class="btn small copy-btn" data-example-index="${index}" title="Copy to clipboard">Copy</button>
                    </div>
                    <pre class="example-event-json"><code>${this.escapeHtml(example.json)}</code></pre>
                </div>
            `).join('');

            exampleEventsHtml = `
                <details class="example-events-section">
                    <summary class="example-events-toggle">
                        <span>Example Events (${nip.exampleEvents.length})</span>
                    </summary>
                    <div class="example-events-content">
                        ${examplesContent}
                    </div>
                </details>
            `;
        }

        container.innerHTML = `
            <h3>${nip.name}: ${nip.title}</h3>
            ${nip.category ? `<span class="category-badge ${nip.category}">${this.getCategoryLabel(nip.category)}</span>` : ''}
            <p class="nip-description">${nip.description}</p>
            ${eventKindsHtml}
            ${relatedNIPsHtml}
            ${exampleEventsHtml}
            <a href="${nip.specUrl}" target="_blank" class="spec-link">View Specification</a>
            ${signingModeFields}
            ${formFields}
            <button class="btn primary" id="run-test-btn">Run Test</button>
        `;

        document.getElementById('run-test-btn').addEventListener('click', () => {
            this.runTest(nip.id);
        });

        // Setup related NIP click handlers
        container.querySelectorAll('.related-nip-link').forEach(link => {
            link.addEventListener('click', () => {
                this.selectNip(link.dataset.nip);
            });
        });

        // Setup example event copy buttons
        container.querySelectorAll('.example-event .copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.exampleIndex, 10);
                if (nip.exampleEvents && nip.exampleEvents[index]) {
                    navigator.clipboard.writeText(nip.exampleEvents[index].json).then(() => {
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                    }).catch(() => {
                        this.showToast('error', 'Failed to copy to clipboard');
                    });
                }
            });
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

    showTestResult(response) {
        const container = document.getElementById('test-results');

        // Handle both formats: {result: {...}} from API and direct result from WebSocket
        const result = response.result || response;
        const historyEntry = response.id ? {
            id: response.id,
            timestamp: response.timestamp,
            result: result
        } : null;

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

        // Update history display if this is from API response (has id)
        if (historyEntry) {
            this.addToTestHistory(historyEntry);
        }
    }

    // Test History Methods
    /**
     * Load test history from the server
     */
    async loadTestHistory() {
        try {
            const response = await fetch('/api/test/history');
            if (response.ok) {
                this.testHistory = await response.json();
                this.renderTestHistory();
            }
        } catch (error) {
            console.error('Failed to load test history:', error);
        }
    }

    /**
     * Add an entry to the local test history and update display
     * @param {Object} entry - The test history entry with id, timestamp, result
     */
    addToTestHistory(entry) {
        // Add to beginning of array (newest first)
        this.testHistory = [entry, ...this.testHistory.filter(e => e.id !== entry.id)];
        // Keep only last 100 entries
        if (this.testHistory.length > 100) {
            this.testHistory = this.testHistory.slice(0, 100);
        }
        this.renderTestHistory();
    }

    /**
     * Clear all test history
     */
    async clearTestHistory() {
        try {
            const response = await fetch('/api/test/history', { method: 'DELETE' });
            if (response.ok) {
                this.testHistory = [];
                this.renderTestHistory();
                this.showToast('Test history cleared', 'success');
            }
        } catch (error) {
            console.error('Failed to clear test history:', error);
            this.showToast('Failed to clear history', 'error');
        }
    }

    /**
     * Delete a single history entry
     * @param {string} entryId - The entry ID to delete
     */
    async deleteHistoryEntry(entryId) {
        try {
            const response = await fetch(`/api/test/history/${entryId}`, { method: 'DELETE' });
            if (response.ok) {
                this.testHistory = this.testHistory.filter(e => e.id !== entryId);
                this.renderTestHistory();
            }
        } catch (error) {
            console.error('Failed to delete history entry:', error);
        }
    }

    /**
     * Render the test history list
     */
    renderTestHistory() {
        const container = document.getElementById('test-history-list');
        if (!container) return;

        if (this.testHistory.length === 0) {
            container.innerHTML = '<p class="hint">No test history yet</p>';
            return;
        }

        container.innerHTML = this.testHistory.map(entry => {
            const result = entry.result;
            const nip = this.nips.find(n => n.id === result.nip_id);
            const nipName = nip ? nip.name : result.nip_id.toUpperCase();
            const statusClass = result.success ? 'success' : 'failure';
            const statusIcon = result.success ? '✓' : '✗';
            const timestamp = new Date(entry.timestamp * 1000);
            const timeStr = this.formatHistoryTime(timestamp);

            return `
                <div class="history-entry ${statusClass}" data-entry-id="${entry.id}">
                    <div class="history-entry-header">
                        <span class="history-status-icon">${statusIcon}</span>
                        <span class="history-nip-name">${nipName}</span>
                        <span class="history-time">${timeStr}</span>
                        <button class="history-delete-btn" data-id="${entry.id}" title="Delete">×</button>
                    </div>
                    <div class="history-entry-message">${this.escapeHtml(result.message)}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.history-entry').forEach(entry => {
            // Click on entry to show details
            entry.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-delete-btn')) {
                    const entryId = entry.dataset.entryId;
                    const historyEntry = this.testHistory.find(h => h.id === entryId);
                    if (historyEntry) {
                        this.showTestResult(historyEntry.result);
                    }
                }
            });
        });

        // Add delete button handlers
        container.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteHistoryEntry(btn.dataset.id);
            });
        });
    }

    /**
     * Format timestamp for history display
     * @param {Date} date - The date to format
     * @returns {string} Formatted time string
     */
    formatHistoryTime(date) {
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }

        // Less than 1 hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m ago`;
        }

        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // Same year
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        // Different year
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

        this.setupCommandReference();
    }

    setupCommandReference() {
        const toggle = document.getElementById('command-reference-toggle');
        const content = document.getElementById('command-reference-content');
        const input = document.getElementById('nak-command');

        if (!toggle || !content) return;

        // Toggle expand/collapse
        toggle.addEventListener('click', () => {
            const isExpanded = toggle.classList.contains('expanded');
            toggle.classList.toggle('expanded', !isExpanded);
            toggle.setAttribute('aria-expanded', !isExpanded);
            content.hidden = isExpanded;
        });

        // Click on command items to populate input
        content.addEventListener('click', (e) => {
            const commandItem = e.target.closest('.command-item');
            if (commandItem) {
                const command = commandItem.dataset.command;
                if (command) {
                    input.value = command;
                    input.focus();
                    this.showToast(`Command loaded: nak ${command}`, 'info');
                }
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
        const canvasIds = ['latency-chart', 'health-score-chart'];

        canvasIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) {
                this.setupCanvasSize(canvas);
            }
        });

        // Redraw all charts with new sizes
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
        // Update latency distribution chart
        this.updateLatencyChart(data);

        // Update health score history chart
        this.updateHealthScoreChart(data);
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

    // Thread Viewer (NIP-10)

    /**
     * Check if an event has NIP-10 thread markers (e tags with root/reply)
     * @param {Object} event - The Nostr event
     * @returns {Object} - { hasThread, isRoot, rootId, replyId }
     */
    parseNIP10Tags(event) {
        if (!event.tags) return { hasThread: false, isRoot: true };

        const eTags = event.tags.filter(tag => tag[0] === 'e');
        if (eTags.length === 0) return { hasThread: false, isRoot: true };

        let rootId = null;
        let replyId = null;

        // Look for marked tags (NIP-10 preferred method)
        for (const tag of eTags) {
            if (tag.length >= 4) {
                const marker = tag[3];
                if (marker === 'root') rootId = tag[1];
                if (marker === 'reply') replyId = tag[1];
            }
        }

        // Fall back to positional method if no markers
        if (!rootId && !replyId && eTags.length > 0) {
            rootId = eTags[0][1];
            if (eTags.length > 1) {
                replyId = eTags[eTags.length - 1][1];
            }
        }

        return {
            hasThread: eTags.length > 0,
            isRoot: !rootId && !replyId,
            rootId,
            replyId
        };
    }

    /**
     * Show the thread viewer modal for an event
     * @param {string} eventId - The event ID to show thread for
     */
    async showThreadViewer(eventId) {
        await this.withLoading('thread-viewer', async () => {
            const response = await fetch(`/api/events/thread/${encodeURIComponent(eventId)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load thread');
            }

            const thread = await response.json();

            if (thread.events.length === 0) {
                throw new Error('No events found in thread');
            }

            const modalBody = this.renderThreadView(thread, eventId);

            await this.showModal({
                title: `Thread (${thread.total_size} events)`,
                body: modalBody,
                size: 'lg',
                buttons: [
                    { text: 'Close', type: 'primary', value: null }
                ]
            });

            // Attach event handlers after modal is shown
            this.attachThreadEventHandlers();

        }, {
            showErrorToast: true
        });
    }

    /**
     * Render the thread view HTML
     * @param {Object} thread - Thread data from API
     * @param {string} targetEventId - The event that was clicked to open thread
     * @returns {string} - HTML string
     */
    renderThreadView(thread, targetEventId) {
        if (thread.events.length === 0) {
            return '<p class="hint">No events in thread.</p>';
        }

        // Build parent-child relationships for tree view
        const childrenMap = new Map();
        const eventMap = new Map();

        for (const event of thread.events) {
            eventMap.set(event.id, event);
            if (event.parent_id) {
                if (!childrenMap.has(event.parent_id)) {
                    childrenMap.set(event.parent_id, []);
                }
                childrenMap.get(event.parent_id).push(event);
            }
        }

        // Sort children by timestamp
        for (const [parentId, children] of childrenMap) {
            children.sort((a, b) => a.created_at - b.created_at);
        }

        // Find root events (events without parents in our set)
        const rootEvents = thread.events.filter(e => !e.parent_id || !eventMap.has(e.parent_id));
        rootEvents.sort((a, b) => a.created_at - b.created_at);

        // Render tree recursively
        const renderEventNode = (event, depth = 0) => {
            const isTarget = event.id === targetEventId;
            const children = childrenMap.get(event.id) || [];
            const indent = Math.min(depth, 5); // Cap indent at 5 levels

            const authorShort = event.pubkey.substring(0, 8);
            const contentPreview = event.content.length > 280
                ? event.content.substring(0, 280) + '...'
                : event.content;

            const badges = [];
            if (event.is_root) badges.push('<span class="thread-badge root">Root</span>');
            if (isTarget) badges.push('<span class="thread-badge target">Target</span>');
            if (event.reply_count > 0) badges.push(`<span class="thread-badge replies">${event.reply_count} replies</span>`);

            let html = `
                <div class="thread-event ${isTarget ? 'is-target' : ''}"
                     style="--thread-depth: ${indent};"
                     data-event-id="${event.id}">
                    <div class="thread-event-header">
                        <span class="thread-author" data-pubkey="${event.pubkey}">
                            ${authorShort}...
                        </span>
                        <span class="thread-time">${this.formatTime(event.created_at)}</span>
                        ${badges.join('')}
                    </div>
                    <div class="thread-event-content">${this.escapeHtml(contentPreview)}</div>
                    <div class="thread-event-actions">
                        <button class="btn small" data-thread-json="${event.id}">Raw JSON</button>
                        <button class="btn small" data-thread-profile="${event.pubkey}">View Profile</button>
                    </div>
                </div>
            `;

            // Render children recursively
            if (children.length > 0) {
                html += `<div class="thread-children">`;
                for (const child of children) {
                    html += renderEventNode(child, depth + 1);
                }
                html += `</div>`;
            }

            return html;
        };

        let html = '<div class="thread-container">';

        // Thread info header
        html += `
            <div class="thread-info">
                <span>Max depth: ${thread.max_depth}</span>
                <span>Events: ${thread.total_size}</span>
            </div>
        `;

        // Render from roots
        for (const rootEvent of rootEvents) {
            html += renderEventNode(rootEvent, 0);
        }

        html += '</div>';

        return html;
    }

    /**
     * Attach event handlers for thread viewer elements
     */
    attachThreadEventHandlers() {
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;

        // Raw JSON buttons
        modalBody.querySelectorAll('[data-thread-json]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.threadJson;
                // Find the event in the thread container
                const eventEl = modalBody.querySelector(`[data-event-id="${eventId}"]`);
                if (eventEl) {
                    // Fetch and show the event JSON
                    this.showThreadEventJson(eventId);
                }
            });
        });

        // View Profile buttons
        modalBody.querySelectorAll('[data-thread-profile]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pubkey = btn.dataset.threadProfile;
                this.closeModal();
                this.exploreProfileByPubkey(pubkey);
            });
        });

        // Author links
        modalBody.querySelectorAll('[data-pubkey]').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const pubkey = el.dataset.pubkey;
                this.closeModal();
                this.exploreProfileByPubkey(pubkey);
            });
        });
    }

    /**
     * Show JSON for an event in the thread (fetches from API)
     * @param {string} eventId - Event ID
     */
    async showThreadEventJson(eventId) {
        try {
            const response = await fetch(`/api/events/thread/${encodeURIComponent(eventId)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load event');
            }

            const thread = await response.json();
            const event = thread.events.find(e => e.id === eventId);

            if (event) {
                // Remove thread-specific fields for cleaner display
                const displayEvent = {
                    id: event.id,
                    kind: event.kind,
                    pubkey: event.pubkey,
                    content: event.content,
                    created_at: event.created_at,
                    tags: event.tags
                };

                this.showModal({
                    title: 'Event JSON',
                    body: this.syntaxHighlightJson(displayEvent),
                    size: 'lg',
                    buttons: [
                        { text: 'Copy', type: 'default', value: 'copy' },
                        { text: 'Close', type: 'primary', value: null }
                    ]
                }).then(value => {
                    if (value === 'copy') {
                        navigator.clipboard.writeText(JSON.stringify(displayEvent, null, 2))
                            .then(() => this.toastSuccess('Copied', 'JSON copied to clipboard'))
                            .catch(() => this.toastError('Error', 'Failed to copy to clipboard'));
                    }
                });
            }
        } catch (error) {
            this.toastError('Error', error.message || 'Failed to load event');
        }
    }

    // Keyboard Shortcuts
    setupKeyboardShortcuts() {
        // Tab name mapping for number keys 1-8
        this.tabMapping = {
            '1': 'relays',
            '2': 'explorer',
            '3': 'events',
            '4': 'publish',
            '5': 'testing',
            '6': 'keys',
            '7': 'console',
            '8': 'monitoring'
        };

        // Two-key sequences starting with 'g' (go to)
        this.goToMapping = {
            'r': 'relays',
            'e': 'explorer',
            'v': 'events',
            'p': 'publish',
            't': 'testing',
            'k': 'keys',
            'c': 'console',
            'm': 'monitoring'
        };

        // Primary input selectors for each tab (for '/' focus)
        this.tabInputs = {
            'relays': '#relay-url',
            'explorer': '#profile-search',
            'events': '#filter-kind',
            'publish': '#publish-content',
            'testing': null,
            'keys': '#nip19-input',
            'console': '#nak-command',
            'monitoring': null
        };

        document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));
    }

    handleKeyboardShortcut(e) {
        // Ignore shortcuts when typing in inputs, textareas, or contenteditable
        const target = e.target;
        const isTyping = target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.tagName === 'SELECT' ||
                        target.isContentEditable;

        // Allow Escape to work anywhere (for closing modals)
        if (e.key === 'Escape') {
            // Clear any pending key sequence
            this.clearKeySequence();
            return; // Let existing handlers deal with Escape
        }

        // Don't process shortcuts when typing, except for specific keys
        if (isTyping) {
            return;
        }

        // Don't process if modal is open
        if (this.modalOverlay && !this.modalOverlay.classList.contains('hidden')) {
            return;
        }

        // Handle two-key sequences
        if (this.pendingKeySequence === 'g') {
            this.clearKeySequence();
            const tabName = this.goToMapping[e.key.toLowerCase()];
            if (tabName) {
                e.preventDefault();
                this.switchTab(tabName);
                this.toastInfo('Navigation', `Switched to ${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
            }
            return;
        }

        // Handle modifier keys
        const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

        // '?' or Shift+/ shows help
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
            e.preventDefault();
            this.showKeyboardShortcutsHelp();
            return;
        }

        // Skip if any modifier except shift is pressed for single-key shortcuts
        if (hasModifier) {
            return;
        }

        // Number keys 1-8 for tab navigation
        if (this.tabMapping[e.key]) {
            e.preventDefault();
            const tabName = this.tabMapping[e.key];
            this.switchTab(tabName);
            return;
        }

        // 'g' starts a two-key sequence
        if (e.key === 'g') {
            e.preventDefault();
            this.startKeySequence('g');
            return;
        }

        // '/' focuses the primary input on the current tab
        if (e.key === '/') {
            e.preventDefault();
            this.focusCurrentTabInput();
            return;
        }
    }

    startKeySequence(key) {
        this.pendingKeySequence = key;
        // Clear sequence after 1 second if no second key pressed
        this.keySequenceTimeout = setTimeout(() => {
            this.clearKeySequence();
        }, 1000);
    }

    clearKeySequence() {
        this.pendingKeySequence = null;
        if (this.keySequenceTimeout) {
            clearTimeout(this.keySequenceTimeout);
            this.keySequenceTimeout = null;
        }
    }

    focusCurrentTabInput() {
        // Find the currently active tab
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab) return;

        const tabName = activeTab.dataset.tab;
        const inputSelector = this.tabInputs[tabName];

        if (inputSelector) {
            const input = document.querySelector(inputSelector);
            if (input) {
                input.focus();
                // Select all text if it's a text input
                if (input.select) {
                    input.select();
                }
            }
        }
    }

    showKeyboardShortcutsHelp() {
        const helpContent = `
            <div class="shortcuts-help">
                <div class="shortcuts-section">
                    <h4>Tab Navigation</h4>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>1</kbd><span>Relays</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>2</kbd><span>Explorer</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>3</kbd><span>Events</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>4</kbd><span>Publish</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>5</kbd><span>Testing</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>6</kbd><span>Keys</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>7</kbd><span>Console</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>8</kbd><span>Monitoring</span>
                        </div>
                    </div>
                </div>
                <div class="shortcuts-section">
                    <h4>Go To (press g, then...)</h4>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>r</kbd><span>Relays</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>e</kbd><span>Explorer</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>v</kbd><span>Events</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>p</kbd><span>Publish</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>t</kbd><span>Testing</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>k</kbd><span>Keys</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>c</kbd><span>Console</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>g</kbd> <kbd>m</kbd><span>Monitoring</span>
                        </div>
                    </div>
                </div>
                <div class="shortcuts-section">
                    <h4>General</h4>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>/</kbd><span>Focus search/input</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>?</kbd><span>Show this help</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Esc</kbd><span>Close modal/menu</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal({
            title: 'Keyboard Shortcuts',
            body: helpContent,
            size: 'md',
            buttons: [{ text: 'Close', type: 'primary', value: null }]
        });
    }
}

// Initialize app
const app = new Shirushi();
window.app = app; // Expose for testing
