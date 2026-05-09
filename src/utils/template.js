import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, '..', 'views');

// Minimal HTML escape so injected values can't break out
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ESC[c]);
}

// Cache templates in production. Don't cache in dev so we can iterate.
const cache = new Map();
const CACHE_ENABLED = process.env.NODE_ENV === 'production';

function loadTemplate(filename) {
  if (CACHE_ENABLED && cache.has(filename)) return cache.get(filename);
  const full = path.join(VIEWS_DIR, filename);
  const content = fs.readFileSync(full, 'utf8');
  if (CACHE_ENABLED) cache.set(filename, content);
  return content;
}

/**
 * Render a template by replacing {{key}} with escaped values, and {{{key}}}
 * with raw values (use raw only for trusted content - newlines, etc).
 */
export function renderTemplate(filename, data = {}) {
  const tpl = loadTemplate(filename);
  return tpl
    .replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, key) => (data[key] != null ? String(data[key]) : ''))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => escapeHtml(data[key]));
}
