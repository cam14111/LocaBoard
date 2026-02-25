import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Loader2, Trash2 } from 'lucide-react';
import { getNotesByDossier, createNote, deleteNote } from '@/lib/api/notes';
import type { Note } from '@/types/database.types';

interface NotesSectionProps {
  dossierId: string;
}

export default function NotesSection({ dossierId }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [contenu, setContenu] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const data = await getNotesByDossier(dossierId);
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function handleAdd() {
    if (!contenu.trim()) return;
    setSaving(true);
    try {
      await createNote({ dossier_id: dossierId, contenu: contenu.trim() });
      setContenu('');
      await loadNotes();
    } catch {
      // silencieux
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      await deleteNote(noteId, dossierId);
      await loadNotes();
    } catch {
      // silencieux
    } finally {
      setDeletingId(null);
    }
  }

  function formatNoteDate(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Notes internes</h3>
      </div>

      {/* Formulaire ajout */}
      <div className="flex gap-2">
        <input
          type="text"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Ajouter une note..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !contenu.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {/* Liste notes */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-2">Aucune note</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.contenu}</p>
                <p className="text-xs text-slate-400 mt-1">{formatNoteDate(note.created_at)}</p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                {deletingId === note.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
