import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Swords, Trophy, Home, Menu, X, ChevronRight, Beaker, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { runApi } from "@/components/api/runApi";
import { resumeActiveRun } from "@/lib/resumeRun";
import { clearActiveRunId, setActiveRunId } from "@/lib/activeRun";
import PartyHUD from "@/components/ui/PartyHUD";

const STATIC_LINKS = [
  { label: "Home", page: "Home", icon: Home },
  { label: "Leaderboard", page: "Leaderboard", icon: Trophy },
  { label: "Dev", page: "DevPanel", icon: Beaker },
];

export default function AppShell({ children, currentPageName }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [activeRunId, setActiveRunIdState] = useState(null);
  const [partyState, setPartyState] = useState([]);

  // Strip functions_version from URL so it doesn't pin the app to a stale deployment
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("functions_version")) {
      url.searchParams.delete("functions_version");
      history.replaceState(null, "", url.toString());
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    runApi.getMyActiveRun()
      .then((run) => {
        if (!mounted) return;
        setHasActiveRun(!!run);
        if (run?.id) {
          setActiveRunId(run.id);
          setActiveRunIdState(run.id);
          const party = run.results?.progress?.partyState ?? [];
          setPartyState(party.slice(0, 6));
        } else {
          clearActiveRunId();
          setActiveRunIdState(null);
          setPartyState([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setHasActiveRun(false);
        setPartyState([]);
      });
    return () => { mounted = false; };
  }, [currentPageName]);

  const handleContinue = async () => {
    const run = await resumeActiveRun({ base44, navigate });
    if (!run) {
      setHasActiveRun(false);
      clearActiveRunId();
      return;
    }
    setHasActiveRun(true);
  };


  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0d0d1a]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-violet-300 transition-colors">PokéRogue</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {STATIC_LINKS.map(({ label, page, icon: Icon }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentPageName === page ? "bg-violet-600/20 text-violet-300" : "text-white/50 hover:text-white/90 hover:bg-white/5"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {hasActiveRun && partyState.length > 0 && (
              <div className="hidden md:block">
                <PartyHUD party={partyState} runId={activeRunId} />
              </div>
            )}
            {hasActiveRun && (
              <button onClick={handleContinue} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/30">
                <Play className="w-3.5 h-3.5" />
                Continue Run
              </button>
            )}
            
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-[#0d0d1a]/95 backdrop-blur-md p-4">
          <nav className="flex flex-col gap-1 mt-2">
            {STATIC_LINKS.map(({ label, page, icon: Icon }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentPageName === page ? "bg-violet-600/20 text-violet-300" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Link>
            ))}
            {hasActiveRun && (
              <button
                onClick={() => { setMobileOpen(false); handleContinue(); }}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-emerald-300 border border-emerald-500/30"
              >
                <div className="flex items-center gap-3"><Play className="w-4 h-4" />Continue Run</div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
            )}
            
          </nav>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/5 py-4 px-4 text-center text-white/20 text-xs">PokéRogue v0.0.1 · M0 Skeleton</footer>
    </div>
  );
}