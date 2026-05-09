// GitHub username rules: alphanumeric or hyphens, can't start or end with hyphen,
// no consecutive hyphens, max 39 chars.
const USERNAME_RE = /^(?!-)(?!.*--)[a-zA-Z0-9-]{1,39}(?<!-)$/;

// Reserved paths we should never treat as usernames
const RESERVED = new Set([
  'r', 'health', 'favicon.ico', 'robots.txt', 'public',
  'api', 'static', 'assets', 'admin', 'login', 'logout',
  'signup', 'about', 'terms', 'privacy', 'contact',
]);

export function isValidUsername(username) {
  if (!username) return false;
  if (RESERVED.has(username.toLowerCase())) return false;
  return USERNAME_RE.test(username);
}
