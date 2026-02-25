import React from "react";
import PlaceholderPage from "../components/ui/PlaceholderPage";

export default function Battle() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");
  const encounterId = params.get("encounterId");

  return (
    <PlaceholderPage
      title="Battle"
      description="Turn-based battle engine. Fight wild Pokémon and trainers."
      debugInfo={{ runId: runId || "none", encounterId: encounterId || "none" }}
    />
  );
}