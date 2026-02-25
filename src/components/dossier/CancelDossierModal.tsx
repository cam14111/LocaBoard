import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cancelDossierCascade } from '@/lib/api/dossiers';
import { PIPELINE_LABELS } from '@/lib/pipeline';
import type { PipelineStatut } from '@/types/database.types';

interface CancelDossierModalProps {
  dossierId: string;
  currentStatut: PipelineStatut;
  onCancelled: () => void;
  onClose: () => void;
}

export default function CancelDossierModal({
  dossierId,
  currentStatut,
  onCancelled,
  onClose,
}: CancelDossierModalProps) {
  const [motif, setMotif] = useState('');
  const [quiAnnule, setQuiAnnule] = useState<'locataire' | 'bailleur'>('locataire');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!motif.trim()) {
      setError('Le motif est obligatoire.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await cancelDossierCascade(dossierId, motif.trim(), quiAnnule);
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'annulation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 flex items-center justify-between border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Annuler le dossier</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 text-red-400 hover:text-red-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Statut actuel */}
          <div className="text-sm text-slate-600">
            Statut actuel :{' '}
            <span className="font-medium text-slate-900">{PIPELINE_LABELS[currentStatut]}</span>
          </div>

          {/* Conséquences */}
          <div className="rounded-xl bg-red-50 border border-red-100 p-4">
            <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">
              Conséquences de l'annulation
            </p>
            <ul className="text-sm text-red-700 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                Pipeline du dossier → Annulé
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                Réservation → Annulée + créneau libéré
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                Paiements dûs et en retard → Annulés
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                Tâches à faire et en cours → Annulées
              </li>
              <li className="flex items-start gap-2 text-slate-500">
                <span className="text-slate-300 mt-0.5">-</span>
                Paiements déjà payés et tâches faites → Inchangés
              </li>
            </ul>
          </div>

          {/* Qui annule */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Qui est à l'initiative de l'annulation ?
            </label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
                  quiAnnule === 'locataire'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="quiAnnule"
                  value="locataire"
                  checked={quiAnnule === 'locataire'}
                  onChange={() => setQuiAnnule('locataire')}
                  className="sr-only"
                />
                Locataire
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
                  quiAnnule === 'bailleur'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="quiAnnule"
                  value="bailleur"
                  checked={quiAnnule === 'bailleur'}
                  onChange={() => setQuiAnnule('bailleur')}
                  className="sr-only"
                />
                Bailleur
              </label>
            </div>
          </div>

          {/* Motif */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Motif d'annulation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Raison de l'annulation..."
              rows={3}
              maxLength={500}
              className="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !motif.trim()}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              "Confirmer l'annulation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
