import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Logement } from '@/types/database.types';

export async function getLogements() {
  const { data, error } = await supabase
    .from('logements')
    .select('*')
    .is('archived_at', null)
    .order('nom');

  if (error) throw error;
  return data as Logement[];
}

export async function getLogementById(id: string) {
  const { data, error } = await supabase.from('logements').select('*').eq('id', id).single();

  if (error) throw error;
  return data as Logement;
}

export async function createLogement(logement: Partial<Logement>) {
  const { data, error } = await supabase.from('logements').insert(logement).select().single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'logement',
    entity_id: data.id,
    action: 'created',
  });

  return data as Logement;
}

export async function updateLogement(id: string, updates: Partial<Logement>) {
  const { data: before } = await supabase.from('logements').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('logements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const changedFields: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(updates) as Array<keyof Logement>) {
    if (before && before[key] !== data[key]) {
      changedFields[key] = { before: before[key], after: data[key] };
    }
  }

  if (Object.keys(changedFields).length > 0) {
    await createAuditLog({
      entity_type: 'logement',
      entity_id: id,
      action: 'updated',
      changed_fields: changedFields,
    });
  }

  return data as Logement;
}

export async function archiveLogement(id: string) {
  const { error } = await supabase
    .from('logements')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'logement',
    entity_id: id,
    action: 'archived',
  });
}
