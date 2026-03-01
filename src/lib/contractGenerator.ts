// Générateur de contrat LMNP
// generateContract()    → HTML pour la prévisualisation dans le modal
// generateContractPDF() → PDF texte via pdfmake (pas d'image, texte sélectionnable)

export interface ContractData {
  // Bailleur
  owner_prenom: string;
  owner_nom: string;
  owner_adresse: string;
  owner_telephone?: string;
  owner_email?: string;
  owner_siret?: string;
  owner_ville?: string;
  owner_signature_base64?: string;
  // Logement
  property_type: string;
  property_adresse: string;
  property_surface?: number | null;
  property_rooms?: number | null;
  property_max_occupants?: number | null;
  property_description?: string | null;
  property_equipements?: string | null;
  property_charges?: string | null;
  property_animaux_autorises?: boolean;
  property_animaux_types?: string | null;
  property_animaux_nb_max?: number | null;
  property_animaux_taille_max?: string | null;
  cleaning_fee?: number | null;
  tourist_tax_rate?: number | null;
  // Locataire
  tenant_prenom: string;
  tenant_nom: string;
  tenant_adresse?: string | null;
  tenant_email?: string | null;
  tenant_telephone?: string | null;
  tenant_pays?: string | null;
  nb_personnes?: number | null;
  // Location
  date_debut: string;
  date_fin: string;
  loyer_total?: number | null;
  type_versement?: 'ARRHES' | 'ACOMPTE';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function computeNights(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const diff = d2.getTime() - d1.getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  appartement: 'appartement',
  maison: 'maison',
  studio: 'studio',
  villa: 'villa',
  chambre: 'chambre',
  autre: 'logement',
};

// ─── Prévisualisation HTML (inchangée) ───────────────────────────────────────

export function generateContract(data: ContractData): string {
  const nbNuits = computeNights(data.date_debut, data.date_fin);
  const nbPersonnes = data.nb_personnes ?? 1;
  const loyerTotal = data.loyer_total ?? 0;
  const forfaitMenage = data.cleaning_fee ?? 0;
  const tauxTaxe = data.tourist_tax_rate ?? 0;
  const taxeSejour = tauxTaxe * nbPersonnes * nbNuits;
  const totalGeneral = loyerTotal + forfaitMenage + taxeSejour;
  const arrhes = Math.round(loyerTotal * 25) / 100;

  const e = {
    ownerPrenom: escapeHTML(data.owner_prenom),
    ownerNom: escapeHTML(data.owner_nom),
    ownerAdresse: escapeHTML(data.owner_adresse),
    ownerTel: escapeHTML(data.owner_telephone ?? ''),
    ownerEmail: escapeHTML(data.owner_email ?? ''),
    ownerSiret: escapeHTML(data.owner_siret ?? ''),
    propertyType: escapeHTML(PROPERTY_TYPE_LABELS[data.property_type] ?? data.property_type),
    propertyAdresse: escapeHTML(data.property_adresse),
    propertySurface: data.property_surface ? escapeHTML(String(data.property_surface)) : '',
    propertyRooms: data.property_rooms ? escapeHTML(String(data.property_rooms)) : '',
    propertyMaxOccupants: data.property_max_occupants ? escapeHTML(String(data.property_max_occupants)) : '',
    propertyDescription: escapeHTML(data.property_description ?? ''),
    propertyEquipements: escapeHTML(data.property_equipements ?? ''),
    propertyCharges: escapeHTML(data.property_charges ?? 'eau, électricité, chauffage, wifi'),
    tenantPrenom: escapeHTML(data.tenant_prenom),
    tenantNom: escapeHTML(data.tenant_nom),
    tenantAdresse: escapeHTML(data.tenant_adresse ?? ''),
    tenantEmail: escapeHTML(data.tenant_email ?? ''),
    tenantTel: escapeHTML(data.tenant_telephone ?? ''),
    tenantPays: escapeHTML(data.tenant_pays ?? 'France'),
    dateDebut: escapeHTML(formatDate(data.date_debut)),
    dateFin: escapeHTML(formatDate(data.date_fin)),
  };

  const animauxClause = data.property_animaux_autorises
    ? `Les animaux de compagnie sont autorisés dans les conditions suivantes : ${escapeHTML(data.property_animaux_types ?? 'selon accord')}, nombre maximum : ${escapeHTML(String(data.property_animaux_nb_max ?? 1))}, gabarit maximum : ${escapeHTML(data.property_animaux_taille_max ?? 'non précisé')}.`
    : `Les animaux de compagnie ne sont pas autorisés dans le logement.`;

  const typeVersement = data.type_versement === 'ACOMPTE' ? 'acompte' : 'arrhes';
  const montantVersement = arrhes > 0 ? formatCurrency(arrhes) : 'à définir';

  const arrhesClause = data.type_versement === 'ACOMPTE'
    ? `Un acompte de <strong>${montantVersement}</strong> (25% du loyer) sera versé à la réservation. En cas d'annulation, les sommes versées restent acquises au bailleur et le locataire demeure redevable du solde.`
    : `Des arrhes de <strong>${montantVersement}</strong> (25% du loyer) seront versées à la réservation. En cas d'annulation par le locataire, les arrhes restent acquises au bailleur. En cas d'annulation par le bailleur, celui-ci rembourse le double des arrhes reçues (art. L.214-1 Code de la Consommation).`;

  return `
<div class="contract-document" style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; max-width: 780px; margin: 0 auto; padding: 40px 50px;">

  <div class="contract-header" style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #333;">
    <h1 style="font-size: 16pt; font-weight: bold; margin: 0 0 6px 0; letter-spacing: 1px; text-transform: uppercase;">
      CONTRAT DE LOCATION MEUBLÉE SAISONNIÈRE
    </h1>
    <p style="font-size: 10pt; color: #555; margin: 0;">
      Conformément aux articles L.324-1-1 du Code du Tourisme et aux dispositions du Code Civil
    </p>
  </div>

  <div class="parties-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px;">
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; background: #f9f9f9;">
      <p style="font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #555; margin: 0 0 8px 0; letter-spacing: 0.5px;">Bailleur</p>
      <p style="margin: 0 0 4px 0;"><strong>${e.ownerPrenom} ${e.ownerNom}</strong></p>
      <p style="margin: 0 0 4px 0; white-space: pre-line;">${e.ownerAdresse}</p>
      ${e.ownerTel ? `<p style="margin: 0 0 4px 0;">Tél : ${e.ownerTel}</p>` : ''}
      ${e.ownerEmail ? `<p style="margin: 0 0 4px 0;">Email : ${e.ownerEmail}</p>` : ''}
      ${e.ownerSiret ? `<p style="margin: 0;">SIRET : ${e.ownerSiret}</p>` : ''}
    </div>
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; background: #f9f9f9;">
      <p style="font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #555; margin: 0 0 8px 0; letter-spacing: 0.5px;">Locataire</p>
      <p style="margin: 0 0 4px 0;"><strong>${e.tenantPrenom} ${e.tenantNom}</strong></p>
      ${e.tenantAdresse ? `<p style="margin: 0 0 4px 0; white-space: pre-line;">${e.tenantAdresse}</p>` : ''}
      ${e.tenantTel ? `<p style="margin: 0 0 4px 0;">Tél : ${e.tenantTel}</p>` : ''}
      ${e.tenantEmail ? `<p style="margin: 0 0 4px 0;">Email : ${e.tenantEmail}</p>` : ''}
      <p style="margin: 0;">Pays : ${e.tenantPays}</p>
    </div>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 1 – OBJET DU CONTRAT</h2>
  <p>Le présent contrat a pour objet la location meublée saisonnière d'un(e) <strong>${e.propertyType}</strong> situé(e) à l'adresse suivante : <strong>${e.propertyAdresse}</strong>${e.propertySurface ? `, d'une surface de <strong>${e.propertySurface} m²</strong>` : ''}${e.propertyRooms ? `, comprenant <strong>${e.propertyRooms} pièce(s)</strong>` : ''}. ${e.propertyMaxOccupants ? `La capacité maximale d'accueil est de <strong>${e.propertyMaxOccupants} personne(s)</strong>.` : ''}</p>
  ${e.propertyDescription ? `<p>${e.propertyDescription}</p>` : ''}
  ${e.propertyEquipements ? `<p><strong>Équipements inclus :</strong> ${e.propertyEquipements}</p>` : ''}
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 2 – DURÉE DE LA LOCATION</h2>
  <p>La location est consentie du <strong>${e.dateDebut}</strong> au <strong>${e.dateFin}</strong>, soit une durée de <strong>${nbNuits} nuit(s)</strong> pour <strong>${nbPersonnes} personne(s)</strong>. Ce contrat est conclu pour une durée déterminée et ne pourra en aucun cas être prorogé tacitement.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 3 – PRIX ET CONDITIONS DE PAIEMENT</h2>
  <p>Le prix de la présente location est fixé comme suit :</p>
  <table style="width: 100%; border-collapse: collapse; margin: 8px 0 12px 0;">
    <tr style="background: #f0f0f0;"><td style="padding: 6px 10px; border: 1px solid #ddd;">Loyer total</td><td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;"><strong>${formatCurrency(loyerTotal)}</strong></td></tr>
    ${forfaitMenage > 0 ? `<tr><td style="padding: 6px 10px; border: 1px solid #ddd;">Forfait ménage</td><td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(forfaitMenage)}</td></tr>` : ''}
    ${taxeSejour > 0 ? `<tr><td style="padding: 6px 10px; border: 1px solid #ddd;">Taxe de séjour (${tauxTaxe} €/pers/nuit × ${nbPersonnes} pers. × ${nbNuits} nuits)</td><td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(taxeSejour)}</td></tr>` : ''}
    <tr style="background: #e8f0e8;"><td style="padding: 6px 10px; border: 1px solid #ddd; font-weight: bold;">TOTAL</td><td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(totalGeneral)}</td></tr>
  </table>
  <p>${arrhesClause}</p>
  <p>Le solde sera versé au plus tard <strong>30 jours avant l'entrée dans les lieux</strong> par virement bancaire ou chèque à l'ordre du bailleur.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 4 – DÉSIGNATION DES PARTIES</h2>
  <p>Le bailleur, <strong>${e.ownerPrenom} ${e.ownerNom}</strong>, domicilié(e) au <strong>${e.ownerAdresse}</strong>, loue au locataire, <strong>${e.tenantPrenom} ${e.tenantNom}</strong>${e.tenantAdresse ? `, domicilié(e) au ${e.tenantAdresse}` : ''}, le bien immobilier décrit à l'article 1 du présent contrat.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 5 – REMISE DES CLÉS</h2>
  <p>Les clés seront remises au locataire à son arrivée contre signature d'un état des lieux d'entrée contradictoire. Le locataire s'engage à restituer les clés au bailleur au terme du contrat, à la date et heure de départ convenues.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 6 – OBLIGATIONS DU LOCATAIRE</h2>
  <p>Le locataire s'engage à :</p>
  <ul style="margin: 8px 0 8px 20px; padding: 0;">
    <li>Occuper le logement personnellement et en bon père de famille ;</li>
    <li>Ne pas sous-louer ni céder le bénéfice du présent contrat ;</li>
    <li>Ne pas dépasser la capacité maximale d'accueil de ${nbPersonnes > 0 ? `<strong>${nbPersonnes} personne(s)</strong>` : 'la capacité autorisée'} ;</li>
    <li>Respecter le voisinage et ne pas causer de nuisances sonores ;</li>
    <li>Ne pas modifier les lieux, ne pas introduire de meubles ou appareils sans accord du bailleur ;</li>
    <li>Signaler immédiatement tout dommage survenu dans le logement.</li>
  </ul>
  <p>${animauxClause}</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 7 – CHARGES ET PRESTATIONS INCLUSES</h2>
  <p>Les charges suivantes sont incluses dans le prix de la location : <strong>${e.propertyCharges}</strong>. Toute consommation excessive sera facturée en sus sur présentation de justificatifs.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 8 – ASSURANCES</h2>
  <p>Le locataire est tenu d'être assuré pour les risques locatifs (incendie, dégât des eaux, responsabilité civile) pendant toute la durée de la location. Il devra fournir une attestation d'assurance à la demande du bailleur. Le bailleur déclare que le logement est couvert par son assurance habitation.</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 9 – RÉSILIATION ET ANNULATION</h2>
  <p>En cas d'inexécution par le locataire de l'une des clauses du présent contrat, celui-ci sera résilié de plein droit sans mise en demeure préalable. Le bailleur pourra exiger le départ immédiat du locataire sans remboursement des sommes versées. Les conditions d'annulation sont définies à l'article 3 (${typeVersement}).</p>
  </div>

  <div class="contract-section">
  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">ARTICLE 10 – LITIGES</h2>
  <p>En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord amiable, tout litige relatif à l'exécution du présent contrat sera de la compétence exclusive des tribunaux du lieu de situation de l'immeuble loué.</p>
  </div>

  <div class="signature-section" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
    <p style="margin-bottom: 20px;">Fait en deux exemplaires originaux, à <strong>${data.owner_ville ? escapeHTML(data.owner_ville) : '________________'}</strong>, le <strong>${escapeHTML(formatDate(new Date().toISOString().slice(0, 10)))}</strong></p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px;">
      <div>
        <p style="font-weight: bold; margin-bottom: 8px;">Le Bailleur</p>
        <p style="margin-bottom: 4px;">${e.ownerPrenom} ${e.ownerNom}</p>
        <p style="font-family: 'Dancing Script', cursive; font-size: 18px; color: #1a3a6a; margin: 8px 0;">Lu et approuvé</p>
        ${data.owner_signature_base64
          ? `<img src="${data.owner_signature_base64}" style="max-width: 150px; max-height: 80px; margin-bottom: 8px;" alt="Signature" />`
          : '<div style="height: 40px;"></div>'}
        <div style="border-bottom: 1px solid #333; width: 210px;"></div>
      </div>
      <div>
        <p style="font-weight: bold; margin-bottom: 8px;">Le Locataire</p>
        <p style="margin-bottom: 4px;">${e.tenantPrenom} ${e.tenantNom}</p>
        <p style="color: #888; font-size: 9pt; margin-bottom: 40px;">Signature précédée de la mention « Lu et approuvé »</p>
        <div style="height: 60px; border-bottom: 1px solid #333;"></div>
      </div>
    </div>
  </div>
</div>
`.trim();
}

