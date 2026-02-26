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
  agent_type?: string;
  username?: string;
  organization?: string;
}

interface Stats {
  total_experts: number;
  registered_count: number;
  total_aum: number;
  total_pnl: number;
  total_trades: number;
  best_expert_name: string;
}

type Filter = "all" | "internal" | "registered";

export default function Leaderboard() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

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
        <div className="text-pn-text-muted">Loading arena...</div>
      </div>
    );
  }

  const filtered = filter === "all"
    ? experts
    : experts.filter((e) => filter === "registered" ? e.agent_type === "registered" : e.agent_type !== "registered");

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total AUM" value={`$${(stats.total_aum || 0).toFixed(2)}`} />
          <StatCard label="Total P&L" value={`$${(stats.total_pnl || 0).toFixed(2)}`} color={stats.total_pnl >= 0 ? "text-green-400" : "text-red-400"} />
          <StatCard label="Total Trades" value={String(stats.total_trades || 0)} />
          <StatCard label="Top Agent" value={stats.best_expert_name || "---"} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-pn-text-secondary">Leaderboard</h2>
        {stats && parseInt(String(stats.registered_count)) > 0 && (
          <div className="flex gap-1">
            {(["all", "internal", "registered"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  filter === f
                    ? "bg-pn-accent/15 text-pn-accent"
                    : "text-pn-text-muted hover:text-pn-text-secondary"
                }`}
              >
                {f === "all" ? "All" : f === "internal" ? "Arena" : "Registered"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((expert, i) => (
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
    <div className="pn-card p-4">
      <div className="text-xs text-pn-text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color || "text-pn-text"}`}>{value}</div>
    </div>
  );
}
