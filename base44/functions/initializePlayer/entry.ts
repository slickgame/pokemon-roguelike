import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function pickDisplayName(user: any) {
  return user?.full_name || user?.email?.split('@')?.[0] || user?.name || 'Trainer';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const displayName = pickDisplayName(user);

    // Canonical lookup: authUserId
    try {
      const existingPlayers = await base44.entities.Player.filter({ authUserId: user.id });
      if (existingPlayers?.length > 0) {
        return Response.json({ player: existingPlayers[0], created: false, repaired: false });
      }
    } catch (error) {
      console.warn('[initializePlayer] canonical lookup failed, falling back to legacy search:', String((error as any)?.message || error));
    }

    // Legacy fallback search for records that predate authUserId
    try {
      let legacyPlayers: any[] = [];
      if (typeof (base44.entities.Player as any).list === 'function') {
        legacyPlayers = await (base44.entities.Player as any).list();
      } else {
        legacyPlayers = await base44.entities.Player.filter({});
      }

      const legacyMatch = (legacyPlayers ?? []).find((p: any) =>
        (p && p.displayName && p.displayName === displayName) ||
        (p && p.created_by && p.created_by === user.id)
      );

      if (legacyMatch) {
        const repaired = await base44.entities.Player.update(legacyMatch.id, {
          authUserId: user.id,
          displayName: legacyMatch.displayName || displayName,
        });
        return Response.json({ player: repaired, created: false, repaired: true });
      }
    } catch (error) {
      console.warn('[initializePlayer] legacy fallback failed:', String((error as any)?.message || error));
    }

    // Create new player with robust error response
    try {
      const newPlayer = await base44.entities.Player.create({
        authUserId: user.id,
        displayName,
        aether: 0,
        avatarUrl: null,
      });

      return Response.json({ player: newPlayer, created: true, repaired: false });
    } catch (error) {
      return Response.json(
        { error: 'initializePlayer:create failed: ' + String((error as any)?.message || error) },
        { status: 500 },
      );
    }
  } catch (error) {
    return Response.json(
      { error: 'initializePlayer:unexpected failed: ' + String((error as any)?.message || error) },
      { status: 500 },
    );
  }
});
