import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  Search,
  X,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { getAllPaiements, type PaiementEnrichi } from '@/lib/api/paiements';
import { getLogements } from '@/lib/api/logements';
import { formatDateFR } from '@/lib/dateUtils';
import type { Logement, PaiementStatut } from '@/types/database.types';

const STATUT_OPTIONS: Array<{ value: PaiementStatut; label: string }> = [
  { value: 'EN_RETARD', label: 'En retard' },
  { value: 'DU', label: 'Dû' },
  { value: 'PAYE', label: 'Payé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const STATUT_COLORS: Record<PaiementStatut, string> = {
  DU: 'bg-amber-100 text-amber-700',
  EN_RETARD: 'bg-red-100 text-red-700',
  PAYE: 'bg-green-100 text-green-700',
  ANNULE: 'bg-slate-100 text-slate-500',
};

const TYPE_LABELS: Record<string, string> = {
  ARRHES: 'Arrhes',
  ACOMPTE: 'Acompte',
  SOLDE: 'Solde',
  TAXE_SEJOUR: 'Taxe séjour',
  EXTRA: 'Extra',
};

function computeDaysOverdue(echeanceDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const echeance = new Date(echeanceDate);
  echeance.setHours(0, 0, 0, 0);
  const diff = today.getTime() - echeance.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function PaiementsGlobal() {
  const navigate = useNavigate();
  const { selectedLogementId } = useSelectedLogement();

  const [paiements, setPaiements] = useState<PaiementEnrichi[]>([]);
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedStatuts, setSelectedStatuts] = useState<PaiementStatut[]>(['EN_RETARD', 'DU']);
  const [selectedLogement, setSelectedLogement] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    getLogements().then(setLogements).catch(() => {});
  }, []);

  // Appliquer le filtre logement global par défaut
  useEffect(() => {
    if (selectedLogementId && !selectedLogement) {
      setSelectedLogement(selectedLogementId);
    }
  }, [selectedLogementId, selectedLogement]);

  const loadPaiements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPaiements({
        logement_id: selectedLogement || undefined,
        statuts: selectedStatuts.length > 0 ? selectedStatuts : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      // Tri : en retard d'abord, puis par échéance
      data.sort((a, b) => {
        const aRetard = a.statut === 'EN_RETARD' ? 0 : 1;
        const bRetard = b.statut === 'EN_RETARD' ? 0 : 1;
        if (aRetard !== bRetard) return aRetard - bRetard;
        return new Date(a.echeance_date).getTime() - new Date(b.echeance_date).getTime();
      });

      setPaiements(data);
    } catch {
      setPaiements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatuts, selectedLogement, fromDate, toDate]);

  useEffect(() => {
    loadPaiements();
  }, [loadPaiements]);

  const toggleStatut = (statut: PaiementStatut) => {
    setSelectedStatuts((prev) =>
      prev.includes(statut) ? prev.filter((s) => s !== statut) : [...prev, statut],
    );
  };

  const clearFilters = () => {
    setSelectedStatuts(['EN_RETARD', 'DU']);
    setSelectedLogement('');
    setFromDate('');
    setToDate('');
  };

  const hasCustomFilters =
    selectedStatuts.length !== 2 ||
    !selectedStatuts.includes('EN_RETARD') ||
    !selectedStatuts.includes('DU') ||
    selectedLogement ||
    fromDate ||
    toDate;

  // Stats rapides
  const totalRetard = paiements
    .filter((p) => p.statut === 'EN_RETARD')
    .reduce((s, p) => s + p.montant_eur, 0);
  const totalDu = paiements
    .filter((p) => p.statut === 'DU')
    .reduce((s, p) => s + p.montant_eur, 0);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-6 w-6 text-primary-600" />
        <h1 className="text-xl font-semibold">Paiements</h1>
      </div>

      {/* Stats rapides */}
      {(totalRetard > 0 || totalDu > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {totalRetard > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                En retard
              </div>
              <p className="text-lg font-bold text-red-700">{totalRetard.toFixed(2)} €</p>
            </div>
          )}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-600 mb-1">Restant dû</div>
            <p className="text-lg font-bold text-amber-700">{totalDu.toFixed(2)} €</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filtres</span>
          </div>
          {hasCustomFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>

        {/* Statuts — chips */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Statut</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleStatut(opt.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedStatuts.includes(opt.value)
                    ? STATUT_COLORS[opt.value] + ' ring-1 ring-current'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Logement</label>
            <select
              value={selectedLogement}
              onChange={(e) => setSelectedLogement(e.target.value)}
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
            <label className="text-xs text-slate-400 mb-1 block">Du</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Au</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Compteur */}
      <p className="text-sm text-slate-500">
        {paiements.length} paiement{paiements.length > 1 ? 's' : ''}
      </p>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : paiements.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CreditCard className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Aucun paiement trouvé.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paiements.map((p) => {
            const daysOverdue =
              p.statut === 'EN_RETARD' ? computeDaysOverdue(p.echeance_date) : 0;

            return (
              <button
                key={p.id}
                onClick={() => navigate(`/dossiers/${p.dossier_id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm shadow-sm hover:border-primary-200 hover:shadow transition-all"
              >
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-slate-900 truncate">
                      {p.locataire_prenom} {p.locataire_nom}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {p.logement_nom}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{TYPE_LABELS[p.type] || p.type}</span>
                    <span>·</span>
                    <span>{formatDateFR(p.echeance_date)}</span>
                    {daysOverdue > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 font-medium">
                          {daysOverdue}j de retard
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Montant + statut */}
                <div className="text-right shrink-0">
                  <p className="font-semibold text-slate-900">{p.montant_eur.toFixed(2)} €</p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${STATUT_COLORS[p.statut]}`}
                  >
                    {STATUT_OPTIONS.find((o) => o.value === p.statut)?.label || p.statut}
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
