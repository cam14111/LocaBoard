import { useState, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import {
  getMonthRange,
  getWeekRange,
  getWeekStart,
  addMonths,
  addWeeks,
} from '@/lib/dateUtils';
import type { ViewMode, EventFilters, CalendarEvent } from '@/types/calendar.types';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import MonthGrid from '@/components/calendar/MonthGrid';
import WeekGrid from '@/components/calendar/WeekGrid';
import ReservationModal from '@/components/calendar/ReservationModal';
import DayActionMenu, { type DayActionChoice } from '@/components/calendar/DayActionMenu';
import BlocageModal from '@/components/calendar/BlocageModal';
import EventDetailPanel from '@/components/calendar/EventDetailPanel';

export default function Calendar() {
  const { selectedLogementId, logements } = useSelectedLogement();
  const currentLogement = logements.find((l) => l.id === selectedLogementId);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [filters, setFilters] = useState<EventFilters>({
    showReservations: true,
    showOptions: true,
    showBlocages: true,
  });

  // Menu action jour
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [dayMenuPosition, setDayMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<'reservation' | 'option' | 'blocage' | null>(null);

  // Panneau détail événement
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Calcul du range de dates pour l'API
  const dateRange = useMemo(() => {
    if (viewMode === 'month') {
      return getMonthRange(currentDate.getFullYear(), currentDate.getMonth());
    }
    return getWeekRange(currentDate);
  }, [viewMode, currentDate]);

  const { events, loading, refetch } = useCalendarEvents(selectedLogementId, dateRange);

  // Navigation
  const handlePrev = useCallback(() => {
    setCurrentDate((d) => (viewMode === 'month' ? addMonths(d, -1) : addWeeks(d, -1)));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate((d) => (viewMode === 'month' ? addMonths(d, 1) : addWeeks(d, 1)));
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Clic sur un jour → ouvrir DayActionMenu
  const handleDayClick = useCallback((date: Date, event?: React.MouseEvent) => {
    setSelectedDate(date);
    if (event) {
      setDayMenuPosition({ x: event.clientX, y: event.clientY });
    } else {
      // Fallback centre écran
      setDayMenuPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    }
    setDayMenuOpen(true);
  }, [selectedLogementId]);

  // Choix dans le menu action jour
  const handleDayAction = useCallback((action: DayActionChoice) => {
    setActiveModal(action);
  }, []);

  // Clic sur un événement → ouvrir le panneau détail
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  // Callback après création/modification → refresh
  const handleCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col h-full">
      {/* Header navigation + filtres */}
      <CalendarHeader
        viewMode={viewMode}
        currentDate={currentDate}
        filters={filters}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={setViewMode}
        onFiltersChange={setFilters}
      />

      {/* Contenu calendrier */}
      <div className="flex-1 overflow-auto p-4">
        {loading && events.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : viewMode === 'month' ? (
          <MonthGrid
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            events={events}
            filters={filters}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        ) : (
          <WeekGrid
            weekStart={getWeekStart(currentDate)}
            events={events}
            filters={filters}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Menu action jour (choix réservation/option/blocage) */}
      <DayActionMenu
        isOpen={dayMenuOpen}
        anchorDate={selectedDate}
        position={dayMenuPosition}
        onSelectAction={handleDayAction}
        onClose={() => setDayMenuOpen(false)}
      />

      {/* Modal création réservation */}
      <ReservationModal
        isOpen={activeModal === 'reservation'}
        onClose={() => setActiveModal(null)}
        onCreated={handleCreated}
        logementId={selectedLogementId}
        initialDate={selectedDate}
        mode="reservation"
      />

      {/* Modal création option */}
      <ReservationModal
        isOpen={activeModal === 'option'}
        onClose={() => setActiveModal(null)}
        onCreated={handleCreated}
        logementId={selectedLogementId}
        initialDate={selectedDate}
        mode="option"
        optionExpirationDays={currentLogement?.duree_expiration_option_jours ?? 7}
      />

      {/* Modal création blocage */}
      <BlocageModal
        isOpen={activeModal === 'blocage'}
        onClose={() => setActiveModal(null)}
        onCreated={handleCreated}
        logementId={selectedLogementId}
        initialDate={selectedDate}
      />

      {/* Panneau détail événement */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onUpdated={handleCreated}
        logementId={selectedLogementId}
        logements={logements}
      />
    </div>
  );
}
