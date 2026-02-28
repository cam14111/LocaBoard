import { supabase } from '@/lib/supabase';
import type { Notification, NotificationType } from '@/types/database.types';

export async function getNotificationsByUser(userId: string, options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) query = query.is('read_at', null);

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data as Notification[];
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

/**
 * Crée une notification avec dédoublonnage.
 * Si une notification non-lue du même type + entity_type + entity_id existe déjà, retourne null.
 */
/** Supprime une notification (utilisée par le bouton X du panneau). */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Supprime toutes les notifications non-lues d'un type/entité donné.
 * Appelé quand une tâche/paiement en retard est soldé ou modifié.
 * Non-bloquant : les erreurs sont ignorées pour ne pas perturber l'action principale.
 */
export async function dismissNotificationsForEntity(
  type: NotificationType,
  entityType: string,
  entityId: string,
): Promise<void> {
  try {
    await supabase.rpc('dismiss_notifications_for_entity', {
      p_type: type,
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
  } catch {}
}

export async function createNotification(params: {
  user_id: string;
  type: NotificationType;
  titre: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
}): Promise<Notification | null> {
  // Dédoublonnage : même type + entity_type + entity_id non-lue → skip
  if (params.entity_id) {
    let dedupQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', params.user_id)
      .eq('type', params.type)
      .eq('entity_id', params.entity_id)
      .is('read_at', null);

    if (params.entity_type) {
      dedupQuery = dedupQuery.eq('entity_type', params.entity_type);
    }

    const { count } = await dedupQuery;
    if (count && count > 0) return null;
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.user_id,
      type: params.type,
      titre: params.titre,
      message: params.message,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Envoi push immédiat pour les tâches assignées
  if (params.type === 'TACHE_ASSIGNEE') {
    const pushPayload = {
      user_id: params.user_id,
      titre: params.titre,
      message: params.message,
      url: params.entity_id ? `/LocaBoard/taches` : '/LocaBoard/',
    };
    console.log('[push] Envoi push pour TACHE_ASSIGNEE:', pushPayload);
    supabase.functions
      .invoke('send-push-notification', { body: pushPayload })
      .then((res) => console.log('[push] Réponse Edge Function:', res))
      .catch((err) => console.error('[push] Erreur Edge Function:', err));
  }

  return data as Notification;
}
