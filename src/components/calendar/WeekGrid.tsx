import { useMemo } from 'react';
import { getWeekDays, toDateString, isToday, getDayNameShort } from '@/lib/dateUtils';
import type { CalendarEvent, EventFilters, CalendarEventColor } from '@/types/calendar.types';
import EventBand, { LANE_HEIGHT, LANE_TOP_OFFSET } from './EventBand';

interface WeekGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  filters: EventFilters;
  onDayClick?: (date: Date, event?: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const MAX_VISIBLE_LANES = 5;

function filterEvents(events: CalendarEvent[], filters: EventFilters): CalendarEvent[] {
  return events.filter((e) => {
    if (e.type === 'reservation' && !filters.showReservations) return false;
    if (e.type === 'option' && !filters.showOptions) return false;
    if (e.type === 'option_expired' && !filters.showOptions) return false;
    if (e.type === 'blocage' && !filters.showBlocages) return false;
    return true;
  });
}

interface LaneAssignment {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  span: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
}

function assignLanes(days: Date[], events: CalendarEvent[]): LaneAssignment[] {
  const dayStrs = days.map(toDateString);
  const weekItems: {
    event: CalendarEvent;
    startCol: number;
    endCol: number;
    isStart: boolean;
    isEnd: boolean;
  }[] = [];

  for (const event of events) {
    if (event.dateFin < dayStrs[0] || event.dateDebut > dayStrs[6]) continue;

    let startCol = 0;
    let endCol = 6;
    let isStart = false;
    let isEnd = false;

    for (let c = 0; c < 7; c++) {
      if (dayStrs[c] >= event.dateDebut) {
        startCol = c;
        isStart = dayStrs[c] === event.dateDebut;
        break;
      }
    }

    for (let c = 6; c >= 0; c--) {
      if (dayStrs[c] <= event.dateFin) {
        endCol = c;
        isEnd = dayStrs[c] === event.dateFin;
        break;
      }
    }

    weekItems.push({ event, startCol, endCol, isStart, isEnd });
  }

  // Trier par début puis durée décroissante
  weekItems.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return (b.endCol - b.startCol) - (a.endCol - a.startCol);
  });

  const laneEnds: number[] = [];
  const assignments: LaneAssignment[] = [];

  for (const item of weekItems) {
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < item.startCol) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(-1);
    }
    laneEnds[lane] = item.endCol;

    assignments.push({
      ...item,
      lane,
      span: item.endCol - item.startCol + 1,
    });
  }

  return assignments;
}

const COLOR_CLASSES: Record<CalendarEventColor, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  gray: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  red: { bg: 'bg-red-50', text: 'text-red-500 line-through', border: 'border-red-200' },
};

export default function WeekGrid({
  weekStart,
  events,
  filters,
  onDayClick,
  onEventClick,
}: WeekGridProps) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const filtered = useMemo(() => filterEvents(events, filters), [events, filters]);
  const lanes = useMemo(() => assignLanes(days, filtered), [days, filtered]);

  const maxLane = lanes.length > 0 ? Math.max(...lanes.map((l) => l.lane)) : -1;
  const visibleLanes = Math.min(maxLane + 1, MAX_VISIBLE_LANES);
  const rowMinHeight = LANE_TOP_OFFSET + visibleLanes * LANE_HEIGHT + 16;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Desktop : grille 7 colonnes avec bandes */}
      <div className="hidden lg:block">
        {/* En-tête */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {days.map((date, i) => {
            const today = isToday(date);
            return (
              <div key={i} className="py-2 text-center">
                <div className="text-xs font-medium text-slate-500 uppercase">
                  {getDayNameShort(i)}
                </div>
                <button
                  onClick={(e) => onDayClick?.(date, e)}
                  className={`
                    mt-1 inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold
                    ${today ? 'bg-primary-600 text-white' : 'hover:bg-slate-100'}
                  `}
                >
                  {date.getDate()}
                </button>
              </div>
            );
          })}
        </div>

        {/* Zone des bandes */}
        <div className="relative" style={{ minHeight: `${Math.max(rowMinHeight, 60)}px` }}>
          {/* Colonnes de fond */}
          <div className="absolute inset-0 grid grid-cols-7">
            {days.map((date, i) => (
              <button
                key={i}
                onClick={(e) => onDayClick?.(date, e)}
                className={`h-full ${i < 6 ? 'border-r border-slate-100' : ''} hover:bg-slate-50/50 transition-colors`}
              />
            ))}
          </div>

          {/* Bandes d'événements */}
          {lanes
            .filter((la) => la.lane < MAX_VISIBLE_LANES)
            .map((la) => (
              <EventBand
                key={la.event.id}
                event={la.event}
                startCol={la.startCol}
                span={la.span}
                lane={la.lane}
                isStart={la.isStart}
                isEnd={la.isEnd}
                onClick={onEventClick}
              />
            ))}
        </div>
      </div>

      {/* Mobile : vue liste empilée */}
      <div className="lg:hidden divide-y divide-slate-100">
        {days.map((date, i) => {
          const dayStr = toDateString(date);
          const dayEvents = filtered.filter(
            (e) => e.dateDebut <= dayStr && e.dateFin >= dayStr,
          );
          const today = isToday(date);

          return (
            <div key={i} className="p-3">
              <button
                onClick={(e) => onDayClick?.(date, e)}
                className="flex items-center gap-2 mb-2 w-full text-left"
              >
                <span
                  className={`
                    inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold
                    ${today ? 'bg-primary-600 text-white' : ''}
                  `}
                >
                  {date.getDate()}
                </span>
                <span className="text-sm text-slate-500 capitalize">
                  {getDayNameShort(i)}
                </span>
              </button>

              {dayEvents.length === 0 && (
                <p className="text-xs text-slate-300 pl-10">Aucun événement</p>
              )}

              {dayEvents.map((ev) => {
                const colors = COLOR_CLASSES[ev.color];
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className={`
                      ml-10 mb-1 w-[calc(100%-2.5rem)] text-left rounded-lg px-3 py-1.5 text-sm
                      border ${colors.bg} ${colors.text} ${colors.border}
                    `}
                  >
                    {ev.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
