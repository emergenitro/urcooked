import { neon } from '@neondatabase/serverless';

let sql;

export function initDb() {
  sql = neon(process.env.DATABASE_URL);
  console.log('[db] neon postgres ready');
  return sql;
}

export async function saveRoast({ id, username, roastText, previewLine, cookedScore }) {
  await sql`
    INSERT INTO roasts (id, username, roast_text, preview_line, cooked_score, created_at)
    VALUES (${id}, ${username}, ${roastText}, ${previewLine}, ${cookedScore ?? null}, ${Date.now()})
  `;
}

export async function getRoast(id) {
  const rows = await sql`SELECT * FROM roasts WHERE id = ${id}`;
  return rows[0] || null;
}

export async function findRecentByUsername(username, ttlMs = 60 * 60 * 1000) {
  const cutoff = Date.now() - ttlMs;
  const rows = await sql`
    SELECT * FROM roasts
    WHERE LOWER(username) = LOWER(${username})
      AND created_at >= ${cutoff}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function saveBattle({ id, user1, user2, winner, roastText, previewLine }) {
  await sql`
    INSERT INTO battles (id, user1, user2, winner, roast_text, preview_line, created_at)
    VALUES (${id}, ${user1}, ${user2}, ${winner ?? null}, ${roastText}, ${previewLine}, ${Date.now()})
  `;
}

export async function getBattle(id) {
  const rows = await sql`SELECT * FROM battles WHERE id = ${id}`;
  return rows[0] || null;
}

export async function findRecentBattle(user1, user2, ttlMs = 30 * 60 * 1000) {
  const cutoff = Date.now() - ttlMs;
  const u1 = user1.toLowerCase();
  const u2 = user2.toLowerCase();
  const rows = await sql`
    SELECT * FROM battles
    WHERE (
      (LOWER(user1) = ${u1} AND LOWER(user2) = ${u2}) OR
      (LOWER(user1) = ${u2} AND LOWER(user2) = ${u1})
    ) AND created_at >= ${cutoff}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}
