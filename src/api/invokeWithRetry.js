import { createClient } from "@base44/sdk";
import { appParams } from "@/lib/app-params";

function createUnpinnedClient() {
  const token = appParams.token ?? (typeof window !== "undefined" ? window?.localStorage?.getItem("base44_access_token") : null);
  return createClient({
    appId: appParams.appId,
    token,
    serverUrl: "",
    requiresAuth: false,
    appBaseUrl: appParams.appBaseUrl,
  });
}

export async function invokeWithRetry(base44, fnName, payload, { retries = 2, delayMs = 700 } = {}) {
  let attemptedUnpinnedFallback = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await base44.functions.invoke(fnName, payload);
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const msg = body?.error || (typeof body === "string" ? body : body ? JSON.stringify(body) : e?.message || "Unknown error");

      if (status === 503 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (status === 404) {
        if (typeof window !== "undefined") {
          window?.localStorage?.removeItem("base44_functions_version");
        }

        if (!attemptedUnpinnedFallback) {
          attemptedUnpinnedFallback = true;
          try {
            const unpinnedClient = createUnpinnedClient();
            return await unpinnedClient.functions.invoke(fnName, payload);
          } catch (fallbackError) {
            const fallbackStatus = fallbackError?.response?.status;
            const fallbackBody = fallbackError?.response?.data;
            const fallbackMsg = fallbackBody?.error || (typeof fallbackBody === "string" ? fallbackBody : fallbackBody ? JSON.stringify(fallbackBody) : fallbackError?.message || "Unknown error");
            throw new Error(`[${fnName}] status=404 on pinned and fallback (status=${fallbackStatus ?? "?"}). Verify function is deployed in the current Base44 app. Details: ${fallbackMsg}`);
          }
        }
      }

      throw new Error(`[${fnName}] status=${status ?? "?"} ${msg}`);
    }
  }
}
