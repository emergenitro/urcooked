import express from 'express';
import rateLimit from 'express-rate-limit';

import { isTerminalClient } from '../utils/detectCurl.js';
import { isValidUsername } from '../utils/validate.js';
import { shortId } from '../utils/shortId.js';
import { renderTemplate } from '../utils/template.js';
import { header, scoredFooter, notFound, rateLimited, badUsername, ansi } from '../utils/ansi.js';
import { streamText } from '../utils/stream.js';
import { fetchGithubProfile, computeCookedScore } from '../services/github.js';
import { streamRoast, generateRoast, extractPreviewLine } from '../services/openai.js';
import { saveRoast, findRecentByUsername } from '../services/db.js';

export const roastRouter = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    if (isTerminalClient(req)) {
      res.status(429).type('text/plain').send(rateLimited());
    } else {
      res.status(429).type('text/plain').send('slow down bro. ur already cooked.\n');
    }
  },
});

const CACHE_TTL_MS = 60 * 60 * 1000;

function buildShareUrl(id) {
  const base = process.env.BASE_URL;
  if (base) return `${base.replace(/\/+$/, '')}/r/${id}`;
  return `urcooked.lol/r/${id}`;
}

roastRouter.get('/:username', limiter, async (req, res, next) => {
  const username = req.params.username;
  const isCurl = isTerminalClient(req);

  if (!isValidUsername(username)) {
    if (isCurl) {
      return res.status(400).type('text/plain').send(badUsername());
    }
    return res.status(400).type('text/plain').send('invalid github username\n');
  }

  const cached = await findRecentByUsername(username, CACHE_TTL_MS);
  if (cached) {
    return serveCached(req, res, cached);
  }

  let githubData;
  try {
    githubData = await fetchGithubProfile(username);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      if (isCurl) {
        return res.status(404).type('text/plain').send(notFound(username));
      }
      const html = renderTemplate('not-found.html', { username });
      return res.status(404).type('text/html').send(html);
    }
    if (err.code === 'RATE_LIMITED') {
      const msg = 'github is rate limiting us. try again in a few minutes.\n';
      return res.status(503).type('text/plain').send(msg);
    }
    return next(err);
  }

  if (isCurl) {
    return handleCurlStream(req, res, username, githubData, next);
  }
  return handleBrowser(req, res, username, githubData, next);
});

async function handleCurlStream(req, res, username, githubData, next) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.flushHeaders();

  res.write(header(username));

  const id = shortId();
  const cookedScore = computeCookedScore(githubData);
  let fullRoast = '';

  try {
    fullRoast = await streamRoast(githubData, (delta) => {
      res.write(delta);
    });
  } catch (err) {
    res.write(`\n\n${ansi.red}roast generation failed mid-flight. embarrassing.${ansi.reset}\n`);
    res.end();
    console.error('[roast/stream]', err);
    return;
  }

  const previewLine = extractPreviewLine(fullRoast);
  try {
    await saveRoast({ id, username, roastText: fullRoast, previewLine, cookedScore });
  } catch (err) {
    console.error('[roast/save]', err);
    res.write(scoredFooter('share link unavailable', cookedScore));
    return res.end();
  }

  res.write(scoredFooter(buildShareUrl(id), cookedScore));
  res.end();
}

async function handleBrowser(req, res, username, githubData, next) {
  let fullRoast;
  try {
    fullRoast = await generateRoast(githubData);
  } catch (err) {
    return next(err);
  }

  const id = shortId();
  const previewLine = extractPreviewLine(fullRoast);
  const cookedScore = computeCookedScore(githubData);

  try {
    await saveRoast({ id, username, roastText: fullRoast, previewLine, cookedScore });
  } catch (err) {
    console.error('[roast/save browser]', err);
  }

  res.redirect(302, `/r/${id}`);
}

async function serveCached(req, res, cached) {
  if (isTerminalClient(req)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    res.write(header(cached.username));
    await streamText(res, cached.roast_text);
    res.write(scoredFooter(buildShareUrl(cached.id), cached.cooked_score));
    return res.end();
  }
  return res.redirect(302, `/r/${cached.id}`);
}
