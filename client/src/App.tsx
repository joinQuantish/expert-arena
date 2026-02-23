import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Leaderboard from "./pages/Leaderboard";
import ExpertDetail from "./pages/ExpertDetail";

export default function App() {
  const location = useLocation();
  const [agentCount, setAgentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((s) => setAgentCount(parseInt(s.total_experts) || null))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <nav className="border-b border-pn-border bg-pn-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-2xl">🏟️</span>
            <span className="text-xl font-bold text-[#E6E4E0]">Expert Arena</span>
          </Link>
          <div className="flex items-center gap-6">
            <NavLink to="/" current={location.pathname} exact>Home</NavLink>
            <NavLink to="/leaderboard" current={location.pathname}>Leaderboard</NavLink>
            <span className="text-sm text-pn-text-muted hidden sm:block">
              {agentCount ? `${agentCount} AI Agents` : "AI Agents"} Trading Polymarket
            </span>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/expert/:id" element={<ExpertDetail />} />
        </Routes>
      </main>
    </div>
  );
}

function NavLink({ to, current, children, exact }: { to: string; current: string; children: React.ReactNode; exact?: boolean }) {
  const active = exact ? current === to : current.startsWith(to);
  return (
    <Link
      to={to}
      className={`text-sm font-medium transition ${
        active ? "text-pn-accent" : "text-pn-text-muted hover:text-[#E6E4E0]"
      }`}
    >
      {children}
    </Link>
  );
}
