import { supabase } from '@/lib/supabase';
import type { PipelineStatut } from '@/types/database.types';

/**
 * Calcule si une transition automatique est applicable depuis un statut donné,
 * en fonction de l'état des paiements et des EDL du dossier.
 * Fonction pure — sans I/O, testable unitairement.
 */
export function computeAutoAdvance(
  statut: PipelineStatut,
  paiements: Array<{ type: string; statut: string }>,
  edls: Array<{ type: string; statut: string }>,
): PipelineStatut | null {
  switch (statut) {
    case 'CONTRAT_SIGNE': {
      const paid = paiements.some(
        (p) => (p.type === 'ARRHES' || p.type === 'ACOMPTE') && p.statut === 'PAYE',
      );
      return paid ? 'ACOMPTE_RECU' : null;
    }

    case 'SOLDE_DEMANDE': {
      const paid = paiements.some((p) => p.type === 'SOLDE' && p.statut === 'PAYE');
      return paid ? 'SOLDE_RECU' : null;
    }

    case 'CHECKIN_FAIT': {
      const edlArrivee = edls.find((e) => e.type === 'ARRIVEE');
      if (!edlArrivee) return null;
      if (edlArrivee.statut === 'TERMINE_OK') return 'EDL_ENTREE_OK';
      if (edlArrivee.statut === 'TERMINE_INCIDENT') return 'EDL_ENTREE_INCIDENT';
      return null;
    }

    case 'CHECKOUT_FAIT': {
      const edlDepart = edls.find((e) => e.type === 'DEPART');
      if (!edlDepart) return null;
      if (edlDepart.statut === 'TERMINE_OK') return 'EDL_OK';
      if (edlDepart.statut === 'TERMINE_INCIDENT') return 'EDL_INCIDENT';
      return null;
    }

    default:
      return null;
  }
}

/**
 * Charge les données du dossier et applique une transition automatique si applicable.
 * Retourne le nouveau statut pipeline si un auto-advance a été effectué, null sinon.
 */
export async function tryAutoAdvancePipeline(
  dossierId: string,
  currentStatut: PipelineStatut,
): Promise<PipelineStatut | null> {
  const target = await resolveAutoAdvanceTarget(dossierId, currentStatut);
  if (!target) return null;

  // RPC SECURITY DEFINER : contourne RLS + insère l'audit log (fonctionne pour tous les rôles)
  await supabase.rpc('auto_advance_pipeline', {
    p_dossier_id: dossierId,
    p_from_statut: currentStatut,
    p_to_statut: target,
  });

  return target;
}

/** Charge paiements + EDLs et calcule la cible (sans appliquer). */
async function resolveAutoAdvanceTarget(
  dossierId: string,
  statut: PipelineStatut,
): Promise<PipelineStatut | null> {
  // Optimisation : ne charger que ce dont computeAutoAdvance a besoin
  const needsPaiements = statut === 'CONTRAT_SIGNE' || statut === 'SOLDE_DEMANDE';
  const needsEdls = statut === 'CHECKIN_FAIT' || statut === 'CHECKOUT_FAIT';

  if (!needsPaiements && !needsEdls) return null;

  const [paiementsResult, edlsResult] = await Promise.all([
    needsPaiements
      ? supabase
          .from('paiements')
          .select('type, statut')
          .eq('dossier_id', dossierId)
      : Promise.resolve({ data: [] }),
    needsEdls
      ? supabase
          .from('edls')
          .select('type, statut')
          .eq('dossier_id', dossierId)
      : Promise.resolve({ data: [] }),
  ]);

  const paiements = (paiementsResult.data ?? []) as Array<{ type: string; statut: string }>;
  const edls = (edlsResult.data ?? []) as Array<{ type: string; statut: string }>;

  return computeAutoAdvance(statut, paiements, edls);
}
