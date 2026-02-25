import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Loader2, Calendar, Search, Euro, List, Columns3, Home } from 'lucide-react';
import { getDossiers } from '@/lib/api/dossiers';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { formatDateFR } from '@/lib/dateUtils';
import { PIPELINE_LABELS, PIPELINE_COLORS } from '@/lib/pipeline';
import DossiersKanban from '@/components/dossier/DossiersKanban';
import type { Reservation, PipelineStatut } from '@/types/database.types';

interface DossierWithReservation {
  id: string;
  pipeline_statut: string;
  created_at: string;
  logement_id: string;
  reservations: Reservation | null;
}

// Groupes de filtres rapides
const FILTER_GROUPS: { label: string; statuts: PipelineStatut[] }[] = [
  {
    label: 'En cours',
    statuts: [
      'DEMANDE_RECUE', 'OPTION_POSEE', 'CONTRAT_ENVOYE', 'CONTRAT_SIGNE',
      'ACOMPTE_RECU', 'SOLDE_DEMANDE', 'SOLDE_RECU',
      'CHECKIN_FAIT', 'EDL_ENTREE_OK', 'EDL_ENTREE_INCIDENT',
      'CHECKOUT_FAIT', 'EDL_OK', 'EDL_INCIDENT',
    ],
  },
  { label: 'Clôturés', statuts: ['CLOTURE'] },
  { label: 'Annulés', statuts: ['ANNULE'] },
];

export default function Dossiers() {
  const { selectedLogementId, logements } = useSelectedLogement();
  const navigate = useNavigate();

  const [dossiers, setDossiers] = useState<DossierWithReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(0); // index dans FILTER_GROUPS
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getDossiers({ logement_id: selectedLogementId || undefined, limit: 200 });
        if (!cancelled) setDossiers(data as unknown as DossierWithReservation[]);
      } catch (err) {
        console.error('Erreur chargement dossiers:', err);
        if (!cancelled) setDossiers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedLogementId]);

  // Filtrage côté client (recherche + filtre pipeline)
  const filtered = useMemo(() => {
    const group = FILTER_GROUPS[activeFilter];
    let result = dossiers.filter((d) =>
      group.statuts.includes(d.pipeline_statut as PipelineStatut),
    );

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((d) => {
        const r = d.reservations;
        if (!r) return false;
        const fullName = `${r.locataire_prenom} ${r.locataire_nom}`.toLowerCase();
        return fullName.includes(q);
      });
    }

    return result;
  }, [dossiers, activeFilter, search]);

  // Compteurs par groupe
  const counts = useMemo(() => {
    return FILTER_GROUPS.map((g) =>
      dossiers.filter((d) => g.statuts.includes(d.pipeline_statut as PipelineStatut)).length,
    );
  }, [dossiers]);

  return (
    <div className={`p-4 mx-auto ${viewMode === 'kanban' ? 'max-w-full' : 'max-w-3xl'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary-600" />
          <h1 className="text-xl font-semibold">Dossiers</h1>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            title="Vue liste"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            title="Vue kanban"
          >
            <Columns3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Barre de recherche + filtres (masqués en mode kanban) */}
      {viewMode === 'list' && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom..."
              className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
            {FILTER_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setActiveFilter(i)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === i
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g.label}
                <span
                  className={`inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full px-1 text-xs ${
                    activeFilter === i ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {counts[i]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : viewMode === 'kanban' ? (
        <DossiersKanban dossiers={dossiers} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FolderOpen className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">
            {search ? 'Aucun dossier correspondant.' : 'Aucun dossier dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
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
                className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-primary-300 hover:shadow transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {r?.locataire_prenom} {r?.locataire_nom}
                    </p>
                    {r && (
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {formatDateFR(r.date_debut)} → {formatDateFR(r.date_fin)}
                        </span>
                      </div>
                    )}
                    {r?.loyer_total != null && r.loyer_total > 0 && (
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Euro className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{r.loyer_total.toFixed(2)} €</span>
                      </div>
                    )}
                    {logementNom && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Home className="h-3 w-3 flex-shrink-0" />
                        <span>{logementNom}</span>
                      </div>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${color}`}>
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
