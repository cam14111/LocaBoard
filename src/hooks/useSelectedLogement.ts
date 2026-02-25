import { useContext } from 'react';
import { LogementContext, type LogementContextType } from '@/contexts/LogementContext';

export function useSelectedLogement(): LogementContextType {
  const ctx = useContext(LogementContext);
  if (!ctx) throw new Error('useSelectedLogement must be used within LogementProvider');
  return ctx;
}
