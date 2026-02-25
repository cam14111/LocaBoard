import { useState, useEffect, useCallback } from 'react';
import { getReservations, expireOptions } from '@/lib/api/reservations';
import { getBlocages } from '@/lib/api/blocages';
import type { Reservation, Blocage } from '@/types/database.types';
import type { CalendarEvent } from '@/types/calendar.types';

function getInitials(nom: string, prenom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

function normalizeReservation(r: Reservation): CalendarEvent | null {
  if (r.statut === 'CONFIRMEE') {
    return {
      id: r.id,
      type: 'reservation',
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
      label: `${r.locataire_prenom} ${r.locataire_nom}`,
      labelShort: getInitials(r.locataire_nom, r.locataire_prenom),
      color: 'blue',
      raw: r,
    };
  }
  if (r.statut === 'OPTION_ACTIVE') {
    return {
      id: r.id,
      type: 'option',
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
      label: `${r.locataire_prenom} ${r.locataire_nom} (option)`,
      labelShort: getInitials(r.locataire_nom, r.locataire_prenom),
      color: 'amber',
      raw: r,
    };
  }
  if (r.statut === 'OPTION_EXPIREE') {
    return {
      id: r.id,
      type: 'option_expired',
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
      label: `${r.locataire_prenom} ${r.locataire_nom} (expirée)`,
      labelShort: getInitials(r.locataire_nom, r.locataire_prenom),
      color: 'red',
      raw: r,
    };
  }
  return null;
}

const MOTIF_LABELS: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  USAGE_PERSO: 'Usage perso',
  AUTRE: 'Blocage',
};

function normalizeBlocage(b: Blocage): CalendarEvent {
  return {
    id: b.id,
    type: 'blocage',
    dateDebut: b.date_debut,
    dateFin: b.date_fin,
    label: b.notes || MOTIF_LABELS[b.motif] || b.motif,
    labelShort: b.motif.charAt(0),
    color: 'gray',
    raw: b,
  };
}

export function useCalendarEvents(
  logementId: string | null,
  dateRange: { from: string; to: string },
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      // Sweep options expirées uniquement si un logement spécifique est sélectionné
      if (logementId) {
        expireOptions(logementId).catch(() => {});
      }

      const [reservations, blocages] = await Promise.all([
        getReservations({
          logement_id: logementId || undefined,
          from: dateRange.from,
          to: dateRange.to,
          statuts: ['CONFIRMEE', 'OPTION_ACTIVE', 'OPTION_EXPIREE'],
        }),
        getBlocages({
          logement_id: logementId || undefined,
          from: dateRange.from,
          to: dateRange.to,
        }),
      ]);

      const normalized: CalendarEvent[] = [];
      for (const r of reservations) {
        const ev = normalizeReservation(r);
        if (ev) normalized.push(ev);
      }
      for (const b of blocages) {
        normalized.push(normalizeBlocage(b));
      }

      normalized.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
      return normalized;
    } catch (err) {
      console.error('Erreur chargement événements calendrier:', err);
      return [];
    }
  }, [logementId, dateRange.from, dateRange.to]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await refetch();
      if (!cancelled) {
        setEvents(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refetch]);

  // Wrap refetch pour mettre à jour le state
  const refetchAndUpdate = useCallback(async () => {
    const result = await refetch();
    setEvents(result);
    setLoading(false);
  }, [refetch]);

  return { events, loading, refetch: refetchAndUpdate };
}
