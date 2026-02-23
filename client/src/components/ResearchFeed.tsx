import { useEffect, useState } from "react";

interface ResearchLog {
  id: number;
  summary: string;
  trades_made: string;
  positions_exited: string;
  next_moves: string;
  timestamp: string;
}

export default function ResearchFeed({ expertId }: { expertId: string }) {
  const [logs, setLogs] = useState<ResearchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/experts/${expertId}/research?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      });
  }, [expertId]);

  if (loading) return <div className="text-gray-500 py-4">Loading research...</div>;

  if (logs.length === 0) {
    return (
      <div className="text-gray-500 py-8 text-center">
        No research reports yet. Waiting for first automation cycle.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div
          key={log.id}
          className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {log.summary && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Research</div>
              <p className="text-sm text-gray-300">{log.summary}</p>
            </div>
          )}

          {log.trades_made && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trades</div>
              <p className="text-sm text-gray-400 font-mono whitespace-pre-wrap">{log.trades_made}</p>
            </div>
          )}

          {log.positions_exited && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Exited</div>
              <p className="text-sm text-gray-400 font-mono whitespace-pre-wrap">{log.positions_exited}</p>
            </div>
          )}

          {log.next_moves && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Next Moves</div>
              <p className="text-sm text-gray-400">{log.next_moves}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
