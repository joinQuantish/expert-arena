import { Routes, Route, Link } from "react-router-dom";
import Leaderboard from "./pages/Leaderboard";
import ExpertDetail from "./pages/ExpertDetail";

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-2xl">🏟️</span>
            <span className="text-xl font-bold text-white">Expert Arena</span>
          </Link>
          <span className="text-sm text-gray-500">
            10 AI Agents Trading Polymarket
          </span>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/expert/:id" element={<ExpertDetail />} />
        </Routes>
      </main>
    </div>
  );
}
