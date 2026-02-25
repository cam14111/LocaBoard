import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CheckCheck,
  Clock,
  CreditCard,
  CalendarDays,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import {
  getNotificationsByUser,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/api/notifications';
import { useAuth } from '@/hooks/useAuth';
import type { Notification, NotificationType } from '@/types/database.types';

const TYPE_ICONS: Record<NotificationType, typeof Clock> = {
  OPTION_EXPIRE_BIENTOT: Clock,
  OPTION_EXPIREE: Clock,
  PAIEMENT_EN_RETARD: CreditCard,
  PAIEMENT_DU_BIENTOT: CreditCard,
  ARRIVEE_IMMINENTE: CalendarDays,
  DEPART_IMMINENT: CalendarDays,
  TACHE_ASSIGNEE: CheckSquare,
  TACHE_EN_RETARD: CheckSquare,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  OPTION_EXPIRE_BIENTOT: 'text-amber-500 bg-amber-50',
  OPTION_EXPIREE: 'text-red-500 bg-red-50',
  PAIEMENT_EN_RETARD: 'text-red-500 bg-red-50',
  PAIEMENT_DU_BIENTOT: 'text-amber-500 bg-amber-50',
  ARRIVEE_IMMINENTE: 'text-blue-500 bg-blue-50',
  DEPART_IMMINENT: 'text-blue-500 bg-blue-50',
  TACHE_ASSIGNEE: 'text-primary-500 bg-primary-50',
  TACHE_EN_RETARD: 'text-red-500 bg-red-50',
};

/** Formatte un timestamp en heure relative */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD} jours`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Résout l'URL de navigation pour une notification */
function resolveUrl(n: Notification): string | null {
  if (!n.entity_type || !n.entity_id) return null;
  switch (n.entity_type) {
    case 'dossier':
      return `/dossiers/${n.entity_id}`;
    case 'reservation':
    case 'edl_arrivee':
    case 'edl_depart':
      return '/calendrier';
    case 'tache':
      return '/taches';
    default:
      return null;
  }
}

interface NotificationsPanelProps {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotificationsByUser(user.id, { limit: 30 });
      setNotifications(data);
    } catch {
      // Non bloquant
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(n: Notification) {
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
        );
      } catch {
        // Non bloquant
      }
    }

    const url = resolveUrl(n);
    if (url) {
      onClose();
      navigate(url);
    }
  }

  async function handleDelete(id: string) {
    // Retrait immédiat de l'UI
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    // Suppression en base (non bloquant)
    deleteNotification(id).catch(() => {});
  }

  async function handleMarkAllRead() {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
    } catch {
      // Non bloquant
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout lu
            </button>
          )}
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">Aucune notification.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Clock;
            const color = TYPE_COLORS[n.type] || 'text-slate-500 bg-slate-50';
            const isUnread = !n.read_at;

            return (
              <div
                key={n.id}
                className={`group flex items-start gap-0 border-b border-slate-50 transition-colors ${
                  isUnread ? 'bg-primary-50/30' : ''
                }`}
              >
                {/* Zone cliquable principale */}
                <button
                  onClick={() => handleClick(n)}
                  className={`flex-1 flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    isUnread ? 'hover:bg-primary-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`rounded-lg p-1.5 flex-shrink-0 mt-0.5 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {n.titre}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                  )}
                </button>

                {/* Bouton supprimer */}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="self-start mt-2 mr-2 p-1 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Supprimer"
                  aria-label="Supprimer la notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
