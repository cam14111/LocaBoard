import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import { dismissNotificationsForEntity } from './notifications';
import type { Paiement, PaiementStatut, PaiementMethod } from '@/types/database.types';

export async function getPaiementsByDossier(dossierId: string) {
  const { data, error } = await supabase
    .from('paiements')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('echeance_date');

  if (error) throw error;
  return data as Paiement[];
}

export async function getPaiementById(id: string) {
  const { data, error } = await supabase.from('paiements').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Paiement;
}

export async function createPaiement(params: {
  dossier_id: string;
  type: Paiement['type'];
  montant_eur: number;
  echeance_date: string;
  label?: string;
}) {
  const { data, error } = await supabase.from('paiements').insert(params).select().single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'paiement',
    entity_id: data.id,
    action: 'created',
    metadata: { type: params.type, montant_eur: params.montant_eur },
  });

  return data as Paiement;
}

export async function markPaiementPaid(
  id: string,
  method: PaiementMethod,
  proofDocumentId?: string,
) {
  const { data: before } = await supabase
    .from('paiements')
    .select('statut, dossier_id')
    .eq('id', id)
    .single();

  if (!before) throw new Error('Paiement introuvable');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('paiements')
    .update({
      statut: 'PAYE' as PaiementStatut,
      method,
      paid_at: new Date().toISOString(),
      paid_by_user_id: user?.id ?? null,
      proof_document_id: proofDocumentId ?? null,
    })
    .eq('id', id);

  if (error) {
    const details = [error.message, error.details, error.hint].filter(Boolean).join(' — ');
    throw new Error(details || 'Erreur lors de la mise à jour du paiement');
  }

  await createAuditLog({
    entity_type: 'paiement',
    entity_id: id,
    action: 'marked_paid',
    changed_fields: { statut: { before: before.statut, after: 'PAYE' } },
    metadata: { method },
  });

  // Paiement soldé → effacer la notification de retard du dossier
  dismissNotificationsForEntity('PAIEMENT_EN_RETARD', 'dossier', before.dossier_id);
}

export async function markPaiementOverdue(id: string) {
  const { error } = await supabase
    .from('paiements')
    .update({ statut: 'EN_RETARD' as PaiementStatut })
    .eq('id', id);

  if (error) throw error;
}

/** Ligne d'échéancier calculée (logique pure) */
export interface ScheduleEntry {
  type: Paiement['type'];
  montant_eur: number;
  echeance_date: string;
  label: string | null;
}

/** Calcule l'échéancier par défaut — logique pure sans I/O */
export function computePaymentSchedule(params: {
  loyer_total: number;
  type_premier_versement: 'ARRHES' | 'ACOMPTE';
  date_debut: string;
  nb_personnes: number;
  taux_taxe_sejour: number;
  nb_nuits: number;
  today?: Date; // injectable pour les tests
}): ScheduleEntry[] {
  const {
    loyer_total,
    type_premier_versement,
    date_debut,
    nb_personnes,
    taux_taxe_sejour,
    nb_nuits,
  } = params;

  const now = params.today ?? new Date();
  const arrivee = new Date(date_debut);
  const entries: ScheduleEntry[] = [];

  if (loyer_total > 0) {
    // Premier versement : 30%
    const montantPremier = Math.round(loyer_total * 0.3 * 100) / 100;
    const echeancePremier = new Date(now);
    echeancePremier.setDate(echeancePremier.getDate() + 7);
    const premierType: Paiement['type'] = type_premier_versement === 'ACOMPTE' ? 'ACOMPTE' : 'ARRHES';

    entries.push({
      type: premierType,
      montant_eur: montantPremier,
      echeance_date: echeancePremier.toISOString().substring(0, 10),
      label: null,
    });

    // Solde : 70%
    const montantSolde = Math.round((loyer_total - montantPremier) * 100) / 100;
    const solde30j = new Date(arrivee);
    solde30j.setDate(solde30j.getDate() - 30);
    // Si arrivée < confirmation + 37j → échéance = arrivée
    const echeanceSoldeDate = solde30j > now ? solde30j : arrivee;

    entries.push({
      type: 'SOLDE',
      montant_eur: montantSolde,
      echeance_date: echeanceSoldeDate.toISOString().substring(0, 10),
      label: null,
    });
  }

  // Taxe de séjour
  if (taux_taxe_sejour > 0 && nb_personnes > 0 && nb_nuits > 0) {
    const montantTaxe = Math.round(taux_taxe_sejour * nb_personnes * nb_nuits * 100) / 100;
    entries.push({
      type: 'TAXE_SEJOUR',
      montant_eur: montantTaxe,
      echeance_date: date_debut,
      label: null,
    });
  }

  return entries;
}

