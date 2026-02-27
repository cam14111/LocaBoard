import { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { uploadDocument, replaceDocument } from '@/lib/api/documents';
import { updatePipelineStatut } from '@/lib/api/dossiers';

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.heic';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface SignedContractUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  dossierId: string;
  existingContratId?: string | null;
}

export default function SignedContractUploadModal({
  isOpen,
  onClose,
  onDone,
  dossierId,
  existingContratId,
}: SignedContractUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError('');
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      setError('Le fichier dépasse la taille maximale de 10 Mo.');
      return;
    }
    setSelectedFile(file);
  }

  async function handleUploadAndAdvance() {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      if (existingContratId) {
        await replaceDocument(existingContratId, {
          dossier_id: dossierId,
          type: 'CONTRAT',
          file: selectedFile,
        });
      } else {
        await uploadDocument({
          dossier_id: dossierId,
          type: 'CONTRAT',
          file: selectedFile,
        });
      }
      await updatePipelineStatut(dossierId, 'ACOMPTE_RECU');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSkipUpload() {
    setUploading(true);
    setError('');
    try {
      await updatePipelineStatut(dossierId, 'ACOMPTE_RECU');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de statut.');
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="sc-title">
      <div className="fixed inset-0 bg-black/50" role="presentation" />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            <h2 id="sc-title" className="text-base font-semibold">Contrat signé</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 transition-colors" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Le statut va passer à <strong className="text-green-700">Contrat signé</strong>.
            {existingContratId
              ? ' Importez le contrat signé scanné pour remplacer la version non signée.'
              : ' Importez le contrat signé scanné pour l\'ajouter aux documents du dossier.'}
          </p>

          {/* Zone de dépôt */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-primary-400 hover:bg-primary-50 transition-colors"
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                <FileText className="h-5 w-5 text-primary-600" />
                <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Cliquez pour sélectionner le contrat signé</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, HEIC — 10 Mo max</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="sr-only"
            aria-hidden="true"
            onChange={handleFileChange}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleUploadAndAdvance}
              disabled={!selectedFile || uploading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Upload className="h-4 w-4" />
              Importer et marquer comme signé
            </button>

            <button
              type="button"
              onClick={handleSkipUpload}
              disabled={uploading}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Passer sans importer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
