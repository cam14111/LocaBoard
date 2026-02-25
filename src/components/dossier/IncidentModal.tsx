import { useState, useRef } from 'react';
import {
  X,
  Camera,
  ImagePlus,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  ZoomIn,
} from 'lucide-react';
import { createIncident } from '@/lib/api/incidents';
import { compressAndStripExif } from '@/lib/imageUtils';
import type { EdlItem, IncidentSeverite } from '@/types/database.types';

const MAX_PHOTOS = 5;

interface IncidentModalProps {
  edlId: string;
  dossierId: string;
  items?: EdlItem[];
  preselectedItemId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export default function IncidentModal({
  edlId,
  dossierId,
  items = [],
  preselectedItemId = null,
  onClose,
  onCreated,
}: IncidentModalProps) {
  const [description, setDescription] = useState('');
  const [severite, setSeverite] = useState<IncidentSeverite>('MINEUR');
  const [selectedItemId, setSelectedItemId] = useState(preselectedItemId || '');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = description.trim().length > 0 && photos.length >= 1 && !creating;

  async function handleAddPhoto(file: File) {
    if (!file.type.startsWith('image/') || photos.length >= MAX_PHOTOS) return;
    try {
      const compressed = await compressAndStripExif(file);
      const preview = URL.createObjectURL(compressed);
      setPhotos((prev) => [...prev, { file: compressed, preview }]);
    } catch {
      // Erreur de compression silencieuse
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleAddPhoto(file);
    e.target.value = '';
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setCreating(true);
    setError('');
    try {
      await createIncident({
        edl_id: edlId,
        dossier_id: dossierId,
        description: description.trim(),
        severite,
        photos: photos.map((p) => p.file),
        edl_item_id: selectedItemId || null,
      });
      // Nettoyage des previews
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setCreating(false);
    }
  }

  // Items en anomalie pour la sélection
  const anomalyItems = items.filter((i) => i.etat === 'ANOMALIE');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h3 className="text-base font-semibold text-slate-900">
              Signaler un incident
            </h3>
          </div>
          <button onClick={onClose} className="p-1">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sévérité */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Sévérité
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSeverite('MINEUR')}
                className={`flex-1 rounded-xl border-2 px-3 py-3 text-center transition-all ${
                  severite === 'MINEUR'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 bg-white hover:border-amber-300'
                }`}
              >
                <AlertTriangle
                  className={`h-6 w-6 mx-auto mb-1 ${
                    severite === 'MINEUR' ? 'text-amber-500' : 'text-slate-300'
                  }`}
                />
                <p className={`text-sm font-semibold ${severite === 'MINEUR' ? 'text-amber-700' : 'text-slate-500'}`}>
                  Mineur
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Usure normale, cosmétique
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSeverite('MAJEUR')}
                className={`flex-1 rounded-xl border-2 px-3 py-3 text-center transition-all ${
                  severite === 'MAJEUR'
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 bg-white hover:border-red-300'
                }`}
              >
                <ShieldAlert
                  className={`h-6 w-6 mx-auto mb-1 ${
                    severite === 'MAJEUR' ? 'text-red-500' : 'text-slate-300'
                  }`}
                />
                <p className={`text-sm font-semibold ${severite === 'MAJEUR' ? 'text-red-700' : 'text-slate-500'}`}>
                  Majeur
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Dégradation, réparation nécessaire
                </p>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez l'incident constaté..."
              maxLength={1000}
              rows={4}
              className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none"
            />
            <p className="text-right text-[10px] text-slate-400 mt-1">
              {description.length}/1000
            </p>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Photos <span className="text-red-500">*</span>
              <span className="font-normal text-slate-400 ml-1">(min 1, max 5)</span>
            </label>

            {/* Grille miniatures */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100"
                  >
                    <img
                      src={photo.preview}
                      alt={`Photo ${idx + 1}`}
                      className="h-full w-full object-cover cursor-pointer"
                      onClick={() => setZoomedPhoto(photo.preview)}
                    />
                    <button
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                    <button
                      onClick={() => setZoomedPhoto(photo.preview)}
                      className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1"
                    >
                      <ZoomIn className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Boutons ajout */}
            {photos.length < MAX_PHOTOS && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  Galerie
                </button>
              </div>
            )}

            {photos.length > 0 && (
              <p className="text-[10px] text-slate-400 text-center mt-1">
                {photos.length}/{MAX_PHOTOS} photo{photos.length > 1 ? 's' : ''}
              </p>
            )}

            {/* Inputs cachés */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleInputChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {/* Item EDL lié (optionnel) */}
          {anomalyItems.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Item EDL lié (optionnel)
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">Aucun</option>
                {anomalyItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.checklist_item_label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              severite === 'MAJEUR'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {creating ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              'Créer l\'incident'
            )}
          </button>
        </div>
      </div>

      {/* Modal zoom photo */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 bg-black/60 rounded-full p-2 z-10"
            onClick={() => setZoomedPhoto(null)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={zoomedPhoto}
            alt="Photo incident agrandie"
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl"
          />
        </div>
      )}
    </div>
  );
}
