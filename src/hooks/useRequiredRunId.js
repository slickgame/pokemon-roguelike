import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { clearActiveRunId, getActiveRunId, setActiveRunId } from "@/lib/activeRun";

export function useRequiredRunId({ page, toast }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  useEffect(() => {
    let mounted = true;
    if (runId) {
      setActiveRunId(runId);
      return;
    }

    const cachedRunId = getActiveRunId();
    if (cachedRunId) {
      navigate(createPageUrl(`${page}?runId=${cachedRunId}`));
      return;
    }

    base44.functions.invoke("getMyActiveRun", {})
      .then((res) => {
        if (!mounted) return;
        const activeRun = res.data?.run ?? null;
        if (activeRun?.id) {
          setActiveRunId(activeRun.id);
          navigate(createPageUrl(`${page}?runId=${activeRun.id}`));
          return;
        }
        toast?.("No active run.", "error");
        navigate(createPageUrl("Home"));
      })
      .catch(() => {
        if (!mounted) return;
        toast?.("No active run.", "error");
        navigate(createPageUrl("Home"));
      });

    return () => { mounted = false; };
  }, [runId, page]);

  const handleInvalidRun = () => {
    clearActiveRunId();
    toast?.("Run not found or expired.", "error");
    navigate(createPageUrl("Home"));
  };

  return { runId, handleInvalidRun };
}
