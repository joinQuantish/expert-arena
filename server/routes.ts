import { Router } from "express";
import pool from "./db.js";

const router = Router();

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

// Leaderboard
router.get("/api/leaderboard", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id, e.name, e.category, e.emoji,
        e.current_balance, e.positions_value, e.total_pnl, e.initial_balance,
        e.current_balance + e.positions_value as total_value,
        CASE WHEN e.initial_balance > 0
          THEN ((e.current_balance + e.positions_value - e.initial_balance) / e.initial_balance) * 100
          ELSE 0
        END as return_pct,
        (SELECT COUNT(*) FROM positions p WHERE p.expert_id = e.id AND p.size > 0) as position_count,
        (SELECT COUNT(*) FROM trades t WHERE t.expert_id = e.id) as trade_count,
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
        SUM(current_balance + positions_value) as total_aum,
        SUM(total_pnl) as total_pnl,
        MAX(total_pnl) as best_pnl,
        (SELECT id FROM experts WHERE enabled = true ORDER BY total_pnl DESC LIMIT 1) as best_expert_id,
        (SELECT name FROM experts WHERE enabled = true ORDER BY total_pnl DESC LIMIT 1) as best_expert_name
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

export default router;
