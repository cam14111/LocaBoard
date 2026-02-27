import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import { createDefaultPaymentSchedule } from './paiements';
import { computeNights } from '@/lib/dateUtils';
import type { Dossier, PipelineStatut } from '@/types/database.types';

export async function getDossierByReservation(reservationId: string) {
  const { data, error } = await supabase
    .from('dossiers')
    .select('*')
    .eq('reservation_id', reservationId)
    .single();

  if (error) throw error;
  return data as Dossier;
}

export async function getDossierById(id: string) {
  const { data, error } = await supabase.from('dossiers').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Dossier;
}

export async function getDossiers(filters?: {
  logement_id?: string;
  pipeline_statut?: PipelineStatut[];
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('dossiers')
    .select('*, reservations(*)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (filters?.logement_id) query = query.eq('logement_id', filters.logement_id);
  if (filters?.pipeline_statut) query = query.in('pipeline_statut', filters.pipeline_statut);

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updatePipelineStatut(
  dossierId: string,
  newStatut: PipelineStatut,
  motif?: string,
) {
  const { data: before } = await supabase
    .from('dossiers')
    .select('pipeline_statut, logement_id')
    .eq('id', dossierId)
    .single();

  if (!before) throw new Error('Dossier introuvable');

  const { error } = await supabase
    .from('dossiers')
    .update({ pipeline_statut: newStatut })
    .eq('id', dossierId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'dossier',
    entity_id: dossierId,
    logement_id: before.logement_id,
    action: 'pipeline_changed',
    changed_fields: {
      pipeline_statut: { before: before.pipeline_statut, after: newStatut },
    },
    metadata: motif ? { motif } : null,
  });
}

/** E04-08 : Annulation cascade d'un dossier complet */
export interface CancelDossierResult {
  paiementsAnnules: number;
  tachesAnnulees: number;
}

export async function cancelDossierCascade(
  dossierId: string,
  motif: string,
  quiAnnule: 'locataire' | 'bailleur',
): Promise<CancelDossierResult> {
  // 1. Récupérer le dossier et son logement_id
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('pipeline_statut, logement_id, reservation_id')
    .eq('id', dossierId)
    .single();

  if (!dossier) throw new Error('Dossier introuvable');
  if (dossier.pipeline_statut === 'CLOTURE' || dossier.pipeline_statut === 'ANNULE') {
    throw new Error('Ce dossier ne peut pas être annulé.');
  }

  // 2. Pipeline → ANNULE
  const { error: dossierErr } = await supabase
    .from('dossiers')
    .update({ pipeline_statut: 'ANNULE' as PipelineStatut })
    .eq('id', dossierId);
  if (dossierErr) throw dossierErr;

  // 3. Réservation → ANNULEE
  if (dossier.reservation_id) {
    const { error: resErr } = await supabase
      .from('reservations')
      .update({ statut: 'ANNULEE', motif_annulation: motif })
      .eq('id', dossier.reservation_id);
    if (resErr) throw resErr;
  }

  // 4. Paiements DU/EN_RETARD → ANNULE (PAYE restent PAYE)
  const { data: paiementsToCancel } = await supabase
    .from('paiements')
    .select('id')
    .eq('dossier_id', dossierId)
    .in('statut', ['DU', 'EN_RETARD']);

  let paiementsAnnules = 0;
  if (paiementsToCancel && paiementsToCancel.length > 0) {
    const ids = paiementsToCancel.map((p) => p.id);
    const { error: payErr } = await supabase
      .from('paiements')
      .update({ statut: 'ANNULE' })
      .in('id', ids);
    if (payErr) throw payErr;
    paiementsAnnules = ids.length;
  }

  // 5. Tâches A_FAIRE/EN_COURS → ANNULEE (FAIT restent FAIT)
  const { data: tachesToCancel } = await supabase
    .from('taches')
    .select('id')
    .eq('dossier_id', dossierId)
    .in('statut', ['A_FAIRE', 'EN_COURS']);

  let tachesAnnulees = 0;
  if (tachesToCancel && tachesToCancel.length > 0) {
    const ids = tachesToCancel.map((t) => t.id);
    const { error: taskErr } = await supabase
      .from('taches')
      .update({ statut: 'ANNULEE' })
      .in('id', ids);
    if (taskErr) throw taskErr;
    tachesAnnulees = ids.length;
  }

  // 6. Audit log complet
  await createAuditLog({
    entity_type: 'dossier',
    entity_id: dossierId,
    logement_id: dossier.logement_id,
    action: 'dossier_cancelled',
    changed_fields: {
      pipeline_statut: { before: dossier.pipeline_statut, after: 'ANNULE' },
    },
    metadata: {
      motif,
      qui_annule: quiAnnule,
      paiements_annules: paiementsAnnules,
      taches_annulees: tachesAnnulees,
    },
  });

  return { paiementsAnnules, tachesAnnulees };
}

export async function ensureDossierForReservation(
  reservationId: string,
  logementId: string,
  typePremierVersement: 'ARRHES' | 'ACOMPTE' = 'ARRHES',
  initialPipelineStatut?: PipelineStatut,
): Promise<Dossier> {
  try {
    return await getDossierByReservation(reservationId);
  } catch {
    const dossier = await createDossier({
      reservation_id: reservationId,
      logement_id: logementId,
      type_premier_versement: typePremierVersement,
      ...(initialPipelineStatut ? { pipeline_statut: initialPipelineStatut } : {}),
    });

    // Créer l'échéancier paiements par défaut
    try {
      const { data: reservation } = await supabase
        .from('reservations')
        .select('loyer_total, nb_personnes, date_debut, date_fin')
        .eq('id', reservationId)
        .single();

      const { data: logement } = await supabase
        .from('logements')
        .select('taux_taxe_sejour, forfait_menage_eur')
        .eq('id', logementId)
        .single();

      if (reservation && reservation.loyer_total) {
        const nbNuits = computeNights(reservation.date_debut, reservation.date_fin);
        await createDefaultPaymentSchedule({
          dossier_id: dossier.id,
          loyer_total: reservation.loyer_total,
          type_premier_versement: typePremierVersement,
          date_debut: reservation.date_debut,
          nb_personnes: reservation.nb_personnes ?? 1,
          taux_taxe_sejour: logement?.taux_taxe_sejour ?? 0,
          nb_nuits: nbNuits,
          forfait_menage_eur: logement?.forfait_menage_eur ?? 0,
        });
      }
    } catch (err) {
      console.warn('Échec création échéancier:', err);
    }

    return dossier;
  }
}

export async function createDossier(params: {
  reservation_id: string;
  logement_id: string;
  type_premier_versement: 'ARRHES' | 'ACOMPTE';
  pipeline_statut?: PipelineStatut;
}) {
  const { data, error } = await supabase.from('dossiers').insert(params).select().single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'dossier',
    entity_id: data.id,
    logement_id: params.logement_id,
    action: 'created',
  });

  return data as Dossier;
}
