import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types/database.types';

interface AuditEntry {
  entity_type: string;
  entity_id: string;
  logement_id?: string | null;
  action: string;
  changed_fields?: Record<string, { before: unknown; after: unknown }> | null;
  metadata?: Record<string, unknown> | null;
}

export async function createAuditLog(entry: AuditEntry) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('audit_log').insert({
    ...entry,
    actor_user_id: user?.id ?? null,
  });

  if (error) {
    console.error('Audit log error:', error);
  }
}

export async function getAuditLogByEntity(entityType: string, entityId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getGlobalAuditLog(filters?: {
  logement_id?: string;
  entity_type?: string;
  entity_types?: string[];
  actor_user_id?: string;
  action?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AuditLog[]; count: number }> {
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (filters?.logement_id) query = query.eq('logement_id', filters.logement_id);
  if (filters?.entity_types && filters.entity_types.length > 0) {
    query = query.in('entity_type', filters.entity_types);
  } else if (filters?.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }
  if (filters?.actor_user_id) query = query.eq('actor_user_id', filters.actor_user_id);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.from_date) query = query.gte('timestamp', filters.from_date);
  if (filters?.to_date) query = query.lte('timestamp', filters.to_date);

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as AuditLog[], count: count ?? 0 };
}
