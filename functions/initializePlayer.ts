import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find player by authUserId (canonical identity)
    const existingPlayers = await base44.entities.Player.filter({ authUserId: user.id });

    if (existingPlayers.length > 0) {
      return Response.json({ player: existingPlayers[0], created: false });
    }

    // Create new player with authUserId
    const newPlayer = await base44.entities.Player.create({
      authUserId: user.id,
      displayName: user.full_name || user.email.split('@')[0] || "Trainer",
      aether: 0,
      avatarUrl: null,
    });

    return Response.json({ player: newPlayer, created: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});