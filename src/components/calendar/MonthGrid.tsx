import { useMemo } from 'react';
import { getMonthGrid, toDateString, getDayNameShort } from '@/lib/dateUtils';
import type { CalendarEvent, EventFilters } from '@/types/calendar.types';
import DayCell from './DayCell';
import EventBand, { LANE_HEIGHT, LANE_TOP_OFFSET } from './EventBand';

interface MonthGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  filters: EventFilters;
  onDayClick?: (date: Date, event?: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const MAX_VISIBLE_LANES = 3;

function filterEvents(events: CalendarEvent[], filters: EventFilters): CalendarEvent[] {
  return events.filter((e) => {
    if (e.type === 'reservation' && !filters.showReservations) return false;
    if (e.type === 'option' && !filters.showOptions) return false;
    if (e.type === 'option_expired' && !filters.showOptions) return false;
    if (e.type === 'blocage' && !filters.showBlocages) return false;
    return true;
  });
}

interface WeekEvent {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  isStart: boolean;
  isEnd: boolean;
}

function getWeekEvents(week: Date[], events: CalendarEvent[]): WeekEvent[] {
  const weekStartStr = toDateString(week[0]);
  const weekEndStr = toDateString(week[6]);
  const result: WeekEvent[] = [];

  for (const event of events) {
    if (event.dateFin < weekStartStr || event.dateDebut > weekEndStr) continue;

    let startCol = 0;
    let endCol = 6;
    let isStart = false;
    let isEnd = false;

    for (let c = 0; c < 7; c++) {
      if (toDateString(week[c]) >= event.dateDebut) {
        startCol = c;
        isStart = toDateString(week[c]) === event.dateDebut;
        break;
      }
    }

    for (let c = 6; c >= 0; c--) {
      if (toDateString(week[c]) <= event.dateFin) {
        endCol = c;
        isEnd = toDateString(week[c]) === event.dateFin;
        break;
      }
    }

    result.push({ event, startCol, endCol, isStart, isEnd });
  }

  return result;
}

interface LaneAssignment extends WeekEvent {
  lane: number;
  span: number;
}

function assignLanes(weekEvents: WeekEvent[]): LaneAssignment[] {
  const sorted = [...weekEvents].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return b.endCol - b.startCol - (a.endCol - a.startCol);
  });

  const laneEnds: number[] = [];
  const assignments: LaneAssignment[] = [];

  for (const item of sorted) {
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

export default function MonthGrid({
  year,
  month,
  events,
  filters,
  onDayClick,
  onEventClick,
}: MonthGridProps) {
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);
  const filtered = useMemo(() => filterEvents(events, filters), [events, filters]);

  const weeksData = useMemo(() => {
    return weeks.map((week) => {
      const weekEvents = getWeekEvents(week, filtered);
      const lanes = assignLanes(weekEvents);
      const maxLane = lanes.length > 0 ? Math.max(...lanes.map((l) => l.lane)) : -1;
      const visibleLanes = Math.min(maxLane + 1, MAX_VISIBLE_LANES);
      const overflow = maxLane + 1 > MAX_VISIBLE_LANES ? maxLane + 1 - MAX_VISIBLE_LANES : 0;
      return { week, lanes, visibleLanes, overflow };
    });
  }, [weeks, filtered]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* En-tête jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="py-2 text-center text-xs font-medium text-slate-500 uppercase">
            {getDayNameShort(i)}
          </div>
        ))}
      </div>

      {/* Semaines */}
      {weeksData.map(({ week, lanes, visibleLanes, overflow }, wi) => {
        const rowMinHeight = LANE_TOP_OFFSET + visibleLanes * LANE_HEIGHT + 8;

        return (
          <WeekRow
            key={wi}
            week={week}
            month={month}
            lanes={lanes}
            overflow={overflow}
            rowMinHeight={rowMinHeight}
            filtered={filtered}
            isLast={wi === weeksData.length - 1}
            onDayClick={onDayClick}
            onEventClick={onEventClick}
          />
        );
      })}
    </div>
  );
}

/** Ligne semaine : cellules jours + bandes événements en absolute */
function WeekRow({
  week,
  month,
  lanes,
  overflow,
  rowMinHeight,
  filtered,
  isLast,
  onDayClick,
  onEventClick,
}: {
  week: Date[];
  month: number;
  lanes: LaneAssignment[];
  overflow: number;
  rowMinHeight: number;
  filtered: CalendarEvent[];
  isLast: boolean;
  onDayClick?: (date: Date, event?: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  return (
    <div
      className={`relative ${!isLast ? 'border-b border-slate-100' : ''}`}
      style={{ minHeight: `${Math.max(rowMinHeight, 40)}px` }}
    >
      {/* Grille des jours */}
      <div className="grid grid-cols-7 h-full">
        {week.map((date, di) => {
          const dayStr = toDateString(date);
          const dayEvents = filtered.filter(
            (e) => e.dateDebut <= dayStr && e.dateFin >= dayStr,
          );

          return (
            <div key={di} className={di < 6 ? 'border-r border-slate-100' : ''}>
              <DayCell
                date={date}
                isCurrentMonth={date.getMonth() === month}
                events={dayEvents}
                onClick={onDayClick}
              />
            </div>
          );
        })}
      </div>

      {/* Bandes d'événements (desktop uniquement, position absolute) */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        {lanes
          .filter((la) => la.lane < MAX_VISIBLE_LANES)
          .map((la) => (
            <div key={la.event.id} className="pointer-events-auto">
              <EventBand
                event={la.event}
                startCol={la.startCol}
                span={la.span}
                lane={la.lane}
                isStart={la.isStart}
                isEnd={la.isEnd}
                onClick={onEventClick}
              />
            </div>
          ))}

        {overflow > 0 && (
          <div
            className="absolute text-xs text-slate-500 font-medium"
            style={{
              top: `${LANE_TOP_OFFSET + MAX_VISIBLE_LANES * LANE_HEIGHT}px`,
              right: '4px',
            }}
          >
            +{overflow} de plus
          </div>
        )}
      </div>
    </div>
  );
}
