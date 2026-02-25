import pool from "./db.js";
import { EXPERTS } from "../config/experts.js";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const USDC_ABI = ["function balanceOf(address) view returns (uint256)"];
const POLYGON_RPC =
  process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const DATA_API = "https://data-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

// Claudiabot DB for reading automation_logs
const CLAUDIABOT_DB_URL = process.env.CLAUDIABOT_DATABASE_URL;
let claudiabotPool: InstanceType<typeof import("pg").Pool> | null = null;

async function getClaudiabotPool() {
  if (!claudiabotPool && CLAUDIABOT_DB_URL) {
    const pg = await import("pg");
    claudiabotPool = new pg.default.Pool({
      connectionString: CLAUDIABOT_DB_URL,
      ssl: CLAUDIABOT_DB_URL.includes("railway.internal")
        ? false
        : { rejectUnauthorized: false },
      max: 2,
    });
  }
  return claudiabotPool;
}

interface PolymarketPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  title: string;
  slug: string;
  outcome: string;
  cashPnl: number;
}

interface PolymarketActivity {
  transactionHash: string;
  type: string;
  asset: string;
  conditionId: string;
  title: string;
  slug: string;
  outcome: string;
  side: string;
  price: number;
  size: number;
  timestamp: number;
}

async function syncBalances() {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

  const experts = await pool.query(
    "SELECT id, wallet_address FROM experts WHERE wallet_address IS NOT NULL"
  );

  for (const expert of experts.rows) {
    try {
      const bal = await usdc.balanceOf(expert.wallet_address);
      const balance = parseFloat(ethers.formatUnits(bal, 6));
      await pool.query(
        "UPDATE experts SET current_balance = $1, updated_at = NOW() WHERE id = $2",
        [balance, expert.id]
      );
    } catch (err) {
      console.error(`[sync] Balance error for ${expert.id}:`, err);
    }
  }
}

async function syncPositions() {
  const experts = await pool.query(
    "SELECT id, wallet_address FROM experts WHERE wallet_address IS NOT NULL"
  );

  for (const expert of experts.rows) {
    try {
      const res = await fetch(
        `${DATA_API}/positions?user=${expert.wallet_address}`
      );
      if (!res.ok) continue;
      const positions: PolymarketPosition[] = await res.json();

      // Clear old positions for this expert
      await pool.query("DELETE FROM positions WHERE expert_id = $1", [
        expert.id,
      ]);

      let totalPositionsValue = 0;
      let totalPnl = 0;

      for (const pos of positions) {
        const size = Number(pos.size) || 0;
        if (size === 0) continue;

        const avgPrice = Number(pos.avgPrice) || 0;
        const currentPrice = Number(pos.curPrice) || 0;
        const pnl = Number(pos.cashPnl) || 0;
        const posValue = size * currentPrice;
        totalPositionsValue += posValue;
        totalPnl += pnl;

        await pool.query(
          `INSERT INTO positions (id, expert_id, condition_id, asset, market_slug, market_title, outcome, size, avg_price, current_price, pnl, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (id) DO UPDATE SET
             size = $8, avg_price = $9, current_price = $10, pnl = $11, updated_at = NOW()`,
          [
            `${expert.id}-${pos.asset}`,
            expert.id,
            pos.conditionId,
            pos.asset,
            pos.slug || "",
            pos.title || "Unknown",
            pos.outcome,
            size,
            avgPrice,
            currentPrice,
            pnl,
          ]
        );
      }

      await pool.query(
        "UPDATE experts SET positions_value = $1, total_pnl = $2, updated_at = NOW() WHERE id = $3",
        [totalPositionsValue, totalPnl, expert.id]
      );
    } catch (err) {
      console.error(`[sync] Positions error for ${expert.id}:`, err);
    }
  }
}

interface RewardMarketRaw {
  condition_id: string;
  total_daily_rate: number;
  rewards_max_spread: number;
  rewards_min_size: number;
  question?: string;
}

interface RewardMarketsPaginated {
  data: RewardMarketRaw[];
  next_cursor?: string;
  count: number;
}

