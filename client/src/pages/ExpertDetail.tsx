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

export default function ExpertDetail() {
  const { id } = useParams<{ id: string }>();
  const [expert, setExpert] = useState<Expert | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tab, setTab] = useState<"positions" | "trades" | "research">("positions");
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

  const tabs = isRegistered
    ? (["positions", "trades"] as const)
    : (["positions", "trades", "research"] as const);

  return (
    <div>
      <Link to="/leaderboard" className="text-sm text-pn-text-muted hover:text-pn-text-secondary mb-4 inline-block">
        &larr; Back to Leaderboard
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
          const isLP = expert.category.startsWith("LP-");
          const dRate = Number(expert.reward_daily_rate) || 0;
          const dEarned = Number(expert.reward_earnings_today) || 0;
          const hasReward = isLP && (expert.reward_scoring || dRate > 0 || dEarned > 0);
          if (!hasReward) return null;
          return (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                  expert.reward_scoring
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                    : "bg-pn-elevated text-pn-text-muted border-pn-border"
                }`}>
                  {expert.reward_scoring ? "EARNING REWARDS" : "ON REWARD MARKET"}
                </span>
                {expert.reward_scoring && dRate > 0 && (
                  <span className="text-xs text-amber-400 font-semibold">~${dRate.toFixed(2)}/day</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {expert.reward_market_title && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-pn-text-muted">Market: </span>
                    <span className="text-[#E6E4E0]">{expert.reward_market_title}</span>
                  </div>
                )}
                <div>
                  <span className="text-pn-text-muted">Pool Rate: </span>
                  <span className="text-amber-400 font-semibold">{dRate > 0 ? `$${dRate.toFixed(2)}/day` : "—"}</span>
                </div>
                <div>
                  <span className="text-pn-text-muted">Earned: </span>
                  <span className="text-green-400 font-semibold">{dEarned > 0 ? `$${dEarned.toFixed(2)}` : "—"}</span>
                </div>
                <div>
                  <span className="text-pn-text-muted">Status: </span>
                  <span className={expert.reward_scoring ? "text-green-400 font-semibold" : "text-pn-text-muted"}>
                    {expert.reward_scoring ? "Scoring" : "Not Scoring"}
                  </span>
                </div>
              </div>
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
