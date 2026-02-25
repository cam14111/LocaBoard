import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  CheckSquare,
  Euro,
  Loader2,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';
import { supabase } from '@/lib/supabase';
import { toDateString, formatDateFR } from '@/lib/dateUtils';
import { PIPELINE_LABELS, PIPELINE_COLORS } from '@/lib/pipeline';
import type { PipelineStatut } from '@/types/database.types';

interface IncidentGroupe {
  dossier_id: string;
  locataire_nom: string;
  locataire_prenom: string;
  logement_nom: string;
  mineurs: number;
  majeurs: number;
  dernierIncident: string; // created_at du plus récent
}

interface OptionExpirante {
  id: string;
  locataire_nom: string;
  locataire_prenom: string;
  date_debut: string;
  date_fin: string;
  expiration_at: string;
}

interface DashboardData {
  arrivees: Array<{
    id: string;
    locataire_nom: string;
    locataire_prenom: string;
    date_debut: string;
    nb_personnes: number;
  }>;
  departs: Array<{
    id: string;
    locataire_nom: string;
    locataire_prenom: string;
    date_fin: string;
  }>;
  tachesCount: number;
  paiementsEnAttente: number;
  paiementsEnRetard: number;
  optionsExpirantes: OptionExpirante[];
  incidents: IncidentGroupe[];
  prochaines: Array<{
    id: string;
    locataire_nom: string;
    locataire_prenom: string;
    date_debut: string;
    date_fin: string;
    pipeline_statut: PipelineStatut;
    dossier_id: string | null;
  }>;
}

