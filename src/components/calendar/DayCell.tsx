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
        relative w-full h-full min-h-[56px] lg:min-h-0
        transition-colors hover:bg-slate-50
        ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-900'}
      `}
    >
      {/* Cercle "aujourd'hui" — derrière le numéro, même ancrage */}
      {today && (
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 h-6 w-6 rounded-full bg-primary-600"
        />
      )}

      {/* Numéro du jour — ancrage fixe top-left */}
      <span
        className={`
          absolute top-1 left-1
          inline-flex items-center justify-center h-6 w-6
          text-sm leading-none z-10
          ${today ? 'font-semibold text-white' : 'font-medium'}
        `}
      >
        {day}
      </span>

      {/* Dots colorés — ancrage fixe bottom-left (mobile uniquement) */}
      <div className="absolute bottom-1.5 left-1 flex items-center gap-0.5 lg:hidden">
        {uniqueColors.map((color) => (
          <span key={color} className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[color]}`} />
        ))}
        {events.length > 1 && (
          <span className="text-[9px] leading-none text-slate-400 ml-0.5">{events.length}</span>
        )}
      </div>
    </button>
  );
}

export { DOT_COLORS };
