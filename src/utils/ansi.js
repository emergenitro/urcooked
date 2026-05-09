// ANSI escape sequences. Keeping this dependency-free.
const ESC = '\x1b[';

export const ansi = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  brightRed: `${ESC}91m`,
  brightCyan: `${ESC}96m`,
};

export const wrap = {
  bold: (s) => `${ansi.bold}${s}${ansi.reset}`,
  red: (s) => `${ansi.red}${s}${ansi.reset}`,
  cyan: (s) => `${ansi.cyan}${s}${ansi.reset}`,
  boldRed: (s) => `${ansi.bold}${ansi.brightRed}${s}${ansi.reset}`,
  boldCyan: (s) => `${ansi.bold}${ansi.brightCyan}${s}${ansi.reset}`,
  dim: (s) => `${ansi.dim}${s}${ansi.reset}`,
};

const RULE = '━'.repeat(48);

export function header(username) {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('ur cooked,')} ${wrap.bold(username)}`,
    wrap.bold(RULE),
    '',
    '',
  ].join('\n');
}

export function footer(shareUrl) {
  return [
    '',
    '',
    wrap.bold(RULE),
    `  ${wrap.dim('share your roast →')} ${wrap.boldCyan(shareUrl)}`,
    wrap.bold(RULE),
    '',
  ].join('\n');
}

export function notFound(username) {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('404')} no github user called ${wrap.bold(username)}`,
    wrap.bold(RULE),
    '',
    "can't roast someone who doesn't exist. check the spelling.",
    '',
  ].join('\n');
}

export function rateLimited() {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('slow down bro.')} ur already cooked.`,
    wrap.bold(RULE),
    '',
  ].join('\n');
}

export function badUsername() {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('that\'s not a real github username')}`,
    wrap.bold(RULE),
    '',
    'github usernames: alphanumeric and hyphens, max 39 chars.',
    '',
  ].join('\n');
}

function scoreBar(score) {
  const filled = Math.floor(score / 10);
  return '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
}

export function scoredFooter(shareUrl, score) {
  const bar = score != null ? ` ${wrap.dim(scoreBar(score))} ${wrap.bold(String(score) + '/100')}` : '';
  return [
    '',
    '',
    wrap.bold(RULE),
    `  ${wrap.dim('verdict:')}${bar}`,
    `  ${wrap.dim('share your roast →')} ${wrap.boldCyan(shareUrl)}`,
    wrap.bold(RULE),
    '',
  ].join('\n');
}

export function battleHeader(user1, user2) {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('⚔  BATTLE:')} ${wrap.bold(user1)} ${wrap.dim('vs')} ${wrap.bold(user2)}`,
    wrap.bold(RULE),
    '',
    '',
  ].join('\n');
}

export function verdictFooter(winner, loser, shareUrl) {
  return [
    '',
    '',
    wrap.bold(RULE),
    `  ${wrap.boldRed('VERDICT:')} ${wrap.bold(winner)} ${wrap.dim('survives.')} ${wrap.bold(loser)} ${wrap.dim('is cooked.')}`,
    `  ${wrap.dim('share →')} ${wrap.boldCyan(shareUrl)}`,
    wrap.bold(RULE),
    '',
  ].join('\n');
}

export function battleNotFound(username) {
  return [
    wrap.bold(RULE),
    `  ${wrap.boldRed('404')} no github user called ${wrap.bold(username)}`,
    wrap.bold(RULE),
    '',
  ].join('\n');
}
