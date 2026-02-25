import type { CalendarEvent, CalendarEventColor } from '@/types/calendar.types';

interface EventBandProps {
  event: CalendarEvent;
  startCol: number; // 0-6
  span: number; // nb colonnes
  lane: number; // position verticale (0, 1, 2...)
  isStart: boolean; // début de l'événement dans cette semaine
  isEnd: boolean; // fin de l'événement dans cette semaine
  onClick?: (event: CalendarEvent) => void;
  compact?: boolean;
}

const COLOR_CLASSES: Record<CalendarEventColor, { bg: string; border: string; text: string }> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-l-blue-600',
    text: 'text-blue-800',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-l-amber-500',
    text: 'text-amber-800',
  },
  gray: {
    bg: 'bg-slate-100',
    border: 'border-l-slate-500',
    text: 'text-slate-700',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-l-red-400',
    text: 'text-red-500 line-through',
  },
};

const LANE_HEIGHT = 24; // px par lane
const LANE_TOP_OFFSET = 30; // px (espace pour le numéro du jour : padding 4px + cercle today h-6=24px + 2px gap)

export default function EventBand({
  event,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  onClick,
  compact,
}: EventBandProps) {
  const colors = COLOR_CLASSES[event.color];

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `calc(${startCol} / 7 * 100%)`,
    width: `calc(${span} / 7 * 100%)`,
    top: `${LANE_TOP_OFFSET + lane * LANE_HEIGHT}px`,
    height: `${LANE_HEIGHT - 2}px`,
  };

  return (
    <button
      onClick={() => onClick?.(event)}
      className={`
        flex items-center overflow-hidden text-xs font-medium
        border-l-3 px-1.5
        ${colors.bg} ${colors.border} ${colors.text}
        ${isStart ? 'rounded-l-md' : ''}
        ${isEnd ? 'rounded-r-md' : ''}
        hover:brightness-95 transition-all cursor-pointer
      `}
      style={style}
      title={event.label}
    >
      <span className="truncate leading-tight">
        {compact ? event.labelShort : event.label}
      </span>
    </button>
  );
}

export { LANE_HEIGHT, LANE_TOP_OFFSET };
