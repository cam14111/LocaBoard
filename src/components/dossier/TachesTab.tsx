import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  CheckSquare,
  Loader2,
  Plus,
  X,
  Clock,
  AlertTriangle,
  Check,
  Calendar,
  Pencil,
  RotateCcw,
  User,
} from 'lucide-react';
import {
  getTachesByDossier,
  createTache,
  updateTache,
  completeTache,
  cancelTache,
  reactivateTache,
} from '@/lib/api/taches';
import { getActiveUtilisateurs } from '@/lib/api/utilisateurs';
import { useAuth } from '@/hooks/useAuth';
import { formatDateFR, toDateString } from '@/lib/dateUtils';
import type { Tache, TacheType, TacheStatut, Utilisateur } from '@/types/database.types';

const TYPE_LABELS: Record<TacheType, string> = {
  MENAGE: 'Ménage',
  ACCUEIL: 'Accueil',
  REMISE_CLES: 'Remise clés',
  MAINTENANCE: 'Maintenance',
  AUTRE: 'Autre',
};

const TYPE_COLORS: Record<TacheType, string> = {
  MENAGE: 'bg-purple-100 text-purple-700',
  ACCUEIL: 'bg-emerald-100 text-emerald-700',
  REMISE_CLES: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  AUTRE: 'bg-slate-100 text-slate-700',
};

const STATUT_LABELS: Record<TacheStatut, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  FAIT: 'Fait',
  ANNULEE: 'Annulée',
};

interface TachesTabProps {
  dossierId: string;
  logementId: string;
}

