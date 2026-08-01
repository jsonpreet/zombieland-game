import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
  query_timeout: 25000,
  idleTimeoutMillis: 0
})

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  birth_year INTEGER,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  wave INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON sessions(score DESC);
`

let schemaReady = null

export async function ensureSchema() {
  if (!schemaReady) schemaReady = pool.query(SCHEMA).catch((e) => {
    schemaReady = null
    throw e
  })
  return schemaReady
}

export async function query(text, values) {
  await ensureSchema()
  return pool.query(text, values)
}

export const getPool = () => pool
