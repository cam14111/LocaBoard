import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Loader2,
  Plus,
  CheckCircle,
  AlertTriangle,
  Circle,
  PlayCircle,
  Play,
  Eye,
  Calendar,
  ShieldAlert,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { getEdlByDossier, createEdl, reopenEdl } from '@/lib/api/edl';
import { getChecklistModeles } from '@/lib/api/checklists';
import { getIncidentsByDossier, getIncidentPhotoUrl, updateIncident, deleteIncident } from '@/lib/api/incidents';
import type { IncidentWithPhotos } from '@/lib/api/incidents';
import IncidentModal from './IncidentModal';
import type { Edl, EdlItem, EdlType, ChecklistModele, IncidentSeverite } from '@/types/database.types';

const EDL_TYPE_LABELS: Record<string, string> = {
  ARRIVEE: "État des lieux d'arrivée",
  DEPART: 'État des lieux de départ',
};

const STATUT_CONFIG: Record<string, { icon: typeof Circle; color: string; label: string }> = {
  NON_COMMENCE: { icon: Circle, color: 'text-slate-400', label: 'Non commencé' },
  EN_COURS: { icon: PlayCircle, color: 'text-blue-600', label: 'En cours' },
  TERMINE_OK: { icon: CheckCircle, color: 'text-green-600', label: 'Terminé — OK' },
  TERMINE_INCIDENT: { icon: AlertTriangle, color: 'text-red-600', label: 'Terminé — Incident' },
};

const SEVERITE_CONFIG: Record<IncidentSeverite, { color: string; bgColor: string; label: string }> = {
  MINEUR: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', label: 'Mineur' },
  MAJEUR: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', label: 'Majeur' },
};

/** Formatte une date ISO en format lisible */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EdlTabProps {
  dossierId: string;
  logementId: string;
}