// ─── PDF texte via pdfmake ────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfMake = { createPdf: (def: any) => { getBlob: (cb: (b: Blob) => void) => void }; vfs?: Record<string, string>; fonts?: Record<string, Record<string, string>> };

/** Charge la police Dancing Script et l'enregistre dans le VFS de pdfmake. */
async function loadHandwritingFont(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = (window as any).pdfMake;
  if (!pdfMake) return;
  if (pdfMake.fonts?.DancingScript) return;

  try {
    const response = await fetch('/fonts/DancingScript-Regular.ttf');
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    pdfMake.vfs = pdfMake.vfs || {};
    pdfMake.vfs['DancingScript-Regular.ttf'] = base64;

    pdfMake.fonts = {
      ...pdfMake.fonts,
      Roboto: pdfMake.fonts?.Roboto ?? {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
      DancingScript: {
        normal: 'DancingScript-Regular.ttf',
        bold: 'DancingScript-Regular.ttf',
        italics: 'DancingScript-Regular.ttf',
        bolditalics: 'DancingScript-Regular.ttf',
      },
    };
  } catch (err) {
    console.warn('[contractGenerator] Impossible de charger la police Dancing Script:', err);
  }
}

function buildPdfMakeDoc(data: ContractData): object {
  const nbNuits = computeNights(data.date_debut, data.date_fin);
  const nbPersonnes = data.nb_personnes ?? 1;
  const loyerTotal = data.loyer_total ?? 0;
  const forfaitMenage = data.cleaning_fee ?? 0;
  const tauxTaxe = data.tourist_tax_rate ?? 0;
  const taxeSejour = tauxTaxe * nbPersonnes * nbNuits;
  const totalGeneral = loyerTotal + forfaitMenage + taxeSejour;
  const arrhes = Math.round(loyerTotal * 25) / 100;

  const ownerName = `${data.owner_prenom} ${data.owner_nom}`;
  const tenantName = `${data.tenant_prenom} ${data.tenant_nom}`;
  const propertyType = PROPERTY_TYPE_LABELS[data.property_type] ?? data.property_type;
  const charges = data.property_charges ?? 'eau, électricité, chauffage, wifi';
  const typeVersement = data.type_versement === 'ACOMPTE' ? 'acompte' : 'arrhes';
  const montantVersement = arrhes > 0 ? formatCurrency(arrhes) : 'à définir';

  const arrhesText = data.type_versement === 'ACOMPTE'
    ? `Un acompte de ${montantVersement} (25% du loyer) sera versé à la réservation. En cas d'annulation, les sommes versées restent acquises au bailleur et le locataire demeure redevable du solde.`
    : `Des arrhes de ${montantVersement} (25% du loyer) seront versées à la réservation. En cas d'annulation par le locataire, les arrhes restent acquises au bailleur. En cas d'annulation par le bailleur, celui-ci rembourse le double des arrhes reçues (art. L.214-1 Code de la Consommation).`;

  const animauxText = data.property_animaux_autorises
    ? `Les animaux de compagnie sont autorisés dans les conditions suivantes : ${data.property_animaux_types ?? 'selon accord'}, nombre maximum : ${data.property_animaux_nb_max ?? 1}, gabarit maximum : ${data.property_animaux_taille_max ?? 'non précisé'}.`
    : `Les animaux de compagnie ne sont pas autorisés dans le logement.`;

  // Tableau financier
  const tableRows: object[][] = [
    [{ text: 'Loyer total', fontSize: 10 }, { text: formatCurrency(loyerTotal), fontSize: 10, alignment: 'right', bold: true }],
  ];
  if (forfaitMenage > 0) {
    tableRows.push([{ text: 'Forfait ménage', fontSize: 10 }, { text: formatCurrency(forfaitMenage), fontSize: 10, alignment: 'right' }]);
  }
  if (taxeSejour > 0) {
    tableRows.push([
      { text: `Taxe de séjour (${tauxTaxe} €/pers/nuit × ${nbPersonnes} pers. × ${nbNuits} nuits)`, fontSize: 10 },
      { text: formatCurrency(taxeSejour), fontSize: 10, alignment: 'right' },
    ]);
  }
  tableRows.push([{ text: 'TOTAL', fontSize: 10, bold: true }, { text: formatCurrency(totalGeneral), fontSize: 10, alignment: 'right', bold: true }]);

  const art = (title: string) => ({ text: title, style: 'articleHeader', keepWithNext: true, headlineLevel: 1 });
  const p = (txt: object | string, margin?: number[]) => ({ text: txt, style: 'body', ...(margin ? { margin } : {}) });

  return {
    pageSize: 'A4',
    pageMargins: [57, 57, 57, 57], // ~20mm
    // Force un saut de page avant un titre d'article orphelin (seul en bas de page)
    pageBreakBefore: (currentNode: { headlineLevel?: number }, followingNodesOnPage: unknown[]) => {
      return currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0;
    },
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.55, color: '#1a1a1a' },
    styles: {
      titleMain: { fontSize: 15, bold: true, alignment: 'center', characterSpacing: 0.5, margin: [0, 0, 0, 6] },
      subtitle: { fontSize: 9.5, color: '#555555', alignment: 'center', margin: [0, 0, 0, 4] },
      articleHeader: { fontSize: 10.5, bold: true, margin: [0, 18, 0, 7] },
      partyLabel: { fontSize: 8.5, bold: true, color: '#666666', margin: [0, 0, 0, 5] },
      body: { fontSize: 10.5, lineHeight: 1.55 },
      signLabel: { fontSize: 10.5, bold: true, margin: [0, 0, 0, 4] },
      signNote: { fontSize: 8.5, color: '#888888', margin: [0, 2, 0, 36] },
    },
    content: [
      // ── Titre ──
      { text: 'CONTRAT DE LOCATION MEUBLÉE SAISONNIÈRE', style: 'titleMain' },
      { text: 'Conformément aux articles L.324-1-1 du Code du Tourisme et aux dispositions du Code Civil', style: 'subtitle' },
      { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 481, y2: 8, lineWidth: 1.5, lineColor: '#333333' }], margin: [0, 0, 0, 18] },

      // ── Parties ──
      {
        columns: [
          {
            width: '48%',
            stack: [
              { text: 'BAILLEUR', style: 'partyLabel' },
              { text: ownerName, bold: true, fontSize: 10 },
              { text: data.owner_adresse, fontSize: 10 },
              ...(data.owner_telephone ? [{ text: `Tél : ${data.owner_telephone}`, fontSize: 10 }] : []),
              ...(data.owner_email ? [{ text: `Email : ${data.owner_email}`, fontSize: 10 }] : []),
              ...(data.owner_siret ? [{ text: `SIRET : ${data.owner_siret}`, fontSize: 10 }] : []),
            ],
            margin: [10, 10, 10, 10],
          },
          {
            width: '48%',
            stack: [
              { text: 'LOCATAIRE', style: 'partyLabel' },
              { text: tenantName, bold: true, fontSize: 10 },
              ...(data.tenant_adresse ? [{ text: data.tenant_adresse, fontSize: 10 }] : []),
              ...(data.tenant_telephone ? [{ text: `Tél : ${data.tenant_telephone}`, fontSize: 10 }] : []),
              ...(data.tenant_email ? [{ text: `Email : ${data.tenant_email}`, fontSize: 10 }] : []),
              { text: `Pays : ${data.tenant_pays ?? 'France'}`, fontSize: 10 },
            ],
            margin: [10, 10, 10, 10],
          },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 18],
      },

      // ── Article 1 ──
      art('ARTICLE 1 – OBJET DU CONTRAT'),
      p([
        'Le présent contrat a pour objet la location meublée saisonnière d\'un(e) ',
        { text: propertyType, bold: true },
        ' situé(e) à l\'adresse suivante : ',
        { text: data.property_adresse, bold: true },
        ...(data.property_surface ? [', d\'une surface de ', { text: `${data.property_surface} m²`, bold: true }] : []),
        ...(data.property_rooms ? [', comprenant ', { text: `${data.property_rooms} pièce(s)`, bold: true }] : []),
        '.',
        ...(data.property_max_occupants ? [' La capacité maximale d\'accueil est de ', { text: `${data.property_max_occupants} personne(s)`, bold: true }, '.'] : []),
      ]),
      ...(data.property_description ? [p(data.property_description, [0, 4, 0, 0])] : []),
      ...(data.property_equipements ? [p([{ text: 'Équipements inclus : ', bold: true }, data.property_equipements], [0, 4, 0, 0])] : []),

      // ── Article 2 ──
      art('ARTICLE 2 – DURÉE DE LA LOCATION'),
      p([
        'La location est consentie du ',
        { text: formatDate(data.date_debut), bold: true },
        ' au ',
        { text: formatDate(data.date_fin), bold: true },
        ', soit une durée de ',
        { text: `${nbNuits} nuit(s)`, bold: true },
        ' pour ',
        { text: `${nbPersonnes} personne(s)`, bold: true },
        '. Ce contrat est conclu pour une durée déterminée et ne pourra en aucun cas être prorogé tacitement.',
      ]),

      // ── Article 3 ──
      art('ARTICLE 3 – PRIX ET CONDITIONS DE PAIEMENT'),
      p('Le prix de la présente location est fixé comme suit :', [0, 0, 0, 6]),
      {
        table: { widths: ['*', 'auto'], body: tableRows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10],
      },
      p(arrhesText, [0, 0, 0, 5]),
      p(['Le solde sera versé au plus tard ', { text: '30 jours avant l\'entrée dans les lieux', bold: true }, ' par virement bancaire ou chèque à l\'ordre du bailleur.']),

      // ── Article 4 ──
      art('ARTICLE 4 – DÉSIGNATION DES PARTIES'),
      p([
        'Le bailleur, ', { text: ownerName, bold: true }, ', domicilié(e) au ', { text: data.owner_adresse, bold: true },
        ', loue au locataire, ', { text: tenantName, bold: true },
        ...(data.tenant_adresse ? [`, domicilié(e) au ${data.tenant_adresse}`] : []),
        ', le bien immobilier décrit à l\'article 1 du présent contrat.',
      ]),

      // ── Article 5 ──
      art('ARTICLE 5 – REMISE DES CLÉS'),
      p('Les clés seront remises au locataire à son arrivée contre signature d\'un état des lieux d\'entrée contradictoire. Le locataire s\'engage à restituer les clés au bailleur au terme du contrat, à la date et heure de départ convenues.'),

      // ── Article 6 ──
      art('ARTICLE 6 – OBLIGATIONS DU LOCATAIRE'),
      p('Le locataire s\'engage à :', [0, 0, 0, 4]),
      {
        ul: [
          'Occuper le logement personnellement et en bon père de famille ;',
          'Ne pas sous-louer ni céder le bénéfice du présent contrat ;',
          { text: ['Ne pas dépasser la capacité maximale d\'accueil de ', { text: `${nbPersonnes} personne(s)`, bold: true }, ' ;'] },
          'Respecter le voisinage et ne pas causer de nuisances sonores ;',
          'Ne pas modifier les lieux, ne pas introduire de meubles ou appareils sans accord du bailleur ;',
          'Signaler immédiatement tout dommage survenu dans le logement.',
        ],
        style: 'body',
        margin: [10, 0, 0, 8],
      },
      p(animauxText),

      // ── Article 7 ──
      art('ARTICLE 7 – CHARGES ET PRESTATIONS INCLUSES'),
      p(['Les charges suivantes sont incluses dans le prix de la location : ', { text: charges, bold: true }, '. Toute consommation excessive sera facturée en sus sur présentation de justificatifs.']),

      // ── Article 8 ──
      art('ARTICLE 8 – ASSURANCES'),
      p('Le locataire est tenu d\'être assuré pour les risques locatifs (incendie, dégât des eaux, responsabilité civile) pendant toute la durée de la location. Il devra fournir une attestation d\'assurance à la demande du bailleur. Le bailleur déclare que le logement est couvert par son assurance habitation.'),

      // ── Article 9 ──
      art('ARTICLE 9 – RÉSILIATION ET ANNULATION'),
      p(['En cas d\'inexécution par le locataire de l\'une des clauses du présent contrat, celui-ci sera résilié de plein droit sans mise en demeure préalable. Le bailleur pourra exiger le départ immédiat du locataire sans remboursement des sommes versées. Les conditions d\'annulation sont définies à l\'article 3 (', typeVersement, ').']),

      // ── Article 10 ──
      art('ARTICLE 10 – LITIGES'),
      p('En cas de litige, les parties s\'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d\'accord amiable, tout litige relatif à l\'exécution du présent contrat sera de la compétence exclusive des tribunaux du lieu de situation de l\'immeuble loué.'),

      // ── Signatures ──
      {
        text: [
          'Fait en deux exemplaires originaux, à ',
          { text: data.owner_ville || '________________', bold: !!data.owner_ville },
          ', le ',
          { text: formatDate(new Date().toISOString().slice(0, 10)), bold: true },
        ],
        style: 'body',
        margin: [0, 28, 0, 18],
      },
      {
        columns: [
          {
            width: '48%',
            stack: [
              { text: 'Le Bailleur', style: 'signLabel' },
              { text: ownerName, fontSize: 10.5, margin: [0, 0, 0, 4] },
              { text: 'Lu et approuvé', font: 'DancingScript', fontSize: 14, color: '#1a3a6a', margin: [0, 8, 0, 4] },
              ...(data.owner_signature_base64
                ? [{ image: data.owner_signature_base64, fit: [150, 80] as [number, number], margin: [0, 4, 0, 4] as [number, number, number, number] }]
                : [{ text: '', margin: [0, 36, 0, 0] as [number, number, number, number] }]
              ),
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#333333' }] },
            ],
          },
          {
            width: '48%',
            stack: [
              { text: 'Le Locataire', style: 'signLabel' },
              { text: tenantName, fontSize: 10.5, margin: [0, 0, 0, 4] },
              { text: 'Signature précédée de la mention « Lu et approuvé »', style: 'signNote' },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#333333' }] },
            ],
          },
        ],
        columnGap: 20,
      },
    ],
  };
}

// Génère un Blob PDF texte à partir des données du contrat via pdfmake.
export async function generateContractPDF(data: ContractData, _fileName: string): Promise<Blob> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js');

  const pdfMake = (window as Window & { pdfMake?: PdfMake }).pdfMake;
  if (!pdfMake) throw new Error('pdfMake non chargé.');

  await loadHandwritingFont();

  const docDef = buildPdfMakeDoc(data);

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob((blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Le PDF généré est vide. Veuillez réessayer.'));
          return;
        }
        resolve(blob);
      });
    } catch (err) {
      reject(err);
    }
  });
}
