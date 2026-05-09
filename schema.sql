CREATE TABLE IF NOT EXISTS roasts (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  roast_text   TEXT NOT NULL,
  preview_line TEXT NOT NULL,
  cooked_score INTEGER,
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_created
  ON roasts (username, created_at DESC);

CREATE TABLE IF NOT EXISTS battles (
  id           TEXT PRIMARY KEY,
  user1        TEXT NOT NULL,
  user2        TEXT NOT NULL,
  winner       TEXT,
  roast_text   TEXT NOT NULL,
  preview_line TEXT NOT NULL,
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_battle_users
  ON battles (user1, user2, created_at DESC);
