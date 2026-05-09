import express from 'express';
import helmet from 'helmet';

import { getBattle } from '../services/db.js';
import { renderTemplate } from '../utils/template.js';
import { isTerminalClient } from '../utils/detectCurl.js';
import { battleHeader, verdictFooter } from '../utils/ansi.js';
import { streamText } from '../utils/stream.js';
import { fetchGithubProfile } from '../services/github.js';

export const battleShareRouter = express.Router();

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

battleShareRouter.use((req, res, next) => {
  if (isTerminalClient(req)) return next();
  return helmetMw(req, res, next);
});

battleShareRouter.get('/:id', async (req, res, next) => {
  const id = req.params.id;
  if (!/^[a-z0-9]{5}$/i.test(id)) {
    return res.status(404).type('text/plain').send('not a real battle id\n');
  }

  let row;
  try {
    row = getBattle(id);
  } catch (err) {
    return next(err);
  }
  if (!row) {
    return res.status(404).type('text/plain').send('battle not found.\n');
  }

  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const shareUrl = `${baseUrl}/b/${row.id}`;

  if (isTerminalClient(req)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.flushHeaders();
    res.write(battleHeader(row.user1, row.user2));
    await streamText(res, row.roast_text);
    const loser = row.winner
      ? (row.winner.toLowerCase() === row.user1.toLowerCase() ? row.user2 : row.user1)
      : '?';
    res.write(verdictFooter(row.winner || '?', loser, shareUrl));
    return res.end();
  }

  const loser = row.winner
    ? (row.winner.toLowerCase() === row.user1.toLowerCase() ? row.user2 : row.user1)
    : null;
  const tweetText = `"${row.preview_line}" :: watch ${row.user1} vs ${row.user2} battle at urcooked.lol`;
  const tweetIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
  const battleUrl = `${baseUrl}/vs/${row.user1}/${row.user2}`;

  const user1IsWinner = row.winner && row.winner.toLowerCase() === row.user1.toLowerCase();
  const user2IsWinner = row.winner && row.winner.toLowerCase() === row.user2.toLowerCase();
  const displayRoast = row.roast_text.replace(/\nWINNER:.*$/i, '').trimEnd();

  let avatar1Url = `https://github.com/${row.user1}.png`;
  let avatar2Url = `https://github.com/${row.user2}.png`;

  try {
    const [profile1, profile2] = await Promise.all([
      fetchGithubProfile(row.user1),
      fetchGithubProfile(row.user2),
    ]);
    avatar1Url = profile1.avatar_url;
    avatar2Url = profile2.avatar_url;
  } catch {
    // Fallback to redirect URLs
  }

  const html = renderTemplate('battle.html', {
    user1: row.user1,
    user2: row.user2,
    winner: row.winner || '',
    loser: loser || '',
    roast_text: displayRoast,
    preview_line: row.preview_line,
    tweet_intent: tweetIntent,
    share_url: shareUrl,
    battle_url: battleUrl,
    avatar1_url: avatar1Url,
    avatar2_url: avatar2Url,
    github1_url: `https://github.com/${row.user1}`,
    github2_url: `https://github.com/${row.user2}`,
    winner_class_1: user1IsWinner ? 'winner' : (user2IsWinner ? 'loser' : ''),
    winner_class_2: user2IsWinner ? 'winner' : (user1IsWinner ? 'loser' : ''),
    winner_label_1: user1IsWinner ? 'winner-label' : '',
    winner_label_2: user2IsWinner ? 'winner-label' : '',
    verdict_label_1: user1IsWinner ? 'survived' : (user2IsWinner ? 'cooked' : ''),
    verdict_label_2: user2IsWinner ? 'survived' : (user1IsWinner ? 'cooked' : ''),
  });
  res.type('text/html').send(html);
});
