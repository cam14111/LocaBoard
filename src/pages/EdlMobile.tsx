import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle,
  AlertTriangle,
  Circle,
  List,
  Loader2,
  MessageSquare,
  Lock,
  ChevronRight,
  Camera,
  Pencil,
} from 'lucide-react';
import { getEdlById, updateEdlItem, startEdl, finalizeEdl, reopenEdl, parsePhotoUrls } from '@/lib/api/edl';
import { getDossierById, updatePipelineStatut } from '@/lib/api/dossiers';
import {
  countCompleted,
  isEdlFinalized,
  canFinalize,
  hasAnomalies,
  countAnomalies,
  getFinalStatut,
  sortItemsByOrdre,
} from '@/lib/edlHelpers';
import EdlItemPhotos from '@/components/dossier/EdlItemPhotos';
import type { Edl, EdlItem, EdlItemEtat, PipelineStatut } from '@/types/database.types';

const EDL_TYPE_LABELS: Record<string, string> = {
  ARRIVEE: "EDL Arrivée",
  DEPART: 'EDL Départ',
};

export default function EdlMobile() {
  const { dossierId, edlId } = useParams<{ dossierId: string; edlId: string }>();
  const navigate = useNavigate();

  const [edl, setEdl] = useState<(Edl & { edl_items: EdlItem[] }) | null>(null);
  const [items, setItems] = useState<EdlItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [pipelineUpdated, setPipelineUpdated] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Debounce pour le commentaire
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEdl = useCallback(async () => {
    if (!edlId) return;
    try {
      const data = await getEdlById(edlId);
      setEdl(data);
      setItems(sortItemsByOrdre(data.edl_items));
    } catch {
      setError('EDL introuvable.');
    } finally {
      setLoading(false);
    }
  }, [edlId]);

  useEffect(() => {
    loadEdl();
  }, [loadEdl]);

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
    };
  }, []);

  const completedCount = countCompleted(items);
  const totalCount = items.length;
  const currentItem = items[currentIndex] ?? null;

  // Passage NON_COMMENCE → EN_COURS au premier item renseigné
  async function ensureStarted() {
    if (!edl || edl.statut !== 'NON_COMMENCE') return;
    try {
      await startEdl(edl.id);
      setEdl((prev) => prev ? { ...prev, statut: 'EN_COURS' } : prev);
    } catch {
      // Non bloquant
    }
  }

  async function handleSetEtat(etat: EdlItemEtat) {
    if (!currentItem) return;
    setSaving(true);
    try {
      await updateEdlItem(currentItem.id, { etat });
      // Mettre à jour localement
      setItems((prev) =>
        prev.map((i) => (i.id === currentItem.id ? { ...i, etat } : i)),
      );
      await ensureStarted();

      // Auto-avancer vers le prochain item non renseigné
      if (currentIndex < totalCount - 1) {
        setTimeout(() => setCurrentIndex((prev) => prev + 1), 200);
      }
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  function handleCommentChange(value: string) {
    if (!currentItem) return;
    // Mise à jour locale immédiate
    setItems((prev) =>
      prev.map((i) => (i.id === currentItem.id ? { ...i, commentaire: value } : i)),
    );

    // Sauvegarde debounced (500ms)
    if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
    commentTimerRef.current = setTimeout(async () => {
      try {
        await updateEdlItem(currentItem.id, { commentaire: value || null });
      } catch {
        // Non bloquant
      }
    }, 500);
  }

  function handlePhotosChange(newPhotoUrl: string | null) {
    if (!currentItem) return;
    setItems((prev) =>
      prev.map((i) => (i.id === currentItem.id ? { ...i, photo_url: newPhotoUrl } : i)),
    );
  }

  async function handleReopen() {
    if (!edlId) return;
    setReopening(true);
    try {
      await reopenEdl(edlId);
      setEdl((prev) => prev ? { ...prev, statut: 'EN_COURS', completed_at: null } : prev);
      setShowReopenModal(false);
    } catch {
      setError('Erreur lors de la réouverture.');
    } finally {
      setReopening(false);
    }
  }

  async function handleFinalize() {
    if (!edl || !dossierId) return;
    setFinalizing(true);
    try {
      const incident = hasAnomalies(items);
      await finalizeEdl(edl.id, incident);
      const newStatut = getFinalStatut(items);
      setEdl((prev) => prev ? { ...prev, statut: newStatut } : prev);
      setShowFinalizeModal(false);

      // E07-07 : Mettre à jour automatiquement le pipeline après finalisation EDL
      // (arrivée ou départ, première finalisation ou re-finalisation)
      try {
        const dossier = await getDossierById(dossierId);
        const ps = dossier.pipeline_statut as PipelineStatut;

        if (edl.type === 'ARRIVEE') {
          const arriveeStates: PipelineStatut[] = ['CHECKIN_FAIT', 'EDL_ENTREE_OK', 'EDL_ENTREE_INCIDENT'];
          if (arriveeStates.includes(ps)) {
            const target: PipelineStatut = incident ? 'EDL_ENTREE_INCIDENT' : 'EDL_ENTREE_OK';
            if (target !== ps) {
              await updatePipelineStatut(dossierId, target);
              setPipelineUpdated(true);
            }
          }
        } else if (edl.type === 'DEPART') {
          const departStates: PipelineStatut[] = ['CHECKOUT_FAIT', 'EDL_OK', 'EDL_INCIDENT'];
          if (departStates.includes(ps)) {
            const target: PipelineStatut = incident ? 'EDL_INCIDENT' : 'EDL_OK';
            if (target !== ps) {
              await updatePipelineStatut(dossierId, target);
              setPipelineUpdated(true);
            }
          }
        }
      } catch {
        // Non bloquant — le pipeline peut être avancé manuellement depuis le dossier
      }
    } catch {
      setError('Erreur lors de la finalisation.');
    } finally {
      setFinalizing(false);
    }
  }

  function goToItem(index: number) {
    setCurrentIndex(index);
    setShowSummary(false);
  }

  function goBack() {
    navigate(`/dossiers/${dossierId}`, { state: { tab: 'edl' } });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !edl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white p-4">
        <p className="text-slate-500 mb-4">{error || 'EDL introuvable.'}</p>
        <button onClick={goBack} className="text-sm text-primary-600 hover:underline">
          Retour au dossier
        </button>
      </div>
    );
  }

  const finalized = isEdlFinalized(edl.statut);
  const allDone = canFinalize(items);
  const anomalyCount = countAnomalies(items);

  // ─── Modale de confirmation finalisation ─────────────────────
  const finalizeModal = showFinalizeModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Finaliser l'état des lieux ?
        </h3>

        {/* Résumé */}
        <div className="rounded-xl bg-slate-50 p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Items OK</span>
            <span className="font-medium text-green-600">
              {totalCount - anomalyCount}
            </span>
          </div>
          {anomalyCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Anomalies</span>
              <span className="font-medium text-red-600">{anomalyCount}</span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Résultat</span>
            <span
              className={`font-semibold ${anomalyCount > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {anomalyCount > 0 ? 'Terminé avec incident' : 'Terminé OK'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-5">
          <Lock className="inline h-3 w-3 mr-1" />
          Une fois finalisé, l'EDL ne pourra plus être modifié.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowFinalizeModal(false)}
            disabled={finalizing}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              anomalyCount > 0
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {finalizing ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              'Finaliser'
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;


  // ─── Modale de confirmation réouverture ──────────────────────
  const reopenModal = showReopenModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Rouvrir l'EDL pour corrections ?
        </h3>
        <p className="text-sm text-slate-600 mb-5">
          Le statut repassera à "En cours". Vous pourrez modifier les items et refinaliser l'EDL.
          Cette action est traçée dans l'audit.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowReopenModal(false)}
            disabled={reopening}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleReopen}
            disabled={reopening}
            className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {reopening ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              'Rouvrir'
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── Vue Résumé ─────────────────────────────────────────────
  if (showSummary) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        {finalizeModal}
        {reopenModal}

        {/* Header */}
        <header className="flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
          <button onClick={() => setShowSummary(false)} className="p-1">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900">
            Résumé — {completedCount}/{totalCount}
          </h1>
          <button onClick={goBack} className="p-1">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </header>

        {/* Badge finalisé + bouton Corriger */}
        {finalized && (
          <div
            className={`mx-4 mt-3 rounded-xl p-3 ${
              edl.statut === 'TERMINE_OK'
                ? 'bg-green-50'
                : 'bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 text-sm font-medium ${
                edl.statut === 'TERMINE_OK' ? 'text-green-700' : 'text-red-700'
              }`}>
                <Lock className="h-4 w-4" />
                {edl.statut === 'TERMINE_OK'
                  ? 'Terminé OK'
                  : 'Terminé avec incident'}
              </span>
              <button
                onClick={() => { setShowReopenModal(true); setPipelineUpdated(false); }}
                className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Corriger
              </button>
            </div>
          </div>
        )}

        {/* Confirmation mise à jour pipeline */}
        {pipelineUpdated && (
          <div className="mx-4 mt-2 rounded-xl bg-primary-50 border border-primary-200 px-3 py-2 flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-primary-600 flex-shrink-0" />
            <p className="text-xs text-primary-700 font-medium">Pipeline du dossier mis à jour.</p>
          </div>
        )}

        {/* Liste des items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.map((item, idx) => {
            const photoCount = parsePhotoUrls(item.photo_url).length;
            return (
              <button
                key={item.id}
                onClick={() => !finalized && goToItem(idx)}
                disabled={finalized}
                className={`w-full flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200 text-left transition-colors ${
                  finalized ? 'opacity-75 cursor-default' : 'hover:border-primary-300'
                }`}
              >
                {item.etat === 'OK' ? (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                ) : item.etat === 'ANOMALIE' ? (
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.checklist_item_label}
                  </p>
                  {item.commentaire && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {item.commentaire}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {photoCount > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-slate-400">
                      <Camera className="h-3 w-3" />
                      {photoCount}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{idx + 1}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bouton Finaliser */}
        {!finalized && (
          <div className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0">
            <button
              onClick={() => setShowFinalizeModal(true)}
              disabled={!allDone}
              className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors min-h-[44px] ${
                allDone
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {allDone
                ? `Finaliser l'EDL (${completedCount}/${totalCount})`
                : `Compléter tous les items (${completedCount}/${totalCount})`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Vue Item ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={goBack} className="p-1">
            <X className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900">
            {EDL_TYPE_LABELS[edl.type] || edl.type}
          </h1>
          <button
            onClick={() => setShowSummary(true)}
            className="p-1"
            title="Voir le résumé"
          >
            <List className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        {/* Barre de progression */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>
      </header>

      {/* Contenu item */}
      {currentItem ? (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Numéro + Label */}
          <div className="text-center mb-6">
            <span className="inline-block bg-primary-100 text-primary-700 text-xs font-semibold rounded-full px-3 py-1 mb-3">
              {currentIndex + 1} / {totalCount}
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              {currentItem.checklist_item_label}
            </h2>
          </div>

          {/* Boutons OK / Anomalie */}
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => handleSetEtat('OK')}
              disabled={saving || finalized}
              className={`flex-1 flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all ${
                currentItem.etat === 'OK'
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-green-300'
              } disabled:opacity-50`}
            >
              <CheckCircle
                className={`h-10 w-10 ${
                  currentItem.etat === 'OK' ? 'text-green-500' : 'text-slate-300'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  currentItem.etat === 'OK' ? 'text-green-700' : 'text-slate-500'
                }`}
              >
                OK
              </span>
            </button>
            <button
              onClick={() => handleSetEtat('ANOMALIE')}
              disabled={saving || finalized}
              className={`flex-1 flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all ${
                currentItem.etat === 'ANOMALIE'
                  ? 'border-red-500 bg-red-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-red-300'
              } disabled:opacity-50`}
            >
              <AlertTriangle
                className={`h-10 w-10 ${
                  currentItem.etat === 'ANOMALIE' ? 'text-red-500' : 'text-slate-300'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  currentItem.etat === 'ANOMALIE' ? 'text-red-700' : 'text-slate-500'
                }`}
              >
                Anomalie
              </span>
            </button>
          </div>

          {/* Photos EDL (E07-03) */}
          <div className="mb-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <Camera className="h-3.5 w-3.5" />
              Photos (max 5)
            </label>
            <EdlItemPhotos
              dossierId={dossierId!}
              edlId={edlId!}
              itemId={currentItem.id}
              photoUrl={currentItem.photo_url}
              disabled={finalized}
              onPhotosChange={handlePhotosChange}
            />
          </div>

          {/* Commentaire */}
          <div className="mb-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Commentaire (optionnel)
            </label>
            <textarea
              value={currentItem.commentaire || ''}
              onChange={(e) => handleCommentChange(e.target.value)}
              disabled={finalized}
              placeholder="Ajouter un commentaire..."
              maxLength={500}
              rows={3}
              className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none disabled:bg-slate-50"
            />
          </div>

          {/* Indicateur de sauvegarde */}
          {saving && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-4">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sauvegarde...
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-slate-400 text-sm">Aucun item dans cet EDL.</p>
        </div>
      )}

      {/* Navigation bas */}
      <nav className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Précédent
        </button>

        {/* Indicateurs de points */}
        <div className="flex gap-1 overflow-hidden max-w-[120px]">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all flex-shrink-0 ${
                idx === currentIndex
                  ? 'w-4 bg-primary-600'
                  : item.etat === 'OK'
                    ? 'w-2 bg-green-400'
                    : item.etat === 'ANOMALIE'
                      ? 'w-2 bg-red-400'
                      : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() =>
            currentIndex < totalCount - 1
              ? setCurrentIndex((prev) => prev + 1)
              : setShowSummary(true)
          }
          className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 min-h-[44px]"
        >
          {currentIndex < totalCount - 1 ? 'Suivant' : 'Résumé'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
