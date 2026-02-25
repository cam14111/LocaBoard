import { useState, useEffect, type FormEvent } from 'react';
import { X, Loader2, CalendarDays, Clock, Info, AlertTriangle } from 'lucide-react';
import { createReservation } from '@/lib/api/reservations';
import { ensureDossierForReservation } from '@/lib/api/dossiers';
import { generateAutoTaches } from '@/lib/api/taches';
import { parseRpcError } from '@/lib/rpcErrors';
import { toDateString } from '@/lib/dateUtils';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { useConflictCheck } from '@/hooks/useConflictCheck';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  logementId: string | null;
  initialDate?: Date | null;
  mode?: 'reservation' | 'option';
  optionExpirationDays?: number;
}

interface FormData {
  date_debut: string;
  date_fin: string;
  locataire_nom: string;
  locataire_prenom: string;
  locataire_email: string;
  locataire_telephone: string;
  locataire_adresse: string;
  locataire_pays: string;
  nb_personnes: string;
  nb_adultes: string;
  nb_enfants: string;
  loyer_total: string;
  notes: string;
}

function getInitialForm(initialDate?: Date | null): FormData {
  return {
    date_debut: initialDate ? toDateString(initialDate) : '',
    date_fin: '',
    locataire_nom: '',
    locataire_prenom: '',
    locataire_email: '',
    locataire_telephone: '',
    locataire_adresse: '',
    locataire_pays: 'France',
    nb_personnes: '1',
    nb_adultes: '1',
    nb_enfants: '0',
    loyer_total: '',
    notes: '',
  };
}

