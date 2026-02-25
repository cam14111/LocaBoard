import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getLogements } from '@/lib/api/logements';
import type { Logement } from '@/types/database.types';

const STORAGE_KEY = 'calloc_selected_logement';

export interface LogementContextType {
  logements: Logement[];
  selectedLogementId: string | null;
  selectLogement: (id: string | null) => void;
  loading: boolean;
  refreshLogements: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const LogementContext = createContext<LogementContextType | null>(null);

export function LogementProvider({ children }: { children: ReactNode }) {
  const [logements, setLogements] = useState<Logement[]>([]);
  const [selectedLogementId, setSelectedLogementId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshLogements = useCallback(async () => {
    try {
      const data = await getLogements();
      setLogements(data);
      // Valider que le selectedLogementId existe encore dans la liste
      setSelectedLogementId(prev => {
        if (prev && !data.some(l => l.id === prev)) {
          try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
          return data.length > 0 ? data[0].id : null;
        }
        return prev;
      });
    } catch (err) {
      console.error('Erreur chargement logements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshLogements(); }, [refreshLogements]);

  function selectLogement(id: string | null) {
    setSelectedLogementId(id);
    try {
      if (id) {
        sessionStorage.setItem(STORAGE_KEY, id);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage indisponible
    }
  }

  return (
    <LogementContext.Provider
      value={{ logements, selectedLogementId, selectLogement, loading, refreshLogements }}
    >
      {children}
    </LogementContext.Provider>
  );
}
