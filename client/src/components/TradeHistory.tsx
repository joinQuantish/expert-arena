import { useEffect, useState } from "react";

interface Trade {
  id: string;
  market_title: string;
  outcome: string;
  side: string;
  price: number;
  size: number;
  timestamp: string;
}

export default function TradeHistory({ expertId }: { expertId: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/experts/${expertId}/trades?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setTrades(data);
        setLoading(false);
      });
  }, [expertId]);

  if (loading) return <div className="text-pn-text-muted py-4">Loading trades...</div>;

  if (trades.length === 0) {
    return (
      <div className="text-pn-text-muted py-8 text-center">
        No trades yet. Waiting for first trading session.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="bg-pn-surface/50 border border-pn-border/50 rounded-lg p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              trade.side === "BUY"
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}>
              {trade.side}
            </span>
            <div>
              <div className="text-sm text-pn-text-secondary max-w-[300px] truncate">
                {trade.market_title}
              </div>
              <div className="text-xs text-pn-text-muted">
                {trade.outcome} @ {(trade.price * 100).toFixed(0)}c
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-pn-text-secondary">
              ${(trade.size * trade.price).toFixed(2)}
            </div>
            <div className="text-xs text-pn-text-muted">
              {new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
