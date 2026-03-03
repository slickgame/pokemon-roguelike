export async function invokeWithRetry(base44, fnName, payload, { retries = 2, delayMs = 700 } = {}) {
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
        if (typeof window !== "undefined" && window?.localStorage?.getItem("base44_functions_version")) {
          window.localStorage.removeItem("base44_functions_version");
        }
        throw new Error(`[${fnName}] status=404 ${fnName} not found. Cleared cached functions version; reload and retry.`);
      }

      throw new Error(`[${fnName}] status=${status ?? "?"} ${msg}`);
    }
  }
}
