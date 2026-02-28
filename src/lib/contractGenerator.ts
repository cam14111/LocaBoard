// Générateur de contrat LMNP — adapté du fichier Générateur de contrat.html
// Toutes les données utilisateur sont échappées via escapeHTML() pour prévenir les injections XSS.

export interface ContractData {
  // Bailleur
  owner_prenom: string;
  owner_nom: string;
  owner_adresse: string;
  owner_telephone?: string;
  owner_email?: string;
  owner_siret?: string;
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

export function generateContract(data: ContractData): string {
  const nbNuits = computeNights(data.date_debut, data.date_fin);
  const nbPersonnes = data.nb_personnes ?? 1;
  const loyerTotal = data.loyer_total ?? 0;
  const forfaitMenage = data.cleaning_fee ?? 0;
  const tauxTaxe = data.tourist_tax_rate ?? 0;
  const taxeSejour = tauxTaxe * nbPersonnes * nbNuits;
  const totalGeneral = loyerTotal + forfaitMenage + taxeSejour;
  const arrhes = Math.round(loyerTotal * 25) / 100;

  // Données échappées
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
    dateDebutRaw: escapeHTML(data.date_debut),
    dateFinRaw: escapeHTML(data.date_fin),
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

  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #333;">
    <h1 style="font-size: 16pt; font-weight: bold; margin: 0 0 6px 0; letter-spacing: 1px; text-transform: uppercase;">
      CONTRAT DE LOCATION MEUBLÉE SAISONNIÈRE
    </h1>
    <p style="font-size: 10pt; color: #555; margin: 0;">
      Conformément aux articles L.324-1-1 du Code du Tourisme et aux dispositions du Code Civil
    </p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px;">
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

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 1 – OBJET DU CONTRAT
  </h2>
  <p>
    Le présent contrat a pour objet la location meublée saisonnière d'un(e) <strong>${e.propertyType}</strong> situé(e)
    à l'adresse suivante : <strong>${e.propertyAdresse}</strong>${e.propertySurface ? `, d'une surface de <strong>${e.propertySurface} m²</strong>` : ''}${e.propertyRooms ? `, comprenant <strong>${e.propertyRooms} pièce(s)</strong>` : ''}.
    ${e.propertyMaxOccupants ? `La capacité maximale d'accueil est de <strong>${e.propertyMaxOccupants} personne(s)</strong>.` : ''}
  </p>
  ${e.propertyDescription ? `<p>${e.propertyDescription}</p>` : ''}
  ${e.propertyEquipements ? `<p><strong>Équipements inclus :</strong> ${e.propertyEquipements}</p>` : ''}

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 2 – DURÉE DE LA LOCATION
  </h2>
  <p>
    La location est consentie du <strong>${e.dateDebut}</strong> au <strong>${e.dateFin}</strong>,
    soit une durée de <strong>${nbNuits} nuit(s)</strong> pour <strong>${nbPersonnes} personne(s)</strong>.
    Ce contrat est conclu pour une durée déterminée et ne pourra en aucun cas être prorogé tacitement.
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 3 – PRIX ET CONDITIONS DE PAIEMENT
  </h2>
  <p>Le prix de la présente location est fixé comme suit :</p>
  <table style="width: 100%; border-collapse: collapse; margin: 8px 0 12px 0;">
    <tr style="background: #f0f0f0;">
      <td style="padding: 6px 10px; border: 1px solid #ddd;">Loyer total</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;"><strong>${formatCurrency(loyerTotal)}</strong></td>
    </tr>
    ${forfaitMenage > 0 ? `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">Forfait ménage</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(forfaitMenage)}</td>
    </tr>` : ''}
    ${taxeSejour > 0 ? `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">Taxe de séjour (${tauxTaxe} €/pers/nuit × ${nbPersonnes} pers. × ${nbNuits} nuits)</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(taxeSejour)}</td>
    </tr>` : ''}
    <tr style="background: #e8f0e8;">
      <td style="padding: 6px 10px; border: 1px solid #ddd; font-weight: bold;">TOTAL</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(totalGeneral)}</td>
    </tr>
  </table>
  <p>${arrhesClause}</p>
  <p>Le solde sera versé au plus tard <strong>30 jours avant l'entrée dans les lieux</strong> par virement bancaire ou chèque à l'ordre du bailleur.</p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 4 – DÉSIGNATION DES PARTIES
  </h2>
  <p>
    Le bailleur, <strong>${e.ownerPrenom} ${e.ownerNom}</strong>, domicilié(e) au <strong>${e.ownerAdresse}</strong>,
    loue au locataire, <strong>${e.tenantPrenom} ${e.tenantNom}</strong>${e.tenantAdresse ? `, domicilié(e) au ${e.tenantAdresse}` : ''},
    le bien immobilier décrit à l'article 1 du présent contrat.
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 5 – REMISE DES CLÉS
  </h2>
  <p>
    Les clés seront remises au locataire à son arrivée contre signature d'un état des lieux d'entrée contradictoire.
    Le locataire s'engage à restituer les clés au bailleur au terme du contrat, à la date et heure de départ convenues.
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 6 – OBLIGATIONS DU LOCATAIRE
  </h2>
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

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 7 – CHARGES ET PRESTATIONS INCLUSES
  </h2>
  <p>
    Les charges suivantes sont incluses dans le prix de la location :
    <strong>${e.propertyCharges}</strong>.
    Toute consommation excessive sera facturée en sus sur présentation de justificatifs.
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 8 – ASSURANCES
  </h2>
  <p>
    Le locataire est tenu d'être assuré pour les risques locatifs (incendie, dégât des eaux, responsabilité civile)
    pendant toute la durée de la location. Il devra fournir une attestation d'assurance à la demande du bailleur.
    Le bailleur déclare que le logement est couvert par son assurance habitation.
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 9 – RÉSILIATION ET ANNULATION
  </h2>
  <p>
    En cas d'inexécution par le locataire de l'une des clauses du présent contrat, celui-ci sera résilié de plein droit
    sans mise en demeure préalable. Le bailleur pourra exiger le départ immédiat du locataire sans remboursement des
    sommes versées. Les conditions d'annulation sont définies à l'article 3 (${typeVersement}).
  </p>

