import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Image,
  Upload,
  Download,
  Eye,
  RefreshCw,
  Loader2,
  Plus,
  X,
  History,
  Wand2,
  Mail,
} from 'lucide-react';
import {
  getDocumentsByDossier,
  uploadDocument,
  replaceDocument,
  getDocumentUrl,
  createDocumentShareLink,
  getDocumentVersionHistory,
} from '@/lib/api/documents';
import { usePermission } from '@/hooks/usePermission';
import ContractGeneratorModal from '@/components/dossier/ContractGeneratorModal';
import type { Document as DocType, DocumentType, Dossier, Reservation } from '@/types/database.types';

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'CONTRAT', label: 'Contrat' },
  { value: 'PREUVE_PAIEMENT', label: 'Preuve de paiement' },
  { value: 'EDL', label: 'État des lieux' },
  { value: 'PIECE_IDENTITE', label: "Pièce d'identité" },
  { value: 'AUTRE', label: 'Autre' },
];

const TYPE_COLORS: Record<string, string> = {
  CONTRAT: 'bg-blue-100 text-blue-700',
  PREUVE_PAIEMENT: 'bg-green-100 text-green-700',
  EDL: 'bg-amber-100 text-amber-700',
  PIECE_IDENTITE: 'bg-purple-100 text-purple-700',
  AUTRE: 'bg-slate-100 text-slate-700',
};

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.heic';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface DocumentsTabProps {
  dossierId: string;
  dossier?: Dossier;
  reservation?: Reservation | null;
}

