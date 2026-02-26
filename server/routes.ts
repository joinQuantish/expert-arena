import { Router } from "express";
import pool from "./db.js";
import { registerLimiter } from "./middleware.js";
import { validateUsername, validateWalletAddress, validateName } from "./validation.js";
import { verifyWallet } from "./verify.js";
import { ethers } from "ethers";

const router = Router();

const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const USDC_ABI = ["function balanceOf(address) view returns (uint256)"];
const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const DATA_API = "https://data-api.polymarket.com";

// Health check
router.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// All experts with summary stats
router.get("/api/experts", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM positions p WHERE p.expert_id = e.id AND p.size > 0) as position_count,
        (SELECT COUNT(*) FROM trades t WHERE t.expert_id = e.id) as trade_count
      FROM experts e
      WHERE e.enabled = true
      ORDER BY e.total_pnl DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Single expert detail
router.get("/api/experts/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM positions p WHERE p.expert_id = e.id AND p.size > 0) as position_count,
        (SELECT COUNT(*) FROM trades t WHERE t.expert_id = e.id) as trade_count
       FROM experts e WHERE e.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expert not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Lookup by username
router.get("/api/agents/:username", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM positions p WHERE p.expert_id = e.id AND p.size > 0) as position_count,
        (SELECT COUNT(*) FROM trades t WHERE t.expert_id = e.id) as trade_count
       FROM experts e WHERE e.username = $1`,
      [req.params.username.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Expert positions
router.get("/api/experts/:id/positions", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM positions
       WHERE expert_id = $1 AND size > 0
       ORDER BY ABS(pnl) DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Expert trade history
router.get("/api/experts/:id/trades", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const result = await pool.query(
      `SELECT * FROM trades
       WHERE expert_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [req.params.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Expert research logs
router.get("/api/experts/:id/research", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const result = await pool.query(
      `SELECT id, expert_id, summary, trades_made, positions_exited, next_moves, timestamp
       FROM research_logs
       WHERE expert_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [req.params.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Expert equity snapshots (for chart)
router.get("/api/experts/:id/snapshots", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const result = await pool.query(
      `SELECT total_value, balance, positions_value, timestamp
       FROM snapshots
       WHERE expert_id = $1 AND timestamp > NOW() - INTERVAL '1 day' * $2
       ORDER BY timestamp ASC`,
      [req.params.id, days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Reward earnings history for an expert
router.get("/api/experts/:id/reward-earnings", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const result = await pool.query(
      `SELECT date, SUM(earnings) as total_earnings,
              json_agg(json_build_object(
                'conditionId', condition_id,
                'question', question,
                'earnings', earnings,
                'earningPercentage', earning_percentage,
                'competitiveness', competitiveness
              ) ORDER BY earnings DESC) as markets
       FROM reward_earnings
       WHERE expert_id = $1 AND date >= CURRENT_DATE - INTERVAL '1 day' * $2
       GROUP BY date
       ORDER BY date DESC`,
      [req.params.id, days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Cumulative reward totals for an expert
router.get("/api/experts/:id/reward-totals", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(earnings), 0) as total_earnings,
        COUNT(DISTINCT date) as days_earning,
        COUNT(DISTINCT condition_id) as markets_deployed,
        MIN(date) as first_earning_date,
        MAX(date) as last_earning_date,
        CASE WHEN COUNT(DISTINCT date) > 0
          THEN ROUND((SUM(earnings) / COUNT(DISTINCT date))::numeric, 4)
          ELSE 0
        END as avg_daily_earnings
       FROM reward_earnings
       WHERE expert_id = $1 AND earnings > 0`,
      [req.params.id]
    );
    res.json(
      result.rows[0] || {
        total_earnings: 0,
        days_earning: 0,
        markets_deployed: 0,
        first_earning_date: null,
        last_earning_date: null,
        avg_daily_earnings: 0,
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Aggregate reward stats across all LP agents
router.get("/api/rewards/summary", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        re.expert_id,
        e.name,
        e.emoji,
        COALESCE(SUM(re.earnings), 0) as total_earnings,
        COUNT(DISTINCT re.date) as days_active,
        MAX(re.date) as last_earning_date,
        COALESCE(SUM(CASE WHEN re.date = CURRENT_DATE THEN re.earnings ELSE 0 END), 0) as today_earnings
      FROM reward_earnings re
      JOIN experts e ON e.id = re.expert_id
      WHERE re.earnings > 0
      GROUP BY re.expert_id, e.name, e.emoji
      ORDER BY total_earnings DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Leaderboard
router.get("/api/leaderboard", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id, e.name, e.category, e.emoji, e.username, e.agent_type, e.organization, e.registered_at,
        e.current_balance, COALESCE(e.positions_value, 0) as positions_value, COALESCE(e.total_pnl, 0) as total_pnl, e.initial_balance,
        e.current_balance + COALESCE(e.positions_value, 0) as total_value,
        CASE WHEN e.initial_balance > 0
          THEN ((e.current_balance + COALESCE(e.positions_value, 0) - e.initial_balance) / e.initial_balance) * 100
          ELSE 0
        END as return_pct,
        (SELECT COUNT(*) FROM positions p WHERE p.expert_id = e.id AND p.size > 0) as position_count,
        (SELECT COUNT(*) FROM trades t WHERE t.expert_id = e.id) as trade_count,
        e.reward_scoring, COALESCE(e.reward_daily_rate, 0) as reward_daily_rate,
        COALESCE(e.reward_earnings_today, 0) as reward_earnings_today, COALESCE(e.reward_market_title, '') as reward_market_title,
        COALESCE((SELECT SUM(re.earnings) FROM reward_earnings re WHERE re.expert_id = e.id AND re.earnings > 0), 0) as reward_total_earnings,
        e.updated_at
      FROM experts e
      WHERE e.enabled = true
      ORDER BY return_pct DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Aggregate stats
router.get("/api/stats", async (_req, res) => {
  try {
    const experts = await pool.query(`
      SELECT
        COUNT(*) as total_experts,
        COUNT(*) FILTER (WHERE agent_type = 'registered') as registered_count,
        SUM(current_balance + COALESCE(positions_value, 0)) as total_aum,
        SUM(COALESCE(total_pnl, 0)) as total_pnl,
        MAX(COALESCE(total_pnl, 0)) as best_pnl,
        (SELECT id FROM experts WHERE enabled = true ORDER BY COALESCE(total_pnl, 0) DESC LIMIT 1) as best_expert_id,
        (SELECT name FROM experts WHERE enabled = true ORDER BY COALESCE(total_pnl, 0) DESC LIMIT 1) as best_expert_name
      FROM experts WHERE enabled = true
    `);
    const trades = await pool.query("SELECT COUNT(*) as total_trades FROM trades");

    res.json({
      ...experts.rows[0],
      total_trades: parseInt(trades.rows[0].total_trades),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Agent registration
router.post("/api/register", registerLimiter, async (req, res) => {
  try {
    const { name, username, wallet_address, external_id, organization } = req.body;

    // Validate inputs
    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ error: usernameErr });

    const walletErr = validateWalletAddress(wallet_address);
    if (walletErr) return res.status(400).json({ error: walletErr });

    if (!external_id || typeof external_id !== "string" || external_id.length < 1 || external_id.length > 100) {
      return res.status(400).json({ error: "external_id is required (1-100 chars)" });
    }

    if (organization && (typeof organization !== "string" || organization.length > 100)) {
      return res.status(400).json({ error: "organization must be a string under 100 chars" });
    }

    // Check username uniqueness
    const existingUser = await pool.query(
      "SELECT id FROM experts WHERE username = $1",
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Check wallet uniqueness
    const existingWallet = await pool.query(
      "SELECT id FROM experts WHERE LOWER(wallet_address) = LOWER($1)",
      [wallet_address]
    );
    if (existingWallet.rows.length > 0) {
      return res.status(409).json({ error: "Wallet address already registered" });
    }

    // Verify wallet via MCP
    const verification = await verifyWallet(external_id, wallet_address);
    if (!verification.valid) {
      return res.status(403).json({ error: verification.error });
    }

    // Fetch current USDC balance for P&L baseline
    let cashBalance = 0;
    try {
      const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
      const bal = await usdc.balanceOf(wallet_address);
      cashBalance = parseFloat(ethers.formatUnits(bal, 6));
    } catch {
      // Non-fatal: default to 0
    }

    // Fetch current positions value from Polymarket
    let positionsValue = 0;
    try {
      const posRes = await fetch(`${DATA_API}/positions?user=${wallet_address}`);
      if (posRes.ok) {
        const positions: { size: number; curPrice: number }[] = await posRes.json();
        for (const pos of positions) {
          const size = Number(pos.size) || 0;
          const price = Number(pos.curPrice) || 0;
          if (size > 0) positionsValue += size * price;
        }
      }
    } catch {
      // Non-fatal: default to 0
    }

    const initialBalance = cashBalance + positionsValue;
    const agentId = `agent-${username}`;

    await pool.query(
      `INSERT INTO experts (id, name, category, emoji, description, wallet_address, initial_balance, current_balance, positions_value, agent_type, username, organization, registered_at, external_id, enabled)
       VALUES ($1, $2, 'REGISTERED', '', '', $3, $4, $5, $6, 'registered', $7, $8, NOW(), $9, true)`,
      [agentId, name, wallet_address, initialBalance, cashBalance, positionsValue, username, organization || null, external_id]
    );

    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name,
        username,
        wallet_address,
        initial_balance: initialBalance,
        registered_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
