/**
 * Modal management module
 * Provides modal creation, display, and cleanup
 */

const MODAL_CONTAINER_ID = 'modal-container';
let activeModal = null;

/**
 * Get or create modal container
 * @returns {Element}
 */
function getContainer() {
  let container = document.getElementById(MODAL_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = MODAL_CONTAINER_ID;
    container.className = 'modal-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a modal with content
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string|Element} options.content - Modal content (HTML string or Element)
 * @param {Array} options.actions - Action buttons [{label, onClick, primary}]
 * @param {Function} options.onClose - Callback when modal is closed
 */
export function show({ title, content, actions = [], onClose } = {}) {
  // Close any existing modal
  close();

  const container = getContainer();

  const modal = document.createElement('div');
  modal.className = 'modal';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', close);

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';

  // Header
  if (title) {
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h3>${title}</h3>
      <button class="modal-close">&times;</button>
    `;
    header.querySelector('.modal-close').addEventListener('click', close);
    dialog.appendChild(header);
  }

  // Content
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content) {
    body.appendChild(content);
  }
  dialog.appendChild(body);

  // Actions
  if (actions.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    actions.forEach(({ label, onClick, primary }) => {
      const btn = document.createElement('button');
      btn.className = primary ? 'btn btn-primary' : 'btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (onClick) onClick();
        close();
      });
      footer.appendChild(btn);
    });
    dialog.appendChild(footer);
  }

  modal.appendChild(overlay);
  modal.appendChild(dialog);
  container.appendChild(modal);

  // Store reference and callback
  activeModal = { element: modal, onClose };

  // Setup escape key handler
  document.addEventListener('keydown', handleEscape);

  // Trigger animation
  requestAnimationFrame(() => {
    modal.classList.add('modal-visible');
  });
}

/**
 * Close the active modal
 */
export function close() {
  if (!activeModal) return;

  const { element, onClose } = activeModal;

  element.classList.remove('modal-visible');
  element.addEventListener('transitionend', () => {
    element.remove();
  });

  document.removeEventListener('keydown', handleEscape);

  if (onClose) onClose();
  activeModal = null;
}

/**
 * Handle escape key to close modal
 * @param {KeyboardEvent} e
 */
function handleEscape(e) {
  if (e.key === 'Escape') {
    close();
  }
}

/**
 * Check if a modal is currently open
 * @returns {boolean}
 */
export function isOpen() {
  return activeModal !== null;
}

export default { show, close, isOpen };
