import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import { computeAutoAdvance } from '@/lib/pipelineAutomate';
import { getLogementPieces } from './logementPieces';
import type { PipelineStatut } from '@/types/database.types';
import type { Edl, EdlItem, EdlType, EdlStatut, EdlItemEtat } from '@/types/database.types';

export async function getEdlByDossier(dossierId: string) {
  const { data, error } = await supabase
    .from('edls')
    .select('*, edl_items(*)')
    .eq('dossier_id', dossierId)
    .order('type');

  if (error) throw error;
  return data as unknown as (Edl & { edl_items: EdlItem[] })[];
}

export async function getEdlById(id: string) {
  const { data, error } = await supabase
    .from('edls')
    .select('*, edl_items(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as Edl & { edl_items: EdlItem[] };
}

export async function createEdl(params: {
  dossier_id: string;
  type: EdlType;
  items: Array<{ checklist_item_label: string; ordre: number; piece_id?: string }>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('edls')
    .insert({
      dossier_id: params.dossier_id,
      type: params.type,
      statut: 'NON_COMMENCE' as EdlStatut,
      realise_par_user_id: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Créer les items de checklist
  if (params.items.length > 0) {
    const itemsToInsert = params.items.map((item) => ({
      edl_id: data.id,
      checklist_item_label: item.checklist_item_label,
      ordre: item.ordre,
      ...(item.piece_id ? { piece_id: item.piece_id } : {}),
    }));

    const { error: itemsError } = await supabase.from('edl_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;
  }

  await createAuditLog({
    entity_type: 'edl',
    entity_id: data.id,
    action: 'created',
    metadata: { type: params.type },
  });

  return data as Edl;
}

/** Peuple un EDL existant avec les pièces configurées pour le logement */
export async function addItemsFromPieces(edlId: string, logementId: string): Promise<void> {
  const pieces = await getLogementPieces(logementId);
  if (pieces.length === 0) return;

  const itemsToInsert = pieces.map((p) => ({
    edl_id: edlId,
    checklist_item_label: p.nom,
    ordre: p.ordre,
    piece_id: p.id,
  }));

  const { error } = await supabase.from('edl_items').insert(itemsToInsert);
  if (error) throw error;
}

export async function updateEdlItem(
  itemId: string,
  updates: { etat?: EdlItemEtat; commentaire?: string | null; photo_url?: string | null },
) {
  const { error } = await supabase.from('edl_items').update(updates).eq('id', itemId);
  if (error) throw error;
}

export async function startEdl(edlId: string) {
  const { error } = await supabase
    .from('edls')
    .update({ statut: 'EN_COURS' as EdlStatut, started_at: new Date().toISOString() })
    .eq('id', edlId);

  if (error) throw error;
}

export async function finalizeEdl(edlId: string, hasIncident: boolean) {
  const newStatut: EdlStatut = hasIncident ? 'TERMINE_INCIDENT' : 'TERMINE_OK';

  // Charger dossier_id + type avant la mise à jour pour l'auto-advance pipeline
  const { data: edlData } = await supabase
    .from('edls')
    .select('dossier_id, type')
    .eq('id', edlId)
    .single();

  const { error } = await supabase
    .from('edls')
    .update({ statut: newStatut, completed_at: new Date().toISOString() })
    .eq('id', edlId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'edl',
    entity_id: edlId,
    action: 'finalized',
    metadata: { statut: newStatut, has_incident: hasIncident },
  });

  // Auto-advance pipeline : on utilise le statut EDL qu'on vient de calculer (pas de re-query)
  if (edlData?.dossier_id && edlData?.type) {
    const { data: dossierData } = await supabase
      .from('dossiers')
      .select('pipeline_statut, logement_id')
      .eq('id', edlData.dossier_id)
      .single();

    if (dossierData?.pipeline_statut) {
      const target = computeAutoAdvance(
        dossierData.pipeline_statut,
        [],
        [{ type: edlData.type, statut: newStatut }],
      );

      if (target) {
        try {
          // RPC SECURITY DEFINER : contourne RLS + insère l'audit log
          await supabase.rpc('auto_advance_pipeline', {
            p_dossier_id: edlData.dossier_id,
            p_from_statut: dossierData.pipeline_statut as PipelineStatut,
            p_to_statut: target,
          });
        } catch {
          // Non-bloquant
        }
      }
    }
  }
}

export async function reopenEdl(edlId: string) {
  const { error } = await supabase
    .from('edls')
    .update({ statut: 'EN_COURS' as EdlStatut, completed_at: null })
    .eq('id', edlId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'edl',
    entity_id: edlId,
    action: 'reopened',
    metadata: {},
  });
}

// ─── Photos EDL ──────────────────────────────────────────────

/** Parse le champ photo_url (JSON array ou string simple) en tableau de chemins Storage */
export function parsePhotoUrls(photoUrl: string | null): string[] {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    return Array.isArray(parsed) ? parsed : [photoUrl];
  } catch {
    return photoUrl ? [photoUrl] : [];
  }
}

/** Upload une photo pour un item EDL vers Supabase Storage */
export async function uploadEdlItemPhoto(params: {
  dossierId: string;
  edlId: string;
  itemId: string;
  file: File;
  currentPhotoUrl: string | null;
}): Promise<string[]> {
  const storagePath = `${params.dossierId}/${params.edlId}/${params.itemId}/${Date.now()}_${params.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('edl-photos')
    .upload(storagePath, params.file);

  if (uploadError) throw uploadError;

  const currentPaths = parsePhotoUrls(params.currentPhotoUrl);
  const newPaths = [...currentPaths, storagePath];

  const { error } = await supabase
    .from('edl_items')
    .update({ photo_url: JSON.stringify(newPaths) })
    .eq('id', params.itemId);

  if (error) throw error;

  return newPaths;
}

/** Supprime une photo d'un item EDL */
export async function deleteEdlItemPhoto(params: {
  itemId: string;
  storagePath: string;
  currentPhotoUrl: string | null;
}): Promise<string[]> {
  await supabase.storage.from('edl-photos').remove([params.storagePath]);

  const currentPaths = parsePhotoUrls(params.currentPhotoUrl);
  const newPaths = currentPaths.filter((p) => p !== params.storagePath);

  const { error } = await supabase
    .from('edl_items')
    .update({ photo_url: newPaths.length > 0 ? JSON.stringify(newPaths) : null })
    .eq('id', params.itemId);

  if (error) throw error;

  return newPaths;
}

/** Récupère l'URL publique d'une photo EDL */
export function getEdlPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from('edl-photos').getPublicUrl(storagePath);
  return data.publicUrl;
}
