import { useState, useEffect, useCallback, useRef } from 'react';
import { getUnreadCount } from '@/lib/api/notifications';
import { useAuth } from '@/hooks/useAuth';

/** Hook pour le polling du compteur de notifications non-lues */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const c = await getUnreadCount(user.id);
      if (mountedRef.current) setCount(c);
    } catch {
      // Non bloquant
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch initial
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const c = await getUnreadCount(user.id);
        if (!cancelled) setCount(c);
      } catch {
        // Non bloquant
      }
    })();

    // Polling toutes les 60s
    const interval = setInterval(() => {
      if (!user) return;
      getUnreadCount(user.id).then((c) => {
        if (!cancelled) setCount(c);
      }).catch(() => {});
    }, 60_000);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [user]);

  return { count, refresh };
}
