import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../fonts');

const FONT_BUFFERS = [
  'montserrat-latin-700-normal.woff2',
  'montserrat-latin-800-normal.woff2',
  'poppins-latin-400-normal.woff2',
  'poppins-latin-700-normal.woff2',
].map(f => { try { return readFileSync(path.join(FONTS_DIR, f)); } catch { return null; } }).filter(Boolean);


async function fetchAvatarBase64(username) {
  try {
    const userRes = await fetch(`https://api.github.com/users/${username}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!userRes.ok) return null;
    const userData = await userRes.json();
    if (!userData.avatar_url) return null;

    const avatarUrl = userData.avatar_url.includes('?')
      ? `${userData.avatar_url}&s=128`
      : `${userData.avatar_url}?s=128`;

    const res = await fetch(avatarUrl, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function stripEmoji(str) {
  return str.replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
}

function escXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLine(line, maxChars) {
  if (line.length <= maxChars) return [line];
  const words = line.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) out.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars - 1) + '…' : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function extractLines(rawText, maxLines, charsPerLine) {
  const clean = stripEmoji(stripAnsi(rawText)).trim();
  const paras = clean.split('\n').filter(l => l.trim().length > 0);
  const lines = [];
  for (const para of paras) {
    for (const wrapped of wrapLine(para.trim(), charsPerLine)) {
      lines.push(wrapped);
      if (lines.length >= maxLines) return { lines, truncated: true };
    }
  }
  return { lines, truncated: lines.length < clean.split('\n').filter(l => l.trim()).length };
}

function buildSvg(username, roastLines, truncated, avatarDataUrl) {
  const W = 1200;
  const H = 630;
  const HEADING_FONT = 'Montserrat';
  const BODY_FONT = 'Poppins';

  const displayName = username.length > 22 ? username.slice(0, 21) + '…' : username;

  const avatarEl = avatarDataUrl
    ? `<image href="${avatarDataUrl}" x="60" y="32" width="88" height="88" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="60" y="32" width="88" height="88" fill="#1a1a1a"/>
  <text x="104" y="88" font-family="${HEADING_FONT}" font-size="38" fill="#333" text-anchor="middle">${escXml((username[0] || '?').toUpperCase())}</text>`;

  const LINE_START_Y = 220;
  const LINE_H = 42;

  const roastEls = roastLines.map((line, i) => {
    const isLast = i === roastLines.length - 1;
    const txt = escXml(line) + (isLast && truncated ? '…' : '');
    return `<text x="60" y="${LINE_START_Y + i * LINE_H}" font-family="${BODY_FONT}" font-size="24" fill="#00ff88" xml:space="preserve">${txt}</text>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect width="${W}" height="5" fill="#ff3b30"/>

  ${avatarEl}

  <text x="168" y="68" font-family="${HEADING_FONT}" font-size="12" fill="#ff3b30" letter-spacing="2.5" font-weight="800">UR COOKED,</text>
  <text x="168" y="122" font-family="${HEADING_FONT}" font-size="48" fill="#e8e8e8" font-weight="800">${escXml(displayName)}</text>

  <rect x="60" y="156" width="1080" height="1" fill="#222222"/>

  ${roastEls}

  <rect x="60" y="568" width="1080" height="1" fill="#1a1a1a"/>
  <text x="60" y="600" font-family="${BODY_FONT}" font-size="13" fill="#383838">$ urcooked.lol</text>
  <text x="1140" y="600" font-family="${BODY_FONT}" font-size="13" fill="#242424" text-anchor="end">get roasted → urcooked.lol</text>
</svg>`;
}

const cache = new Map();

export async function generateOgImage(id, username, roastText) {
  if (cache.has(id)) return cache.get(id);

  const avatarDataUrl = await fetchAvatarBase64(username);
  const { lines, truncated } = extractLines(roastText, 6, 75);
  const svg = buildSvg(username, lines, truncated, avatarDataUrl);

  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: FONT_BUFFERS,
      loadSystemFonts: false,
      defaultFontFamily: 'Poppins',
    },
  });

  const png = resvg.render().asPng();

  if (cache.size >= 500) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(id, png);

  return png;
}
