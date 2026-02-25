import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Note } from '@/types/database.types';

export async function getNotesByDossier(dossierId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Note[];
}

export async function createNote(params: { dossier_id: string; contenu: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('notes')
    .insert({
      dossier_id: params.dossier_id,
      contenu: params.contenu,
      created_by_user_id: user?.id ?? '',
    })
    .select()
    .single();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'dossier',
    entity_id: params.dossier_id,
    action: 'note_added',
  });

  return data as Note;
}

export async function deleteNote(noteId: string, dossierId: string) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;

  await createAuditLog({
    entity_type: 'dossier',
    entity_id: dossierId,
    action: 'note_deleted',
  });
}
