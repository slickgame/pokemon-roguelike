import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import PlaceholderPage from "../components/ui/PlaceholderPage";
import { Star } from "lucide-react";

export default function Seasons() {
  const [season, setSeason] = useState(null);

  useEffect(() => {
    base44.functions.invoke("getCurrentSeason", {})
      .then(res => setSeason(res.data))
      .catch(() => {});
  }, []);

  return (
    <PlaceholderPage
      title="Seasons"
      description="View current and past season info, rewards, and event details."
      debugInfo={season ? {
        seasonId: season.seasonId,
        state: season.state,
        dbVersionHash: season.dbVersionHash,
      } : null}
    />
  );
}