import { useState, useEffect, type FormEvent } from 'react';
import { X, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { createBlocage } from '@/lib/api/blocages';
import { parseRpcError } from '@/lib/rpcErrors';
import { toDateString } from '@/lib/dateUtils';
import type { BlocageMotif } from '@/types/database.types';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { useConflictCheck } from '@/hooks/useConflictCheck';

interface BlocageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  logementId: string | null;
  initialDate?: Date | null;
}

const MOTIF_OPTIONS: { value: BlocageMotif; label: string }[] = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'USAGE_PERSO', label: 'Usage personnel' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function BlocageModal({
  isOpen,
  onClose,
  onCreated,
  logementId,
  initialDate,
}: BlocageModalProps) {
  const { logements } = useSelectedLogement();
  const [localLogementId, setLocalLogementId] = useState(logementId ?? '');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motif, setMotif] = useState<BlocageMotif>('USAGE_PERSO');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { conflict, checking: conflictChecking } = useConflictCheck(
    localLogementId,
    dateDebut,
    dateFin,
  );

  useEffect(() => {
    if (isOpen) {
      setLocalLogementId(logementId ?? '');
      setDateDebut(initialDate ? toDateString(initialDate) : '');
      setDateFin('');
      setMotif('USAGE_PERSO');
      setNotes('');
      setError('');
    }
  }, [isOpen, initialDate, logementId]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleDateDebut(value: string) {
    setDateDebut(value);
    // Si la date de début devient >= date de fin, réinitialiser la fin
    if (dateFin && value >= dateFin) {
      setDateFin('');
    }
  }

  function validate(): string | null {
    if (!localLogementId) return 'Veuillez sélectionner un logement.';
    if (!dateDebut) return 'La date de début est requise.';
    if (!dateFin) return 'La date de fin est requise.';
    if (dateFin <= dateDebut) return 'La date de fin doit être après la date de début.';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await createBlocage({
        logement_id: localLogementId,
        date_debut: dateDebut,
        date_fin: dateFin,
        motif,
        notes: notes.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setSaving(false);
    }
  }

  const INPUT = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';
  const LABEL = 'block text-sm font-medium text-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true" aria-labelledby="bl-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} role="presentation" />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-600" aria-hidden="true" />
            <h2 id="bl-title" className="text-lg font-semibold">Nouveau blocage</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sélecteur logement (uniquement si aucun logement pré-sélectionné) */}
          {!logementId && (
            <div>
              <label htmlFor="bl-logement" className={LABEL}>
                Logement <span className="text-red-500">*</span>
              </label>
              <select
                id="bl-logement"
                required
                value={localLogementId}
                onChange={(e) => setLocalLogementId(e.target.value)}
                className={INPUT}
              >
                <option value="">— Choisir un logement —</option>
                {logements.map((l) => (
                  <option key={l.id} value={l.id}>{l.nom}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bl-date-debut" className={LABEL}>
                Début <span className="text-red-500">*</span>
              </label>
              <input
                id="bl-date-debut"
                type="date"
                required
                max={dateFin || undefined}
                value={dateDebut}
                onChange={(e) => handleDateDebut(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="bl-date-fin" className={LABEL}>
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                id="bl-date-fin"
                type="date"
                required
                min={dateDebut || undefined}
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Conflit de dates */}
          {conflictChecking && dateDebut && dateFin && (
            <p className="text-xs text-slate-400">Vérification des disponibilités…</p>
          )}
          {!conflictChecking && conflict && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800" role="alert">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{conflict.label}</span>
            </div>
          )}

          {/* Motif */}
          <div>
            <label htmlFor="bl-motif" className={LABEL}>Motif</label>
            <select
              id="bl-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value as BlocageMotif)}
              className={INPUT}
            >
              {MOTIF_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="bl-notes" className={LABEL}>Notes</label>
            <textarea
              id="bl-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Erreur */}
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !!conflict}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le blocage
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
