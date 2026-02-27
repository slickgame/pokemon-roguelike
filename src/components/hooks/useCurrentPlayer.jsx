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

        // Check authentication
        const isAuthenticated = await base44.auth.isAuthenticated();
        if (!isAuthenticated) {
          if (mounted) {
            setUser(null);
            setPlayer(null);
            setLoading(false);
          }
          return;
        }

        // Get authenticated user
        const currentUser = await base44.auth.me();
        if (mounted) {
          setUser(currentUser);
        }

        // Initialize/fetch player
        const res = await base44.functions.invoke('initializePlayer');
        if (mounted) {
          setPlayer(res.data.player);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load player');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPlayer();

    return () => {
      mounted = false;
    };
  }, []);

  return { player, user, loading, error };
}