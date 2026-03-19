import { useRef, useEffect, useState, useCallback, type RefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}

interface Position {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

/**
 * Popover générique rendu via portal (évite le clipping dans les parents overflow).
 * Desktop : positionné au-dessus ou en-dessous de l'ancre.
 * Mobile (<640px) : bottom-sheet pleine largeur.
 */
export default function Popover({ open, onClose, anchorRef, children, className = '' }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const stableOnClose = useCallback(() => onClose(), [onClose]);

  useClickOutside(panelRef, stableOnClose, open);

  // Calcul position
  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);

    if (mobile) {
      setPos(null);
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const panelHeight = 160; // estimation
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement = spaceBelow > panelHeight + 8 ? 'below' : 'above';

    const maxWidth = 320;
    let left = rect.left + rect.width / 2 - maxWidth / 2;
    // Garder dans le viewport
    left = Math.max(16, Math.min(left, window.innerWidth - maxWidth - 16));

    setPos({
      top: placement === 'below' ? rect.bottom + 8 : rect.top - panelHeight - 8,
      left,
      placement,
    });
  }, [open, anchorRef]);

  // Keyboard : Escape ferme
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus le panel à l'ouverture
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus({ preventScroll: true });
    }
  }, [open, pos]);

  if (!open) return null;

  const panel = isMobile ? (
    // Bottom-sheet mobile
    <>
      <div className="fixed inset-0 z-[59] bg-black/30" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl border-t border-slate-200 bg-white p-5 pb-8 shadow-xl safe-bottom outline-none ${className}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Aide</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </div>
    </>
  ) : (
    // Desktop popover
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      style={pos ? { position: 'fixed', top: pos.top, left: pos.left, maxWidth: 320 } : undefined}
      className={`z-[60] w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-lg outline-none ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Aide</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );

  return createPortal(panel, document.body);
}
