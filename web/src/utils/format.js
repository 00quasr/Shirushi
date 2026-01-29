/**
 * Formatting utilities module
 * Provides text truncation, time formatting, and kind descriptions
 */

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length (default: 20)
 * @returns {string}
 */
export function truncate(str, length = 20) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Format timestamp as full date/time
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string}
 */
export function formatDateTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Format satoshis as readable amount
 * @param {number} sats - Amount in satoshis
 * @returns {string}
 */
export function formatSats(sats) {
  if (sats >= 1000000) return `${(sats / 1000000).toFixed(1)}M sats`;
  if (sats >= 1000) return `${(sats / 1000).toFixed(1)}k sats`;
  return `${sats} sats`;
}

/**
 * Nostr event kind descriptions
 */
export const kindDescriptions = {
  0: 'Metadata',
  1: 'Short Text Note',
  2: 'Recommend Relay',
  3: 'Contacts',
  4: 'Encrypted Direct Messages',
  5: 'Event Deletion',
  6: 'Repost',
  7: 'Reaction',
  8: 'Badge Award',
  9: 'Group Chat Message',
  10: 'Group Chat Threaded Reply',
  16: 'Generic Repost',
  40: 'Channel Creation',
  41: 'Channel Metadata',
  42: 'Channel Message',
  43: 'Channel Hide Message',
  44: 'Channel Mute User',
  1063: 'File Metadata',
  1311: 'Live Chat Message',
  1984: 'Reporting',
  1985: 'Label',
  4550: 'Community Post Approval',
  9734: 'Zap Request',
  9735: 'Zap Receipt',
  10000: 'Mute List',
  10001: 'Pin List',
  10002: 'Relay List Metadata',
  13194: 'Wallet Info',
  22242: 'Client Authentication',
  23194: 'Wallet Request',
  23195: 'Wallet Response',
  24133: 'Nostr Connect',
  27235: 'HTTP Auth',
  30000: 'Categorized People List',
  30001: 'Categorized Bookmark List',
  30008: 'Profile Badges',
  30009: 'Badge Definition',
  30017: 'Stall Creation',
  30018: 'Product Creation',
  30023: 'Long-form Content',
  30024: 'Draft Long-form Content',
  30078: 'Application-specific Data',
  31989: 'Handler Recommendation',
  31990: 'Handler Information',
};

/**
 * Get description for event kind
 * @param {number} kind - Event kind
 * @returns {string}
 */
export function getKindDescription(kind) {
  return kindDescriptions[kind] || `Kind ${kind}`;
}

export default { truncate, formatRelativeTime, formatDateTime, formatSats, kindDescriptions, getKindDescription };
