import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { LogementSaison } from '@/types/database.types';

/** Récupère les saisons d'un logement, triées par ordre */
export async function getLogementSaisons(logementId: string): Promise<LogementSaison[]> {
  const { data, error } = await supabase
    .from('logement_saisons')
    .select('*')
    .eq('logement_id', logementId)
    .order('ordre');

  if (error) throw error;
  return data as LogementSaison[];
}

/** Remplace toutes les saisons d'un logement (delete + insert) */
export async function upsertLogementSaisons(
  logementId: string,
  saisons: Array<{
    nom_saison: string;
    loyer_nuit: number;
    loyer_semaine: number | null;
    date_debut: string;
    date_fin: string;
    ordre: number;
  }>,
): Promise<LogementSaison[]> {
  // Supprimer les saisons existantes
  const { error: deleteError } = await supabase
    .from('logement_saisons')
    .delete()
    .eq('logement_id', logementId);

  if (deleteError) throw deleteError;

  if (saisons.length === 0) return [];

  // Insérer les nouvelles
  const rows = saisons.map((s) => ({
    logement_id: logementId,
    nom_saison: s.nom_saison,
    loyer_nuit: s.loyer_nuit,
    loyer_semaine: s.loyer_semaine,
    date_debut: s.date_debut,
    date_fin: s.date_fin,
    ordre: s.ordre,
  }));

  const { data, error } = await supabase
    .from('logement_saisons')
    .insert(rows)
    .select();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'logement',
    entity_id: logementId,
    logement_id: logementId,
    action: 'saisons_updated',
    metadata: { nb_saisons: saisons.length },
  });

  return data as LogementSaison[];
}
