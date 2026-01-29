/**
 * API utilities module
 * Provides fetch wrappers with error handling for backend communication
 */

/**
 * Base API URL (relative to current host)
 */
const API_BASE = '/api';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make API request with error handling
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {Object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new APIError(
      data.error || data.message || `HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}

/**
 * GET request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<any>}
 */
export async function get(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;
  return request(url, { method: 'GET' });
}

/**
 * POST request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<any>}
 */
export async function post(endpoint, body = {}) {
  return request(endpoint, { method: 'POST', body });
}

/**
 * DELETE request helper
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>}
 */
export async function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

export default { request, get, post, del, APIError };
