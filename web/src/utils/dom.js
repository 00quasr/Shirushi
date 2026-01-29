/**
 * DOM utilities module
 * Provides DOM helpers and event delegation for efficient event handling
 */

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {Array} children - Child elements or text
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        el.dataset[dataKey] = dataValue;
      });
    } else {
      el.setAttribute(key, value);
    }
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

/**
 * Event delegation helper
 * @param {Element} container - Container element to attach listener to
 * @param {string} event - Event type
 * @param {string} selector - CSS selector for target elements
 * @param {Function} handler - Event handler function
 * @returns {Function} - Cleanup function to remove the listener
 */
export function delegate(container, event, selector, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) {
      handler.call(target, e, target);
    }
  };
  container.addEventListener(event, listener);
  return () => container.removeEventListener(event, listener);
}

/**
 * Add multiple event listeners at once
 * @param {Element} element - Target element
 * @param {Object} events - Object mapping event names to handlers
 * @returns {Function} - Cleanup function to remove all listeners
 */
export function addEventListeners(element, events) {
  Object.entries(events).forEach(([event, handler]) => {
    element.addEventListener(event, handler);
  });
  return () => {
    Object.entries(events).forEach(([event, handler]) => {
      element.removeEventListener(event, handler);
    });
  };
}

export default { $, $$, createElement, delegate, addEventListeners };
