import { useState } from 'react';
import {
  CreditCard,
  Check,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
} from 'lucide-react';
import { markPaiementPaid, updatePaiement, createPaiement } from '@/lib/api/paiements';
import { formatDateFR } from '@/lib/dateUtils';
import type { Paiement, PaiementMethod } from '@/types/database.types';

const TYPE_LABELS: Record<string, string> = {
  ARRHES: 'Arrhes',
  ACOMPTE: 'Acompte',
  SOLDE: 'Solde',
  TAXE_SEJOUR: 'Taxe de séjour',
  EXTRA: 'Extra',
};

const STATUT_CONFIG: Record<string, { icon: typeof Check; color: string; label: string }> = {
  PAYE: { icon: Check, color: 'text-green-600 bg-green-50', label: 'Payé' },
  DU: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Dû' },
  EN_RETARD: { icon: AlertTriangle, color: 'text-red-600 bg-red-50', label: 'En retard' },
  ANNULE: { icon: X, color: 'text-slate-400 bg-slate-50', label: 'Annulé' },
};

const METHOD_OPTIONS: { value: PaiementMethod; label: string }[] = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'AUTRE', label: 'Autre' },
];

interface PaiementsTabProps {
  paiements: Paiement[];
  dossierId: string;
  onUpdated: () => void;
}

export default function PaiementsTab({ paiements, dossierId, onUpdated }: PaiementsTabProps) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaiementMethod>('VIREMENT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMontant, setEditMontant] = useState('');
  const [editDate, setEditDate] = useState('');
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraLabel, setExtraLabel] = useState('');
  const [extraMontant, setExtraMontant] = useState('');
  const [extraDate, setExtraDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleMarkPaid(id: string) {
    setLoading(true);
    setError('');
    try {
      await markPaiementPaid(id, selectedMethod);
      setPayingId(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message || 'Erreur inattendue lors de la confirmation du paiement');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p: Paiement) {
    setEditingId(p.id);
    setEditMontant(p.montant_eur.toString());
    setEditDate(p.echeance_date);
    setError('');
  }

  async function handleSaveEdit(id: string) {
    const montant = parseFloat(editMontant);
    if (isNaN(montant) || montant <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }
    if (!editDate) {
      setError('La date d\'échéance est requise.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updatePaiement(id, { montant_eur: montant, echeance_date: editDate });
      setEditingId(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExtra() {
    if (!extraLabel.trim()) {
      setError('Le libellé est requis.');
      return;
    }
    const montant = parseFloat(extraMontant);
    if (isNaN(montant) || montant <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }
    if (!extraDate) {
      setError('La date d\'échéance est requise.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createPaiement({
        dossier_id: dossierId,
        type: 'EXTRA',
        montant_eur: montant,
        echeance_date: extraDate,
        label: extraLabel.trim(),
      });
      setShowAddExtra(false);
      setExtraLabel('');
      setExtraMontant('');
      setExtraDate('');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  const INPUT = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

  return (
    <div className="space-y-3">
      {paiements.length === 0 && !showAddExtra ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Aucun paiement enregistré</p>
        </div>
      ) : (
        paiements.map((p) => {
          const cfg = STATUT_CONFIG[p.statut] || STATUT_CONFIG.DU;
          const Icon = cfg.icon;
          const isExpanded = expandedId === p.id;
          const isPaying = payingId === p.id;
          const isEditing = editingId === p.id;
          const canPay = p.statut === 'DU' || p.statut === 'EN_RETARD';
          const canEdit = p.statut === 'DU' || p.statut === 'EN_RETARD';

          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {/* Ligne principale */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0 ${cfg.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {TYPE_LABELS[p.type] || p.type}
                      {p.label && <span className="text-slate-400 font-normal"> — {p.label}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      Échéance : {formatDateFR(p.echeance_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${p.statut === 'ANNULE' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {p.montant_eur.toFixed(2)} €
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Détails */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                  {/* Mode édition */}
                  {isEditing ? (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Montant (€)</label>
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={editMontant}
                            onChange={(e) => setEditMontant(e.target.value)}
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Échéance</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className={INPUT}
                          />
                        </div>
                      </div>
                      {error && editingId === p.id && <p className="text-xs text-red-600">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(p.id)}
                          disabled={loading}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                          Enregistrer
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setError(''); }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs">Statut</span>
                          <p className={`font-medium ${cfg.color.split(' ')[0]}`}>{cfg.label}</p>
                        </div>
                        {p.method && (
                          <div>
                            <span className="text-slate-400 text-xs">Méthode</span>
                            <p className="text-slate-700">
                              {METHOD_OPTIONS.find((m) => m.value === p.method)?.label || p.method}
                            </p>
                          </div>
                        )}
                        {p.paid_at && (
                          <div>
                            <span className="text-slate-400 text-xs">Payé le</span>
                            <p className="text-slate-700">{formatDateFR(p.paid_at.substring(0, 10))}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {canEdit && !isPaying && (
                          <button
                            onClick={() => startEdit(p)}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                        )}
                        {canPay && !isPaying && (
                          <button
                            onClick={() => {
                              setPayingId(p.id);
                              setSelectedMethod('VIREMENT');
                              setError('');
                            }}
                            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                          >
                            Marquer payé
                          </button>
                        )}
                      </div>

                      {/* Formulaire de paiement inline */}
                      {isPaying && (
                        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3">
                          <label className="block text-xs text-slate-600">Méthode de paiement</label>
                          <select
                            value={selectedMethod}
                            onChange={(e) => setSelectedMethod(e.target.value as PaiementMethod)}
                            className={INPUT}
                          >
                            {METHOD_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>

                          {error && payingId === p.id && <p className="text-xs text-red-600">{error}</p>}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              disabled={loading}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                              Confirmer
                            </button>
                            <button
                              onClick={() => setPayingId(null)}
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Formulaire ajout extra */}
      {showAddExtra ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Ajouter un extra</h4>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Libellé</label>
            <input
              type="text"
              value={extraLabel}
              onChange={(e) => setExtraLabel(e.target.value)}
              placeholder="Ex : Ménage supplémentaire"
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Montant (€)</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={extraMontant}
                onChange={(e) => setExtraMontant(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Échéance</label>
              <input
                type="date"
                value={extraDate}
                onChange={(e) => setExtraDate(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>
          {error && showAddExtra && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddExtra}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Ajouter
            </button>
            <button
              onClick={() => { setShowAddExtra(false); setError(''); }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setShowAddExtra(true);
            setExtraLabel('');
            setExtraMontant('');
            setExtraDate('');
            setError('');
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un extra
        </button>
      )}
    </div>
  );
}
