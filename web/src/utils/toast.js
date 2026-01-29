/**
 * Toast notification module
 * Provides toast notifications for success, error, and info messages
 */

const TOAST_DURATION = 3000;
const TOAST_CONTAINER_ID = 'toast-container';

/**
 * Get or create toast container
 * @returns {Element}
 */
function getContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds
 */
export function show(message, type = 'info', duration = TOAST_DURATION) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration);
}

/**
 * Show success toast
 * @param {string} message - Toast message
 */
export function success(message) {
  show(message, 'success');
}

/**
 * Show error toast
 * @param {string} message - Toast message
 */
export function error(message) {
  show(message, 'error');
}

/**
 * Show info toast
 * @param {string} message - Toast message
 */
export function info(message) {
  show(message, 'info');
}

/**
 * Show warning toast
 * @param {string} message - Toast message
 */
export function warning(message) {
  show(message, 'warning');
}

export default { show, success, error, info, warning };
