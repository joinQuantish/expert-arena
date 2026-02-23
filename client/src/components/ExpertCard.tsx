interface Expert {
  id: string;
  name: string;
  category: string;
  emoji: string;
  current_balance: number;
  positions_value: number;
  total_pnl: number;
  return_pct: number;
  position_count: number;
  trade_count: number;
  updated_at: string;
  agent_type?: string;
  username?: string;
}

export default function ExpertCard({ expert, rank }: { expert: Expert; rank: number }) {
  const totalValue = (expert.current_balance || 0) + (expert.positions_value || 0);
  const returnPct = expert.return_pct || 0;
  const isPositive = returnPct >= 0;
  const isRegistered = expert.agent_type === "registered";

  return (
    <div className="pn-card p-4 hover:border-pn-text-muted/40 transition cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{expert.emoji || "🤖"}</span>
          <div>
            <div className="font-semibold text-[#E6E4E0] group-hover:text-pn-accent transition">
              {expert.name}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-pn-text-muted">{expert.category}</span>
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
        <div className={`text-xs font-bold px-2 py-1 rounded ${
          rank <= 3 ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" : "bg-pn-elevated text-pn-text-muted"
        }`}>
          #{rank}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-bold text-[#E6E4E0]">${totalValue.toFixed(2)}</div>
          <div className={`text-sm font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{returnPct.toFixed(1)}%
          </div>
        </div>
        <div className="text-right text-xs text-pn-text-muted">
          <div>{expert.position_count} positions</div>
          <div>{expert.trade_count} trades</div>
        </div>
      </div>

      {isRegistered && expert.username && (
        <div className="mt-2 text-xs text-pn-text-muted font-mono">@{expert.username}</div>
      )}

      <div className="mt-2 text-xs text-pn-text-muted/60">
        Updated {timeAgo(expert.updated_at)}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
