import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Loader2, AlertCircle, CreditCard, FileText, Home, ShieldAlert } from 'lucide-react';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { getDossierById } from '@/lib/api/dossiers';
import { getReservationById } from '@/lib/api/reservations';
import { getPaiementsByDossier, sweepOverduePaiements } from '@/lib/api/paiements';
import { getIncidentsByDossier } from '@/lib/api/incidents';
import { getAuditLogByEntity } from '@/lib/api/audit';
import { formatDateFR, computeNights } from '@/lib/dateUtils';
import { PIPELINE_LABELS, PIPELINE_COLORS } from '@/lib/pipeline';
import AuditTimeline from '@/components/dossier/AuditTimeline';
import PipelineStepper from '@/components/dossier/PipelineStepper';
import PaiementsTab from '@/components/dossier/PaiementsTab';
import NotesSection from '@/components/dossier/NotesSection';
import DocumentsTab from '@/components/dossier/DocumentsTab';
import EdlTab from '@/components/dossier/EdlTab';
import TachesTab from '@/components/dossier/TachesTab';
import type { Dossier, Reservation, Paiement, AuditLog, PipelineStatut, IncidentSeverite } from '@/types/database.types';

type Tab = 'resume' | 'pipeline' | 'paiements' | 'docs' | 'edl' | 'taches' | 'historique';

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedLogementId, logements } = useSelectedLogement();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [incidentMineurs, setIncidentMineurs] = useState(0);
  const [incidentMajeurs, setIncidentMajeurs] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('resume');
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const d = await getDossierById(id);
      setDossier(d);
      const r = await getReservationById(d.reservation_id);
      setReservation(r);

      // Sweep paiements en retard (non-bloquant) + charger paiements
      try {
        await sweepOverduePaiements(d.id).catch(() => {});
        const p = await getPaiementsByDossier(d.id);
        setPaiements(p);
      } catch { setPaiements([]); }

      // Incidents EDL
      try {
        const incs = await getIncidentsByDossier(d.id);
        setIncidentMineurs(incs.filter((i) => i.severite === ('MINEUR' as IncidentSeverite)).length);
        setIncidentMajeurs(incs.filter((i) => i.severite === ('MAJEUR' as IncidentSeverite)).length);
      } catch { /* non-bloquant */ }

      // Charger audit logs
      setAuditLoading(true);
      try {
        const [dossierLogs, reservationLogs] = await Promise.all([
          getAuditLogByEntity('dossier', id).catch(() => [] as AuditLog[]),
          getAuditLogByEntity('reservation', r.id).catch(() => [] as AuditLog[]),
        ]);
        const combined = [...dossierLogs, ...reservationLogs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setAuditLogs(combined);
      } catch { setAuditLogs([]); }
      finally { setAuditLoading(false); }
    } catch {
      setError('Dossier introuvable.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="p-4">
        <button onClick={() => navigate('/dossiers')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">{error || 'Dossier introuvable.'}</p>
        </div>
      </div>
    );
  }

  const nights = reservation ? computeNights(reservation.date_debut, reservation.date_fin) : 0;
  const pipelineColor = PIPELINE_COLORS[dossier.pipeline_statut as PipelineStatut] || 'bg-slate-100 text-slate-700';
  const pipelineLabel = PIPELINE_LABELS[dossier.pipeline_statut as PipelineStatut] || dossier.pipeline_statut;
  const logementNom = !selectedLogementId
    ? logements.find((l) => l.id === dossier.logement_id)?.nom
    : undefined;

  // Calculs financiers
  const totalDu = paiements.filter((p) => p.statut === 'DU' || p.statut === 'EN_RETARD').reduce((s, p) => s + p.montant_eur, 0);
  const totalPaye = paiements.filter((p) => p.statut === 'PAYE').reduce((s, p) => s + p.montant_eur, 0);
  const totalRetard = paiements.filter((p) => p.statut === 'EN_RETARD').reduce((s, p) => s + p.montant_eur, 0);
  const totalGeneral = paiements.filter((p) => p.statut !== 'ANNULE').reduce((s, p) => s + p.montant_eur, 0);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resume', label: 'Résumé' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'paiements', label: 'Paiements' },
    { key: 'docs', label: 'Docs' },
    { key: 'edl', label: 'EDL' },
    { key: 'taches', label: 'Tâches' },
    { key: 'historique', label: 'Historique' },
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Retour */}
      <button onClick={() => navigate('/dossiers')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-semibold">
              {reservation ? `${reservation.locataire_prenom} ${reservation.locataire_nom}` : 'Dossier'}
            </h1>
            {reservation && (
              <p className="text-sm text-slate-500">
                {formatDateFR(reservation.date_debut)} → {formatDateFR(reservation.date_fin)}
                {nights > 0 && ` (${nights} nuit${nights > 1 ? 's' : ''})`}
              </p>
            )}
            {logementNom && (
              <p className="flex items-center gap-1 text-sm text-slate-400 mt-0.5">
                <Home className="h-3.5 w-3.5 flex-shrink-0" />
                {logementNom}
              </p>
            )}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${pipelineColor}`}>
          {pipelineLabel}
        </span>
      </div>

      {/* Onglets — overflow-x-auto + scrollbar-hide pour éviter le widget natif Windows */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 shrink-0 relative py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors text-center whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              {tab.label}
              {tab.key === 'paiements' && totalRetard > 0 && (
                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white">!</span>
              )}
              {tab.key === 'edl' && (dossier.pipeline_statut === 'EDL_INCIDENT' || dossier.pipeline_statut === 'EDL_ENTREE_INCIDENT') && (
                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white">!</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'resume' && (
        <ResumeTab
          dossier={dossier}
          reservation={reservation}
          totalDu={totalDu}
          totalPaye={totalPaye}
          totalRetard={totalRetard}
          totalGeneral={totalGeneral}
          incidentMineurs={incidentMineurs}
          incidentMajeurs={incidentMajeurs}
          onGoToEdl={() => setActiveTab('edl')}
        />
      )}
      {activeTab === 'pipeline' && (
        <PipelineStepper
          dossierId={dossier.id}
          currentStatut={dossier.pipeline_statut as PipelineStatut}
          userRole="ADMIN"
          onUpdated={loadAll}
        />
      )}
      {activeTab === 'paiements' && (
        <PaiementsTab paiements={paiements} dossierId={dossier.id} onUpdated={loadAll} />
      )}
      {activeTab === 'docs' && (
        <DocumentsTab dossierId={dossier.id} dossier={dossier} reservation={reservation} />
      )}
      {activeTab === 'edl' && (
        <EdlTab dossierId={dossier.id} logementId={dossier.logement_id} />
      )}
      {activeTab === 'taches' && (
        <TachesTab dossierId={dossier.id} logementId={dossier.logement_id} />
      )}
      {activeTab === 'historique' && (
        <AuditTimeline logs={auditLogs} loading={auditLoading} />
      )}
    </div>
  );
}

// ─── Onglet Résumé enrichi ──────────────────────────────────

function ResumeTab({
  dossier,
  reservation,
  totalDu,
  totalPaye,
  totalRetard,
  totalGeneral,
  incidentMineurs,
  incidentMajeurs,
  onGoToEdl,
}: {
  dossier: Dossier;
  reservation: Reservation | null;
  totalDu: number;
  totalPaye: number;
  totalRetard: number;
  totalGeneral: number;
  incidentMineurs: number;
  incidentMajeurs: number;
  onGoToEdl: () => void;
}) {
  const totalIncidents = incidentMineurs + incidentMajeurs;

  return (
    <div className="space-y-6">
      {/* Alertes */}
      {totalRetard > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{totalRetard.toFixed(2)} € en retard de paiement</span>
        </div>
      )}
      {totalIncidents > 0 && (
        <button
          onClick={onGoToEdl}
          className={`w-full flex items-center justify-between gap-2 rounded-lg border p-3 text-sm text-left transition-colors ${
            incidentMajeurs > 0
              ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>
              {totalIncidents} incident{totalIncidents > 1 ? 's' : ''} EDL
              {incidentMajeurs > 0 && incidentMineurs > 0 && (
                <span className="ml-1 font-normal opacity-80">
                  ({incidentMajeurs} majeur{incidentMajeurs > 1 ? 's' : ''}, {incidentMineurs} mineur{incidentMineurs > 1 ? 's' : ''})
                </span>
              )}
              {incidentMajeurs > 0 && incidentMineurs === 0 && (
                <span className="ml-1 font-normal opacity-80">
                  ({incidentMajeurs} majeur{incidentMajeurs > 1 ? 's' : ''})
                </span>
              )}
              {incidentMajeurs === 0 && incidentMineurs > 0 && (
                <span className="ml-1 font-normal opacity-80">
                  ({incidentMineurs} mineur{incidentMineurs > 1 ? 's' : ''})
                </span>
              )}
            </span>
          </div>
          <span className="text-xs opacity-70 flex-shrink-0">Voir l'EDL →</span>
        </button>
      )}

      {/* Résumé financier */}
      {totalGeneral > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Financier</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Payé</span>
              <p className="text-green-700 font-medium">{totalPaye.toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Restant dû</span>
              <p className={`font-medium ${totalRetard > 0 ? 'text-red-600' : 'text-slate-700'}`}>{totalDu.toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Total</span>
              <p className="text-slate-700 font-medium">{totalGeneral.toFixed(2)} €</p>
            </div>
          </div>
          {/* Barre de progression */}
          {totalGeneral > 0 && (
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalPaye / totalGeneral) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Réservation */}
      {reservation && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Réservation</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Locataire</span>
              <p className="text-slate-700">{reservation.locataire_prenom} {reservation.locataire_nom}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Personnes</span>
              <p className="text-slate-700">{reservation.nb_personnes}</p>
            </div>
            {reservation.locataire_email && (
              <div>
                <span className="text-slate-400 text-xs">Email</span>
                <p className="text-slate-700">{reservation.locataire_email}</p>
              </div>
            )}
            {reservation.locataire_telephone && (
              <div>
                <span className="text-slate-400 text-xs">Téléphone</span>
                <p className="text-slate-700">{reservation.locataire_telephone}</p>
              </div>
            )}
            {reservation.loyer_total != null && (
              <div>
                <span className="text-slate-400 text-xs">Loyer total</span>
                <p className="text-slate-700">{reservation.loyer_total.toFixed(2)} €</p>
              </div>
            )}
            <div>
              <span className="text-slate-400 text-xs">Premier versement</span>
              <p className="text-slate-700">{dossier.type_premier_versement}</p>
            </div>
          </div>
          {reservation.notes && (
            <div>
              <span className="text-slate-400 text-xs">Notes</span>
              <p className="text-sm text-slate-600">{reservation.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes internes */}
      <NotesSection dossierId={dossier.id} />
    </div>
  );
}
