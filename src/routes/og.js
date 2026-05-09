import express from 'express';
import { getRoast } from '../services/db.js';
import { generateOgImage } from '../services/ogImage.js';

export const ogRouter = express.Router();

ogRouter.get('/:id.png', async (req, res, next) => {
  const { id } = req.params;
  if (!/^[a-z0-9]{5}$/i.test(id)) {
    return res.status(404).type('text/plain').send('not found\n');
  }

  let row;
  try {
    row = getRoast(id);
  } catch (err) {
    return next(err);
  }
  if (!row) {
    return res.status(404).type('text/plain').send('not found\n');
  }

  try {
    const png = await generateOgImage(row.id, row.username, row.roast_text);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(png);
  } catch (err) {
    return next(err);
  }
});