async function syncRewardMarkets() {
  try {
    const res = await fetch(`${CLOB_API}/rewards/markets/current`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[sync] Reward markets fetch failed: ${res.status} ${errBody.slice(0, 200)}`);
      return;
    }
    const body: RewardMarketsPaginated = await res.json();

    // Build lookup: conditionId → reward data (first 500 is sufficient for cross-reference)
    const rewardMap = new Map<string, RewardMarketRaw>();
    for (const rm of body.data) {
      rewardMap.set(rm.condition_id, rm);
    }

    // For each expert, check if any of their positions are on reward markets
    const experts = await pool.query(
      "SELECT id FROM experts WHERE wallet_address IS NOT NULL"
    );

    for (const expert of experts.rows) {
      const positions = await pool.query(
        "SELECT condition_id, market_title FROM positions WHERE expert_id = $1 AND size > 0",
        [expert.id]
      );

      let bestRate = 0;
      let bestTitle = "";

      for (const pos of positions.rows) {
        const rm = rewardMap.get(pos.condition_id);
        if (rm && rm.total_daily_rate > bestRate) {
          bestRate = rm.total_daily_rate;
          bestTitle = rm.question || pos.market_title || "";
        }
      }

      // Update reward_daily_rate and reward_market_title from public data
      // (reward_scoring and reward_earnings_today come from agent report parsing)
      await pool.query(
        `UPDATE experts SET
          reward_daily_rate = $1,
          reward_market_title = $2,
          updated_at = NOW()
        WHERE id = $3`,
        [bestRate, bestTitle, expert.id]
      );
    }
    console.log(`[sync] Reward markets: ${rewardMap.size} active, checked ${experts.rows.length} experts`);
  } catch (err) {
    console.error("[sync] Reward markets error:", err);
  }
}

async function syncTrades() {
  const experts = await pool.query(
    "SELECT id, wallet_address FROM experts WHERE wallet_address IS NOT NULL"
  );

  for (const expert of experts.rows) {
    try {
      const res = await fetch(
        `${DATA_API}/activity?user=${expert.wallet_address}&limit=50`
      );
      if (!res.ok) continue;
      const activities: PolymarketActivity[] = await res.json();

      for (const act of activities) {
        if (act.type !== "TRADE") continue;
        const tradeId = act.transactionHash || `${expert.id}-${act.timestamp}-${act.asset}`;
        await pool.query(
          `INSERT INTO trades (id, expert_id, market_slug, market_title, outcome, side, price, size, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            tradeId,
            expert.id,
            act.slug || "",
            act.title || "Unknown",
            act.outcome,
            act.side,
            Number(act.price) || 0,
            Number(act.size) || 0,
            new Date(act.timestamp * 1000),
          ]
        );
      }
    } catch (err) {
      console.error(`[sync] Trades error for ${expert.id}:`, err);
    }
  }
}

async function takeSnapshots() {
  const experts = await pool.query(
    "SELECT id, current_balance, positions_value FROM experts WHERE wallet_address IS NOT NULL"
  );

  for (const expert of experts.rows) {
    const totalValue = expert.current_balance + expert.positions_value;
    await pool.query(
      "INSERT INTO snapshots (expert_id, balance, positions_value, total_value) VALUES ($1, $2, $3, $4)",
      [expert.id, expert.current_balance, expert.positions_value, totalValue]
    );
  }
}

interface ParsedReport {
  summary: string;
  tradesMade: string;
  positionsHeld: string;
  positionsExited: string;
  nextMoves: string;
  rawReport: string;
  rewardScoring?: boolean;
  rewardEarningsToday?: number;
}

