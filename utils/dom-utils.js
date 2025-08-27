/**
 * DOM utilities for deep querying including Shadow DOM support
 */

/**
 * Collect all DOM roots including Shadow DOM roots
 * @param {Document|Element} start - Starting element/document
 * @returns {Array} - Array of all roots to search
 */
export function collectRoots(start) {
  const roots = [];
  const queue = [start];
  const seen = new Set();
  
  while (queue.length) {
    const root = queue.shift();
    if (!root || seen.has(root)) continue;
    seen.add(root);
    roots.push(root);
    
    // Enumerate elements inside this root
    const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of els) {
      if (el.shadowRoot) queue.push(el.shadowRoot);
    }
  }
  
  return roots;
}

/**
 * Query selector all with deep Shadow DOM support
 * @param {string} selector - CSS selector
 * @param {Document|Element} scope - Scope to search in
 * @returns {Array} - Array of matching elements
 */
export function qsaDeep(selector, scope = document) {
  const roots = collectRoots(scope);
  const out = [];
  const seen = new Set();
  
  for (const r of roots) {
    if (!r.querySelectorAll) continue;
    for (const el of r.querySelectorAll(selector)) {
      if (!seen.has(el)) {
        seen.add(el);
        out.push(el);
      }
    }
  }
  
  return out;
}

/**
 * Query selector with deep Shadow DOM support
 * @param {string} selector - CSS selector
 * @param {Document|Element} scope - Scope to search in
 * @returns {Element|null} - First matching element or null
 */
export function qsDeep(selector, scope = document) {
  return qsaDeep(selector, scope)[0] || null;
}

/**
 * Click element and wait
 * @param {Element} element - Element to click
 * @param {number} waitMs - Milliseconds to wait after click
 */
export async function clickAndWait(element, waitMs = 400) {
  element.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window
  }));
  await new Promise(resolve => setTimeout(resolve, waitMs));
}