  <h2 style="font-size: 11pt; font-weight: bold; border-left: 3px solid #333; padding-left: 10px; margin: 24px 0 10px 0;">
    ARTICLE 10 – LITIGES
  </h2>
  <p>
    En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire.
    À défaut d'accord amiable, tout litige relatif à l'exécution du présent contrat sera de la compétence exclusive
    des tribunaux du lieu de situation de l'immeuble loué.
  </p>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
    <p style="margin-bottom: 20px;">
      Fait en deux exemplaires originaux, à ________________, le ________________
    </p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px;">
      <div>
        <p style="font-weight: bold; margin-bottom: 8px;">Le Bailleur</p>
        <p style="margin-bottom: 4px;">${e.ownerPrenom} ${e.ownerNom}</p>
        <p style="color: #888; font-size: 9pt; margin-bottom: 40px;">Signature précédée de la mention « Lu et approuvé »</p>
        <div style="height: 60px; border-bottom: 1px solid #333;"></div>
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

type Html2CanvasFn = (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>;
type JsPDFCtor = new (opts: { orientation: string; unit: string; format: string }) => {
  addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  addPage: () => void;
  output: (type: string) => unknown;
};

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

// Génère un Blob PDF à partir du HTML du contrat.
// Charge html2canvas + jsPDF via CDN au moment de l'appel (lazy, pas d'import statique).
export async function generateContractPDF(htmlContent: string, _fileName: string): Promise<Blob> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

  const w = window as Window & {
    html2canvas?: Html2CanvasFn;
    jspdf?: { jsPDF?: JsPDFCtor };
    jsPDF?: JsPDFCtor;
  };
  const html2canvas = w.html2canvas;
  const JsPDF = w.jspdf?.jsPDF ?? w.jsPDF;

  if (!html2canvas || !JsPDF) throw new Error('Impossible de charger les librairies PDF (html2canvas / jsPDF).');

  // Rendre le contrat dans un iframe isolé pour éviter l'héritage des styles oklch de Tailwind
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:1px;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  try {
    // Construire un document HTML complet et isolé (aucun CSS de l'app)
    const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{background:#fff;margin:0;padding:0}</style></head><body>${htmlContent}</body></html>`;
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = srcdoc;
    });

    const iframeBody = iframe.contentDocument!.body;
    // Ajuster la hauteur de l'iframe pour capturer tout le contenu
    iframe.style.height = iframeBody.scrollHeight + 'px';

    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;

    const canvas = await html2canvas(iframeBody, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800,
    });

    // Collecte des positions des éléments bloc pour des sauts de page cohérents
    const iframeDoc = iframe.contentDocument!;
    const bodyRect = iframeBody.getBoundingClientRect();
    const canvasScale = 2; // doit correspondre au scale passé à html2canvas
    const pageHeightPx = Math.round((pageHeight * canvas.width) / pageWidth);
    const mmPerPx = pageWidth / canvas.width;

    const breakSet = new Set<number>([0, canvas.height]);
    iframeDoc
      .querySelectorAll('h1, h2, h3, p, li, .contract-section, .parties-section, .date-location, .signature-section')
      .forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const topPx = Math.round((rect.top - bodyRect.top) * canvasScale);
        const bottomPx = Math.round((rect.bottom - bodyRect.top) * canvasScale);
        if (topPx > 0) breakSet.add(topPx);
        if (bottomPx > 0 && bottomPx < canvas.height) breakSet.add(bottomPx);
      });
    const breakPoints = Array.from(breakSet).sort((a, b) => a - b);

    let srcY = 0;
    let firstPage = true;

    while (srcY < canvas.height) {
      const targetEndY = srcY + pageHeightPx;
      let endY = targetEndY >= canvas.height ? canvas.height : targetEndY;

      if (targetEndY < canvas.height) {
        // Cherche le dernier point de rupture ≤ targetEndY et > srcY pour éviter les coupures dans le contenu
        for (const bp of breakPoints) {
          if (bp > srcY && bp <= targetEndY) endY = bp;
        }
      }

      const sliceHeightPx = endY - srcY;
      if (sliceHeightPx <= 0) break;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      sliceCanvas.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      if (!firstPage) pdf.addPage();
      pdf.addImage(sliceData, 'JPEG', 0, 0, pageWidth, sliceHeightPx * mmPerPx);

      srcY = endY;
      firstPage = false;
    }

    return pdf.output('blob') as Blob;
  } finally {
    document.body.removeChild(iframe);
  }
}
