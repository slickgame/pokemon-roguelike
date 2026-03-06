import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useCurrentPlayer() {
  const [player, setPlayer] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    let mounted = true;

    async function loadPlayer() {
      try {
        setLoading(true);
        setError(null);

        const isAuthenticated = await base44.auth.isAuthenticated();
        if (!isAuthenticated) {
          if (mounted) {
            setUser(null);
            setPlayer(null);
            setLoading(false);
          }
          return;
        }

        const currentUser = await base44.auth.me();
        if (mounted) setUser(currentUser);

        // Primary path: initialize or repair profile
        try {
          const res = await base44.functions.invoke('initializePlayer');
          const initializedPlayer = res?.data?.player ?? null;
          if (mounted && initializedPlayer) {
            setPlayer(initializedPlayer);
            setError(null);
            return;
          }
          if (mounted) setError('Could not initialize player profile.');
        } catch (initErr) {
          if (mounted) {
            setError('Could not initialize player profile.');
            console.error('initializePlayer failed:', initErr);
          }
        }

        // Fallback path: query Player directly
        const rows = await base44.entities.Player.filter({ authUserId: currentUser.id }).catch(() => []);
        if (mounted && rows?.[0]) {
          setPlayer(rows[0]);
          setError(null);
          return;
        }

        if (mounted) {
          setPlayer(null);
          setError('Could not load your trainer profile. Please retry.');
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Failed to load player');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPlayer();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  return { player, user, loading, error, refresh };
}
