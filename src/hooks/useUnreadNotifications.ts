import { useState, useEffect, useCallback, useRef } from 'react';
import { getUnreadCount } from '@/lib/api/notifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

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
    if (!user) return;

    // Fetch initial
    let cancelled = false;
    const userId = user.id;
    (async () => {
      try {
        const c = await getUnreadCount(userId);
        if (!cancelled) setCount(c);
      } catch {
        // Non bloquant
      }
    })();

    // Realtime : mise à jour instantanée à chaque changement sur les notifications de l'utilisateur
    const channel = supabase
      .channel(`notifications-count-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        getUnreadCount(userId).then((c) => {
          if (!cancelled) setCount(c);
        }).catch(() => {});
      })
      .subscribe();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { count, refresh };
}
