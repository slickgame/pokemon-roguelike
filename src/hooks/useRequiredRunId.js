import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { clearActiveRunId, getActiveRunId, setActiveRunId } from "@/lib/activeRun";

export function useRequiredRunId({ page, toast }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  useEffect(() => {
    if (runId) {
      setActiveRunId(runId);
      return;
    }
    const cachedRunId = getActiveRunId();
    if (cachedRunId) {
      navigate(createPageUrl(`${page}?runId=${cachedRunId}`));
      return;
    }
    toast?.("No active run.", "error");
    navigate(createPageUrl("Home"));
  }, [runId, page]);

  const handleInvalidRun = () => {
    clearActiveRunId();
    toast?.("Run not found or expired.", "error");
    navigate(createPageUrl("Home"));
  };

  return { runId, handleInvalidRun };
}
