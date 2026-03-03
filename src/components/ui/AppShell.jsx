import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Swords, Map, Trophy, Star, Home, Menu, X, Users, ChevronRight, Beaker } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", page: "Home", icon: Home },
  { label: "Starter Select", page: "StarterSelect", icon: Star },
  { label: "Run Map", page: "RunMap", icon: Map },
  { label: "Battle", page: "Battle", icon: Swords },
  { label: "Results", page: "Results", icon: Trophy },
  { label: "Leaderboard", page: "Leaderboard", icon: Trophy },
  { label: "Carryover Roster", page: "CarryoverRoster", icon: Users },
  { label: "Seasons", page: "Seasons", icon: Star },
  { label: "Dev Panel", page: "DevPanel", icon: Beaker },
];

export default function AppShell({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Strip functions_version from URL so it doesn't pin the app to a stale deployment
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("functions_version")) {
      url.searchParams.delete("functions_version");
      history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0d0d1a]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-violet-300 transition-colors">
              PokéRogue
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.slice(0, 5).map(({ label, page, icon: Icon }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${currentPageName === page
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-white/50 hover:text-white/90 hover:bg-white/5"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              to={createPageUrl("Leaderboard")}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${currentPageName === "Leaderboard"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-white/50 hover:text-amber-300/70 hover:bg-white/5"
                }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </Link>
            <Link
              to={createPageUrl("DevPanel")}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${currentPageName === "DevPanel"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-white/50 hover:text-emerald-300/70 hover:bg-white/5"
                }`}
            >
              <Beaker className="w-3.5 h-3.5" />
              Dev
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-[#0d0d1a]/95 backdrop-blur-md p-4">
          <nav className="flex flex-col gap-1 mt-2">
            {NAV_LINKS.map(({ label, page, icon: Icon }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${currentPageName === page
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-4 text-center text-white/20 text-xs">
        PokéRogue v0.0.1 · M0 Skeleton
      </footer>
    </div>
  );
}