import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  CheckSquare,
  Loader2,
  Plus,
  X,
  Clock,
  AlertTriangle,
  Check,
  Filter,
  Calendar,
  Home,
  Pencil,
  RotateCcw,
  User,
} from 'lucide-react';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { useAuth } from '@/hooks/useAuth';
import { getTaches, createTache, updateTache, completeTache, cancelTache, reactivateTache } from '@/lib/api/taches';
import { getActiveUtilisateurs } from '@/lib/api/utilisateurs';
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


type FilterStatut = 'actives' | 'faites' | 'toutes';

export default function Tasks() {
  const { selectedLogementId, logements } = useSelectedLogement();
  const { user } = useAuth();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('actives');
  const [filterType, setFilterType] = useState<TacheType | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Utilisateur[]>([]);

  async function loadTaches() {
    setLoading(true);
    try {
      const data = await getTaches({ logement_id: selectedLogementId || undefined, limit: 200 });
      setTaches(data);
    } catch (err) {
      console.error('Erreur chargement tâches:', err);
      setTaches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getTaches({ logement_id: selectedLogementId || undefined, limit: 200 });
        if (!cancelled) setTaches(data);
      } catch (err) {
        console.error('Erreur chargement tâches:', err);
        if (!cancelled) setTaches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogementId]);

  useEffect(() => {
    getActiveUtilisateurs().then(setActiveUsers).catch(() => setActiveUsers([]));
  }, []);

  const filtered = useMemo(() => {
    let list = taches;

    if (filterStatut === 'actives') {
      list = list.filter((t) => t.statut === 'A_FAIRE' || t.statut === 'EN_COURS');
    } else if (filterStatut === 'faites') {
      list = list.filter((t) => t.statut === 'FAIT');
    }

    if (filterType) {
      list = list.filter((t) => t.type === filterType);
    }

    return list;
  }, [taches, filterStatut, filterType]);

  async function handleStatusChange(tache: Tache, newStatut: TacheStatut) {
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
      await loadTaches();
    } catch (err) {
      console.error('Erreur mise à jour tâche:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const activeCount = taches.filter(
    (t) => t.statut === 'A_FAIRE' || t.statut === 'EN_COURS',
  ).length;
  const today = toDateString(new Date());
  const overdueCount = taches.filter(
    (t) => (t.statut === 'A_FAIRE' || t.statut === 'EN_COURS') && t.echeance_at < today,
  ).length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary-600" />
          <h1 className="text-xl font-semibold">Tâches</h1>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary-100 text-primary-700 px-2 py-0.5 text-xs font-medium">
              {activeCount}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} en retard
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />

        {/* Filtre statut */}
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          {(['actives', 'faites', 'toutes'] as FilterStatut[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatut(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatut === f
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'actives' ? 'Actives' : f === 'faites' ? 'Terminées' : 'Toutes'}
            </button>
          ))}
        </div>

        {/* Filtre type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TacheType | '')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">Tous les types</option>
          {(Object.keys(TYPE_LABELS) as TacheType[]).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckSquare className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">
            {filterStatut === 'actives'
              ? 'Aucune tâche active. Vous êtes à jour !'
              : 'Aucune tâche trouvée.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tache) => (
            <TacheRow
              key={tache.id}
              tache={tache}
              onStatusChange={handleStatusChange}
              onEdited={loadTaches}
              activeUsers={activeUsers}
              currentUserId={user?.id}
              logementNom={
                !selectedLogementId
                  ? logements.find((l) => l.id === tache.logement_id)?.nom
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showCreateModal && (
        <CreateTacheModal
          logementId={selectedLogementId}
          activeUsers={activeUsers}
          currentUserId={user?.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTaches();
          }}
        />
      )}
    </div>
  );
}

function TacheRow({
  tache,
  onStatusChange,
  onEdited,
  activeUsers,
  currentUserId,
  logementNom,
}: {
  tache: Tache;
  onStatusChange: (tache: Tache, statut: TacheStatut) => void;
  onEdited: () => void;
  activeUsers: Utilisateur[];
  currentUserId?: string;
  logementNom?: string;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);

  const today = toDateString(new Date());
  const isOverdue =
    (tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS') && tache.echeance_at < today;
  const isDone = tache.statut === 'FAIT' || tache.statut === 'ANNULEE';

  const assignee = tache.assignee_user_id
    ? activeUsers.find((u) => u.id === tache.assignee_user_id)
    : null;
  const assigneeLabel = assignee
    ? (tache.assignee_user_id === currentUserId
        ? 'Moi'
        : `${assignee.prenom} ${assignee.nom}`)
    : null;

  // Mode édition
  if (editing) {
    return (
      <EditTacheRowForm
        tache={tache}
        activeUsers={activeUsers}
        currentUserId={currentUserId}
        onSaved={() => { setEditing(false); onEdited(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
        isDone ? 'border-slate-100 opacity-70' : isOverdue ? 'border-red-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox / status */}
        {!isDone ? (
          <button
            onClick={() => onStatusChange(tache, 'FAIT')}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
            title="Marquer comme fait"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : (
          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${tache.statut === 'FAIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
            {tache.statut === 'FAIT' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${isDone ? 'line-through text-slate-400' : ''}`}>
              {tache.titre}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[tache.type]}`}>
              {TYPE_LABELS[tache.type]}
            </span>
          </div>

          {tache.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{tache.description}</p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <Calendar className="h-3 w-3" />
              {formatDateFR(tache.echeance_at.substring(0, 10))}
              {isOverdue && ' (en retard)'}
            </span>
            <span className="text-slate-300">|</span>
            <span>{STATUT_LABELS[tache.statut]}</span>
            {assigneeLabel && (
              <>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <User className="h-3 w-3" />
                  {assigneeLabel}
                </span>
              </>
            )}
            {logementNom && (
              <>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Home className="h-3 w-3" />
                  {logementNom}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isDone ? (
            <button
              onClick={() => onStatusChange(tache, 'A_FAIRE')}
              className="rounded-lg p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Rouvrir la tâche"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : (
            <>
              {tache.statut === 'A_FAIRE' && (
                <button
                  onClick={() => onStatusChange(tache, 'EN_COURS')}
                  className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Démarrer"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => { setEditing(true); setConfirmCancel(false); }}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirmCancel(!confirmCancel)}
                className={`rounded-lg p-1 transition-colors ${
                  confirmCancel ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Annuler la tâche"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bandeau de confirmation */}
      {confirmCancel && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 flex-1">Confirmer l'annulation de cette tâche ?</span>
          <button
            onClick={() => setConfirmCancel(false)}
            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-white transition-colors"
          >
            Non
          </button>
          <button
            onClick={() => { setConfirmCancel(false); onStatusChange(tache, 'ANNULEE'); }}
            className="rounded px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Oui, annuler
          </button>
        </div>
      )}
    </div>
  );
}

function EditTacheRowForm({
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError('Le titre est requis.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateTache(tache.id, {
        titre: titre.trim(),
        type,
        echeance_at: new Date(echeance + 'T12:00:00Z').toISOString(),
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
  const cohotes = activeUsers.filter((u) => (u.role === 'COHOTE' || u.role === 'ADMIN') && u.id !== currentUserId);
  const concierges = activeUsers.filter((u) => u.role === 'CONCIERGE');

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-primary-200 bg-primary-50/30 p-4 shadow-sm space-y-3">
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
        <select value={type} onChange={(e) => setType(e.target.value as TacheType)} className={INPUT}>
          {(Object.keys(TYPE_LABELS) as TacheType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={INPUT} />
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
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function CreateTacheModal({
  logementId,
  activeUsers,
  currentUserId,
  onClose,
  onCreated,
}: {
  logementId: string | null;
  activeUsers: Utilisateur[];
  currentUserId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { logements } = useSelectedLogement();
  const [selectedLogement, setSelectedLogement] = useState(logementId ?? '');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TacheType>('MENAGE');
  const [echeance, setEcheance] = useState(toDateString(new Date()));
  const [assigneeId, setAssigneeId] = useState(currentUserId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cohotes = activeUsers.filter((u) => (u.role === 'COHOTE' || u.role === 'ADMIN') && u.id !== currentUserId);
  const concierges = activeUsers.filter((u) => u.role === 'CONCIERGE');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedLogement) {
      setError('Veuillez sélectionner un logement.');
      return;
    }
    if (!titre.trim()) {
      setError('Le titre est requis.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createTache({
        logement_id: selectedLogement,
        titre: titre.trim(),
        description: description.trim() || undefined,
        type,
        echeance_at: new Date(echeance).toISOString(),
        assignee_user_id: assigneeId || undefined,
      });
      onCreated();
    } catch (err) {
      console.error('Erreur création tâche:', err);
      setError('Erreur lors de la création de la tâche.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nouvelle tâche</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!logementId && (
            <div>
              <label htmlFor="tache-logement" className="block text-sm font-medium text-slate-700">
                Logement *
              </label>
              <select
                id="tache-logement"
                required
                value={selectedLogement}
                onChange={(e) => setSelectedLogement(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">— Choisir un logement —</option>
                {logements.map((l) => (
                  <option key={l.id} value={l.id}>{l.nom}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="tache-titre" className="block text-sm font-medium text-slate-700">
              Titre *
            </label>
            <input
              id="tache-titre"
              type="text"
              required
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Ménage entre deux locataires"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="tache-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="tache-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails optionnels..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tache-type" className="block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="tache-type"
                value={type}
                onChange={(e) => setType(e.target.value as TacheType)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                {(Object.keys(TYPE_LABELS) as TacheType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tache-echeance"
                className="block text-sm font-medium text-slate-700"
              >
                Échéance
              </label>
              <input
                id="tache-echeance"
                type="date"
                required
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tache-assignee" className="block text-sm font-medium text-slate-700">
              Assigné à
            </label>
            <select
              id="tache-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
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
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
