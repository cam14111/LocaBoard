import { useState } from 'react';
import { X, Loader2, Calendar, Clock, Trash2, CheckCircle, Edit3, ExternalLink, Lock } from 'lucide-react';
import { cancelReservation, updateReservationDates, confirmOption } from '@/lib/api/reservations';
import { archiveBlocage } from '@/lib/api/blocages';
import { ensureDossierForReservation, getDossierByReservation } from '@/lib/api/dossiers';
import { generateAutoTaches } from '@/lib/api/taches';
import { parseRpcError } from '@/lib/rpcErrors';
import { formatDateFR, computeNights } from '@/lib/dateUtils';
import type { CalendarEvent } from '@/types/calendar.types';
import type { Reservation, Blocage } from '@/types/database.types';
import { useNavigate } from 'react-router-dom';

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdated: () => void;
  logementId: string | null;
}

export default function EventDetailPanel({ event, onClose, onUpdated, logementId }: EventDetailPanelProps) {
  if (!event) return null;
  // Extraire le logementId depuis l'événement raw si pas de logement global sélectionné
  const effectiveLogementId = logementId || (event.raw as Reservation | Blocage).logement_id;

  return (
    <>
      {/* Desktop : drawer latéral droit */}
      <div className="hidden lg:block fixed inset-y-0 right-0 z-40 w-[400px]" role="dialog" aria-modal="true" aria-label="Détail de l'événement">
        <div className="fixed inset-0 bg-black/20" onClick={onClose} role="presentation" />
        <div className="absolute inset-y-0 right-0 w-[400px] bg-white shadow-xl border-l border-slate-200 overflow-y-auto animate-in slide-in-from-right duration-200">
          <PanelContent event={event} onClose={onClose} onUpdated={onUpdated} logementId={effectiveLogementId} />
        </div>
      </div>

      {/* Mobile : modal plein écran */}
      <div className="lg:hidden fixed inset-0 z-50 bg-white overflow-y-auto animate-in slide-in-from-bottom duration-200" role="dialog" aria-modal="true" aria-label="Détail de l'événement">
        <PanelContent event={event} onClose={onClose} onUpdated={onUpdated} logementId={effectiveLogementId} />
      </div>
    </>
  );
}

