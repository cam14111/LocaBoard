import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Incident, IncidentPhoto, IncidentSeverite } from '@/types/database.types';

export interface IncidentWithPhotos extends Incident {
  incident_photos: IncidentPhoto[];
}

export async function getIncidentsByDossier(dossierId: string): Promise<IncidentWithPhotos[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select('*, incident_photos(*)')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as IncidentWithPhotos[];
}

export async function getIncidentsByEdl(edlId: string) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('edl_id', edlId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Incident[];
}

/** Crée un incident avec photos uploadées vers Storage */
export async function createIncident(params: {
  edl_id: string;
  dossier_id: string;
  description: string;
  severite: IncidentSeverite;
  photos: File[];
  edl_item_id?: string | null;
}): Promise<Incident> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Non authentifié');

  // Créer l'incident
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      edl_id: params.edl_id,
      dossier_id: params.dossier_id,
      description: params.description,
      severite: params.severite,
      created_by_user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  const incident = data as Incident;

  // Upload et enregistrement des photos
  for (const file of params.photos) {
    const storagePath = `incidents/${incident.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('edl-photos')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    const { error: photoError } = await supabase.from('incident_photos').insert({
      incident_id: incident.id,
      photo_url: storagePath,
    });

    if (photoError) throw photoError;
  }

  // Audit log
  await createAuditLog({
    entity_type: 'incident',
    entity_id: incident.id,
    action: 'created',
    metadata: {
      severite: params.severite,
      description: params.description.substring(0, 100),
      photo_count: params.photos.length,
      edl_item_id: params.edl_item_id ?? null,
    },
  });

  return incident;
}

/** Met à jour la description et/ou la sévérité d'un incident */
export async function updateIncident(
  incidentId: string,
  updates: { description?: string; severite?: IncidentSeverite },
): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', incidentId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'incident',
    entity_id: incidentId,
    action: 'updated',
    metadata: updates,
  });
}

/** Supprime un incident et ses photos (Storage + DB) */
export async function deleteIncident(incidentId: string): Promise<void> {
  // Récupérer les photos pour supprimer du Storage
  const { data: photos } = await supabase
    .from('incident_photos')
    .select('photo_url')
    .eq('incident_id', incidentId);

  if (photos && photos.length > 0) {
    const paths = photos.map((p: { photo_url: string }) => p.photo_url);
    await supabase.storage.from('edl-photos').remove(paths);
  }

  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', incidentId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'incident',
    entity_id: incidentId,
    action: 'deleted',
    metadata: {},
  });
}

/** Récupère les photos d'un incident */
export async function getIncidentPhotos(incidentId: string) {
  const { data, error } = await supabase
    .from('incident_photos')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at');

  if (error) throw error;
  return data;
}

/** URL publique d'une photo d'incident */
export function getIncidentPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from('edl-photos').getPublicUrl(storagePath);
  return data.publicUrl;
}
