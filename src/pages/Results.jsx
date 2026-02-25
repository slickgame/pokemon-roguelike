import React from "react";
import PlaceholderPage from "../components/ui/PlaceholderPage";

export default function Results() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  return (
    <PlaceholderPage
      title="Results"
      description="Run complete! View your score, Aether earned, and final team."
      debugInfo={{ runId: runId || "none" }}
    />
  );
}