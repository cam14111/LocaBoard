import { useNavigate } from 'react-router-dom';
import { Calendar, Euro, Home } from 'lucide-react';
import { PIPELINE_LABELS, PIPELINE_COLORS } from '@/lib/pipeline';
import { formatDateFR } from '@/lib/dateUtils';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import type { Reservation, PipelineStatut } from '@/types/database.types';

interface DossierItem {
  id: string;
  pipeline_statut: string;
  logement_id: string;
  reservations: Reservation | null;
}

// Colonnes kanban : regroupement logique des étapes
const KANBAN_COLUMNS: { label: string; statuts: PipelineStatut[] }[] = [
  { label: 'Pré-contrat', statuts: ['DEMANDE_RECUE', 'OPTION_POSEE'] },
  { label: 'Contrat', statuts: ['CONTRAT_ENVOYE', 'CONTRAT_SIGNE'] },
  { label: 'Paiements', statuts: ['ACOMPTE_RECU', 'SOLDE_DEMANDE', 'SOLDE_RECU'] },
  { label: 'Séjour', statuts: ['CHECKIN_FAIT', 'EDL_ENTREE_OK', 'EDL_ENTREE_INCIDENT', 'CHECKOUT_FAIT'] },
  { label: 'Finalisation', statuts: ['EDL_OK', 'EDL_INCIDENT', 'CLOTURE'] },
];

interface DossiersKanbanProps {
  dossiers: DossierItem[];
}

export default function DossiersKanban({ dossiers }: DossiersKanbanProps) {
  const navigate = useNavigate();
  const { selectedLogementId, logements } = useSelectedLogement();

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 snap-x lg:grid lg:grid-cols-5 lg:overflow-x-visible lg:mx-0 lg:px-0">
      {KANBAN_COLUMNS.map((col) => {
        const items = dossiers.filter((d) =>
          col.statuts.includes(d.pipeline_statut as PipelineStatut),
        );

        return (
          <div
            key={col.label}
            className="flex-shrink-0 w-56 snap-start lg:w-auto lg:min-w-0"
          >
            {/* En-tête colonne */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {items.length}
              </span>
            </div>

            {/* Cartes */}
            <div className="space-y-2 min-h-[200px] rounded-xl bg-slate-50 p-2">
              {items.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-8">Vide</p>
              ) : (
                items.map((d) => {
                  const r = d.reservations;
                  const color = PIPELINE_COLORS[d.pipeline_statut as PipelineStatut] || 'bg-slate-100 text-slate-700';
                  const label = PIPELINE_LABELS[d.pipeline_statut as PipelineStatut] || d.pipeline_statut;

                  const logementNom = !selectedLogementId
                    ? logements.find((l) => l.id === d.logement_id)?.nom
                    : undefined;

                  return (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/dossiers/${d.id}`)}
                      className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-primary-300 hover:shadow transition-all"
                    >
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r?.locataire_prenom} {r?.locataire_nom}
                      </p>
                      {r && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {formatDateFR(r.date_debut)} → {formatDateFR(r.date_fin)}
                          </span>
                        </div>
                      )}
                      {r?.loyer_total != null && r.loyer_total > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <Euro className="h-3 w-3 flex-shrink-0" />
                          <span>{r.loyer_total.toFixed(2)} €</span>
                        </div>
                      )}
                      {logementNom && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <Home className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{logementNom}</span>
                        </div>
                      )}
                      <span className={`inline-block mt-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
                        {label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