function computeNights(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const diff = d2.getTime() - d1.getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

export default function ReservationModal({
  isOpen,
  onClose,
  onCreated,
  logementId,
  initialDate,
  mode = 'reservation',
  optionExpirationDays = 7,
}: ReservationModalProps) {
  const isOption = mode === 'option';
  const { logements } = useSelectedLogement();
  const [localLogementId, setLocalLogementId] = useState(logementId ?? '');
  const currentLogement = logements.find((l) => l.id === localLogementId) ?? null;
  const capaciteMax = currentLogement?.capacite_personnes ?? null;
  const [form, setForm] = useState<FormData>(() => getInitialForm(initialDate));
  const [typePremierVersement, setTypePremierVersement] = useState<'ARRHES' | 'ACOMPTE'>('ARRHES');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { conflict, checking: conflictChecking } = useConflictCheck(
    localLogementId,
    form.date_debut,
    form.date_fin,
  );

  // Réinitialiser le formulaire quand la modal s'ouvre avec une nouvelle date
  useEffect(() => {
    if (isOpen) {
      setLocalLogementId(logementId ?? '');
      setForm(getInitialForm(initialDate));
      setTypePremierVersement('ARRHES');
      setError('');
    }
  }, [isOpen, initialDate, logementId]);

  // Fermeture par Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'nb_adultes' || field === 'nb_enfants') {
        const adultes = Number(field === 'nb_adultes' ? value : prev.nb_adultes) || 0;
        const enfants = Number(field === 'nb_enfants' ? value : prev.nb_enfants) || 0;
        next.nb_personnes = String(adultes + enfants);
      }
      // Si la date d'arrivée devient >= date de départ, réinitialiser le départ
      if (field === 'date_debut' && next.date_fin && value >= next.date_fin) {
        next.date_fin = '';
      }
      return next;
    });
  }

  function validate(): string | null {
    if (!localLogementId) return 'Veuillez sélectionner un logement.';
    if (!form.date_debut) return 'La date de début est requise.';
    if (!form.date_fin) return 'La date de fin est requise.';
    if (form.date_fin <= form.date_debut) return 'La date de fin doit être après la date de début.';
    if (!form.locataire_nom.trim()) return 'Le nom du locataire est requis.';
    if (!form.locataire_prenom.trim()) return 'Le prénom du locataire est requis.';
    if (!form.nb_adultes || Number(form.nb_adultes) < 1) return 'Le nombre d\'adultes doit être au moins 1.';
    if (capaciteMax !== null && Number(form.nb_personnes) > capaciteMax) {
      return `Le nombre total de personnes (${form.nb_personnes}) dépasse la capacité du logement (${capaciteMax} pers. max).`;
    }
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
      // Calcul expiration pour les options
      let expirationAt: string | undefined;
      if (isOption) {
        const exp = new Date();
        exp.setDate(exp.getDate() + optionExpirationDays);
        expirationAt = exp.toISOString();
      }

      const newId = await createReservation({
        logement_id: localLogementId,
        type: isOption ? 'OPTION' : 'RESERVATION',
        statut: isOption ? 'OPTION_ACTIVE' : 'CONFIRMEE',
        expiration_at: expirationAt,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        locataire_nom: form.locataire_nom.trim(),
        locataire_prenom: form.locataire_prenom.trim(),
        locataire_email: form.locataire_email.trim() || undefined,
        locataire_telephone: form.locataire_telephone.trim() || undefined,
        locataire_adresse: form.locataire_adresse.trim() || undefined,
        locataire_pays: form.locataire_pays || 'France',
        nb_personnes: Number(form.nb_personnes),
        nb_adultes: Number(form.nb_adultes),
        nb_enfants: Number(form.nb_enfants),
        loyer_total: form.loyer_total ? Number(form.loyer_total) : undefined,
        notes: form.notes.trim() || undefined,
      });

      // Auto-création dossier + tâches auto pour les réservations confirmées
      if (!isOption) {
        try {
          const dossier = await ensureDossierForReservation(newId, localLogementId, typePremierVersement);
          // E08-05 : Génération auto tâches
          await generateAutoTaches({
            dossier_id: dossier.id,
            logement_id: localLogementId,
            reservation_id: newId,
          }).catch(() => {});
        } catch {
          // Non bloquant : le dossier pourra être créé plus tard
          console.warn('Échec auto-création dossier pour réservation', newId);
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setSaving(false);
    }
  }

  const nights = computeNights(form.date_debut, form.date_fin);
  const INPUT = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';
  const LABEL = 'block text-sm font-medium text-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4" role="dialog" aria-modal="true" aria-labelledby="rm-title">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} role="presentation" />

      {/* Contenu */}
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-2">
            {isOption ? (
              <Clock className="h-5 w-5 text-amber-500" aria-hidden="true" />
            ) : (
              <CalendarDays className="h-5 w-5 text-primary-600" aria-hidden="true" />
            )}
            <h2 id="rm-title" className="text-lg font-semibold">
              {isOption ? 'Nouvelle option' : 'Nouvelle réservation'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Sélecteur logement (uniquement si aucun logement pré-sélectionné) */}
          {!logementId && (
            <div>
              <label htmlFor="rm-logement" className={LABEL}>
                Logement <span className="text-red-500">*</span>
              </label>
              <select
                id="rm-logement"
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
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Dates du séjour</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rm-date-debut" className={LABEL}>
                  Arrivée <span className="text-red-500">*</span>
                </label>
                <input
                  id="rm-date-debut"
                  type="date"
                  required
                  max={form.date_fin || undefined}
                  value={form.date_debut}
                  onChange={(e) => handleChange('date_debut', e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="rm-date-fin" className={LABEL}>
                  Départ <span className="text-red-500">*</span>
                </label>
                <input
                  id="rm-date-fin"
                  type="date"
                  required
                  min={form.date_debut || undefined}
                  value={form.date_fin}
                  onChange={(e) => handleChange('date_fin', e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            {nights > 0 && (
              <p className="text-sm text-slate-500">
                {nights} nuit{nights > 1 ? 's' : ''}
              </p>
            )}
            {conflictChecking && form.date_debut && form.date_fin && (
              <p className="text-xs text-slate-400">Vérification des disponibilités…</p>
            )}
            {!conflictChecking && conflict && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800" role="alert">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{conflict.label}</span>
              </div>
            )}
          </div>

          {/* Locataire */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Locataire</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rm-prenom" className={LABEL}>
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  id="rm-prenom"
                  type="text"
                  required
                  value={form.locataire_prenom}
                  onChange={(e) => handleChange('locataire_prenom', e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="rm-nom" className={LABEL}>
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="rm-nom"
                  type="text"
                  required
                  value={form.locataire_nom}
                  onChange={(e) => handleChange('locataire_nom', e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rm-email" className={LABEL}>Email</label>
                <input
                  id="rm-email"
                  type="email"
                  value={form.locataire_email}
                  onChange={(e) => handleChange('locataire_email', e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="rm-telephone" className={LABEL}>Téléphone</label>
                <input
                  id="rm-telephone"
                  type="tel"
                  value={form.locataire_telephone}
                  onChange={(e) => handleChange('locataire_telephone', e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label htmlFor="rm-adresse" className={LABEL}>Adresse</label>
              <input
                id="rm-adresse"
                type="text"
                value={form.locataire_adresse}
                onChange={(e) => handleChange('locataire_adresse', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="rm-pays" className={LABEL}>Pays</label>
              <input
                id="rm-pays"
                type="text"
                value={form.locataire_pays}
                onChange={(e) => handleChange('locataire_pays', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Détails</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rm-adultes" className={LABEL}>
                    Adultes <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="rm-adultes"
                    type="number"
                    required
                    min={1}
                    max={capaciteMax !== null ? capaciteMax : undefined}
                    value={form.nb_adultes}
                    onChange={(e) => handleChange('nb_adultes', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="rm-enfants" className={LABEL}>Enfants</label>
                  <input
                    id="rm-enfants"
                    type="number"
                    min={0}
                    max={capaciteMax !== null ? capaciteMax - 1 : undefined}
                    value={form.nb_enfants}
                    onChange={(e) => handleChange('nb_enfants', e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Total :{' '}
                <span className={`font-medium ${capaciteMax !== null && Number(form.nb_personnes) > capaciteMax ? 'text-red-600' : 'text-slate-700'}`}>
                  {form.nb_personnes} personne{Number(form.nb_personnes) > 1 ? 's' : ''}
                </span>
                {capaciteMax !== null && (
                  <span className="ml-1 text-slate-400">/ {capaciteMax} max</span>
                )}
              </p>
              {capaciteMax !== null && Number(form.nb_personnes) > capaciteMax && (
                <p className="text-xs text-red-600" role="alert">
                  Capacité du logement dépassée ({capaciteMax} pers. max).
                </p>
              )}
            </div>
            <div>
              <label htmlFor="rm-loyer" className={LABEL}>Loyer total (€)</label>
              <input
                id="rm-loyer"
                type="number"
                min={0}
                step={0.01}
                value={form.loyer_total}
                onChange={(e) => handleChange('loyer_total', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Choix arrhes/acompte (réservation uniquement) */}
          {!isOption && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Premier versement</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type_premier_versement"
                    value="ARRHES"
                    checked={typePremierVersement === 'ARRHES'}
                    onChange={() => setTypePremierVersement('ARRHES')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Arrhes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type_premier_versement"
                    value="ACOMPTE"
                    checked={typePremierVersement === 'ACOMPTE'}
                    onChange={() => setTypePremierVersement('ACOMPTE')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Acompte</span>
                </label>
              </div>
              <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {typePremierVersement === 'ARRHES'
                    ? 'Arrhes : le locataire peut se désister en perdant les arrhes. Le bailleur rembourse le double s\'il annule.'
                    : 'Acompte : engagement ferme des deux parties. Le solde est dû quoi qu\'il arrive.'}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="rm-notes" className={LABEL}>Notes</label>
            <textarea
              id="rm-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
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
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50 ${
                isOption
                  ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400'
                  : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
              }`}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isOption ? "Poser l'option" : 'Créer la réservation'}
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
