import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { ChecklistModele } from '@/types/database.types';

export async function getChecklistModeles(logementId: string) {
  const { data, error } = await supabase
    .from('checklist_modeles')
    .select('*')
    .eq('logement_id', logementId)
    .order('created_at');

  if (error) throw error;
  return data as ChecklistModele[];
}

export async function createChecklistModele(modele: Partial<ChecklistModele>) {
  const { data, error } = await supabase
    .from('checklist_modeles')
    .insert(modele)
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'checklist_modele',
    entity_id: data.id,
    logement_id: data.logement_id,
    action: 'created',
  });

  return data as ChecklistModele;
}

export async function updateChecklistModele(id: string, updates: Partial<ChecklistModele>) {
  const { data, error } = await supabase
    .from('checklist_modeles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'checklist_modele',
    entity_id: id,
    logement_id: data.logement_id,
    action: 'updated',
  });

  return data as ChecklistModele;
}

export async function deleteChecklistModele(id: string) {
  const { data } = await supabase
    .from('checklist_modeles')
    .select('logement_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('checklist_modeles')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'checklist_modele',
    entity_id: id,
    logement_id: data?.logement_id ?? null,
    action: 'deleted',
  });
}
