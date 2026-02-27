/**
 * Escape a string for safe insertion into HTML.
 *
 * Uses the browser's built-in text encoding to guarantee that all HTML
 * special characters (&, <, >, ", ') are properly escaped.
 */
const escapeEl = document.createElement('span');

export function escapeHtml(text: string): string {
  escapeEl.textContent = text;
  return escapeEl.innerHTML;
}
