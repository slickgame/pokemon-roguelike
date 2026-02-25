import React from "react";
import PlaceholderPage from "../components/ui/PlaceholderPage";

export default function StarterSelect() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  return (
    <PlaceholderPage
      title="Starter Select"
      description="Choose your starter Pokémon to begin your run."
      debugInfo={{ runId: runId || "none" }}
    />
  );
}