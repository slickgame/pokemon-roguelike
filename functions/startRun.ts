import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── DB manifest (single source of truth) ─────────────────────────────────────
// This must match components/db/manifest.json exactly.
const MANIFEST = {
  dbVersionSemantic: "0.0.1",
  dbVersionHash: "4a2b7f3e8c1d9a5b6f0e2c4d7a1b3e5f",
};
// ─────────────────────────────────────────────────────────────────────────────


async function getNewestActiveRun(base44, playerId) {
  const runs = await base44.entities.Run.filter({ playerId, status: "active" });
  if (!runs?.length) return null;
  return [...runs].sort((a, b) => {
    const at = new Date(a.startedAt ?? a.created_date ?? 0).getTime();
    const bt = new Date(b.startedAt ?? b.created_date ?? 0).getTime();
    return bt - at;
  })[0];
}

function generateSeed() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { isRanked = false, modifierIds = [] } = body;

    const existingActiveRun = await getNewestActiveRun(base44, user.id);
    if (existingActiveRun) {
      return Response.json({ error: "ACTIVE_RUN_EXISTS", runId: existingActiveRun.id }, { status: 409 });
    }

    const seed = generateSeed();
    const modifiers = modifierIds.reduce((acc, id) => ({ ...acc, [id]: true }), {});

    const run = await base44.entities.Run.create({
      playerId: user.id,
      seed,
      dbVersionSemantic: MANIFEST.dbVersionSemantic,
      dbVersionHash: MANIFEST.dbVersionHash,
      isRanked,
      status: "active",
      modifiers,
      nextActionIdx: 0,
      startedAt: new Date().toISOString(),
    });

    return Response.json({
      runId: run.id,
      seed: run.seed,
      dbVersionSemantic: run.dbVersionSemantic,
      dbVersionHash: run.dbVersionHash,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});