/** Formate le temps restant avant expiration */
function formatTimeRemaining(expirationAt: string): string {
  const now = Date.now();
  const expiry = new Date(expirationAt).getTime();
  const diffMs = expiry - now;

  if (diffMs <= 0) return 'Expirée';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export default function Dashboard() {
  const { selectedLogementId } = useSelectedLogement();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const today = toDateString(new Date());
        const in7days = toDateString(new Date(Date.now() + 7 * 86400000));
        const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        // Arrivées aujourd'hui
        let arrivQuery = supabase
          .from('reservations')
          .select('id, locataire_nom, locataire_prenom, date_debut, nb_personnes')
          .eq('date_debut', today)
          .in('statut', ['CONFIRMEE', 'OPTION_ACTIVE'])
          .is('archived_at', null);
        if (selectedLogementId) arrivQuery = arrivQuery.eq('logement_id', selectedLogementId);
        const { data: arrivees } = await arrivQuery;

        if (cancelled) return;

        // Départs aujourd'hui
        let depQuery = supabase
          .from('reservations')
          .select('id, locataire_nom, locataire_prenom, date_fin')
          .eq('date_fin', today)
          .in('statut', ['CONFIRMEE', 'OPTION_ACTIVE'])
          .is('archived_at', null);
        if (selectedLogementId) depQuery = depQuery.eq('logement_id', selectedLogementId);
        const { data: departs } = await depQuery;

        if (cancelled) return;

        // Tâches à faire
        let tachesQuery = supabase
          .from('taches')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['A_FAIRE', 'EN_COURS']);
        if (selectedLogementId) tachesQuery = tachesQuery.eq('logement_id', selectedLogementId);
        const { count: tachesCount } = await tachesQuery;

        if (cancelled) return;

        // Paiements & incidents : filtrer via les dossiers du logement
        let dossierQuery = supabase
          .from('dossiers')
          .select('id, reservation_id, logement_id')
          .is('archived_at', null);
        if (selectedLogementId) dossierQuery = dossierQuery.eq('logement_id', selectedLogementId);
        const { data: dossierIds } = await dossierQuery;

        if (cancelled) return;

        const dossierIdSet = new Set((dossierIds ?? []).map((d) => d.id));
        const dossierReservationMap = new Map(
          (dossierIds ?? []).map((d) => [d.id, d.reservation_id as string]),
        );
        const dossierLogementMap = new Map(
          (dossierIds ?? []).map((d) => [d.id, d.logement_id as string]),
        );

        const { data: paiementsDu } = await supabase
          .from('paiements')
          .select('id, dossier_id')
          .eq('statut', 'DU');

        const { data: paiementsRetard } = await supabase
          .from('paiements')
          .select('id, dossier_id')
          .eq('statut', 'EN_RETARD');

        if (cancelled) return;

        const paiementsEnAttente = (paiementsDu ?? []).filter((p) =>
          dossierIdSet.has(p.dossier_id),
        ).length;
        const paiementsEnRetard = (paiementsRetard ?? []).filter((p) =>
          dossierIdSet.has(p.dossier_id),
        ).length;

        // Options expirant sous 48h
        let optQuery = supabase
          .from('reservations')
          .select('id, locataire_nom, locataire_prenom, date_debut, date_fin, expiration_at')
          .eq('statut', 'OPTION_ACTIVE')
          .not('expiration_at', 'is', null)
          .lte('expiration_at', in48h)
          .is('archived_at', null)
          .order('expiration_at');
        if (selectedLogementId) optQuery = optQuery.eq('logement_id', selectedLogementId);
        const { data: optionsExpirantes } = await optQuery;

        if (cancelled) return;

        // Incidents EDL — tous les dossiers non-archivés, groupés ensuite par dossier
        let rawIncidents: Array<{
          dossier_id: string;
          severite: string;
          created_at: string;
        }> = [];
        const dossierIdArray = [...dossierIdSet];
        if (dossierIdArray.length > 0) {
          const { data: incData } = await supabase
            .from('incidents')
            .select('dossier_id, severite, created_at')
            .in('dossier_id', dossierIdArray)
            .order('created_at', { ascending: false });
          rawIncidents = incData ?? [];
        }

        if (cancelled) return;

        // Grouper par dossier_id
        const incGroupMap = new Map<
          string,
          { mineurs: number; majeurs: number; dernierIncident: string }
        >();
        for (const inc of rawIncidents) {
          const existing = incGroupMap.get(inc.dossier_id);
          if (existing) {
            if (inc.severite === 'MAJEUR') existing.majeurs++;
            else existing.mineurs++;
            // rawIncidents est déjà trié desc, donc le premier rencontré est le plus récent
          } else {
            incGroupMap.set(inc.dossier_id, {
              mineurs: inc.severite === 'MINEUR' ? 1 : 0,
              majeurs: inc.severite === 'MAJEUR' ? 1 : 0,
              dernierIncident: inc.created_at,
            });
          }
        }

        // Enrichir avec les noms des locataires
        const incidentReservationIds = [
          ...new Set(
            [...incGroupMap.keys()]
              .map((did) => dossierReservationMap.get(did))
              .filter((rid): rid is string => !!rid),
          ),
        ];
        const incResMap = new Map<string, { locataire_nom: string; locataire_prenom: string }>();
        if (incidentReservationIds.length > 0) {
          const { data: incResData } = await supabase
            .from('reservations')
            .select('id, locataire_nom, locataire_prenom')
            .in('id', incidentReservationIds);
          (incResData ?? []).forEach((r) => incResMap.set(r.id, r));
        }

        // Récupérer les noms des logements concernés
        const incidentLogementIds = [
          ...new Set(
            [...incGroupMap.keys()]
              .map((did) => dossierLogementMap.get(did))
              .filter((lid): lid is string => !!lid),
          ),
        ];
        const logementNomMap = new Map<string, string>();
        if (incidentLogementIds.length > 0) {
          const { data: logData } = await supabase
            .from('logements')
            .select('id, nom')
            .in('id', incidentLogementIds);
          (logData ?? []).forEach((l) => logementNomMap.set(l.id, l.nom));
        }

        // Construire le tableau final, trié : MAJEUR > 0 en premier, puis par date desc
        const incidents: IncidentGroupe[] = [...incGroupMap.entries()]
          .map(([dossier_id, g]) => {
            const rid = dossierReservationMap.get(dossier_id);
            const lid = dossierLogementMap.get(dossier_id);
            const res = rid ? incResMap.get(rid) : undefined;
            return {
              dossier_id,
              locataire_nom: res?.locataire_nom ?? '',
              locataire_prenom: res?.locataire_prenom ?? '',
              logement_nom: lid ? (logementNomMap.get(lid) ?? '') : '',
              mineurs: g.mineurs,
              majeurs: g.majeurs,
              dernierIncident: g.dernierIncident,
            };
          })
          .sort((a, b) => {
            if (b.majeurs !== a.majeurs) return b.majeurs - a.majeurs;
            return new Date(b.dernierIncident).getTime() - new Date(a.dernierIncident).getTime();
          });

        if (cancelled) return;

        // Prochaines arrivées (7 jours)
        let prochQuery = supabase
          .from('reservations')
          .select('id, locataire_nom, locataire_prenom, date_debut, date_fin, statut')
          .gt('date_debut', today)
          .lte('date_debut', in7days)
          .in('statut', ['CONFIRMEE', 'OPTION_ACTIVE'])
          .is('archived_at', null)
          .order('date_debut')
          .limit(5);
        if (selectedLogementId) prochQuery = prochQuery.eq('logement_id', selectedLogementId);
        const { data: prochaines } = await prochQuery;

        if (cancelled) return;

        // Récupérer les dossiers associés
        const prochainesWithDossier = await Promise.all(
          (prochaines ?? []).map(async (r) => {
            const { data: dossier } = await supabase
              .from('dossiers')
              .select('id, pipeline_statut')
              .eq('reservation_id', r.id)
              .maybeSingle();
            return {
              ...r,
              pipeline_statut: (dossier?.pipeline_statut ?? 'DEMANDE_RECUE') as PipelineStatut,
              dossier_id: dossier?.id ?? null,
            };
          }),
        );

        if (cancelled) return;

        setData({
          arrivees: arrivees ?? [],
          departs: departs ?? [],
          tachesCount: tachesCount ?? 0,
          paiementsEnAttente,
          paiementsEnRetard,
          optionsExpirantes: (optionsExpirantes ?? []) as OptionExpirante[],
          incidents,
          prochaines: prochainesWithDossier,
        });
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedLogementId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary-600" />
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LogIn className="h-5 w-5 text-emerald-600" />}
          label="Arrivées aujourd'hui"
          value={data?.arrivees.length ?? 0}
        />
        <KpiCard
          icon={<LogOut className="h-5 w-5 text-blue-600" />}
          label="Départs aujourd'hui"
          value={data?.departs.length ?? 0}
        />
        <button
          onClick={() => navigate('/taches')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left hover:border-primary-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-slate-500">Tâches à faire</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{data?.tachesCount ?? 0}</p>
        </button>
        <button
          onClick={() => navigate('/paiements')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left hover:border-primary-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-slate-500">Paiements en attente</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{data?.paiementsEnAttente ?? 0}</p>
          {(data?.paiementsEnRetard ?? 0) > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {data!.paiementsEnRetard} en retard
            </p>
          )}
        </button>
      </div>

      {/* Card Options expirant sous 48h (E09-04) — visible uniquement s'il y en a */}
      {data && data.optionsExpirantes.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-orange-800">
              <Clock className="h-4 w-4" />
              Options expirant bientôt ({data.optionsExpirantes.length})
            </h2>
            <button
              onClick={() => navigate('/calendrier')}
              className="text-xs text-orange-700 hover:text-orange-900 flex items-center gap-1"
            >
              Calendrier <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {data.optionsExpirantes.map((opt) => (
              <button
                key={opt.id}
                onClick={() => navigate('/calendrier')}
                className="flex w-full items-center justify-between rounded-lg bg-white border border-orange-100 px-3 py-2 text-left text-sm hover:bg-orange-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {opt.locataire_prenom} {opt.locataire_nom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateFR(opt.date_debut)} → {formatDateFR(opt.date_fin)}
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  {formatTimeRemaining(opt.expiration_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Incidents EDL par dossier */}
      {data && data.incidents.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-3">
            <ShieldAlert className="h-4 w-4" />
            Incidents EDL ({data.incidents.length} dossier{data.incidents.length > 1 ? 's' : ''})
          </h2>
          <div className="space-y-2">
            {data.incidents.map((inc) => (
              <button
                key={inc.dossier_id}
                onClick={() =>
                  navigate(`/dossiers/${inc.dossier_id}`, { state: { tab: 'edl' } })
                }
                className="flex w-full items-center gap-3 rounded-lg bg-white border border-red-100 px-3 py-2.5 text-left text-sm hover:bg-red-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">
                    {inc.locataire_prenom} {inc.locataire_nom}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{inc.logement_nom}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dernier le{' '}
                    {new Date(inc.dernierIncident).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {inc.majeurs > 0 && (
                    <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                      {inc.majeurs} majeur{inc.majeurs > 1 ? 's' : ''}
                    </span>
                  )}
                  {inc.mineurs > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                      {inc.mineurs} mineur{inc.mineurs > 1 ? 's' : ''}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Arrivées / Départs du jour */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <LogIn className="h-4 w-4 text-emerald-600" />
            Arrivées du jour
          </h2>
          {data?.arrivees.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune arrivée aujourd'hui</p>
          ) : (
            <ul className="space-y-2">
              {data!.arrivees.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {r.locataire_prenom} {r.locataire_nom}
                  </span>
                  <span className="text-slate-500">{r.nb_personnes} pers.</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <LogOut className="h-4 w-4 text-blue-600" />
            Départs du jour
          </h2>
          {data?.departs.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun départ aujourd'hui</p>
          ) : (
            <ul className="space-y-2">
              {data!.departs.map((r) => (
                <li key={r.id} className="text-sm font-medium">
                  {r.locataire_prenom} {r.locataire_nom}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Prochaines arrivées */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Calendar className="h-4 w-4 text-primary-600" />
            Prochaines arrivées (7 jours)
          </h2>
          <button
            onClick={() => navigate('/calendrier')}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Voir le calendrier <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {data?.prochaines.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucune arrivée prévue dans les 7 prochains jours
          </p>
        ) : (
          <div className="space-y-2">
            {data!.prochaines.map((r) => (
              <button
                key={r.id}
                onClick={() => r.dossier_id && navigate(`/dossiers/${r.dossier_id}`)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-medium">
                    {r.locataire_prenom} {r.locataire_nom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateFR(r.date_debut)} → {formatDateFR(r.date_fin)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${PIPELINE_COLORS[r.pipeline_statut]}`}
                >
                  {PIPELINE_LABELS[r.pipeline_statut]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
