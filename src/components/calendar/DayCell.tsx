import { isToday } from '@/lib/dateUtils';
import type { CalendarEvent, CalendarEventColor } from '@/types/calendar.types';

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  events: CalendarEvent[];
  onClick?: (date: Date, event?: React.MouseEvent) => void;
}

const DOT_COLORS: Record<CalendarEventColor, string> = {
  blue: 'bg-status-confirmed',
  amber: 'bg-status-option',
  gray: 'bg-status-blocked',
  red: 'bg-red-400',
};

export default function DayCell({ date, isCurrentMonth, events, onClick }: DayCellProps) {
  const today = isToday(date);
  const day = date.getDate();

  // Dots uniques par couleur (mobile)
  const uniqueColors = [...new Set(events.map((e) => e.color))].slice(0, 3);

  const ariaLabel = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <button
      onClick={(e) => onClick?.(date, e)}
      aria-label={ariaLabel}
      className={`
        relative w-full flex flex-col items-start p-1 min-h-[40px] lg:min-h-[100px]
        transition-colors hover:bg-slate-50
        ${!isCurrentMonth ? 'text-slate-300' : ''}
      `}
    >
      {/* Numéro du jour */}
      <span
        className={`
          inline-flex items-center justify-center text-sm leading-none
          ${today ? 'h-6 w-6 rounded-full bg-primary-600 text-white font-semibold' : 'font-medium'}
        `}
      >
        {day}
      </span>

      {/* Dots colorés + compteur (mobile uniquement) */}
      {events.length > 0 && (
        <div className="flex items-center gap-0.5 mt-0.5 lg:hidden">
          {uniqueColors.map((color) => (
            <span key={color} className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[color]}`} />
          ))}
          {events.length > 1 && (
            <span className="text-[9px] leading-none text-slate-400 ml-0.5">{events.length}</span>
          )}
        </div>
      )}
    </button>
  );
}

export { DOT_COLORS };
