import { Loader2 } from 'lucide-react';
import type { AuditLog } from '@/types/database.types';

interface AuditTimelineProps {
  logs: AuditLog[];
  loading: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Créé',
  option_confirmed: 'Option confirmée',
  option_expired: 'Option expirée',
  cancelled: 'Annulé',
  dates_modified: 'Dates modifiées',
  pipeline_changed: 'Statut modifié',
  archived: 'Archivé',
};

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatChangedField(key: string, change: { before: unknown; after: unknown }): string {
  const before = change.before != null ? String(change.before) : '—';
  const after = change.after != null ? String(change.after) : '—';
  return `${key}: ${before} → ${after}`;
}

export default function AuditTimeline({ logs, loading }: AuditTimelineProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">Aucun historique.</p>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Ligne verticale */}
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-200" />

      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="relative">
            {/* Point */}
            <div className="absolute -left-6 top-1.5 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" />

            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {ACTION_LABELS[log.action] || log.action}
                </span>
                <span className="text-xs text-slate-400">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>

              {/* Champs modifiés */}
              {log.changed_fields && Object.keys(log.changed_fields).length > 0 && (
                <div className="space-y-0.5">
                  {Object.entries(log.changed_fields).map(([key, change]) => (
                    <p key={key} className="text-xs text-slate-500 font-mono">
                      {formatChangedField(key, change as { before: unknown; after: unknown })}
                    </p>
                  ))}
                </div>
              )}

              {/* Metadata */}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <p className="text-xs text-slate-400">
                  {Object.entries(log.metadata)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