/** Crée l'échéancier par défaut à la confirmation d'une réservation */
export async function createDefaultPaymentSchedule(params: {
  dossier_id: string;
  loyer_total: number;
  type_premier_versement: 'ARRHES' | 'ACOMPTE';
  date_debut: string;
  nb_personnes: number;
  taux_taxe_sejour: number;
  nb_nuits: number;
}) {
  const entries = computePaymentSchedule(params);
  if (entries.length === 0) return;

  const paiements = entries.map((e) => ({ ...e, dossier_id: params.dossier_id }));

  const { error } = await supabase.from('paiements').insert(paiements);
  if (error) throw error;

  await createAuditLog({
    entity_type: 'dossier',
    entity_id: params.dossier_id,
    action: 'echeancier_created',
    metadata: {
      nb_lignes: paiements.length,
      total: paiements.reduce((s, p) => s + p.montant_eur, 0),
    },
  });
}

/** Passe automatiquement les paiements DU en retard → EN_RETARD */
export async function sweepOverduePaiements(dossierId?: string) {
  const today = new Date().toISOString().substring(0, 10);

  let query = supabase
    .from('paiements')
    .select('id')
    .eq('statut', 'DU')
    .lt('echeance_date', today);

  if (dossierId) query = query.eq('dossier_id', dossierId);

  const { data: overdue, error: fetchErr } = await query;
  if (fetchErr || !overdue || overdue.length === 0) return 0;

  const ids = overdue.map((p) => p.id);
  const { error } = await supabase
    .from('paiements')
    .update({ statut: 'EN_RETARD' as PaiementStatut })
    .in('id', ids);

  if (error) throw error;

  // Audit log pour chaque paiement passé en retard
  for (const p of overdue) {
    await createAuditLog({
      entity_type: 'paiement',
      entity_id: p.id,
      action: 'paiement_overdue',
      changed_fields: { statut: { before: 'DU', after: 'EN_RETARD' } },
    });
  }

  return ids.length;
}

/** Met à jour montant et/ou échéance d'un paiement DU ou EN_RETARD */
export async function updatePaiement(
  id: string,
  updates: { montant_eur?: number; echeance_date?: string; label?: string },
) {
  const { data: before } = await supabase
    .from('paiements')
    .select('montant_eur, echeance_date, label, statut, dossier_id')
    .eq('id', id)
    .single();

  if (!before) throw new Error('Paiement introuvable');
  if (before.statut !== 'DU' && before.statut !== 'EN_RETARD') {
    throw new Error('Seuls les paiements DU ou EN_RETARD sont modifiables.');
  }

  // Si une nouvelle date d'échéance >= aujourd'hui est fournie,
  // remettre le statut à DU (le paiement n'est plus en retard).
  const today = new Date().toISOString().substring(0, 10);
  const actualUpdates: typeof updates & { statut?: PaiementStatut } = { ...updates };
  if (
    updates.echeance_date !== undefined &&
    updates.echeance_date >= today &&
    before.statut === 'EN_RETARD'
  ) {
    actualUpdates.statut = 'DU';
  }

  const { error } = await supabase.from('paiements').update(actualUpdates).eq('id', id);
  if (error) throw error;

  const changed: Record<string, { before: unknown; after: unknown }> = {};
  if (updates.montant_eur !== undefined && updates.montant_eur !== before.montant_eur) {
    changed.montant_eur = { before: before.montant_eur, after: updates.montant_eur };
  }
  if (updates.echeance_date !== undefined && updates.echeance_date !== before.echeance_date) {
    changed.echeance_date = { before: before.echeance_date, after: updates.echeance_date };
  }
  if (actualUpdates.statut) {
    changed.statut = { before: before.statut, after: actualUpdates.statut };
  }

  if (Object.keys(changed).length > 0) {
    await createAuditLog({
      entity_type: 'paiement',
      entity_id: id,
      action: 'paiement_modified',
      changed_fields: changed,
    });
    // Paiement modifié → effacer la notification de retard du dossier
    dismissNotificationsForEntity('PAIEMENT_EN_RETARD', 'dossier', before.dossier_id);
  }
}

