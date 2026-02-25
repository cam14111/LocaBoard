import { useEffect, useRef } from 'react';
import { CalendarDays, Clock, Lock } from 'lucide-react';

export type DayActionChoice = 'reservation' | 'option' | 'blocage';

interface DayActionMenuProps {
  isOpen: boolean;
  anchorDate: Date | null;
  position: { x: number; y: number };
  onSelectAction: (action: DayActionChoice) => void;
  onClose: () => void;
}

const ACTIONS: { key: DayActionChoice; label: string; icon: typeof CalendarDays; colors: string }[] = [
  { key: 'reservation', label: 'Nouvelle réservation', icon: CalendarDays, colors: 'text-blue-600 hover:bg-blue-50' },
  { key: 'option', label: 'Nouvelle option', icon: Clock, colors: 'text-amber-600 hover:bg-amber-50' },
  { key: 'blocage', label: 'Nouveau blocage', icon: Lock, colors: 'text-slate-600 hover:bg-slate-50' },
];

export default function DayActionMenu({
  isOpen,
  position,
  onSelectAction,
  onClose,
}: DayActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture Escape + clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ajuster la position pour ne pas sortir de l'écran
  const menuWidth = 220;
  const menuHeight = 160;
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 16);
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 16);

  return (
    <>
      {/* Desktop : popup positionné */}
      <div
        ref={menuRef}
        className="hidden lg:block fixed z-50"
        style={{ left: adjustedX, top: adjustedY }}
      >
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 py-1 w-56 animate-in fade-in zoom-in-95 duration-150">
          {ACTIONS.map(({ key, label, icon: Icon, colors }) => (
            <button
              key={key}
              onClick={() => { onSelectAction(key); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${colors}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile : bottom sheet */}
      <div className="lg:hidden fixed inset-0 z-50">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8 space-y-2 animate-in slide-in-from-bottom duration-200">
          {ACTIONS.map(({ key, label, icon: Icon, colors }) => (
            <button
              key={key}
              onClick={() => { onSelectAction(key); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${colors}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="w-full text-center py-3 text-sm text-slate-400 font-medium"
          >
            Annuler
          </button>
        </div>
      </div>
    </>
  );
}
