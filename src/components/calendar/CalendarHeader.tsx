import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useState } from 'react';
import { formatMonthYear, formatWeekRange, getWeekStart } from '@/lib/dateUtils';
import type { ViewMode, EventFilters } from '@/types/calendar.types';

interface CalendarHeaderProps {
  viewMode: ViewMode;
  currentDate: Date;
  filters: EventFilters;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onFiltersChange: (filters: EventFilters) => void;
}

const FILTER_ITEMS: { key: keyof EventFilters; label: string; dotClass: string }[] = [
  { key: 'showReservations', label: 'Réservations', dotClass: 'bg-status-confirmed' },
  { key: 'showOptions', label: 'Options', dotClass: 'bg-status-option' },
  { key: 'showBlocages', label: 'Blocages', dotClass: 'bg-status-blocked' },
];

export default function CalendarHeader({
  viewMode,
  currentDate,
  filters,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  onFiltersChange,
}: CalendarHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const title =
    viewMode === 'month'
      ? formatMonthYear(currentDate.getFullYear(), currentDate.getMonth())
      : formatWeekRange(getWeekStart(currentDate));

  function toggleFilter(key: keyof EventFilters) {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  }

  const activeFilterCount = FILTER_ITEMS.filter((f) => !filters[f.key]).length;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onToday}
          className="rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-slate-100 transition-colors"
        >
          Aujourd'hui
        </button>
        <button
          onClick={onNext}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
          aria-label="Suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Titre — pleine largeur sur mobile pour éviter la troncature */}
      <h1 className="order-first basis-full text-base font-semibold capitalize sm:order-none sm:basis-auto sm:flex-1 sm:min-w-0 sm:truncate sm:text-lg">
        {title}
      </h1>

      {/* Bascule mois/semaine */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => onViewModeChange('month')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            viewMode === 'month' ? 'bg-primary-600 text-white' : 'hover:bg-slate-50'
          }`}
        >
          Mois
        </button>
        <button
          onClick={() => onViewModeChange('week')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            viewMode === 'week' ? 'bg-primary-600 text-white' : 'hover:bg-slate-50'
          }`}
        >
          Semaine
        </button>
      </div>

      {/* Filtres — desktop inline, mobile dropdown */}
      <div className="hidden lg:flex items-center gap-3">
        {FILTER_ITEMS.map((f) => (
          <label
            key={f.key}
            className="flex items-center gap-1.5 cursor-pointer text-sm rounded focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-1"
          >
            <input
              type="checkbox"
              checked={filters[f.key]}
              onChange={() => toggleFilter(f.key)}
              className="sr-only"
            />
            <span
              className={`h-3 w-3 rounded-full ${f.dotClass} ${!filters[f.key] ? 'opacity-30' : ''}`}
            />
            <span className={!filters[f.key] ? 'text-slate-400 line-through' : ''}>
              {f.label}
            </span>
          </label>
        ))}
      </div>

      {/* Filtres — mobile dropdown */}
      <div className="relative lg:hidden">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors relative"
          aria-label="Filtres"
        >
          <Filter className="h-5 w-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {filtersOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 p-3 min-w-[180px]">
              {FILTER_ITEMS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 py-1.5 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters[f.key]}
                    onChange={() => toggleFilter(f.key)}
                    className="rounded border-slate-300"
                  />
                  <span className={`h-3 w-3 rounded-full ${f.dotClass}`} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
