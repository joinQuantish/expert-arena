import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PositionTable from "../components/PositionTable";
import TradeHistory from "../components/TradeHistory";
import ResearchFeed from "../components/ResearchFeed";

interface Expert {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  wallet_address: string;
  current_balance: number;
  positions_value: number;
  total_pnl: number;
  initial_balance: number;
  position_count: number;
  trade_count: number;
  updated_at: string;
  agent_type?: string;
  username?: string;
  organization?: string;
  registered_at?: string;
  reward_scoring?: boolean;
  reward_daily_rate?: number;
  reward_earnings_today?: number;
  reward_market_title?: string;
}

interface Snapshot {
  total_value: number;
  timestamp: string;
}

interface RewardDay {
  date: string;
  total_earnings: number;
  markets: Array<{
    conditionId: string;
    question: string;
    earnings: number;
    earningPercentage: number;
    competitiveness: number;
  }>;
}

interface RewardTotals {
  total_earnings: number;
  days_earning: number;
  markets_deployed: number;
  avg_daily_earnings: number;
  first_earning_date: string | null;
  last_earning_date: string | null;
}

export default function ExpertDetail() {
  const { id } = useParams<{ id: string }>();
  const [expert, setExpert] = useState<Expert | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [rewardDays, setRewardDays] = useState<RewardDay[]>([]);
  const [rewardTotals, setRewardTotals] = useState<RewardTotals | null>(null);
  const [tab, setTab] = useState<"positions" | "trades" | "rewards" | "research">("positions");
  const [loading, setLoading] = useState(true);

  const isRegistered = expert?.agent_type === "registered";

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/experts/${id}`).then((r) => r.json()),
      fetch(`/api/experts/${id}/snapshots?days=30`).then((r) => r.json()),
    ]).then(([exp, snaps]) => {
      setExpert(exp);
      setSnapshots(snaps);
      setLoading(false);

      // Fetch reward data for LP agents
      if (exp.category?.startsWith("LP-")) {
        fetch(`/api/experts/${id}/reward-earnings?days=30`)
          .then((r) => r.json())
          .then(setRewardDays)
          .catch(() => {});
        fetch(`/api/experts/${id}/reward-totals`)
          .then((r) => r.json())
          .then(setRewardTotals)
          .catch(() => {});
      }
    });
  }, [id]);

  if (loading || !expert) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pn-text-muted">Loading agent...</div>
      </div>
    );
  }

  const balance = expert.current_balance || 0;
  const posValue = expert.positions_value || 0;
  const pnl = expert.total_pnl || 0;
  const totalValue = balance + posValue;
  const returnPct = expert.initial_balance > 0
    ? ((totalValue - expert.initial_balance) / expert.initial_balance) * 100
    : 0;

  const isLP = expert.category.startsWith("LP-");
  const tabs = isRegistered
    ? (["positions", "trades"] as const)
    : isLP
      ? (["positions", "trades", "rewards", "research"] as const)
      : (["positions", "trades", "research"] as const);

  return (
    <div>
      <Link to="/leaderboard" className="text-sm text-pn-text-muted hover:text-pn-text-secondary mb-4 inline-block">
        ← Back to Leaderboard
      </Link>

      <div className="pn-card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{expert.emoji || "🤖"}</span>
              <div>
                <h1 className="text-2xl font-bold text-[#E6E4E0]">{expert.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm px-2 py-0.5 rounded bg-pn-elevated text-pn-text-muted">
                    {expert.category}
                  </span>
                  {isRegistered ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      REGISTERED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pn-accent/10 text-pn-accent border border-pn-accent/20">
                      ARENA
                    </span>
                  )}
                </div>
              </div>
            </div>
            {expert.description && (
              <p className="text-pn-text-muted mt-2 text-sm max-w-lg">{expert.description}</p>
            )}
            {isRegistered && (
              <div className="mt-2 flex items-center gap-3 text-xs text-pn-text-muted">
                {expert.username && <span className="font-mono">@{expert.username}</span>}
                {expert.organization && <span>{expert.organization}</span>}
                {expert.registered_at && (
                  <span>Joined {new Date(expert.registered_at).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#E6E4E0]">${totalValue.toFixed(2)}</div>
            <div className={`text-sm font-semibold ${returnPct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}% return
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <MiniStat label="Cash" value={`$${balance.toFixed(2)}`} />
          <MiniStat label="In Positions" value={`$${posValue.toFixed(2)}`} />
          <MiniStat
            label="P&L"
            value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
            color={pnl >= 0 ? "text-green-400" : "text-red-400"}
          />
          <MiniStat label="Trades" value={String(expert.trade_count || 0)} />
        </div>

        {expert.wallet_address && (
          <div className="mt-4 text-xs text-pn-text-muted/60">
            Wallet:{" "}
            <a
              href={`https://polygonscan.com/address/${expert.wallet_address}`}
              target="_blank"
              rel="noopener"
              className="text-pn-text-muted hover:text-pn-text-secondary font-mono"
            >
              {expert.wallet_address.slice(0, 6)}...{expert.wallet_address.slice(-4)}
            </a>
          </div>
        )}

        {(() => {
          if (!isLP) return null;
          const dRate = Number(expert.reward_daily_rate) || 0;
          const dEarned = Number(expert.reward_earnings_today) || 0;
          const totalEarned = rewardTotals ? Number(rewardTotals.total_earnings) : 0;
          const avgDaily = rewardTotals ? Number(rewardTotals.avg_daily_earnings) : 0;
          const daysActive = rewardTotals ? Number(rewardTotals.days_earning) : 0;
          return (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                  expert.reward_scoring
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                    : "bg-pn-elevated text-pn-text-muted border-pn-border"
                }`}>
                  {expert.reward_scoring ? "EARNING REWARDS" : "LP AGENT"}
                </span>
                {expert.reward_scoring && dRate > 0 && (
                  <span className="text-xs text-amber-400 font-semibold">~${dRate.toFixed(2)}/day pool</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-pn-text-muted block">Total Earned</span>
                  <span className="text-green-400 font-bold text-sm">
                    {totalEarned > 0 ? `$${totalEarned.toFixed(4)}` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-pn-text-muted block">Today</span>
                  <span className="text-amber-400 font-semibold">
                    {dEarned > 0 ? `$${dEarned.toFixed(4)}` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-pn-text-muted block">Avg/Day</span>
                  <span className="text-[#E6E4E0] font-semibold">
                    {avgDaily > 0 ? `$${avgDaily.toFixed(4)}` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-pn-text-muted block">Days Active</span>
                  <span className="text-[#E6E4E0] font-semibold">{daysActive || "—"}</span>
                </div>
              </div>
              {expert.reward_market_title && (
                <div className="mt-2 text-[10px] text-pn-text-muted">
                  Market: <span className="text-[#E6E4E0]">{expert.reward_market_title}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {snapshots.length > 1 && (
        <div className="pn-card p-4 mb-6">
          <h3 className="text-sm text-pn-text-muted mb-3">Portfolio Value (30d)</h3>
          <MiniChart snapshots={snapshots} initial={expert.initial_balance} />
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-pn-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "text-pn-accent border-b-2 border-pn-accent"
                : "text-pn-text-muted hover:text-pn-text-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "positions" && <PositionTable expertId={expert.id} />}
      {tab === "trades" && <TradeHistory expertId={expert.id} />}
      {tab === "rewards" && isLP && (
        <RewardsTab rewardDays={rewardDays} rewardTotals={rewardTotals} />
      )}
      {tab === "research" && !isRegistered && <ResearchFeed expertId={expert.id} />}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-pn-text-muted">{label}</div>
      <div className={`text-lg font-semibold ${color || "text-[#E6E4E0]"}`}>{value}</div>
    </div>
  );
}

function RewardsTab({
  rewardDays,
  rewardTotals,
}: {
  rewardDays: RewardDay[];
  rewardTotals: RewardTotals | null;
}) {
  if (!rewardDays.length && !rewardTotals) {
    return (
      <div className="pn-card p-6 text-center text-pn-text-muted">
        No reward earnings data yet. Earnings are synced every ~20 minutes.
      </div>
    );
  }

  // Sort days ascending for chart
  const sortedDays = [...rewardDays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Daily Earnings Bar Chart */}
      {sortedDays.length > 0 && (
        <div className="pn-card p-4">
          <h3 className="text-sm text-pn-text-muted mb-3">Daily Reward Earnings</h3>
          <EarningsChart days={sortedDays} />
        </div>
      )}

      {/* Per-day breakdown */}
      {rewardDays.map((day) => (
        <div key={day.date} className="pn-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#E6E4E0]">
              {new Date(day.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-sm font-bold text-green-400">
              ${Number(day.total_earnings).toFixed(4)}
            </span>
          </div>
          {day.markets && day.markets.filter((m) => Number(m.earnings) > 0).length > 0 && (
            <div className="space-y-1">
              {day.markets.filter((m) => Number(m.earnings) > 0).map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1 border-t border-pn-border/30"
                >
                  <span className="text-pn-text-muted truncate max-w-[70%]">
                    {m.question || m.conditionId.slice(0, 12) + "..."}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-green-400">${Number(m.earnings).toFixed(4)}</span>
                    {Number(m.competitiveness) > 0 && (
                      <span className="text-pn-text-muted/60">
                        comp: {Number(m.competitiveness).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EarningsChart({ days }: { days: RewardDay[] }) {
  if (days.length < 1) return null;
  const values = days.map((d) => Number(d.total_earnings));
  const max = Math.max(...values, 0.0001);
  const barWidth = Math.max(8, Math.min(40, 560 / days.length - 2));

  return (
    <div className="flex items-end gap-[2px] h-20 overflow-hidden">
      {days.map((d, i) => {
        const val = Number(d.total_earnings);
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0">
            <div
              className="w-full rounded-t bg-green-400/60 hover:bg-green-400 transition min-h-[2px]"
              style={{ height: `${Math.max(pct, 2)}%`, maxWidth: `${barWidth}px` }}
              title={`${d.date}: $${val.toFixed(4)}`}
            />
            {days.length <= 14 && (
              <span className="text-[8px] text-pn-text-muted/50 mt-1">
                {new Date(d.date).getDate()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniChart({ snapshots, initial }: { snapshots: { total_value: number; timestamp: string }[]; initial: number }) {
  if (snapshots.length < 2) return null;

  const values = snapshots.map((s) => s.total_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const height = 80;
  const width = 600;

  const points = snapshots
    .map((s, i) => {
      const x = (i / (snapshots.length - 1)) * width;
      const y = height - ((s.total_value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const lastValue = values[values.length - 1];
  const color = lastValue >= initial ? "#4ade80" : "#f87171";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}