export interface PaiementEnrichi extends Paiement {
  locataire_nom: string;
  locataire_prenom: string;
  logement_id: string;
  logement_nom: string;
}

/** Récupère tous les paiements avec infos dossier/réservation pour la vue transversale */
export async function getAllPaiements(filters?: {
  logement_id?: string;
  statuts?: PaiementStatut[];
  from_date?: string;
  to_date?: string;
}): Promise<PaiementEnrichi[]> {
  // 1. Charger les dossiers actifs (avec filtre logement si applicable)
  let dossierQuery = supabase
    .from('dossiers')
    .select('id, logement_id, reservation_id')
    .is('archived_at', null);

  if (filters?.logement_id) dossierQuery = dossierQuery.eq('logement_id', filters.logement_id);

  const { data: dossiers, error: dErr } = await dossierQuery;
  if (dErr) throw dErr;
  if (!dossiers || dossiers.length === 0) return [];

  const dossierIds = dossiers.map((d) => d.id);

  // 2. Charger les paiements de ces dossiers
  let pQuery = supabase
    .from('paiements')
    .select('*')
    .in('dossier_id', dossierIds)
    .order('echeance_date');

  if (filters?.statuts && filters.statuts.length > 0) {
    pQuery = pQuery.in('statut', filters.statuts);
  }
  if (filters?.from_date) pQuery = pQuery.gte('echeance_date', filters.from_date);
  if (filters?.to_date) pQuery = pQuery.lte('echeance_date', filters.to_date);

  const { data: paiements, error: pErr } = await pQuery;
  if (pErr) throw pErr;
  if (!paiements || paiements.length === 0) return [];

  // 3. Charger les réservations + logements pour enrichir
  const reservationIds = [...new Set(dossiers.map((d) => d.reservation_id))];
  const logementIds = [...new Set(dossiers.map((d) => d.logement_id))];

  const [{ data: reservations }, { data: logements }] = await Promise.all([
    supabase
      .from('reservations')
      .select('id, locataire_nom, locataire_prenom')
      .in('id', reservationIds),
    supabase.from('logements').select('id, nom').in('id', logementIds),
  ]);

  // 4. Construire les lookups
  const dossierMap = new Map(dossiers.map((d) => [d.id, d]));
  const resMap = new Map((reservations ?? []).map((r) => [r.id, r]));
  const logMap = new Map((logements ?? []).map((l) => [l.id, l]));

  return (paiements as Paiement[]).map((p) => {
    const dossier = dossierMap.get(p.dossier_id);
    const reservation = dossier ? resMap.get(dossier.reservation_id) : undefined;
    const logement = dossier ? logMap.get(dossier.logement_id) : undefined;
    return {
      ...p,
      locataire_nom: reservation?.locataire_nom ?? '',
      locataire_prenom: reservation?.locataire_prenom ?? '',
      logement_id: dossier?.logement_id ?? '',
      logement_nom: logement?.nom ?? '',
    };
  });
}

export async function cancelPaiement(id: string) {
  const { data: before } = await supabase
    .from('paiements')
    .select('statut, dossier_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('paiements')
    .update({ statut: 'ANNULE' as PaiementStatut })
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'paiement',
    entity_id: id,
    action: 'cancelled',
    changed_fields: { statut: { before: before?.statut, after: 'ANNULE' } },
  });

  // Paiement annulé → effacer la notification de retard du dossier
  if (before?.dossier_id) {
    dismissNotificationsForEntity('PAIEMENT_EN_RETARD', 'dossier', before.dossier_id);
  }
}