function PanelContent({
  event,
  onClose,
  onUpdated,
  logementId,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated: () => void;
  logementId: string;
}) {
  const isReservation = event.type === 'reservation';
  const isOption = event.type === 'option';
  const isOptionExpired = event.type === 'option_expired';
  const isBlocage = event.type === 'blocage';

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          {isBlocage ? (
            <Lock className="h-5 w-5 text-slate-500" />
          ) : (
            <Calendar className="h-5 w-5 text-primary-600" />
          )}
          <h2 className="text-lg font-semibold truncate">
            {event.label}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isOptionExpired && (
            <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-medium">
              Expirée
            </span>
          )}
          {isOption && (
            <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-medium">
              Option
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Infos communes : dates */}
        <InfoSection event={event} />

        {/* Infos locataire (réservation/option) */}
        {!isBlocage && <TenantInfo reservation={event.raw as Reservation} />}

        {/* Blocage details */}
        {isBlocage && <BlocageInfo blocage={event.raw as Blocage} />}

        {/* Expiration option */}
        {isOption && <OptionExpirationInfo reservation={event.raw as Reservation} />}

        {/* Actions */}
        {(isReservation || isOption || isOptionExpired || isBlocage) && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {/* Confirmer option */}
            {isOption && (
              <ConfirmOptionAction
                reservationId={event.id}
                logementId={logementId}
                onUpdated={onUpdated}
                onClose={onClose}
              />
            )}

            {/* Modifier les dates (réservation + option) */}
            {(isReservation || isOption) && (
              <EditDatesAction
                reservationId={event.id}
                currentDebut={(event.raw as Reservation).date_debut}
                currentFin={(event.raw as Reservation).date_fin}
                onUpdated={onUpdated}
              />
            )}

            {/* Voir le dossier (réservation) */}
            {isReservation && (
              <ViewDossierAction reservationId={event.id} logementId={logementId} />
            )}

            {/* Annuler réservation/option — Supprimer option expirée */}
            {(isReservation || isOption || isOptionExpired) && (
              <CancelAction
                reservationId={event.id}
                label={
                  isOptionExpired
                    ? "Supprimer l'option expirée"
                    : isOption
                      ? "Annuler l'option"
                      : 'Annuler la réservation'
                }
                onUpdated={onUpdated}
                onClose={onClose}
              />
            )}

            {/* Supprimer blocage */}
            {isBlocage && (
              <DeleteBlocageAction
                blocageId={event.id}
                onUpdated={onUpdated}
                onClose={onClose}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants info ─────────────────────────────────

function InfoSection({ event }: { event: CalendarEvent }) {
  const nights = computeNights(event.dateDebut, event.dateFin);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Calendar className="h-4 w-4" />
        <span>
          {formatDateFR(event.dateDebut)} → {formatDateFR(event.dateFin)}
        </span>
      </div>
      {nights > 0 && (
        <p className="text-sm text-slate-500 pl-6">
          {nights} nuit{nights > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function TenantInfo({ reservation }: { reservation: Reservation }) {
  return (
    <div className="space-y-2 text-sm">
      <h3 className="font-medium text-slate-900">Locataire</h3>
      <div className="grid grid-cols-2 gap-2 text-slate-600">
        <div>
          <span className="text-slate-400 text-xs">Nom</span>
          <p>{reservation.locataire_prenom} {reservation.locataire_nom}</p>
        </div>
        {reservation.locataire_email && (
          <div>
            <span className="text-slate-400 text-xs">Email</span>
            <p>{reservation.locataire_email}</p>
          </div>
        )}
        {reservation.locataire_telephone && (
          <div>
            <span className="text-slate-400 text-xs">Téléphone</span>
            <p>{reservation.locataire_telephone}</p>
          </div>
        )}
        <div>
          <span className="text-slate-400 text-xs">Personnes</span>
          <p>{reservation.nb_personnes}</p>
        </div>
        {reservation.loyer_total != null && (
          <div>
            <span className="text-slate-400 text-xs">Loyer</span>
            <p>{reservation.loyer_total.toFixed(2)} €</p>
          </div>
        )}
      </div>
      {reservation.notes && (
        <div>
          <span className="text-slate-400 text-xs">Notes</span>
          <p className="text-slate-600">{reservation.notes}</p>
        </div>
      )}
    </div>
  );
}

function BlocageInfo({ blocage }: { blocage: Blocage }) {
  const MOTIF_LABELS: Record<string, string> = {
    MAINTENANCE: 'Maintenance',
    USAGE_PERSO: 'Usage personnel',
    AUTRE: 'Autre',
  };
  return (
    <div className="space-y-2 text-sm">
      <h3 className="font-medium text-slate-900">Détails du blocage</h3>
      <div className="text-slate-600">
        <span className="text-slate-400 text-xs">Motif</span>
        <p>{MOTIF_LABELS[blocage.motif] || blocage.motif}</p>
      </div>
      {blocage.notes && (
        <div className="text-slate-600">
          <span className="text-slate-400 text-xs">Notes</span>
          <p>{blocage.notes}</p>
        </div>
      )}
    </div>
  );
}

function OptionExpirationInfo({ reservation }: { reservation: Reservation }) {
  if (!reservation.expiration_at) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span>
        Expire le {formatDateFR(reservation.expiration_at.substring(0, 10))}
      </span>
    </div>
  );
}

// ─── Sous-composants actions ──────────────────────────────

function ConfirmOptionAction({
  reservationId,
  logementId,
  onUpdated,
  onClose,
}: {
  reservationId: string;
  logementId: string;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await confirmOption(reservationId);
      // Auto-création dossier + tâches auto
      try {
        const dossier = await ensureDossierForReservation(reservationId, logementId);
        // E08-05 : Génération auto tâches
        await generateAutoTaches({
          dossier_id: dossier.id,
          logement_id: logementId,
          reservation_id: reservationId,
        }).catch(() => {});
      } catch {
        console.warn('Échec auto-création dossier pour option confirmée', reservationId);
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        Confirmer l'option
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function EditDatesAction({
  reservationId,
  currentDebut,
  currentFin,
  onUpdated,
}: {
  reservationId: string;
  currentDebut: string;
  currentFin: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dateDebut, setDateDebut] = useState(currentDebut);
  const [dateFin, setDateFin] = useState(currentFin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!dateDebut || !dateFin) return;
    if (dateFin <= dateDebut) {
      setError('La date de fin doit être après la date de début.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateReservationDates(reservationId, dateDebut, dateFin);
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Edit3 className="h-4 w-4" />
        Modifier les dates
      </button>
    );
  }

  const INPUT = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500">Arrivée</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Départ</label>
          <input
            type="date"
            value={dateFin}
            min={dateDebut || undefined}
            onChange={(e) => setDateFin(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Sauvegarder
        </button>
        <button
          onClick={() => { setEditing(false); setError(''); setDateDebut(currentDebut); setDateFin(currentFin); }}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function ViewDossierAction({ reservationId, logementId }: { reservationId: string; logementId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      let dossier;
      try {
        dossier = await getDossierByReservation(reservationId);
      } catch {
        // Dossier inexistant → le créer
        dossier = await ensureDossierForReservation(reservationId, logementId);
      }
      navigate(`/dossiers/${dossier.id}`);
    } catch (err) {
      console.error('Erreur accès dossier:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
      Voir le dossier
    </button>
  );
}

function CancelAction({
  reservationId,
  label,
  onUpdated,
  onClose,
}: {
  reservationId: string;
  label: string;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCancel() {
    if (!motif.trim()) {
      setError('Le motif est requis.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await cancelReservation(reservationId, motif.trim());
      onUpdated();
      onClose();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-medium text-red-700">Confirmer l'annulation</p>
      <input
        type="text"
        placeholder="Motif de l'annulation"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        className="block w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmer
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function DeleteBlocageAction({
  blocageId,
  onUpdated,
  onClose,
}: {
  blocageId: string;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      await archiveBlocage(blocageId);
      onUpdated();
      onClose();
    } catch (err) {
      setError(parseRpcError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Supprimer le blocage
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
