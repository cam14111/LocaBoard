import { useState, useRef } from 'react';
import { Camera, ImagePlus, X, Loader2, ZoomIn } from 'lucide-react';
import {
  uploadEdlItemPhoto,
  deleteEdlItemPhoto,
  getEdlPhotoUrl,
  parsePhotoUrls,
} from '@/lib/api/edl';
import { compressAndStripExif } from '@/lib/imageUtils';

const MAX_PHOTOS = 5;

interface EdlItemPhotosProps {
  dossierId: string;
  edlId: string;
  itemId: string;
  photoUrl: string | null;
  disabled?: boolean;
  onPhotosChange: (newPhotoUrl: string | null) => void;
}

export default function EdlItemPhotos({
  dossierId,
  edlId,
  itemId,
  photoUrl,
  disabled = false,
  onPhotosChange,
}: EdlItemPhotosProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const photos = parsePhotoUrls(photoUrl);
  const canAdd = photos.length < MAX_PHOTOS && !disabled;

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    setPhotoError('');
    try {
      const compressed = await compressAndStripExif(file);
      const newPaths = await uploadEdlItemPhoto({
        dossierId,
        edlId,
        itemId,
        file: compressed,
        currentPhotoUrl: photoUrl,
      });
      onPhotosChange(JSON.stringify(newPaths));
    } catch {
      setPhotoError('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(storagePath: string) {
    setDeleting(storagePath);
    setPhotoError('');
    try {
      const newPaths = await deleteEdlItemPhoto({
        itemId,
        storagePath,
        currentPhotoUrl: photoUrl,
      });
      onPhotosChange(newPaths.length > 0 ? JSON.stringify(newPaths) : null);
    } catch {
      setPhotoError('Erreur lors de la suppression.');
    } finally {
      setDeleting(null);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-2">
      {photoError && (
        <p className="text-xs text-red-600" role="alert">{photoError}</p>
      )}

      {/* Grille de miniatures */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((path) => {
            const url = getEdlPhotoUrl(path);
            const isDeleting = deleting === path;
            return (
              <div
                key={path}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100"
              >
                <img
                  src={url}
                  alt="Photo EDL"
                  className="h-full w-full object-cover cursor-pointer"
                  onClick={() => setZoomedPhoto(url)}
                />
                {/* Bouton zoom — toujours visible */}
                <button
                  onClick={() => setZoomedPhoto(url)}
                  className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1"
                >
                  <ZoomIn className="h-3 w-3 text-white" />
                </button>
                {/* Bouton supprimer — visible seulement si pas finalisé */}
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(path);
                    }}
                    disabled={isDeleting}
                    className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    ) : (
                      <X className="h-3 w-3 text-white" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Boutons ajout photo */}
      {canAdd && (
        <div className="flex gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Photo
              </>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                Galerie
              </>
            )}
          </button>
        </div>
      )}

      {/* Compteur */}
      {photos.length > 0 && (
        <p className="text-[10px] text-slate-400 text-center">
          {photos.length}/{MAX_PHOTOS} photo{photos.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Inputs fichier cachés */}
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

      {/* Modal zoom plein écran */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
            alt="Photo EDL agrandie"
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl"
          />
        </div>
      )}
    </div>
  );
}
