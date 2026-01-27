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

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupTabs();
        this.setupRelays();
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
