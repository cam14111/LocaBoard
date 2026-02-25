import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Loader2, Save, X } from 'lucide-react';
import {
  getChecklistModeles,
  createChecklistModele,
  updateChecklistModele,
  deleteChecklistModele,
} from '@/lib/api/checklists';
import type { ChecklistModele } from '@/types/database.types';

const DEFAULT_ITEMS = [
  'Entrée',
  'Salon',
  'Cuisine',
  'Salle de bain',
  'Chambre 1',
  'Terrasse',
  'Électroménager',
  'Clés',
];

interface EditingModele {
  id?: string;
  nom: string;
  items: string[];
}

export default function ChecklistTemplates() {
  const { id: logementId } = useParams();
  const [modeles, setModeles] = useState<ChecklistModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingModele | null>(null);
  const [newItem, setNewItem] = useState('');

  const fetchModeles = useCallback(async () => {
    if (!logementId) return;
    try {
      const data = await getChecklistModeles(logementId);
      setModeles(data);
    } catch (err) {
      console.error('Erreur chargement checklists:', err);
    } finally {
      setLoading(false);
    }
  }, [logementId]);

  useEffect(() => { fetchModeles(); }, [fetchModeles]);

  function startCreate() {
    setEditing({ nom: '', items: [...DEFAULT_ITEMS] });
  }

  function startEdit(modele: ChecklistModele) {
    setEditing({
      id: modele.id,
      nom: modele.nom,
      items: modele.items.sort((a, b) => a.ordre - b.ordre).map((i) => i.label),
    });
  }

  function addItem() {
    if (!editing || !newItem.trim()) return;
    setEditing({ ...editing, items: [...editing.items, newItem.trim()] });
    setNewItem('');
  }

  function removeItem(index: number) {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== index) });
  }

  function moveItem(index: number, direction: -1 | 1) {
    if (!editing) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editing.items.length) return;
    const items = [...editing.items];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    setEditing({ ...editing, items });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing || !logementId || !editing.nom.trim() || editing.items.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        logement_id: logementId,
        nom: editing.nom.trim(),
        items: editing.items.map((label, index) => ({ label, ordre: index })),
      };

      if (editing.id) {
        await updateChecklistModele(editing.id, payload);
      } else {
        await createChecklistModele(payload);
      }

      setEditing(null);
      await fetchModeles();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(modele: ChecklistModele) {
    if (!confirm(`Supprimer le modèle « ${modele.nom} » ?`)) return;
    try {
      await deleteChecklistModele(modele.id);
      setModeles((prev) => prev.filter((m) => m.id !== modele.id));
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to={`/parametres/logements/${logementId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au logement
        </Link>
        {!editing && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau modèle
          </button>
        )}
      </div>

      <h2 className="text-lg font-semibold">Modèles de checklist EDL</h2>

      {/* Formulaire d'édition */}
      {editing && (
        <form onSubmit={handleSave} className="rounded-xl border border-primary-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{editing.id ? 'Modifier le modèle' : 'Nouveau modèle'}</h3>
            <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label htmlFor="checklist-nom" className="block text-sm font-medium text-slate-700">
              Nom du modèle <span className="text-red-500">*</span>
            </label>
            <input
              id="checklist-nom"
              type="text"
              required
              value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              placeholder="EDL Arrivée"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Items ({editing.items.length})</p>
            <div className="space-y-1">
              {editing.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5">
                  <span className="text-xs text-slate-400 w-5">{index + 1}</span>
                  <span className="flex-1 text-sm">{item}</span>
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === editing.items.length - 1}
                    className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-0.5 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                placeholder="Ajouter un item..."
              />
              <button
                type="button"
                onClick={addItem}
                disabled={!newItem.trim()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !editing.nom.trim() || editing.items.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste des modèles */}
      {modeles.length === 0 && !editing ? (
        <div className="text-center py-12 text-slate-500">
          <p className="font-medium">Aucun modèle de checklist</p>
          <p className="text-sm mt-1">Créez votre premier modèle pour les états des lieux.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modeles.map((modele) => (
            <div key={modele.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{modele.nom}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(modele)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(modele)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modele.items
                  .sort((a, b) => a.ordre - b.ordre)
                  .map((item, i) => (
                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {item.label}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
