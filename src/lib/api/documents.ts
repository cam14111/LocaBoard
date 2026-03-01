import { supabase, supabaseUrl } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Document, DocumentType } from '@/types/database.types';

/** Normalise un nom de fichier pour Supabase Storage (ASCII uniquement, sans espaces). */
function sanitizeStorageKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les diacritiques (é→e, î→i, etc.)
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // remplace tout caractère non-ASCII par _
}

export async function getDocumentsByDossier(dossierId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('dossier_id', dossierId)
    .is('archived_at', null)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data as Document[];
}

export async function getDocumentById(id: string) {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Document;
}

export async function uploadDocument(params: {
  dossier_id: string;
  type: DocumentType;
  file: File;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const storagePath = `${params.dossier_id}/${Date.now()}_${sanitizeStorageKey(params.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, params.file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      dossier_id: params.dossier_id,
      type: params.type,
      nom_fichier: params.file.name,
      mime_type: params.file.type,
      taille_octets: params.file.size,
      storage_path: storagePath,
      uploaded_by_user_id: user?.id ?? '',
    })
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'document',
    entity_id: data.id,
    action: 'uploaded',
    metadata: { type: params.type, nom_fichier: params.file.name },
  });

  return data as Document;
}

export async function replaceDocument(oldDocumentId: string, params: {
  dossier_id: string;
  type: DocumentType;
  file: File;
}) {
  // Archive l'ancien document
  await supabase
    .from('documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', oldDocumentId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const storagePath = `${params.dossier_id}/${Date.now()}_${sanitizeStorageKey(params.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, params.file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      dossier_id: params.dossier_id,
      type: params.type,
      nom_fichier: params.file.name,
      mime_type: params.file.type,
      taille_octets: params.file.size,
      storage_path: storagePath,
      uploaded_by_user_id: user?.id ?? '',
      remplace_document_id: oldDocumentId,
    })
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'document',
    entity_id: data.id,
    action: 'replaced',
    metadata: { replaced_document_id: oldDocumentId, nom_fichier: params.file.name },
  });

  return data as Document;
}

/** Récupère toutes les versions d'un document (actif + archivées) par type dans un dossier */
export async function getDocumentVersionHistory(dossierId: string, docType: DocumentType) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('dossier_id', dossierId)
    .eq('type', docType)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data as Document[];
}

/** Génère une URL signée (1 heure) pour un document dans le bucket privé. */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Crée un lien de partage court et stable pour un document (via Edge Function doc-redirect). */
export async function createDocumentShareLink(storagePath: string): Promise<string> {
  const { data, error } = await supabase
    .from('document_shares')
    .insert({ storage_path: storagePath })
    .select('id')
    .single();
  if (error) throw error;
  return `${supabaseUrl}/functions/v1/doc-redirect?id=${data.id}`;
}
