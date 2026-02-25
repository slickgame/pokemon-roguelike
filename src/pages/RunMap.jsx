import React from "react";
import PlaceholderPage from "../components/ui/PlaceholderPage";

export default function RunMap() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  return (
    <PlaceholderPage
      title="Run Map"
      description="Navigate through the run's node map. Choose your path wisely."
      debugInfo={{ runId: runId || "none" }}
    />
  );
}