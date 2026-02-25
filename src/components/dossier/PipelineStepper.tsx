import { useState } from 'react';
import { Check, Circle, ChevronRight, ChevronLeft, Loader2, AlertTriangle, X } from 'lucide-react';
import { updatePipelineStatut } from '@/lib/api/dossiers';
import CancelDossierModal from './CancelDossierModal';
import CloseDossierModal from './CloseDossierModal';
import {
  PIPELINE_STEPS,
  PIPELINE_LABELS,
  getNextSteps,
  canAdvance,
  canRevert,
  canCancel,
  getStepIndex,
  type UserPipelineRole,
} from '@/lib/pipeline';
import type { PipelineStatut } from '@/types/database.types';

interface PipelineStepperProps {
  dossierId: string;
  currentStatut: PipelineStatut;
  userRole: UserPipelineRole;
  onUpdated: () => void;
}

export default function PipelineStepper({
  dossierId,
  currentStatut,
  userRole,
  onUpdated,
}: PipelineStepperProps) {
  const [confirmAction, setConfirmAction] = useState<{
    target: PipelineStatut;
    type: 'advance' | 'revert';
  } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentIndex = getStepIndex(currentStatut);
  const isTerminal = currentStatut === 'CLOTURE' || currentStatut === 'ANNULE';

  // Transitions possibles
  const nextSteps = getNextSteps(currentStatut).filter((s) => canAdvance(currentStatut, s, userRole));
  const revertTarget = canRevert(currentStatut, userRole);

  function handleAdvanceClick(target: PipelineStatut) {
    // E04-09 : Si la cible est CLOTURE, ouvrir la modale de clôture
    if (target === 'CLOTURE') {
      setShowCloseModal(true);
      return;
    }
    setConfirmAction({ target, type: 'advance' });
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === 'revert' && !motif.trim()) {
      setError('Le motif est obligatoire pour un retour arrière.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updatePipelineStatut(dossierId, confirmAction.target, motif.trim() || undefined);
      setConfirmAction(null);
      setMotif('');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la transition.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Modale annulation cascade (E04-08) */}
      {showCancelModal && (
        <CancelDossierModal
          dossierId={dossierId}
          currentStatut={currentStatut}
          onCancelled={() => {
            setShowCancelModal(false);
            onUpdated();
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* Modale clôture (E04-09) */}
      {showCloseModal && (
        <CloseDossierModal
          dossierId={dossierId}
          onClosed={() => {
            setShowCloseModal(false);
            onUpdated();
          }}
          onClose={() => setShowCloseModal(false)}
        />
      )}

      {/* Stepper visuel vertical */}
      <div className="space-y-0">
        {PIPELINE_STEPS.map((step, i) => {
          const isCompleted = currentIndex > i;

          // Quand le statut actuel est une variante _INCIDENT, l'étape _OK correspondante
          // affiche directement le label et la couleur de l'incident (inline, pas de badge séparé)
          const isIncidentVariant =
            (step === 'EDL_OK' && currentStatut === 'EDL_INCIDENT') ||
            (step === 'EDL_ENTREE_OK' && currentStatut === 'EDL_ENTREE_INCIDENT');

          const isCurrent = step === currentStatut || isIncidentVariant;

          // Statut effectif à afficher (label + couleur)
          const displayStatut: PipelineStatut = isIncidentVariant ? currentStatut : step;

          return (
            <div key={step} className="flex items-start gap-3">
              {/* Icône + ligne */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full border-2 flex-shrink-0 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent && isIncidentVariant
                        ? 'bg-red-500 border-red-500 text-white'
                        : isCurrent
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isCurrent && isIncidentVariant ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Circle className="h-3 w-3 fill-current" />
                  ) : (
                    <span className="text-xs">{i + 1}</span>
                  )}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-6 ${
                      isCompleted ? 'bg-green-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pt-0.5 pb-4">
                <span
                  className={`text-sm font-medium ${
                    isCurrent && isIncidentVariant
                      ? 'text-red-700'
                      : isCurrent
                        ? 'text-primary-700'
                        : isCompleted
                          ? 'text-green-700'
                          : 'text-slate-400'
                  }`}
                >
                  {PIPELINE_LABELS[displayStatut]}
                </span>
              </div>
            </div>
          );
        })}

        {/* Statut ANNULE si applicable */}
        {currentStatut === 'ANNULE' && (
          <div className="flex items-start gap-3 mt-2">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-7 w-7 rounded-full border-2 bg-red-500 border-red-500 text-white flex-shrink-0">
                <X className="h-4 w-4" />
              </div>
            </div>
            <div className="pt-0.5">
              <span className="text-sm font-medium text-red-700">Annulé</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isTerminal && !confirmAction && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          {/* Avancer */}
          {nextSteps.map((target) => (
            <button
              key={target}
              onClick={() => handleAdvanceClick(target)}
              className="w-full flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>
                {target === 'CLOTURE' ? 'Clôturer le dossier' : `Avancer vers ${PIPELINE_LABELS[target]}`}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}

          {/* Reculer */}
          {revertTarget && (
            <button
              onClick={() => setConfirmAction({ target: revertTarget, type: 'revert' })}
              className="w-full flex items-center justify-between rounded-lg border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <span>Revenir à {PIPELINE_LABELS[revertTarget]}</span>
              <ChevronLeft className="h-4 w-4 text-amber-400" />
            </button>
          )}

          {/* Annuler (ouvre la modale cascade) */}
          {canCancel(currentStatut) && userRole === 'ADMIN' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Annuler le dossier
            </button>
          )}
        </div>
      )}

      {/* Modale de confirmation inline (avancer / reculer — sauf CLOTURE) */}
      {confirmAction && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-900">
            {confirmAction.type === 'revert'
              ? `Revenir de ${PIPELINE_LABELS[currentStatut]} à ${PIPELINE_LABELS[confirmAction.target]} ?`
              : `Passer de ${PIPELINE_LABELS[currentStatut]} à ${PIPELINE_LABELS[confirmAction.target]} ?`}
          </p>

          {/* Motif obligatoire pour revert */}
          {confirmAction.type === 'revert' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Motif (obligatoire)
              </label>
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Raison de ce changement..."
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirmer
            </button>
            <button
              onClick={() => { setConfirmAction(null); setMotif(''); setError(''); }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
