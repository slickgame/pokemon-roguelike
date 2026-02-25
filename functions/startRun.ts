import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// DB version manifest — update these when game data changes
const MANIFEST = {
  dbVersionSemantic: "0.1.0",
  dbVersionHash: "m1a2b3c4d5e6f7a8b9c0",
};

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