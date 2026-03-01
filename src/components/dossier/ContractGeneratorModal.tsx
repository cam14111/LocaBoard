import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getLogementById } from '@/lib/api/logements';
import { uploadDocument, getDocumentsByDossier, replaceDocument } from '@/lib/api/documents';
import { generateContract, generateContractPDF, type ContractData } from '@/lib/contractGenerator';
import type { Dossier, Reservation, Logement, Document as AppDocument } from '@/types/database.types';

interface ContractGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
  dossier: Dossier;
  reservation: Reservation;
}

const INPUT = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';
const LABEL = 'block text-sm font-medium text-slate-700';

export default function ContractGeneratorModal({
  isOpen,
  onClose,
  onGenerated,
  dossier,
  reservation,
}: ContractGeneratorModalProps) {
  const { profile } = useAuth();
  const [logement, setLogement] = useState<Logement | null>(null);
  const [existingContrat, setExistingContrat] = useState<AppDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Champs modifiables
  const [ownerPrenom, setOwnerPrenom] = useState('');
  const [ownerNom, setOwnerNom] = useState('');
  const [ownerAdresse, setOwnerAdresse] = useState('');
  const [ownerTel, setOwnerTel] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerSiret, setOwnerSiret] = useState('');
  const [loyerTotal, setLoyerTotal] = useState('');
  const [includeMenage, setIncludeMenage] = useState(false);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  // Charger la signature bailleur en base64 pour injection dans le PDF
  const loadSignature = useCallback(async () => {
    const storagePath = profile?.signature_url;
    if (!storagePath) { setSignatureBase64(null); return; }
    try {
      const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 300);
      if (!data?.signedUrl) return;
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => setSignatureBase64(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn('[ContractGenerator] Signature non disponible:', err);
      setSignatureBase64(null);
    }
  }, [profile?.signature_url]);

  useEffect(() => { if (isOpen) loadSignature(); }, [isOpen, loadSignature]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setPreviewHtml('');

    Promise.all([
      getLogementById(dossier.logement_id),
      getDocumentsByDossier(dossier.id),
    ])
      .then(([lg, docs]) => {
        setLogement(lg);
        setIncludeMenage((lg?.forfait_menage_eur ?? 0) > 0);
        const contrat = docs.find((d) => d.type === 'CONTRAT') ?? null;
        setExistingContrat(contrat);
      })
      .catch(() => setError('Impossible de charger les données du logement.'))
      .finally(() => setLoading(false));
  }, [isOpen, dossier.logement_id, dossier.id]);

  // Pré-remplir les champs bailleur depuis le profil
  useEffect(() => {
    if (!profile) return;
    setOwnerPrenom(profile.prenom ?? '');
    setOwnerNom(profile.nom ?? '');
    setOwnerAdresse((profile as { adresse?: string | null })?.adresse ?? '');
    setOwnerTel((profile as { telephone?: string | null })?.telephone ?? '');
    setOwnerEmail(profile.email ?? '');
    setOwnerSiret((profile as { siret?: string | null })?.siret ?? '');
    setLoyerTotal(reservation.loyer_total ? String(reservation.loyer_total) : '');
  }, [profile, reservation.loyer_total]);

  function buildContractData(): ContractData {
    return {
      owner_prenom: ownerPrenom.trim(),
      owner_nom: ownerNom.trim(),
      owner_adresse: ownerAdresse.trim(),
      owner_telephone: ownerTel.trim() || undefined,
      owner_email: ownerEmail.trim() || undefined,
      owner_siret: ownerSiret.trim() || undefined,
      owner_ville: profile?.ville || undefined,
      owner_signature_base64: signatureBase64 || undefined,
      property_type: logement?.type ?? 'appartement',
      property_adresse: logement?.adresse ?? '',
      property_surface: logement?.surface_m2,
      property_rooms: logement?.nb_pieces,
      property_max_occupants: logement?.capacite_personnes,
      property_description: logement?.description,
      property_equipements: logement?.equipements,
      property_charges: logement?.charges_incluses,
      property_animaux_autorises: logement?.animaux_autorises ?? false,
      property_animaux_types: logement?.animaux_types,
      property_animaux_nb_max: logement?.animaux_nb_max,
      property_animaux_taille_max: logement?.animaux_taille_max,
      cleaning_fee: includeMenage ? (logement?.forfait_menage_eur ?? 0) : 0,
      tourist_tax_rate: logement?.taux_taxe_sejour,
      tenant_prenom: reservation.locataire_prenom,
      tenant_nom: reservation.locataire_nom,
      tenant_adresse: reservation.locataire_adresse,
      tenant_email: reservation.locataire_email,
      tenant_telephone: reservation.locataire_telephone,
      tenant_pays: reservation.locataire_pays,
      nb_personnes: reservation.nb_personnes,
      date_debut: reservation.date_debut,
      date_fin: reservation.date_fin,
      loyer_total: loyerTotal ? Number(loyerTotal) : reservation.loyer_total,
      type_versement: dossier.type_premier_versement,
    };
  }

  function handlePreview() {
    setError('');
    if (!ownerNom.trim() || !ownerPrenom.trim() || !ownerAdresse.trim()) {
      setError('Les informations du bailleur (nom, prénom, adresse) sont obligatoires.');
      return;
    }
    const html = generateContract(buildContractData());
    setPreviewHtml(html);
  }

  async function handleGenerate() {
    setError('');
    if (!ownerNom.trim() || !ownerPrenom.trim() || !ownerAdresse.trim()) {
      setError('Les informations du bailleur (nom, prénom, adresse) sont obligatoires.');
      return;
    }

    setGenerating(true);
    try {
      const contractData = buildContractData();
      const fileName = `Contrat_${reservation.locataire_nom}_${reservation.date_debut}.pdf`;
      const pdfBlob = await generateContractPDF(contractData, fileName);
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (existingContrat) {
        await replaceDocument(existingContrat.id, {
          dossier_id: dossier.id,
          type: 'CONTRAT',
          file,
        });
      } else {
        await uploadDocument({
          dossier_id: dossier.id,
          type: 'CONTRAT',
          file,
        });
      }

      setSuccess('Contrat généré et sauvegardé avec succès.');
      setPreviewHtml('');
      onGenerated();
    } catch (err) {
      // Supabase PostgrestError a message + details + hint — on les affiche tous
      const e = err as Record<string, unknown>;
      const msg = [e?.message, e?.details, e?.hint].filter(Boolean).join(' — ') || 'Erreur inconnue';
      console.error('[ContractGenerator] erreur:', err);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  const missingOwnerInfo = !ownerNom.trim() || !ownerPrenom.trim() || !ownerAdresse.trim();

  // Calculs récapitulatif
  const loyer = loyerTotal ? Number(loyerTotal) : (reservation.loyer_total ?? 0);
  const arrhes = Math.round(loyer * 0.25 * 100) / 100;
  const solde = Math.round((loyer - arrhes) * 100) / 100;
  const forfaitMenage = includeMenage ? (logement?.forfait_menage_eur ?? 0) : 0;
  const nbNuits = Math.round(
    (new Date(reservation.date_fin).getTime() - new Date(reservation.date_debut).getTime()) / (1000 * 60 * 60 * 24)
  );
  const taxeSejour = Math.round((logement?.taux_taxe_sejour ?? 0) * (reservation.nb_personnes ?? 1) * nbNuits * 100) / 100;
  const totalGeneral = Math.round((loyer + forfaitMenage + taxeSejour) * 100) / 100;
  const typeVersement = dossier.type_premier_versement === 'ACOMPTE' ? 'Acompte' : 'Arrhes';
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[3vh] px-4" role="dialog" aria-modal="true" aria-labelledby="cg-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} role="presentation" />

      <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <h2 id="cg-title" className="text-lg font-semibold">Générer le contrat de location</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 transition-colors" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          )}

          {!loading && (
            <>
              {existingContrat && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Un contrat existe déjà pour ce dossier. Il sera <strong>remplacé</strong> par la nouvelle version générée.</span>
                </div>
              )}

              {missingOwnerInfo && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Les informations du bailleur sont incomplètes. Complétez-les ci-dessous ou mettez à jour votre{' '}
                    <a href="/parametres/profil" className="underline font-medium" onClick={onClose}>profil</a>.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Colonne gauche : données bailleur */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Informations bailleur</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Prénom <span className="text-red-500">*</span></label>
                      <input type="text" required value={ownerPrenom} onChange={(e) => setOwnerPrenom(e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Nom <span className="text-red-500">*</span></label>
                      <input type="text" required value={ownerNom} onChange={(e) => setOwnerNom(e.target.value)} className={INPUT} />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Adresse <span className="text-red-500">*</span></label>
                    <input type="text" required value={ownerAdresse} onChange={(e) => setOwnerAdresse(e.target.value)} className={INPUT} placeholder="Adresse complète du bailleur" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Téléphone</label>
                      <input type="tel" value={ownerTel} onChange={(e) => setOwnerTel(e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Email</label>
                      <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={INPUT} />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>SIRET <span className="text-slate-400 font-normal">(optionnel)</span></label>
                    <input type="text" value={ownerSiret} onChange={(e) => setOwnerSiret(e.target.value)} className={INPUT} placeholder="14 chiffres" maxLength={14} />
                  </div>
                </div>

                {/* Colonne droite : données récapitulatives */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Récapitulatif</h3>

                  <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Locataire</span>
                      <span className="font-medium">{reservation.locataire_prenom} {reservation.locataire_nom}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Logement</span>
                      <span className="font-medium">{logement?.nom ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Arrivée</span>
                      <span className="font-medium">{new Date(reservation.date_debut).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Départ</span>
                      <span className="font-medium">{new Date(reservation.date_fin).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Personnes</span>
                      <span className="font-medium">{reservation.nb_personnes ?? '—'} · {nbNuits} nuit{nbNuits > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Loyer total (€)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={loyerTotal}
                      onChange={(e) => setLoyerTotal(e.target.value)}
                      className={INPUT}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Détail financier */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
                    <div className="flex justify-between px-3 py-2 bg-slate-50">
                      <span className="text-slate-500">Loyer</span>
                      <span className="font-medium">{fmt(loyer)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 border-t border-slate-100">
                      <span className="text-slate-500">{typeVersement} (25%)</span>
                      <span className="font-medium">{fmt(arrhes)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 border-t border-slate-100">
                      <span className="text-slate-500">Solde (75%)</span>
                      <span className="font-medium">{fmt(solde)}</span>
                    </div>

                    {/* Toggle forfait ménage */}
                    {(logement?.forfait_menage_eur ?? 0) > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                          <input
                            type="checkbox"
                            checked={includeMenage}
                            onChange={(e) => setIncludeMenage(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          Forfait ménage
                        </label>
                        <span className={includeMenage ? 'font-medium' : 'text-slate-400 line-through'}>
                          {fmt(logement?.forfait_menage_eur ?? 0)}
                        </span>
                      </div>
                    )}

                    {taxeSejour > 0 && (
                      <div className="flex justify-between px-3 py-2 border-t border-slate-100">
                        <span className="text-slate-500">Taxe de séjour</span>
                        <span className="font-medium">{fmt(taxeSejour)}</span>
                      </div>
                    )}

                    <div className="flex justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 font-semibold">
                      <span>Total</span>
                      <span>{fmt(totalGeneral)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {previewHtml && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-sm font-medium text-slate-700">Aperçu du contrat</span>
                    <button
                      type="button"
                      onClick={() => setPreviewHtml('')}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Masquer
                    </button>
                  </div>
                  <div
                    className="overflow-y-auto max-h-80 p-2"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700" role="status">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || missingOwnerInfo}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {generating ? 'Génération en cours…' : 'Générer et sauvegarder le PDF'}
                </button>

                {!previewHtml && (
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={missingOwnerInfo}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Aperçu
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 ml-auto"
                >
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
