/**
 * Decide whether to send terminal-style ANSI text or HTML.
 * Curl is the obvious one. Wget, httpie, and powershell's Invoke-WebRequest
 * also behave like curl from a user perspective so we treat them the same.
 */
const TERMINAL_AGENTS = ['curl', 'wget', 'httpie', 'http/', 'powershell', 'fetch/'];

export function isTerminalClient(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (!ua) return false;
  return TERMINAL_AGENTS.some((needle) => ua.includes(needle));
}
