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
        <div className="text-gray-500">Loading expert...</div>
      </div>
    );
  }

  const totalValue = expert.current_balance + expert.positions_value;
  const returnPct = expert.initial_balance > 0
    ? ((totalValue - expert.initial_balance) / expert.initial_balance) * 100
    : 0;

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
        &larr; Back to Arena
      </Link>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{expert.emoji}</span>
              <div>
                <h1 className="text-2xl font-bold">{expert.name}</h1>
                <span className="text-sm px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                  {expert.category}
                </span>
              </div>
            </div>
            <p className="text-gray-400 mt-2 text-sm max-w-lg">{expert.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
            <div className={`text-sm font-semibold ${returnPct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}% return
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <MiniStat label="Cash" value={`$${expert.current_balance.toFixed(2)}`} />
          <MiniStat label="In Positions" value={`$${expert.positions_value.toFixed(2)}`} />
          <MiniStat
            label="P&L"
            value={`${expert.total_pnl >= 0 ? "+" : ""}$${expert.total_pnl.toFixed(2)}`}
            color={expert.total_pnl >= 0 ? "text-green-400" : "text-red-400"}
          />
          <MiniStat label="Trades" value={String(expert.trade_count || 0)} />
        </div>

        {expert.wallet_address && (
          <div className="mt-4 text-xs text-gray-600">
            Wallet:{" "}
            <a
              href={`https://polygonscan.com/address/${expert.wallet_address}`}
              target="_blank"
              rel="noopener"
              className="text-gray-500 hover:text-gray-300 font-mono"
            >
              {expert.wallet_address.slice(0, 6)}...{expert.wallet_address.slice(-4)}
            </a>
          </div>
        )}
      </div>

      {/* Equity chart (simple text-based for now) */}
      {snapshots.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm text-gray-400 mb-3">Portfolio Value (30d)</h3>
          <MiniChart snapshots={snapshots} initial={expert.initial_balance} />
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {(["positions", "trades", "research"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "positions" && <PositionTable expertId={expert.id} />}
      {tab === "trades" && <TradeHistory expertId={expert.id} />}
      {tab === "research" && <ResearchFeed expertId={expert.id} />}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${color || "text-white"}`}>{value}</div>
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
