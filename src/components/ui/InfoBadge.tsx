import { useState, useRef, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { helpContent } from '@/data/helpContent';
import Popover from './Popover';

interface InfoBadgeProps {
  /** Clé dans helpContent */
  helpKey: string;
}

/**
 * Pastille "i" contextuelle.
 * Clic → popover avec explication courte + lien optionnel vers le manuel.
 */
export default function InfoBadge({ helpKey }: InfoBadgeProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const entry = helpContent[helpKey];
  if (!entry) return null;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className="info-badge inline-flex items-center justify-center rounded-full p-0.5 border border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
        aria-label="Aide"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Info className="h-2.5 w-2.5" />
      </button>

      <Popover open={open} onClose={handleClose} anchorRef={btnRef}>
        <p>{entry.short}</p>
        {entry.doc && (
          <Link
            to={`/manuel#${entry.doc}`}
            onClick={handleClose}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            En savoir plus →
          </Link>
        )}
      </Popover>
    </>
  );
}
