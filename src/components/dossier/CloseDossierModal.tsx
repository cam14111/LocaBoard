import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import { updatePipelineStatut } from '@/lib/api/dossiers';
import { getPaiementsByDossier } from '@/lib/api/paiements';
import { getEdlByDossier } from '@/lib/api/edl';

interface CloseDossierModalProps {
  dossierId: string;
  onClosed: () => void;
  onClose: () => void;
}

export default function CloseDossierModal({
  dossierId,
  onClosed,
  onClose,
}: CloseDossierModalProps) {
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  // Résultat des vérifications
  const [edlDepartOk, setEdlDepartOk] = useState(false);
  const [paiementsOk, setPaiementsOk] = useState(true);
  const [paiementsWarning, setPaiementsWarning] = useState('');

  useEffect(() => {
    async function checkPrerequisites() {
      try {
        // Vérifier EDL départ
        const edls = await getEdlByDossier(dossierId);
        const edlDepart = edls.find((e) => e.type === 'DEPART');
        const departTermine =
          edlDepart?.statut === 'TERMINE_OK' || edlDepart?.statut === 'TERMINE_INCIDENT';
        setEdlDepartOk(departTermine);

        // Vérifier paiements
        const paiements = await getPaiementsByDossier(dossierId);
        const nonResolus = paiements.filter(
          (p) => p.statut === 'DU' || p.statut === 'EN_RETARD',
        );
        if (nonResolus.length > 0) {
          const total = nonResolus.reduce((s, p) => s + p.montant_eur, 0);
          setPaiementsOk(false);
          setPaiementsWarning(
            `${nonResolus.length} paiement${nonResolus.length > 1 ? 's' : ''} non résolu${nonResolus.length > 1 ? 's' : ''} (${total.toFixed(2)} €)`,
          );
        }
      } catch {
        setError('Erreur lors de la vérification des prérequis.');
      } finally {
        setLoading(false);
      }
    }
    checkPrerequisites();
  }, [dossierId]);

  async function handleClose() {
    setClosing(true);
    setError('');
    try {
      await updatePipelineStatut(dossierId, 'CLOTURE');
      onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la clôture.');
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Clôturer le dossier</h3>
          </div>
          <button onClick={onClose} disabled={closing} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Vérification EDL départ */}
              <div className={`flex items-start gap-3 rounded-xl p-3 ${
                edlDepartOk ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {edlDepartOk ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${edlDepartOk ? 'text-green-800' : 'text-red-800'}`}>
                    EDL départ
                  </p>
                  <p className={`text-xs ${edlDepartOk ? 'text-green-600' : 'text-red-600'}`}>
                    {edlDepartOk
                      ? 'EDL départ terminé'
                      : 'EDL départ non terminé — obligatoire pour clôturer'}
                  </p>
                </div>
              </div>

              {/* Vérification paiements */}
              <div className={`flex items-start gap-3 rounded-xl p-3 ${
                paiementsOk ? 'bg-green-50' : 'bg-amber-50'
              }`}>
                {paiementsOk ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${paiementsOk ? 'text-green-800' : 'text-amber-800'}`}>
                    Paiements
                  </p>
                  <p className={`text-xs ${paiementsOk ? 'text-green-600' : 'text-amber-600'}`}>
                    {paiementsOk
                      ? 'Tous les paiements sont réglés ou annulés'
                      : paiementsWarning}
                  </p>
                </div>
              </div>

              {/* Info lecture seule */}
              <p className="text-xs text-slate-500">
                <Lock className="inline h-3 w-3 mr-1" />
                Une fois clôturé, le dossier passera en lecture seule.
              </p>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={closing}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleClose}
            disabled={closing || loading || !edlDepartOk}
            className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {closing ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              'Clôturer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
