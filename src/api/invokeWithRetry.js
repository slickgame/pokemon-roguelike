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
        throw new Error(`[${fnName}] status=404 ${fnName} not found. Check Base44 Functions deployment and naming.`);
      }

      throw new Error(`[${fnName}] status=${status ?? "?"} ${msg}`);
    }
  }
}