export default function EdlTab({ dossierId, logementId }: EdlTabProps) {
  const navigate = useNavigate();
  const [edls, setEdls] = useState<(Edl & { edl_items: EdlItem[] })[]>([]);
  const [incidents, setIncidents] = useState<IncidentWithPhotos[]>([]);
  const [checklists, setChecklists] = useState<ChecklistModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<EdlType>('ARRIVEE');
  const [selectedChecklist, setSelectedChecklist] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [incidentEdlId, setIncidentEdlId] = useState<string | null>(null);
  const [confirmReopenId, setConfirmReopenId] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [editIncidentId, setEditIncidentId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editSeverite, setEditSeverite] = useState<IncidentSeverite>('MINEUR');
  const [savingIncident, setSavingIncident] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingIncident, setDeletingIncident] = useState(false);
  const [error, setError] = useState('');

  const loadEdls = useCallback(async () => {
    try {
      const [edlData, incidentData] = await Promise.all([
        getEdlByDossier(dossierId),
        getIncidentsByDossier(dossierId),
      ]);
      setEdls(edlData);
      setIncidents(incidentData);
    } catch {
      setEdls([]);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    loadEdls();
  }, [loadEdls]);

  // Charger les checklists du logement pour pré-remplir les items
  useEffect(() => {
    if (!showCreate) return;
    getChecklistModeles(logementId)
      .then(setChecklists)
      .catch(() => setChecklists([]));
  }, [showCreate, logementId]);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const checklist = checklists.find((c) => c.id === selectedChecklist);
      const items = checklist
        ? checklist.items.map((item, i) => ({
            checklist_item_label: item.label,
            ordre: item.ordre ?? i + 1,
          }))
        : [];

      await createEdl({
        dossier_id: dossierId,
        type: selectedType,
        items,
      });

      setShowCreate(false);
      await loadEdls();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erreur lors de la création.';
      console.error('[EdlTab] Erreur création EDL:', err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  function openEdl(edlId: string) {
    navigate(`/dossiers/${dossierId}/edl/${edlId}`);
  }

  function handleIncidentCreated() {
    setIncidentEdlId(null);
    loadEdls();
  }

  async function handleReopen(edlId: string) {
    setReopening(true);
    try {
      await reopenEdl(edlId);
      setConfirmReopenId(null);
      await loadEdls();
    } catch {
      // Non bloquant — l'erreur sera silencieuse
    } finally {
      setReopening(false);
    }
  }

  function startEditIncident(inc: IncidentWithPhotos) {
    setEditIncidentId(inc.id);
    setEditDescription(inc.description);
    setEditSeverite(inc.severite);
    setDeleteConfirmId(null);
  }

  async function handleSaveIncident() {
    if (!editIncidentId) return;
    setSavingIncident(true);
    try {
      await updateIncident(editIncidentId, {
        description: editDescription.trim(),
        severite: editSeverite,
      });
      setEditIncidentId(null);
      await loadEdls();
    } catch {
      // Silencieux
    } finally {
      setSavingIncident(false);
    }
  }

  async function handleDeleteIncident(incidentId: string) {
    setDeletingIncident(true);
    try {
      await deleteIncident(incidentId);
      setDeleteConfirmId(null);
      await loadEdls();
    } catch {
      // Silencieux
    } finally {
      setDeletingIncident(false);
    }
  }

  const existingTypes = new Set(edls.map((e) => e.type));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // EDL sélectionné pour la modale incident
  const incidentEdl = edls.find((e) => e.id === incidentEdlId);

  return (
    <div className="space-y-4">
      {/* Liste EDL existants */}
      {edls.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Aucun état des lieux créé.</p>
        </div>
      ) : (
        edls.map((edl) => {
          const cfg = STATUT_CONFIG[edl.statut] || STATUT_CONFIG.NON_COMMENCE;
          const Icon = cfg.icon;
          const okItems = edl.edl_items.filter((i) => i.etat === 'OK').length;
          const anomalyItems = edl.edl_items.filter((i) => i.etat === 'ANOMALIE').length;
          const totalItems = edl.edl_items.length;
          const completedItems = okItems + anomalyItems;
          const isFinalized = edl.statut === 'TERMINE_OK' || edl.statut === 'TERMINE_INCIDENT';
          const edlIncidents = incidents.filter((inc) => inc.edl_id === edl.id);
          const canReport = edl.statut !== 'NON_COMMENCE';

          return (
            <div
              key={edl.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              {/* En-tête avec statut */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {EDL_TYPE_LABELS[edl.type] || edl.type}
                    </p>
                    <p className="text-xs text-slate-500">{cfg.label}</p>
                  </div>
                </div>
                {totalItems > 0 && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500">
                      {okItems > 0 && (
                        <span className="text-green-600">{okItems} OK</span>
                      )}
                      {okItems > 0 && anomalyItems > 0 && ' · '}
                      {anomalyItems > 0 && (
                        <span className="text-red-600">{anomalyItems} anomalie{anomalyItems > 1 ? 's' : ''}</span>
                      )}
                      {completedItems === 0 && `0/${totalItems}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Date de réalisation */}
              {isFinalized && edl.completed_at && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Réalisé le {formatDate(edl.completed_at)}</span>
                </div>
              )}

              {/* Barre de progression */}
              {totalItems > 0 && (
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      edl.statut === 'TERMINE_INCIDENT' ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
                  />
                </div>
              )}

              {/* Items aperçu */}
              {edl.edl_items.length > 0 && (
                <div className="space-y-1">
                  {edl.edl_items
                    .sort((a, b) => a.ordre - b.ordre)
                    .slice(0, 5)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        {item.etat === 'OK' ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        ) : item.etat === 'ANOMALIE' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        )}
                        <span className={item.etat ? 'text-slate-700' : 'text-slate-400'}>
                          {item.checklist_item_label}
                        </span>
                      </div>
                    ))}
                  {edl.edl_items.length > 5 && (
                    <p className="text-xs text-slate-400 pl-5">
                      + {edl.edl_items.length - 5} autres items
                    </p>
                  )}
                </div>
              )}

              {/* Incidents liés à cet EDL */}
              {edlIncidents.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                    {edlIncidents.length} incident{edlIncidents.length > 1 ? 's' : ''}
                  </p>
                  {edlIncidents.map((inc) => {
                    const sev = SEVERITE_CONFIG[inc.severite];
                    const isEditing = editIncidentId === inc.id;
                    const isDeleteConfirm = deleteConfirmId === inc.id;

                    return (
                      <div
                        key={inc.id}
                        className={`rounded-lg border px-3 py-2 ${sev.bgColor}`}
                      >
                        {/* En-tête : sévérité + date + actions */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${sev.color}`}>
                              {sev.label}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(inc.created_at)}
                            </span>
                          </div>
                          {!isEditing && !isDeleteConfirm && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditIncident(inc)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => { setDeleteConfirmId(inc.id); setEditIncidentId(null); }}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white/60 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Formulaire d'édition inline */}
                        {isEditing ? (
                          <div className="space-y-2 mt-1">
                            <select
                              value={editSeverite}
                              onChange={(e) => setEditSeverite(e.target.value as IncidentSeverite)}
                              className="block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            >
                              <option value="MINEUR">Mineur</option>
                              <option value="MAJEUR">Majeur</option>
                            </select>
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={2}
                              className="block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleSaveIncident}
                                disabled={savingIncident || !editDescription.trim()}
                                className="flex items-center gap-1 rounded bg-primary-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                              >
                                {savingIncident ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Enregistrer
                              </button>
                              <button
                                onClick={() => setEditIncidentId(null)}
                                disabled={savingIncident}
                                className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" />
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : isDeleteConfirm ? (
                          <div className="mt-1 space-y-1.5">
                            <p className="text-[10px] text-red-700 font-medium">Supprimer cet incident ?</p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleDeleteIncident(inc.id)}
                                disabled={deletingIncident}
                                className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingIncident ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Supprimer
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={deletingIncident}
                                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 line-clamp-2">
                            {inc.description}
                          </p>
                        )}

                        {/* Photos */}
                        {!isEditing && inc.incident_photos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {inc.incident_photos.map((photo) => (
                              <a
                                key={photo.id}
                                href={getIncidentPhotoUrl(photo.photo_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-14 w-14 rounded overflow-hidden border border-white/60 hover:opacity-90 transition-opacity flex-shrink-0"
                              >
                                <img
                                  src={getIncidentPhotoUrl(photo.photo_url)}
                                  alt="Photo incident"
                                  className="h-full w-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <button
                  onClick={() => openEdl(edl.id)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isFinalized
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isFinalized ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Voir le détail
                    </>
                  ) : edl.statut === 'EN_COURS' ? (
                    <>
                      <Play className="h-4 w-4" />
                      Reprendre
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Commencer
                    </>
                  )}
                </button>
                {canReport && (
                  <button
                    onClick={() => setIncidentEdlId(edl.id)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Incident
                  </button>
                )}
                {isFinalized && (
                  <button
                    onClick={() => setConfirmReopenId(edl.id)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                    title="Rouvrir pour corrections"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Confirmation réouverture */}
              {confirmReopenId === edl.id && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
                  <p className="text-amber-800 font-medium mb-2">
                    Rouvrir l'EDL pour corrections ?
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    Le statut repassera à "En cours". Cette action est traçée dans l'audit.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReopen(edl.id)}
                      disabled={reopening}
                      className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {reopening && <Loader2 className="h-3 w-3 animate-spin" />}
                      Oui, rouvrir
                    </button>
                    <button
                      onClick={() => setConfirmReopenId(null)}
                      disabled={reopening}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Formulaire de création */}
      {showCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Créer un état des lieux</h4>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as EdlType)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
              <option value="ARRIVEE" disabled={existingTypes.has('ARRIVEE')}>
                Arrivée {existingTypes.has('ARRIVEE') ? '(déjà créé)' : ''}
              </option>
              <option value="DEPART" disabled={existingTypes.has('DEPART')}>
                Départ {existingTypes.has('DEPART') ? '(déjà créé)' : ''}
              </option>
            </select>
          </div>
          {checklists.length > 0 && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Modèle de checklist (optionnel)</label>
              <select
                value={selectedChecklist}
                onChange={(e) => setSelectedChecklist(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">Sans modèle</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} ({c.items.length} items)
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || existingTypes.has(selectedType)}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin" />}
              Créer
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(''); }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          disabled={existingTypes.has('ARRIVEE') && existingTypes.has('DEPART')}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {existingTypes.has('ARRIVEE') && existingTypes.has('DEPART')
            ? 'EDL arrivée et départ déjà créés'
            : 'Créer un état des lieux'}
        </button>
      )}

      {/* Modale création incident */}
      {incidentEdl && (
        <IncidentModal
          edlId={incidentEdl.id}
          dossierId={dossierId}
          items={incidentEdl.edl_items}
          onClose={() => setIncidentEdlId(null)}
          onCreated={handleIncidentCreated}
        />
      )}
    </div>
  );
}
