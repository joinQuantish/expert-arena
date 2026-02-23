import { useEffect, useState } from "react";

interface Position {
  id: string;
  market_title: string;
  outcome: string;
  size: number;
  avg_price: number;
  current_price: number;
  pnl: number;
}

export default function PositionTable({ expertId }: { expertId: string }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/experts/${expertId}/positions`)
      .then((r) => r.json())
      .then((data) => {
        setPositions(data);
        setLoading(false);
      });
  }, [expertId]);

  if (loading) return <div className="text-gray-500 py-4">Loading positions...</div>;

  if (positions.length === 0) {
    return (
      <div className="text-gray-500 py-8 text-center">
        No open positions yet. Waiting for first trading session.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
            <th className="pb-2 pr-4">Market</th>
            <th className="pb-2 pr-4">Outcome</th>
            <th className="pb-2 pr-4 text-right">Size</th>
            <th className="pb-2 pr-4 text-right">Entry</th>
            <th className="pb-2 pr-4 text-right">Current</th>
            <th className="pb-2 text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-3 pr-4 max-w-[250px] truncate text-gray-300">
                {pos.market_title}
              </td>
              <td className="py-3 pr-4">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  pos.outcome === "Yes"
                    ? "bg-green-900/30 text-green-400"
                    : "bg-red-900/30 text-red-400"
                }`}>
                  {pos.outcome}
                </span>
              </td>
              <td className="py-3 pr-4 text-right font-mono text-gray-300">
                {pos.size.toFixed(2)}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-gray-400">
                {(pos.avg_price * 100).toFixed(0)}c
              </td>
              <td className="py-3 pr-4 text-right font-mono text-gray-300">
                {(pos.current_price * 100).toFixed(0)}c
              </td>
              <td className={`py-3 text-right font-mono font-semibold ${
                pos.pnl >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