export default function TachesTab({ dossierId, logementId }: TachesTabProps) {
  const { user } = useAuth();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [activeUsers, setActiveUsers] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    getActiveUtilisateurs().then(setActiveUsers).catch(() => setActiveUsers([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getTachesByDossier(dossierId);
      setTaches(data);
    } catch {
      setTaches([]);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(tache: Tache, newStatut: TacheStatut) {
    setActionError('');
    setConfirmCancelId(null);
    try {
      if (newStatut === 'FAIT') {
        await completeTache(tache.id);
      } else if (newStatut === 'ANNULEE') {
        await cancelTache(tache.id);
      } else if (newStatut === 'A_FAIRE') {
        await reactivateTache(tache.id);
      } else {
        await updateTache(tache.id, { statut: newStatut });
      }
      await load();
    } catch (err) {
      console.error('Erreur mise à jour tâche:', err);
      setActionError('Erreur lors de la mise à jour de la tâche.');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const today = toDateString(new Date());
  const activeCount = taches.filter(
    (t) => t.statut === 'A_FAIRE' || t.statut === 'EN_COURS',
  ).length;
  const overdueCount = taches.filter(
    (t) => (t.statut === 'A_FAIRE' || t.statut === 'EN_COURS') && t.echeance_at < today,
  ).length;

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      {taches.length > 0 && (
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="rounded-full bg-primary-100 text-primary-700 px-2.5 py-0.5 text-xs font-medium">
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} en retard
            </span>
          )}
        </div>
      )}

      {/* Erreur action */}
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}

      {/* Liste des tâches */}
      {taches.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <CheckSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Aucune tâche pour ce dossier.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {taches.map((tache) => {
            // Mode édition
            if (editingId === tache.id) {
              return (
                <EditTacheInline
                  key={tache.id}
                  tache={tache}
                  activeUsers={activeUsers}
                  currentUserId={user?.id}
                  onSaved={() => { setEditingId(null); load(); }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const isOverdue =
              (tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS') &&
              tache.echeance_at < today;
            const isDone = tache.statut === 'FAIT' || tache.statut === 'ANNULEE';
            const isConfirmingCancel = confirmCancelId === tache.id;
            const assignee = tache.assignee_user_id
              ? activeUsers.find((u) => u.id === tache.assignee_user_id)
              : null;
            const assigneeLabel = assignee
              ? (tache.assignee_user_id === user?.id ? 'Moi' : `${assignee.prenom} ${assignee.nom}`)
              : null;

            return (
              <div
                key={tache.id}
                className={`rounded-xl border bg-white p-4 transition-colors ${
                  isDone
                    ? 'border-slate-100 opacity-70'
                    : isOverdue
                      ? 'border-red-200'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  {!isDone ? (
                    <button
                      onClick={() => handleStatusChange(tache, 'FAIT')}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                      title="Marquer comme fait"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  ) : (
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${tache.statut === 'FAIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {tache.statut === 'FAIT' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${isDone ? 'line-through text-slate-400' : ''}`}
                      >
                        {tache.titre}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[tache.type]}`}
                      >
                        {TYPE_LABELS[tache.type]}
                      </span>
                    </div>

                    {tache.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {tache.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span
                        className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}
                      >
                        <Calendar className="h-3 w-3" />
                        {formatDateFR(tache.echeance_at.substring(0, 10))}
                        {isOverdue && ' (en retard)'}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>{STATUT_LABELS[tache.statut]}</span>
                      {assigneeLabel && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {assigneeLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isDone ? (
                      /* Bouton réactiver */
                      <button
                        onClick={() => handleStatusChange(tache, 'A_FAIRE')}
                        className="rounded-lg p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        title="Rouvrir la tâche"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <>
                        {/* Bouton démarrer */}
                        {tache.statut === 'A_FAIRE' && (
                          <button
                            onClick={() => handleStatusChange(tache, 'EN_COURS')}
                            className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Démarrer"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Bouton éditer */}
                        <button
                          onClick={() => { setEditingId(tache.id); setConfirmCancelId(null); }}
                          className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Bouton annuler */}
                        <button
                          onClick={() => setConfirmCancelId(isConfirmingCancel ? null : tache.id)}
                          className={`rounded-lg p-1 transition-colors ${
                            isConfirmingCancel
                              ? 'text-red-600 bg-red-50'
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Annuler la tâche"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Bandeau de confirmation d'annulation */}
                {isConfirmingCancel && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 flex-1">Confirmer l'annulation de cette tâche ?</span>
                    <button
                      onClick={() => setConfirmCancelId(null)}
                      className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-white transition-colors"
                    >
                      Non
                    </button>
                    <button
                      onClick={() => handleStatusChange(tache, 'ANNULEE')}
                      className="rounded px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      Oui, annuler
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bouton + formulaire création */}
      {showCreate ? (
        <CreateTacheInline
          logementId={logementId}
          dossierId={dossierId}
          activeUsers={activeUsers}
          currentUserId={user?.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter une tâche
        </button>
      )}
    </div>
  );
}

// ─── Formulaire édition inline ───────────────────────────────

function EditTacheInline({
  tache,
  activeUsers,
  currentUserId,
  onSaved,
  onCancel,
}: {
  tache: Tache;
  activeUsers: Utilisateur[];
  currentUserId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [titre, setTitre] = useState(tache.titre);
  const [type, setType] = useState<TacheType>(tache.type);
  const [echeance, setEcheance] = useState(tache.echeance_at.substring(0, 10));
  const [description, setDescription] = useState(tache.description ?? '');
  const [assigneeId, setAssigneeId] = useState(tache.assignee_user_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cohotes = activeUsers.filter((u) => (u.role === 'COHOTE' || u.role === 'ADMIN') && u.id !== currentUserId);
  const concierges = activeUsers.filter((u) => u.role === 'CONCIERGE');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError('Le titre est requis.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateTache(tache.id, {
        titre: titre.trim(),
        type,
        echeance_at: new Date(echeance + 'T00:00:00').toISOString(),
        description: description.trim() || undefined,
        assignee_user_id: assigneeId || null,
      });
      onSaved();
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  const INPUT = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-primary-200 bg-primary-50/30 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-primary-600" />
          Modifier la tâche
        </h4>
        <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Titre *"
        maxLength={200}
        className={INPUT}
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optionnelle)"
        rows={2}
        className={`${INPUT} resize-none`}
      />

      <div className="grid grid-cols-2 gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TacheType)}
          className={INPUT}
        >
          {(Object.keys(TYPE_LABELS) as TacheType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          className={INPUT}
        />
      </div>

      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={INPUT}>
        <option value="">— Non assigné —</option>
        {currentUserId && <option value={currentUserId}>Moi</option>}
        {cohotes.length > 0 && (
          <optgroup label="Co-hôtes">
            {cohotes.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </optgroup>
        )}
        {concierges.length > 0 && (
          <optgroup label="Concierges">
            {concierges.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </optgroup>
        )}
      </select>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─── Formulaire création inline ─────────────────────────────

function CreateTacheInline({
  logementId,
  dossierId,
  activeUsers,
  currentUserId,
  onClose,
  onCreated,
}: {
  logementId: string;
  dossierId: string;
  activeUsers: Utilisateur[];
  currentUserId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<TacheType>('MENAGE');
  const [echeance, setEcheance] = useState(toDateString(new Date()));
  const [assigneeId, setAssigneeId] = useState(currentUserId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cohotes = activeUsers.filter((u) => (u.role === 'COHOTE' || u.role === 'ADMIN') && u.id !== currentUserId);
  const concierges = activeUsers.filter((u) => u.role === 'CONCIERGE');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) {
      setError('Le titre est requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createTache({
        logement_id: logementId,
        dossier_id: dossierId,
        titre: titre.trim(),
        type,
        echeance_at: new Date(echeance).toISOString(),
        assignee_user_id: assigneeId || undefined,
      });
      onCreated();
    } catch {
      setError('Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  }

  const INPUT = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <h4 className="text-sm font-semibold text-slate-900">Nouvelle tâche</h4>
      <input
        type="text"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Titre de la tâche..."
        maxLength={200}
        className={INPUT}
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TacheType)}
          className={INPUT}
        >
          {(Object.keys(TYPE_LABELS) as TacheType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          className={INPUT}
        />
      </div>
      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={INPUT}>
        <option value="">— Non assigné —</option>
        {currentUserId && <option value={currentUserId}>Moi</option>}
        {cohotes.length > 0 && (
          <optgroup label="Co-hôtes">
            {cohotes.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </optgroup>
        )}
        {concierges.length > 0 && (
          <optgroup label="Concierges">
            {concierges.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </optgroup>
        )}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Créer
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
