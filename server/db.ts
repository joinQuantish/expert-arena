import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});

export default pool;

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS experts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      wallet_address TEXT,
      eoa_address TEXT,
      automation_id TEXT,
      initial_balance FLOAT DEFAULT 20,
      current_balance FLOAT DEFAULT 0,
      positions_value FLOAT DEFAULT 0,
      total_pnl FLOAT DEFAULT 0,
      enabled BOOLEAN DEFAULT true,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      expert_id TEXT REFERENCES experts(id),
      condition_id TEXT,
      asset TEXT,
      market_slug TEXT,
      market_title TEXT,
      outcome TEXT,
      size FLOAT,
      avg_price FLOAT,
      current_price FLOAT,
      pnl FLOAT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      expert_id TEXT REFERENCES experts(id),
      market_slug TEXT,
      market_title TEXT,
      outcome TEXT,
      side TEXT,
      price FLOAT,
      size FLOAT,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      expert_id TEXT REFERENCES experts(id),
      balance FLOAT,
      positions_value FLOAT,
      total_value FLOAT,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS research_logs (
      id SERIAL PRIMARY KEY,
      expert_id TEXT REFERENCES experts(id),
      summary TEXT,
      trades_made TEXT,
      positions_held TEXT,
      positions_exited TEXT,
      next_moves TEXT,
      raw_report TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_positions_expert ON positions(expert_id);
    CREATE INDEX IF NOT EXISTS idx_trades_expert ON trades(expert_id);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_expert ON snapshots(expert_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_research_expert ON research_logs(expert_id);
    CREATE INDEX IF NOT EXISTS idx_research_timestamp ON research_logs(timestamp DESC);
  `);

  // Migration: add columns for open registration
  await pool.query(`
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS organization TEXT;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'internal';
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS external_id TEXT;
  `);

  // Migration: add reward tracking columns
  await pool.query(`
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS reward_scoring BOOLEAN DEFAULT false;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS reward_daily_rate NUMERIC DEFAULT 0;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS reward_earnings_today NUMERIC DEFAULT 0;
    ALTER TABLE experts ADD COLUMN IF NOT EXISTS reward_market_title TEXT DEFAULT '';
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_experts_username ON experts(username) WHERE username IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_experts_external_id ON experts(external_id) WHERE external_id IS NOT NULL;
  `);

  // Migration: reward_earnings history table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reward_earnings (
      id SERIAL PRIMARY KEY,
      expert_id TEXT REFERENCES experts(id),
      date DATE NOT NULL,
      condition_id TEXT NOT NULL,
      question TEXT DEFAULT '',
      earnings NUMERIC DEFAULT 0,
      earning_percentage NUMERIC DEFAULT 0,
      competitiveness NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(expert_id, date, condition_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reward_earnings_expert ON reward_earnings(expert_id);
    CREATE INDEX IF NOT EXISTS idx_reward_earnings_date ON reward_earnings(date DESC);
    CREATE INDEX IF NOT EXISTS idx_reward_earnings_expert_date ON reward_earnings(expert_id, date DESC);
  `);

  console.log("[db] Schema initialized");
}
