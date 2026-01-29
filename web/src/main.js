/**
 * Shirushi - Nostr Protocol Explorer
 * Main entry point for the modular JavaScript application
 */

// Import utilities
import { $, $$, delegate } from './utils/dom.js';
import * as api from './utils/api.js';
import * as toast from './utils/toast.js';
import * as modal from './utils/modal.js';
import * as format from './utils/format.js';

// Import modules
import { WebSocketManager } from './modules/websocket.js';
import { TabManager } from './modules/tabs.js';
import { RelayManager } from './modules/relays.js';
import { ProfileExplorer } from './modules/explorer.js';
import { EventStream } from './modules/events.js';
import { EventPublisher } from './modules/publish.js';
import { NIPTester } from './modules/testing.js';
import { KeyManager } from './modules/keys.js';
import { NakConsole } from './modules/console.js';
import { MonitoringDashboard } from './modules/monitoring.js';

// Import styles
import './styles/main.css';

/**
 * Main Shirushi application class
 * Coordinates all modules and handles initialization
 */
export class Shirushi {
  constructor() {
    // Initialize module instances
    this.ws = new WebSocketManager();
    this.tabs = new TabManager();
    this.relays = new RelayManager();
    this.explorer = new ProfileExplorer();
    this.events = new EventStream();
    this.publisher = new EventPublisher();
    this.tester = new NIPTester();
    this.keys = new KeyManager();
    this.console = new NakConsole();
    this.monitoring = new MonitoringDashboard();

    // Track initialization state
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) {
      console.warn('Shirushi already initialized');
      return;
    }

    try {
      // Setup WebSocket connection
      await this.setupWebSocket();

      // Initialize UI modules
      this.tabs.setupKeyboardShortcuts();

      // Setup global event delegation
      this.setupEventDelegation();

      // Check for NIP-07 extension
      this.checkExtension();

      // Load initial data
      await this.loadInitialData();

      this.initialized = true;
      console.log('Shirushi initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Shirushi:', error);
      toast.error('Failed to initialize application');
    }
  }

  /**
   * Setup WebSocket connection and message handlers
   */
  async setupWebSocket() {
    this.ws.on('open', () => {
      this.updateConnectionStatus(true);
    });

    this.ws.on('close', () => {
      this.updateConnectionStatus(false);
    });

    this.ws.on('message', (data) => {
      this.handleWebSocketMessage(data);
    });

    this.ws.connect();
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} data - Parsed message data
   */
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'init':
        this.handleInit(data);
        break;
      case 'event':
        this.events.addEvent(data.event);
        break;
      case 'relay_status':
        this.relays.updateStatus(data);
        break;
      case 'test_result':
        this.tester.handleResult(data);
        break;
      case 'monitoring_update':
        this.monitoring.updateCharts(data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Handle initial state from server
   * @param {Object} data - Initial state data
   */
  handleInit(data) {
    if (data.nips) {
      this.tester.loadNIPs(data.nips);
    }
    if (data.relays) {
      this.relays.setRelays(data.relays);
    }
  }

  /**
   * Setup global event delegation for common actions
   */
  setupEventDelegation() {
    // Copy button delegation
    delegate(document.body, 'click', '[data-copy]', (e, target) => {
      const sourceId = target.dataset.copy;
      const sourceEl = document.getElementById(sourceId);
      if (sourceEl) {
        const text = sourceEl.value || sourceEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
          toast.success('Copied to clipboard');
        }).catch(() => {
          toast.error('Failed to copy');
        });
      }
    });

    // Tab switching delegation
    delegate(document.body, 'click', '.tab[data-tab]', (e, target) => {
      const tabId = target.dataset.tab;
      this.tabs.switchTo(tabId);
    });

    // Modal close on overlay click
    delegate(document.body, 'click', '.modal-overlay', () => {
      modal.close();
    });
  }

  /**
   * Check for NIP-07 browser extension
   */
  checkExtension() {
    const statusDot = $('#extension-status-dot');
    const statusText = $('#extension-status-text');

    if (window.nostr) {
      statusDot?.classList.add('detected');
      statusDot?.classList.remove('not-detected');
      if (statusText) statusText.textContent = 'Extension Connected';
    } else {
      statusDot?.classList.add('not-detected');
      statusDot?.classList.remove('detected');
      if (statusText) statusText.textContent = 'No Extension';
    }
  }

  /**
   * Update connection status indicator
   * @param {boolean} connected - Connection state
   */
  updateConnectionStatus(connected) {
    const statusDot = $('#connection-status');
    const statusText = $('#connection-text');

    if (connected) {
      statusDot?.classList.add('connected');
      statusDot?.classList.remove('disconnected');
      if (statusText) statusText.textContent = 'Connected';
    } else {
      statusDot?.classList.add('disconnected');
      statusDot?.classList.remove('connected');
      if (statusText) statusText.textContent = 'Disconnected';
    }
  }

  /**
   * Load initial data from API
   */
  async loadInitialData() {
    try {
      await this.relays.loadRelays();
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  /**
   * Cleanup and destroy the application
   */
  destroy() {
    this.ws.disconnect();
    this.initialized = false;
  }
}

// Export utilities for use in other modules
export { api, toast, modal, format };

// Create and export global app instance
let app = null;

/**
 * Get or create the Shirushi application instance
 * @returns {Shirushi}
 */
export function getApp() {
  if (!app) {
    app = new Shirushi();
  }
  return app;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      getApp().init();
    });
  } else {
    getApp().init();
  }
}

export default Shirushi;