function parseReport(output: string, expertName: string): ParsedReport | null {
  const startMarker = `=== ${expertName} REPORT ===`;
  const endMarker = `=== END REPORT ===`;
  const startIdx = output.indexOf(startMarker);
  const endIdx = output.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;

  const report = output.substring(startIdx + startMarker.length, endIdx).trim();

  const extract = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z][ A-Z]*:|$)`, "s");
    const match = report.match(regex);
    return match ? match[1].trim() : "";
  };

  // Parse LP-specific reward fields
  const rewardStatusRaw = extract("REWARD STATUS");
  let rewardScoring: boolean | undefined;
  if (rewardStatusRaw) {
    rewardScoring = /scoring/i.test(rewardStatusRaw) && !/not scoring/i.test(rewardStatusRaw);
  }

  const earningsRaw = extract("EARNINGS");
  let rewardEarningsToday: number | undefined;
  if (earningsRaw) {
    const match = earningsRaw.match(/\$?([\d.]+)/);
    if (match) rewardEarningsToday = parseFloat(match[1]);
  }

  // Works for both directional and LP report formats
  return {
    summary: extract("RESEARCH"),
    tradesMade: extract("TRADES THIS SESSION"),
    positionsHeld: extract("POSITIONS HELD") || extract("INVENTORY"),
    positionsExited: extract("POSITIONS EXITED") || extract("OPEN ORDERS"),
    nextMoves: extract("NEXT MOVES"),
    rawReport: report,
    rewardScoring,
    rewardEarningsToday,
  };
}

async function syncResearchLogs() {
  const cbPool = await getClaudiabotPool();
  if (!cbPool) return;

  const expertsResult = await pool.query("SELECT id, name FROM experts");
  const expertMap = new Map(
    expertsResult.rows.map((e: { id: string; name: string }) => [e.id, e.name])
  );

  // Get last synced timestamp per expert
  const lastSynced = await pool.query(
    "SELECT expert_id, MAX(timestamp) as last_ts FROM research_logs GROUP BY expert_id"
  );
  const lastTsMap = new Map(
    lastSynced.rows.map((r: { expert_id: string; last_ts: Date }) => [
      r.expert_id,
      r.last_ts,
    ])
  );

  try {
    const logs = await cbPool.query(
      `SELECT id, external_user_id, output, status, executed_at
       FROM automation_logs
       WHERE external_user_id LIKE 'expert-%'
         AND status = 'success'
         AND output IS NOT NULL
       ORDER BY executed_at DESC
       LIMIT 100`
    );

    for (const log of logs.rows) {
      const expertId = log.external_user_id;
      const expertName = expertMap.get(expertId);
      if (!expertName) continue;

      const lastTs = lastTsMap.get(expertId);
      if (lastTs && new Date(log.executed_at) <= lastTs) continue;

      const parsed = parseReport(log.output, expertName);
      if (!parsed) continue;

      await pool.query(
        `INSERT INTO research_logs (expert_id, summary, trades_made, positions_held, positions_exited, next_moves, raw_report, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          expertId,
          parsed.summary,
          parsed.tradesMade,
          parsed.positionsHeld,
          parsed.positionsExited,
          parsed.nextMoves,
          parsed.rawReport,
          new Date(log.executed_at),
        ]
      );

      // Update reward fields on expert if this is an LP report with reward data
      if (parsed.rewardScoring !== undefined) {
        await pool.query(
          `UPDATE experts SET
            reward_scoring = $1,
            reward_earnings_today = COALESCE($2, reward_earnings_today),
            updated_at = NOW()
          WHERE id = $3`,
          [parsed.rewardScoring, parsed.rewardEarningsToday ?? null, expertId]
        );
      }
    }
  } catch (err) {
    console.error("[sync] Research logs error:", err);
  }
}

export async function runSync() {
  console.log("[sync] Starting sync cycle...");
  const start = Date.now();

  try {
    await syncBalances();
    await syncPositions();
    await syncRewardMarkets();
    await syncTrades();
    await syncResearchLogs();
    await takeSnapshots();
    console.log(`[sync] Completed in ${Date.now() - start}ms`);
  } catch (err) {
    console.error("[sync] Sync cycle failed:", err);
  }
}

export async function seedExperts() {
  // Load wallet addresses from public config if available
  let walletMap = new Map<string, { walletAddress: string; automationId: string }>();
  try {
    // Try multiple possible locations (dev vs Docker build)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(__dirname, "../config/experts-public.json"),
      path.resolve(__dirname, "../../config/experts-public.json"),
      path.resolve(process.cwd(), "config/experts-public.json"),
    ];
    let configData: string | null = null;
    for (const p of candidates) {
      try {
        configData = readFileSync(p, "utf-8");
        break;
      } catch {}
    }
    if (configData) {
      const publicConfig = JSON.parse(configData);
      for (const entry of publicConfig) {
        walletMap.set(entry.id, {
          walletAddress: entry.walletAddress,
          automationId: entry.automationId,
        });
      }
    }
  } catch {
    console.log("[sync] No public config found, seeding without wallet addresses");
  }

  for (const expert of EXPERTS) {
    const wallet = walletMap.get(expert.id);
    await pool.query(
      `INSERT INTO experts (id, name, category, emoji, description, wallet_address, automation_id, agent_type, initial_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'internal', $8)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, category = $3, emoji = $4, description = $5,
         wallet_address = COALESCE($6, experts.wallet_address),
         automation_id = COALESCE($7, experts.automation_id),
         agent_type = 'internal',
         initial_balance = COALESCE($8, experts.initial_balance)`,
      [
        expert.id,
        expert.name,
        expert.category,
        expert.emoji,
        expert.description,
        wallet?.walletAddress || null,
        wallet?.automationId || null,
        expert.initialCapital || 20,
      ]
    );
  }
  console.log(`[sync] Experts seeded (${walletMap.size} with wallets)`);
}
