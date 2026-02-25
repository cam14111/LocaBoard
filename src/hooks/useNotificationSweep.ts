import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { runNotificationSweeps } from '@/lib/notificationTriggers';

const SWEEP_INTERVAL = 5 * 60_000; // 5 minutes

/** Hook qui exécute les sweeps de notifications périodiquement */
export function useNotificationSweep() {
  const { user } = useAuth();
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const sweep = async () => {
      if (cancelled) return;
      const now = Date.now();
      // Garde-fou : pas plus d'un sweep par intervalle
      if (now - lastRunRef.current < SWEEP_INTERVAL - 1000) return;
      lastRunRef.current = now;
      try {
        await runNotificationSweeps(user.id);
      } catch {
        // Non bloquant
      }
    };

    // Sweep initial (délai 3s pour ne pas bloquer le premier render)
    const timeout = setTimeout(sweep, 3000);

    // Sweep périodique
    const interval = setInterval(sweep, SWEEP_INTERVAL);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user]);
}
