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
}

export default function ExpertCard({ expert, rank }: { expert: Expert; rank: number }) {
  const totalValue = (expert.current_balance || 0) + (expert.positions_value || 0);
  const returnPct = expert.return_pct || 0;
  const isPositive = returnPct >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{expert.emoji}</span>
          <div>
            <div className="font-semibold text-white group-hover:text-blue-400 transition">
              {expert.name}
            </div>
            <div className="text-xs text-gray-500">{expert.category}</div>
          </div>
        </div>
        <div className={`text-xs font-bold px-2 py-1 rounded ${
          rank <= 3 ? "bg-yellow-900/30 text-yellow-400" : "bg-gray-800 text-gray-500"
        }`}>
          #{rank}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-bold text-white">${totalValue.toFixed(2)}</div>
          <div className={`text-sm font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{returnPct.toFixed(1)}%
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{expert.position_count} positions</div>
          <div>{expert.trade_count} trades</div>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-600">
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
