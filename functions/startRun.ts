import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DB_VERSION_SEMANTIC = "0.0.1";
const DB_VERSION_HASH = "abc123def456";

function generateSeed() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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

    const seed = generateSeed();
    const modifiers = modifierIds.reduce((acc, id) => ({ ...acc, [id]: true }), {});

    const run = await base44.entities.Run.create({
      playerId: user.id,
      seed,
      dbVersionSemantic: DB_VERSION_SEMANTIC,
      dbVersionHash: DB_VERSION_HASH,
      isRanked,
      status: "active",
      modifiers,
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