import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb } from './services/db.js';
import { roastRouter } from './routes/roast.js';
import { shareRouter } from './routes/share.js';
import { battleRouter } from './routes/battle.js';
import { battleShareRouter } from './routes/battleShare.js';
import { ogRouter } from './routes/og.js';
import { renderTemplate } from './utils/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Railway/Coolify sit behind a proxy, so trust X-Forwarded-For for rate limiting
// and real client IPs. Don't trust everything blindly though.
app.set('trust proxy', 1);

// Init SQLite before serving requests
initDb();

// Static assets (browser only, curl users never load CSS)
app.use('/public', express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1d',
  fallthrough: true,
}));

// Health check for Railway. Plain text so it shows up in any browser/curl.
app.get('/health', (req, res) => {
  res.type('text/plain').send('ok');
});

// Favicon - just 204 it. We're a terminal tool, no time for icons.
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

// Landing page
app.get('/', (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const isCurl = userAgent.includes('curl');

  console.log('[root]', isCurl ? 'curl' : 'browser', 'user-agent:', userAgent.slice(0, 60));

  if (isCurl) {
    res.type('text/plain').send(`urcooked.lol - GitHub profile roasting via curl

usage:
  curl urcooked.lol/<username>
  curl urcooked.lol/vs/<user1>/<user2>

examples:
  curl urcooked.lol/torvalds
  curl urcooked.lol/vs/octocat/gvanrossum

share your roast:
  curl urcooked.lol/r/<roast-id>
`);
    return;
  }

  const html = renderTemplate('index.html', {
    base_url: process.env.BASE_URL || `http://localhost:${PORT}`,
  });
  res.type('text/html').send(html);
});

// OG image route BEFORE catchall
app.use('/og', ogRouter);

// Share routes BEFORE the catchall /:username, so /r/:id wins
app.use('/r', shareRouter);

// Battle routes before catchall
app.use('/vs', battleRouter);
app.use('/b', battleShareRouter);

// The main event. Catchall on a single path segment.
// Mounted last so it doesn't shadow /r, /health, /public etc.
app.use('/', roastRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).type('text/plain').send('not found. ur not even cooked, just lost.\n');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) {
    // Streaming response already started, just end it
    try { res.end('\n\nsomething broke mid-roast. embarrassing for both of us.\n'); } catch {}
    return;
  }
  res.status(500).type('text/plain').send('something broke. try again in a bit.\n');
});

const server = app.listen(PORT, () => {
  console.log(`[urcooked] listening on :${PORT}`);
});

// Graceful shutdown for Railway redeploys
const shutdown = (signal) => {
  console.log(`[urcooked] ${signal} received, closing server...`);
  server.close(() => {
    console.log('[urcooked] server closed, exiting');
    process.exit(0);
  });
  // Force-exit after 10s if connections won't close
  setTimeout(() => {
    console.warn('[urcooked] force exit after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
