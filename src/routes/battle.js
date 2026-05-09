import express from 'express';
import rateLimit from 'express-rate-limit';

import { isTerminalClient } from '../utils/detectCurl.js';
import { isValidUsername } from '../utils/validate.js';
import { shortId } from '../utils/shortId.js';
import { renderTemplate } from '../utils/template.js';
import { battleHeader, verdictFooter, battleNotFound, rateLimited, ansi } from '../utils/ansi.js';
import { streamText } from '../utils/stream.js';
import { fetchGithubProfile } from '../services/github.js';
import { streamBattleRoast, generateBattleRoast, extractPreviewLine, extractBattleWinner } from '../services/openai.js';
import { saveBattle, findRecentBattle } from '../services/db.js';

export const battleRouter = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    if (isTerminalClient(req)) {
      res.status(429).type('text/plain').send(rateLimited());
    } else {
      res.status(429).type('text/plain').send('slow down bro.\n');
    }
  },
});

const BATTLE_CACHE_TTL_MS = 30 * 60 * 1000;

function buildBattleShareUrl(id) {
  const base = process.env.BASE_URL;
  if (base) return `${base.replace(/\/+$/, '')}/b/${id}`;
  return `urcooked.lol/b/${id}`;
}

battleRouter.get('/:user1/:user2', limiter, async (req, res, next) => {
  const { user1, user2 } = req.params;
  const isCurl = isTerminalClient(req);

  if (!isValidUsername(user1)) {
    return res.status(400).type('text/plain').send(`invalid username: ${user1}\n`);
  }
  if (!isValidUsername(user2)) {
    return res.status(400).type('text/plain').send(`invalid username: ${user2}\n`);
  }
  if (user1.toLowerCase() === user2.toLowerCase()) {
    return res.status(400).type('text/plain').send("can't battle yourself. that's just a mirror.\n");
  }

  const cached = await findRecentBattle(user1, user2, BATTLE_CACHE_TTL_MS);
  if (cached) {
    return serveCachedBattle(req, res, cached);
  }

  let data1, data2;
  try {
    [data1, data2] = await Promise.all([
      fetchGithubProfile(user1),
      fetchGithubProfile(user2),
    ]);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      if (isCurl) return res.status(404).type('text/plain').send(battleNotFound(user1));
      return res.status(404).type('text/plain').send('one of those users does not exist.\n');
    }
    if (err.code === 'RATE_LIMITED') {
      return res.status(503).type('text/plain').send('github is rate limiting us. try again in a few minutes.\n');
    }
    return next(err);
  }

  if (isCurl) {
    return handleBattleCurlStream(req, res, user1, user2, data1, data2, next);
  }
  return handleBattleBrowser(req, res, user1, user2, data1, data2, next);
});

async function handleBattleCurlStream(req, res, user1, user2, data1, data2, next) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.flushHeaders();

  res.write(battleHeader(user1, user2));

  const id = shortId();
  let fullRoast = '';

  try {
    fullRoast = await streamBattleRoast(data1, data2, (delta) => {
      res.write(delta);
    });
  } catch (err) {
    res.write(`\n\n${ansi.red}battle exploded mid-fight. embarrassing.${ansi.reset}\n`);
    res.end();
    console.error('[battle/stream]', err);
    return;
  }

  const winner = extractBattleWinner(fullRoast);
  const loser = winner
    ? (winner.toLowerCase() === user1.toLowerCase() ? user2 : user1)
    : null;
  const previewLine = extractPreviewLine(fullRoast);

  try {
    await saveBattle({ id, user1, user2, winner, roastText: fullRoast, previewLine });
  } catch (err) {
    console.error('[battle/save]', err);
    res.write(verdictFooter(winner || '?', loser || '?', 'save failed'));
    return res.end();
  }

  res.write(verdictFooter(winner || '?', loser || '?', buildBattleShareUrl(id)));
  res.end();
}

async function handleBattleBrowser(req, res, user1, user2, data1, data2, next) {
  let fullRoast;
  try {
    fullRoast = await generateBattleRoast(data1, data2);
  } catch (err) {
    return next(err);
  }

  const id = shortId();
  const winner = extractBattleWinner(fullRoast);
  const previewLine = extractPreviewLine(fullRoast);

  try {
    await saveBattle({ id, user1, user2, winner, roastText: fullRoast, previewLine });
  } catch (err) {
    console.error('[battle/save browser]', err);
  }

  res.redirect(302, `/b/${id}`);
}

async function serveCachedBattle(req, res, cached) {
  if (isTerminalClient(req)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    res.write(battleHeader(cached.user1, cached.user2));
    await streamText(res, cached.roast_text);
    const loser = cached.winner
      ? (cached.winner.toLowerCase() === cached.user1.toLowerCase() ? cached.user2 : cached.user1)
      : '?';
    res.write(verdictFooter(cached.winner || '?', loser, buildBattleShareUrl(cached.id)));
    return res.end();
  }
  return res.redirect(302, `/b/${cached.id}`);
}
