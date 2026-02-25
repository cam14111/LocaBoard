import { useSelectedLogement } from '@/hooks/useSelectedLogement';

export default function LogementSelector({ className }: { className?: string }) {
  const { logements, selectedLogementId, selectLogement, loading } = useSelectedLogement();

  return (
    <select
      value={selectedLogementId ?? ''}
      onChange={(e) => selectLogement(e.target.value || null)}
      disabled={loading}
      aria-label="Sélectionner un logement"
      className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:opacity-50${className ? ` ${className}` : ''}`}
    >
      <option value="">Tous les logements</option>
      {logements.map((l) => (
        <option key={l.id} value={l.id}>{l.nom}</option>
      ))}
    </select>
  );
}
