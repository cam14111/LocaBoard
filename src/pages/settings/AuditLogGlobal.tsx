import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FileText,
} from 'lucide-react';
import { getGlobalAuditLog } from '@/lib/api/audit';
import { getLogements } from '@/lib/api/logements';
import type { AuditLog, Logement } from '@/types/database.types';

const PAGE_SIZE = 50;

const ENTITY_TYPE_OPTIONS = [
  { value: 'reservation', label: 'Réservation' },
  { value: 'dossier', label: 'Dossier' },
  { value: 'paiement', label: 'Paiement' },
  { value: 'document', label: 'Document' },
  { value: 'edl', label: 'EDL' },
  { value: 'tache', label: 'Tâche' },
  { value: 'logement', label: 'Logement' },
  { value: 'note', label: 'Note' },
  { value: 'incident', label: 'Incident' },
  { value: 'blocage', label: 'Blocage' },
];

const ACTION_LABELS: Record<string, string> = {
  created: 'Créé',
  updated: 'Modifié',
  completed: 'Complété',
  cancelled: 'Annulé',
  archived: 'Archivé',
  option_confirmed: 'Option confirmée',
  option_expired: 'Option expirée',
  pipeline_changed: 'Pipeline modifié',
  dates_modified: 'Dates modifiées',
  payment_recorded: 'Paiement enregistré',
  taches_auto_generated: 'Tâches auto-générées',
  dossier_cancelled: 'Dossier annulé',
  replaced: 'Remplacé',
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  archived: 'bg-slate-100 text-slate-600',
  option_confirmed: 'bg-green-100 text-green-700',
  option_expired: 'bg-orange-100 text-orange-700',
  pipeline_changed: 'bg-purple-100 text-purple-700',
  dates_modified: 'bg-amber-100 text-amber-700',
  payment_recorded: 'bg-green-100 text-green-700',
  taches_auto_generated: 'bg-indigo-100 text-indigo-700',
  dossier_cancelled: 'bg-red-100 text-red-700',
  replaced: 'bg-blue-100 text-blue-700',
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: 'Réservation',
  dossier: 'Dossier',
  paiement: 'Paiement',
  document: 'Document',
  edl: 'EDL',
  tache: 'Tâche',
  logement: 'Logement',
  note: 'Note',
  incident: 'Incident',
  blocage: 'Blocage',
};

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

function resolveEntityUrl(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'dossier':
      return `/dossiers/${entityId}`;
    case 'reservation':
      return `/calendrier`;
    case 'logement':
      return `/parametres/logements/${entityId}`;
    case 'tache':
      return `/taches`;
    default:
      return null;
  }
}

export default function AuditLogGlobal() {
  const navigate = useNavigate();

  // Données
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(0);

  // Filtres
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [selectedLogement, setSelectedLogement] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Charger logements une fois
  useEffect(() => {
    getLogements().then(setLogements).catch(() => {});
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getGlobalAuditLog({
        entity_types: selectedEntityTypes.length > 0 ? selectedEntityTypes : undefined,
        logement_id: selectedLogement || undefined,
        action: selectedAction || undefined,
        from_date: fromDate ? fromDate + 'T00:00:00' : undefined,
        to_date: toDate ? toDate + 'T23:59:59' : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(result.data);
      setTotalCount(result.count);
    } catch {
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityTypes, selectedLogement, selectedAction, fromDate, toDate, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset page quand les filtres changent
  const handleFilterChange = useCallback(() => {
    setPage(0);
  }, []);

  const toggleEntityType = (value: string) => {
    setSelectedEntityTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
    handleFilterChange();
  };

  const clearFilters = () => {
    setSelectedEntityTypes([]);
    setSelectedLogement('');
    setSelectedAction('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const hasFilters =
    selectedEntityTypes.length > 0 || selectedLogement || selectedAction || fromDate || toDate;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filtres</span>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>

        {/* Entity types — chips multi-select */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Type d'entité</label>
          <div className="flex flex-wrap gap-1.5">
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleEntityType(opt.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedEntityTypes.includes(opt.value)
                    ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logement + Action + Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Logement</label>
            <select
              value={selectedLogement}
              onChange={(e) => {
                setSelectedLogement(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">Tous</option>
              {logements.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">Toutes</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Du</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Au</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Compteur */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {totalCount} entrée{totalCount > 1 ? 's' : ''}
          {hasFilters ? ' (filtré)' : ''}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page + 1} / {totalPages}
          </span>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Aucune entrée d'audit.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const url = resolveEntityUrl(log.entity_type, log.entity_id);
            const actionColor = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600';
            const actionLabel = ACTION_LABELS[log.action] || log.action;
            const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;

            const hasDetails =
              (log.changed_fields && Object.keys(log.changed_fields).length > 0) ||
              (log.metadata && Object.keys(log.metadata).length > 0);

            return (
              <div
                key={log.id}
                className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Ligne principale */}
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm ${hasDetails ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                >
                  {/* Date */}
                  <span className="text-xs text-slate-400 shrink-0 w-[120px] hidden sm:block">
                    {formatTimestamp(log.timestamp)}
                  </span>

                  {/* Entity type badge */}
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">
                    {entityLabel}
                  </span>

                  {/* Action badge */}
                  <span className={`text-xs font-medium rounded px-1.5 py-0.5 shrink-0 ${actionColor}`}>
                    {actionLabel}
                  </span>

                  {/* Lien entité */}
                  <div className="flex-1 min-w-0">
                    {url ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(url);
                        }}
                        className="text-xs text-primary-600 hover:underline truncate block"
                      >
                        {log.entity_id.substring(0, 8)}...
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 truncate block">
                        {log.entity_id.substring(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* Date mobile */}
                  <span className="text-[10px] text-slate-400 shrink-0 sm:hidden">
                    {formatTimestamp(log.timestamp)}
                  </span>

                  {/* Expand icon */}
                  {hasDetails && (
                    <span className="text-slate-400 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </div>

                {/* Détails expandés */}
                {isExpanded && hasDetails && (
                  <div className="border-t border-slate-100 px-3 py-2 bg-slate-50 space-y-1.5">
                    {log.changed_fields &&
                      Object.entries(log.changed_fields).map(([key, change]) => {
                        const c = change as { before: unknown; after: unknown };
                        return (
                          <div key={key} className="text-xs font-mono">
                            <span className="text-slate-500">{key}:</span>{' '}
                            <span className="text-red-500 line-through">
                              {c.before != null ? String(c.before) : '—'}
                            </span>{' '}
                            →{' '}
                            <span className="text-green-600">
                              {c.after != null ? String(c.after) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-xs text-slate-500">
                        {Object.entries(log.metadata)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
