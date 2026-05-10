import express from 'express';
import helmet from 'helmet';

import { getRoast } from '../services/db.js';
import { renderTemplate } from '../utils/template.js';
import { isTerminalClient } from '../utils/detectCurl.js';
import { header, scoredFooter } from '../utils/ansi.js';
import { fetchGithubProfile } from '../services/github.js';

export const shareRouter = express.Router();

// Helmet on share routes only - we don't want CSP interfering with curl streaming.
// allowInline scripts/styles since the templates are simple and self-contained.
const helmetMw = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://avatars.githubusercontent.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Apply helmet only when serving HTML, not when serving ANSI to curl.
shareRouter.use((req, res, next) => {
  if (isTerminalClient(req)) return next();
  return helmetMw(req, res, next);
});

shareRouter.get('/:id', async (req, res, next) => {
  const id = req.params.id;
  if (!/^[a-z0-9]{5}$/i.test(id)) {
    return res.status(404).type('text/plain').send('not a real roast id\n');
  }

  let row;
  try {
    row = await getRoast(id);
  } catch (err) {
    return next(err);
  }
  if (!row) {
    return res.status(404).type('text/plain').send('roast not found. maybe it never existed.\n');
  }

  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const shareUrl = `${baseUrl}/r/${row.id}`;
  const ogImageUrl = `${baseUrl}/og/${row.id}.png`;

  // Curl: replay the ANSI roast for the same URL
  if (isTerminalClient(req)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.write(header(row.username));
    res.write(row.roast_text);
    res.write(scoredFooter(shareUrl, row.cooked_score));
    return res.end();
  }

  // Browser: pretty share page
  const tweetText = `my github just got cooked 💀\n\n"${row.preview_line}"\n\nget yours →`;
  const tweetIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;

  let avatarUrl = null;
  try {
    const profile = await fetchGithubProfile(row.username);
    avatarUrl = profile.avatar_url;
  } catch {
    // Fallback if API fetch fails
    avatarUrl = `https://github.com/${row.username}.png`;
  }

  const html = renderTemplate('share.html', {
    username: row.username,
    roast_text: row.roast_text,
    preview_line: row.preview_line,
    tweet_intent: tweetIntent,
    share_url: shareUrl,
    og_image_url: ogImageUrl,
    avatar_url: avatarUrl,
    github_url: `https://github.com/${row.username}`,
    cooked_score: row.cooked_score != null ? String(row.cooked_score) : '?',
  });
  res.type('text/html').send(html);
});
