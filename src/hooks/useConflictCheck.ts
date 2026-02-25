import { useState, useEffect } from 'react';
import { getReservationsByLogement } from '@/lib/api/reservations';
import { getBlocagesByLogement } from '@/lib/api/blocages';
import { formatDateFR } from '@/lib/dateUtils';

export interface ConflictInfo {
  type: 'reservation' | 'blocage';
  label: string;
}

/**
 * Vérifie en temps réel si un créneau est en conflit avec des réservations
 * ou blocages existants pour un logement donné.
 */
export function useConflictCheck(
  logementId: string,
  dateDebut: string,
  dateFin: string,
): { conflict: ConflictInfo | null; checking: boolean } {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!logementId || !dateDebut || !dateFin) {
      setConflict(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    async function check() {
      try {
        const [reservations, blocages] = await Promise.all([
          getReservationsByLogement(logementId, { from: dateDebut, to: dateFin }),
          getBlocagesByLogement(logementId, { from: dateDebut, to: dateFin }),
        ]);

        if (cancelled) return;

        // Exclure les réservations annulées ou options expirées
        const actives = reservations.filter(
          (r) => r.statut !== 'ANNULEE' && r.statut !== 'OPTION_EXPIREE',
        );

        // Overlap strict : debut_existant < dateFin ET fin_existant > dateDebut
        const r = actives.find((r) => r.date_debut < dateFin && r.date_fin > dateDebut);
        if (r) {
          setConflict({
            type: 'reservation',
            label: `Conflit avec ${r.locataire_prenom} ${r.locataire_nom} · ${formatDateFR(r.date_debut)} → ${formatDateFR(r.date_fin)}`,
          });
          return;
        }

        const b = blocages.find((b) => b.date_debut < dateFin && b.date_fin > dateDebut);
        if (b) {
          setConflict({
            type: 'blocage',
            label: `Conflit avec un blocage · ${formatDateFR(b.date_debut)} → ${formatDateFR(b.date_fin)}`,
          });
          return;
        }

        setConflict(null);
      } catch {
        setConflict(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [logementId, dateDebut, dateFin]);

  return { conflict, checking };
}
