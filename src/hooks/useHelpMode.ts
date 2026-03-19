import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'locaboard_help_mode';

/**
 * Gère le mode "aide renforcée".
 * Synchronise un attribut data-help-mode sur <body> pour le ciblage CSS (halo glow).
 * Persiste l'état dans localStorage.
 */
export function useHelpMode() {
  const [helpMode, setHelpMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sync body attribute on mount
  useEffect(() => {
    document.body.setAttribute('data-help-mode', String(helpMode));
  }, [helpMode]);

  const toggleHelpMode = useCallback(() => {
    setHelpMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* silencieux */
      }
      return next;
    });
  }, []);

  return { helpMode, toggleHelpMode };
}