export default function DocumentsTab({ dossierId, dossier, reservation }: DocumentsTabProps) {
  const canUploadAll = usePermission('document:upload_all');
  const canGenerateContract = usePermission('contrat:generate');
  const canReplace = usePermission('document:replace');
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  // Co-hôte : peut uniquement upload EDL
  const canUploadEdl = true; // Tous les utilisateurs authentifiés peuvent upload EDL

  const [documents, setDocuments] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>('CONTRAT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // Store full doc info for replacement (id + type) to avoid stale closure issues
  const replacingDocRef = useRef<{ id: string; type: DocumentType } | null>(null);

  // Historique des versions (E06-04)
  const [versionHistory, setVersionHistory] = useState<DocType[] | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionDocType, setVersionDocType] = useState<string>('');
  const [versionMap, setVersionMap] = useState<Map<string, number>>(new Map());

  const loadDocs = useCallback(async () => {
    try {
      const data = await getDocumentsByDossier(dossierId);
      setDocuments(data);

      // Calculer les numéros de version réels pour les documents remplacés
      const replacedDocs = data.filter((d) => d.remplace_document_id);
      if (replacedDocs.length > 0) {
        const newMap = new Map<string, number>();
        await Promise.all(
          replacedDocs.map(async (doc) => {
            try {
              const versions = await getDocumentVersionHistory(dossierId, doc.type);
              const versionNum = computeVersionNumber(versions, doc);
              if (versionNum > 0) newMap.set(doc.id, versionNum);
            } catch {
              // fallback : pas de numéro dans la map → badge "v?" sera affiché
            }
          }),
        );
        setVersionMap(newMap);
      }
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  function validateFile(file: File): string | null {
    if (file.size > MAX_SIZE_BYTES) {
      return `Fichier trop volumineux (${formatFileSize(file.size)}). Max : 10 Mo.`;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'jpg', 'jpeg', 'png', 'heic'].includes(ext)) {
      return 'Format non supporté. Acceptés : PDF, JPG, PNG, HEIC.';
    }
    return null;
  }

  async function handleUpload() {
    if (!selectedFile) return;
    const validation = validateFile(selectedFile);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setError('');
    try {
      await uploadDocument({
        dossier_id: dossierId,
        type: uploadType,
        file: selectedFile,
      });
      setShowUpload(false);
      setSelectedFile(null);
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace() {
    const file = replaceInputRef.current?.files?.[0];
    const doc = replacingDocRef.current;
    if (!file || !doc) return;

    const validation = validateFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setError('');
    try {
      await replaceDocument(doc.id, {
        dossier_id: dossierId,
        type: doc.type,
        file,
      });
      replacingDocRef.current = null;
      // Reset the file input so the same file can be re-selected if needed
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du remplacement.');
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc: DocType) {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      if (isImageType(doc.mime_type)) {
        setPreviewUrl(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      setError('Impossible de récupérer le lien du document.');
    }
  }

  async function handleDownload(doc: DocType) {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = doc.nom_fichier;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Impossible de télécharger le document.');
    }
  }

  async function handleShowVersions(doc: DocType) {
    setVersionLoading(true);
    setVersionDocType(TYPE_OPTIONS.find((t) => t.value === doc.type)?.label || doc.type);
    try {
      const versions = await getDocumentVersionHistory(dossierId, doc.type);
      setVersionHistory(versions);
    } catch {
      setVersionHistory([]);
    } finally {
      setVersionLoading(false);
    }
  }

  async function handleSendByEmail(doc: DocType) {
    try {
      const shareUrl = await createDocumentShareLink(doc.storage_path);
      const to = reservation?.locataire_email || '';
      const subject = encodeURIComponent(`Contrat de location — ${doc.nom_fichier}`);
      const body = encodeURIComponent(
        `Bonjour,\n\nVeuillez trouver ci-dessous le lien pour télécharger votre document :\n\n${shareUrl}\n\nCordialement`,
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    } catch {
      setError('Impossible de générer le lien du document.');
    }
  }

  // Vérifier si un document a un historique (a été remplacé ou remplace un autre)
  function hasVersionHistory(doc: DocType): boolean {
    return !!doc.remplace_document_id;
  }

  // Calculer le numéro de version d'un doc dans l'historique
  function computeVersionNumber(versions: DocType[], doc: DocType): number {
    // versions est trié par uploaded_at DESC, donc v1 est le dernier
    const sorted = [...versions].sort(
      (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
    );
    return sorted.findIndex((v) => v.id === doc.id) + 1;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Liste documents */}
      {documents.length === 0 && !showUpload ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Aucun document. Ajoutez le contrat ou d'autres pièces.</p>
        </div>
      ) : (
        documents.map((doc) => {
          const typeColor = TYPE_COLORS[doc.type] || TYPE_COLORS.AUTRE;
          const typeLabel = TYPE_OPTIONS.find((t) => t.value === doc.type)?.label || doc.type;
          const isReplacement = !!doc.remplace_document_id;

          return (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                {/* Icône */}
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-50 flex-shrink-0">
                  {isImageType(doc.mime_type) ? (
                    <Image className="h-5 w-5 text-slate-400" />
                  ) : (
                    <FileText className="h-5 w-5 text-slate-400" />
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.nom_fichier}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor}`}>
                      {typeLabel}
                    </span>
                    <span className="text-xs text-slate-400">{formatFileSize(doc.taille_octets)}</span>
                    <span className="text-xs text-slate-400">{formatDate(doc.uploaded_at)}</span>
                    {isReplacement && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                        v{versionMap.get(doc.id) ?? '?'}
                      </span>
                    )}
                    {doc.type === 'CONTRAT' && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        isReplacement
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isReplacement ? 'Signé' : 'Non signé'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => handleView(doc)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Voir
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </button>
                <button
                  onClick={() => handleSendByEmail(doc)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Envoyer
                </button>
                {canReplace && (
                  <button
                    onClick={() => {
                      replacingDocRef.current = { id: doc.id, type: doc.type };
                      setError('');
                      // Small delay to let React commit the state before triggering picker
                      setTimeout(() => replaceInputRef.current?.click(), 50);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Remplacer
                  </button>
                )}
                {hasVersionHistory(doc) && (
                  <button
                    onClick={() => handleShowVersions(doc)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
                  >
                    <History className="h-3.5 w-3.5" />
                    Versions
                  </button>
                )}
              </div>


            </div>
          );
        })
      )}

      {/* Formulaire d'upload */}
      {showUpload ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Ajouter un document</h4>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Type</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
              {(canUploadAll ? TYPE_OPTIONS : TYPE_OPTIONS.filter((t) => t.value === 'EDL')).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Fichier (PDF, JPG, PNG, HEIC — max 10 Mo)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Envoyer
            </button>
            <button
              onClick={() => { setShowUpload(false); setSelectedFile(null); setError(''); }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:shadow-sm transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (canUploadAll || canUploadEdl) ? (
        <div className="space-y-2">
          {/* Bouton de génération de contrat — admin + co-hôte (pas concierge) */}
          {canGenerateContract && dossier && reservation && (
            <button
              onClick={() => setShowContractGenerator(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 px-4 py-3 text-sm font-medium text-primary-600 hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              <Wand2 className="h-4 w-4" />
              Générer le contrat
            </button>
          )}

          <button
            onClick={() => {
              setShowUpload(true);
              setError('');
              // Co-hôte : pré-sélectionner EDL
              if (!canUploadAll) setUploadType('EDL');
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter un document
          </button>
        </div>
      ) : null}

      {/* Modal génération contrat */}
      {dossier && reservation && (
        <ContractGeneratorModal
          isOpen={showContractGenerator}
          onClose={() => setShowContractGenerator(false)}
          onGenerated={() => { setShowContractGenerator(false); void loadDocs(); }}
          dossier={dossier}
          reservation={reservation}
        />
      )}

      {/* Input caché global pour remplacement (rendu une seule fois, hors de la liste).
          sr-only plutôt que hidden : l'élément reste cliquable via .click() programmatique. */}
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleReplace}
      />

      {/* Lightbox image */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewUrl(null)}>
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <img src={previewUrl} alt="Aperçu" className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Modal historique des versions (E06-04) */}
      {(versionHistory !== null || versionLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => { setVersionHistory(null); setVersionLoading(false); }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Historique — {versionDocType}
              </h3>
              <button
                onClick={() => { setVersionHistory(null); setVersionLoading(false); }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {versionLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : versionHistory && versionHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucune version.</p>
            ) : (
              <div className="space-y-2">
                {versionHistory!.map((v) => {
                  const versionNum = computeVersionNumber(versionHistory!, v);
                  const isActive = !v.archived_at;

                  return (
                    <div
                      key={v.id}
                      className={`rounded-lg border p-3 ${
                        isActive
                          ? 'border-primary-200 bg-primary-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            v{versionNum}
                          </span>
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[180px]">
                            {v.nom_fichier}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-medium ${
                            isActive ? 'text-green-600' : 'text-slate-400'
                          }`}
                        >
                          {isActive ? 'Actif' : 'Archivé'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{formatFileSize(v.taille_octets)}</span>
                        <span>{formatDate(v.uploaded_at)}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleView(v)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-white"
                        >
                          <Eye className="h-3 w-3" />
                          Voir
                        </button>
                        <button
                          onClick={() => handleDownload(v)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-white"
                        >
                          <Download className="h-3 w-3" />
                          Télécharger
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
