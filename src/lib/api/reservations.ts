import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Reservation, ReservationType, ReservationStatut } from '@/types/database.types';

export async function getReservationsByLogement(logementId: string, options?: {
  from?: string;
  to?: string;
  statuts?: ReservationStatut[];
}) {
  let query = supabase
    .from('reservations')
    .select('*')
    .eq('logement_id', logementId)
    .is('archived_at', null);

  if (options?.from) query = query.gte('date_fin', options.from);
  if (options?.to) query = query.lte('date_debut', options.to);
  if (options?.statuts) query = query.in('statut', options.statuts);

  const { data, error } = await query.order('date_debut');
  if (error) throw error;
  return data as Reservation[];
}

/** Récupère les réservations avec logement_id optionnel (pour "Tous les logements") */
export async function getReservations(options?: {
  logement_id?: string;
  from?: string;
  to?: string;
  statuts?: ReservationStatut[];
}) {
  let query = supabase
    .from('reservations')
    .select('*')
    .is('archived_at', null);

  if (options?.logement_id) query = query.eq('logement_id', options.logement_id);
  if (options?.from) query = query.gte('date_fin', options.from);
  if (options?.to) query = query.lte('date_debut', options.to);
  if (options?.statuts) query = query.in('statut', options.statuts);

  const { data, error } = await query.order('date_debut');
  if (error) throw error;
  return data as Reservation[];
}

export async function getReservationById(id: string) {
  const { data, error } = await supabase.from('reservations').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Reservation;
}

export async function createReservation(params: {
  logement_id: string;
  type: ReservationType;
  statut: ReservationStatut;
  date_debut: string;
  date_fin: string;
  expiration_at?: string;
  locataire_nom: string;
  locataire_prenom: string;
  locataire_email?: string;
  locataire_telephone?: string;
  locataire_adresse?: string;
  locataire_pays?: string;
  nb_personnes: number;
  nb_adultes?: number;
  nb_enfants?: number;
  loyer_total?: number;
  notes?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('check_and_create_reservation', {
    p_logement_id: params.logement_id,
    p_date_debut: params.date_debut,
    p_date_fin: params.date_fin,
    p_type: params.type,
    p_statut: params.statut,
    p_expiration_at: params.expiration_at ?? null,
    p_locataire_nom: params.locataire_nom,
    p_locataire_prenom: params.locataire_prenom,
    p_locataire_email: params.locataire_email ?? null,
    p_locataire_telephone: params.locataire_telephone ?? null,
    p_locataire_adresse: params.locataire_adresse ?? null,
    p_locataire_pays: params.locataire_pays ?? 'France',
    p_nb_personnes: params.nb_personnes,
    p_nb_adultes: params.nb_adultes ?? null,
    p_nb_enfants: params.nb_enfants ?? null,
    p_loyer_total: params.loyer_total ?? null,
    p_notes: params.notes ?? null,
    p_created_by: user?.id ?? null,
  });

  if (error) throw error;

  const newId = data as string;

  await createAuditLog({
    entity_type: 'reservation',
    entity_id: newId,
    logement_id: params.logement_id,
    action: 'created',
    metadata: { type: params.type, statut: params.statut },
  });

  return newId;
}

export async function cancelReservation(id: string, motif: string) {
  const { data: before } = await supabase.from('reservations').select('statut').eq('id', id).single();

  const { error } = await supabase
    .from('reservations')
    .update({ statut: 'ANNULEE', motif_annulation: motif })
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'reservation',
    entity_id: id,
    action: 'cancelled',
    changed_fields: { statut: { before: before?.statut, after: 'ANNULEE' } },
    metadata: { motif },
  });
}

export async function updateReservationDates(id: string, dateDebut: string, dateFin: string) {
  const { data: before } = await supabase
    .from('reservations')
    .select('date_debut, date_fin, logement_id')
    .eq('id', id)
    .single();

  if (!before) throw new Error('Réservation introuvable');

  // RPC dédiée : vérifie conflits + tampon puis fait l'UPDATE (pas de doublon)
  const { error } = await supabase.rpc('update_reservation_dates', {
    p_reservation_id: id,
    p_date_debut: dateDebut,
    p_date_fin: dateFin,
  });

  if (error) throw error;

  await createAuditLog({
    entity_type: 'reservation',
    entity_id: id,
    logement_id: before.logement_id,
    action: 'dates_modified',
    changed_fields: {
      date_debut: { before: before.date_debut, after: dateDebut },
      date_fin: { before: before.date_fin, after: dateFin },
    },
  });
}

export async function confirmOption(id: string): Promise<string> {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('statut, logement_id')
    .eq('id', id)
    .single();

  if (!reservation) throw new Error('Réservation introuvable');
  if (reservation.statut !== 'OPTION_ACTIVE') {
    throw new Error('Seule une option active peut être confirmée.');
  }

  const { error } = await supabase
    .from('reservations')
    .update({ type: 'RESERVATION', statut: 'CONFIRMEE', expiration_at: null })
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'reservation',
    entity_id: id,
    logement_id: reservation.logement_id,
    action: 'option_confirmed',
    changed_fields: {
      type: { before: 'OPTION', after: 'RESERVATION' },
      statut: { before: 'OPTION_ACTIVE', after: 'CONFIRMEE' },
    },
  });

  return id;
}

export async function expireOptions(logementId: string): Promise<number> {
  const { data: expired, error: fetchError } = await supabase
    .from('reservations')
    .select('id')
    .eq('logement_id', logementId)
    .eq('statut', 'OPTION_ACTIVE')
    .lt('expiration_at', new Date().toISOString())
    .is('archived_at', null);

  if (fetchError) throw fetchError;
  if (!expired || expired.length === 0) return 0;

  const ids = expired.map((r) => r.id);

  const { error } = await supabase
    .from('reservations')
    .update({ statut: 'OPTION_EXPIREE' })
    .in('id', ids);

  if (error) throw error;

  // Audit log pour chaque option expirée
  for (const r of expired) {
    await createAuditLog({
      entity_type: 'reservation',
      entity_id: r.id,
      logement_id: logementId,
      action: 'option_expired',
      changed_fields: { statut: { before: 'OPTION_ACTIVE', after: 'OPTION_EXPIREE' } },
    });
  }

  return ids.length;
}
