import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import { dismissNotificationsForEntity, createNotification } from './notifications';
import type { Tache, TacheType, TacheStatut, Logement } from '@/types/database.types';

export async function getTaches(filters?: {
  logement_id?: string;
  assignee_user_id?: string;
  statuts?: TacheStatut[];
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('taches')
    .select('*')
    .order('echeance_at', { ascending: true });

  if (filters?.logement_id) query = query.eq('logement_id', filters.logement_id);
  if (filters?.assignee_user_id) query = query.eq('assignee_user_id', filters.assignee_user_id);
  if (filters?.statuts) query = query.in('statut', filters.statuts);
  if (filters?.from_date) query = query.gte('echeance_at', filters.from_date);
  if (filters?.to_date) query = query.lte('echeance_at', filters.to_date);

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data as Tache[];
}

export async function getTachesByDossier(dossierId: string) {
  const { data, error } = await supabase
    .from('taches')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('echeance_at');

  if (error) throw error;
  return data as Tache[];
}

export async function getTacheById(id: string) {
  const { data, error } = await supabase.from('taches').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Tache;
}

export async function createTache(params: {
  logement_id: string;
  dossier_id?: string;
  titre: string;
  description?: string;
  type: TacheType;
  echeance_at: string;
  assignee_user_id?: string;
  auto_generated?: boolean;
}) {
  const { data, error } = await supabase
    .from('taches')
    .insert({
      ...params,
      statut: 'A_FAIRE' as TacheStatut,
      auto_generated: params.auto_generated ?? false,
    })
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'tache',
    entity_id: data.id,
    logement_id: params.logement_id,
    action: 'created',
    metadata: { type: params.type, titre: params.titre },
  });

  return data as Tache;
}

export async function updateTache(id: string, updates: Partial<Pick<Tache,
  'titre' | 'description' | 'type' | 'echeance_at' | 'assignee_user_id' | 'statut'
>>) {
  const { data: before } = await supabase.from('taches').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('taches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const changedFields: Record<string, { before: unknown; after: unknown }> = {};
  if (before) {
    for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
      if (before[key] !== data[key]) {
        changedFields[key] = { before: before[key], after: data[key] };
      }
    }
  }

  if (Object.keys(changedFields).length > 0) {
    await createAuditLog({
      entity_type: 'tache',
      entity_id: id,
      logement_id: data.logement_id,
      action: 'updated',
      changed_fields: changedFields,
    });
    // Modification d'une tâche → effacer la notification de retard
    dismissNotificationsForEntity('TACHE_EN_RETARD', 'tache', id);

    // Réassignation → notifier immédiatement le nouvel assigné
    const newAssignee = data.assignee_user_id as string | null;
    const prevAssignee = before?.assignee_user_id as string | null;
    if (newAssignee && newAssignee !== prevAssignee) {
      const echeanceFr = new Date(data.echeance_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
      createNotification({
        user_id: newAssignee,
        type: 'TACHE_ASSIGNEE',
        titre: 'Nouvelle tâche assignée',
        message: `${data.titre} — échéance ${echeanceFr}`,
        entity_type: 'tache',
        entity_id: id,
      }).catch(() => {});
    }
  }

  return data as Tache;
}

export async function completeTache(id: string, proofPhotoUrl?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: before } = await supabase.from('taches').select('statut').eq('id', id).single();

  const { error } = await supabase
    .from('taches')
    .update({
      statut: 'FAIT' as TacheStatut,
      completed_at: new Date().toISOString(),
      completed_by_user_id: user?.id ?? null,
      proof_photo_url: proofPhotoUrl ?? null,
    })
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'tache',
    entity_id: id,
    action: 'completed',
    changed_fields: { statut: { before: before?.statut, after: 'FAIT' } },
  });

  // Tâche soldée → effacer la notification de retard
  dismissNotificationsForEntity('TACHE_EN_RETARD', 'tache', id);
}

export async function cancelTache(id: string) {
  const { error } = await supabase.rpc('cancel_tache', { p_tache_id: id });
  if (error) throw error;

  await createAuditLog({
    entity_type: 'tache',
    entity_id: id,
    action: 'cancelled',
  });

  // Tâche annulée → effacer la notification de retard
  dismissNotificationsForEntity('TACHE_EN_RETARD', 'tache', id);
}

export async function reactivateTache(id: string) {
  const { error } = await supabase.rpc('reactivate_tache', { p_tache_id: id });
  if (error) throw error;

  await createAuditLog({
    entity_type: 'tache',
    entity_id: id,
    action: 'reactivated',
  });
}

/** Génère les tâches automatiques à la confirmation d'une réservation (E08-05) */
export async function generateAutoTaches(params: {
  dossier_id: string;
  logement_id: string;
  reservation_id: string;
}): Promise<number> {
  // Vérifier si le logement a les tâches auto activées
  const { data: logement } = await supabase
    .from('logements')
    .select('taches_auto_enabled')
    .eq('id', params.logement_id)
    .single();

  if (!logement || !(logement as Pick<Logement, 'taches_auto_enabled'>).taches_auto_enabled) {
    return 0;
  }

  // Récupérer les dates de la réservation
  const { data: reservation } = await supabase
    .from('reservations')
    .select('date_debut, date_fin, locataire_prenom, locataire_nom')
    .eq('id', params.reservation_id)
    .single();

  if (!reservation) return 0;

  const locataire = `${reservation.locataire_prenom} ${reservation.locataire_nom}`;

  // Définir les tâches à créer
  const tachesAuto: Array<{ titre: string; type: TacheType; echeance_date: string }> = [
    {
      titre: `Ménage avant arrivée — ${locataire}`,
      type: 'MENAGE',
      echeance_date: reservation.date_debut,
    },
    {
      titre: `Remise des clés — ${locataire}`,
      type: 'REMISE_CLES',
      echeance_date: reservation.date_debut,
    },
    {
      titre: `Ménage après départ — ${locataire}`,
      type: 'MENAGE',
      echeance_date: reservation.date_fin,
    },
  ];

  // Créer les tâches en base
  const inserts = tachesAuto.map((t) => ({
    logement_id: params.logement_id,
    dossier_id: params.dossier_id,
    titre: t.titre,
    type: t.type,
    echeance_at: new Date(t.echeance_date + 'T08:00:00').toISOString(),
    statut: 'A_FAIRE' as TacheStatut,
    auto_generated: true,
  }));

  const { error } = await supabase.from('taches').insert(inserts);
  if (error) throw error;

  // Audit log
  await createAuditLog({
    entity_type: 'dossier',
    entity_id: params.dossier_id,
    logement_id: params.logement_id,
    action: 'taches_auto_generated',
    metadata: { count: tachesAuto.length, reservation_id: params.reservation_id },
  });

  return tachesAuto.length;
}
