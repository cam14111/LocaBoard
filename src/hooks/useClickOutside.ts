import { useEffect, type RefObject } from 'react';

/**
 * Ferme un élément (popover, menu…) au clic en dehors du ref.
 * Pattern extrait de Header.tsx pour réutilisation.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [ref, handler, active]);
}
