import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Blocage, BlocageMotif } from '@/types/database.types';

export async function getBlocagesByLogement(
  logementId: string,
  options?: { from?: string; to?: string },
) {
  let query = supabase
    .from('blocages')
    .select('*')
    .eq('logement_id', logementId)
    .is('archived_at', null);

  if (options?.from) query = query.gte('date_fin', options.from);
  if (options?.to) query = query.lte('date_debut', options.to);

  const { data, error } = await query.order('date_debut');
  if (error) throw error;
  return data as Blocage[];
}

/** Récupère les blocages avec logement_id optionnel (pour "Tous les logements") */
export async function getBlocages(options?: {
  logement_id?: string;
  from?: string;
  to?: string;
}) {
  let query = supabase
    .from('blocages')
    .select('*')
    .is('archived_at', null);

  if (options?.logement_id) query = query.eq('logement_id', options.logement_id);
  if (options?.from) query = query.gte('date_fin', options.from);
  if (options?.to) query = query.lte('date_debut', options.to);

  const { data, error } = await query.order('date_debut');
  if (error) throw error;
  return data as Blocage[];
}

export async function createBlocage(params: {
  logement_id: string;
  date_debut: string;
  date_fin: string;
  motif: BlocageMotif;
  notes?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('check_and_create_blocage', {
    p_logement_id: params.logement_id,
    p_date_debut: params.date_debut,
    p_date_fin: params.date_fin,
    p_motif: params.motif,
    p_notes: params.notes ?? null,
    p_created_by: user?.id ?? null,
  });

  if (error) throw error;

  const newId = data as string;

  await createAuditLog({
    entity_type: 'blocage',
    entity_id: newId,
    logement_id: params.logement_id,
    action: 'created',
    metadata: { motif: params.motif },
  });

  return newId;
}

export async function archiveBlocage(id: string) {
  const { data: before } = await supabase
    .from('blocages')
    .select('logement_id, archived_at')
    .eq('id', id)
    .single();

  const now = new Date().toISOString();
  const { error } = await supabase.from('blocages').update({ archived_at: now }).eq('id', id);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'blocage',
    entity_id: id,
    logement_id: before?.logement_id ?? null,
    action: 'archived',
    changed_fields: { archived_at: { before: before?.archived_at, after: now } },
  });
}
