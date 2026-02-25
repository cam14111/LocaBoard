import type { Reservation, Blocage } from './database.types';

export type CalendarEventType = 'reservation' | 'option' | 'option_expired' | 'blocage';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  dateDebut: string; // 'YYYY-MM-DD'
  dateFin: string; // 'YYYY-MM-DD'
  label: string; // Nom complet locataire ou motif blocage
  labelShort: string; // Initiales (mobile)
  color: CalendarEventColor;
  raw: Reservation | Blocage;
}

export type CalendarEventColor = 'blue' | 'amber' | 'gray' | 'red';

export type ViewMode = 'month' | 'week';

export interface EventFilters {
  showReservations: boolean;
  showOptions: boolean;
  showBlocages: boolean;
}
