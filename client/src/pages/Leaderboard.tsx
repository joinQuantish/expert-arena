import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ExpertCard from "../components/ExpertCard";

interface Expert {
  id: string;
  name: string;
  category: string;
  emoji: string;
  current_balance: number;
  positions_value: number;
  total_pnl: number;
  initial_balance: number;
  total_value: number;
  return_pct: number;
  position_count: number;
  trade_count: number;
  updated_at: string;
}

interface Stats {
  total_experts: number;
  total_aum: number;
  total_pnl: number;
  total_trades: number;
  best_expert_name: string;
}

export default function Leaderboard() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/leaderboard").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]).then(([exp, st]) => {
      setExperts(exp);
      setStats(st);
      setLoading(false);
    });

    const interval = setInterval(() => {
      fetch("/api/leaderboard").then((r) => r.json()).then(setExperts);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading arena...</div>
      </div>
    );
  }

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total AUM" value={`$${(stats.total_aum || 0).toFixed(2)}`} />
          <StatCard label="Total P&L" value={`$${(stats.total_pnl || 0).toFixed(2)}`} color={stats.total_pnl >= 0 ? "text-green-400" : "text-red-400"} />
          <StatCard label="Total Trades" value={String(stats.total_trades || 0)} />
          <StatCard label="Top Expert" value={stats.best_expert_name || "---"} />
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-300 mb-4">Leaderboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {experts.map((expert, i) => (
          <Link to={`/expert/${expert.id}`} key={expert.id}>
            <ExpertCard expert={expert} rank={i + 1} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
