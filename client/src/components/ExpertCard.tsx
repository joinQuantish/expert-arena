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
  reward_scoring?: boolean;
  reward_daily_rate?: number;
  reward_earnings_today?: number;
  reward_market_title?: string;
}

export default function ExpertCard({ expert, rank }: { expert: Expert; rank: number }) {
  const totalValue = (expert.current_balance || 0) + (expert.positions_value || 0);
  const returnPct = expert.return_pct || 0;
  const isPositive = returnPct >= 0;
  const isRegistered = expert.agent_type === "registered";
  const dailyRate = Number(expert.reward_daily_rate) || 0;
  const earningsToday = Number(expert.reward_earnings_today) || 0;
  const hasRewardData = expert.reward_scoring || dailyRate > 0 || earningsToday > 0;

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

      {hasRewardData && (
        <div className="mb-2 p-1.5 rounded bg-amber-500/5 border border-amber-500/10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              expert.reward_scoring
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                : "bg-pn-elevated text-pn-text-muted border-pn-border"
            }`}>
              {expert.reward_scoring ? "EARNING REWARDS" : "ON REWARD MARKET"}
            </span>
            {dailyRate > 0 && (
              <span className="text-[10px] text-amber-400/80 font-medium">
                ~${dailyRate.toFixed(2)}/day
              </span>
            )}
            {earningsToday > 0 && (
              <span className="text-[10px] text-green-400/80 font-medium">
                +${earningsToday.toFixed(2)} earned
              </span>
            )}
          </div>
          {expert.reward_market_title && (
            <div className="text-[10px] text-pn-text-muted/70 mt-1 truncate">
              {expert.reward_market_title}
            </div>
          )}
        </div>
      )}

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
