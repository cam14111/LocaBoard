// ─── Types ────────────────────────────────────────────────────

export interface HelpEntry {
  /** Texte court affiché dans le popover (2-4 lignes max) */
  short: string;
  /** Texte étendu pour le manuel (optionnel) */
  long?: string;
  /** ID ancre dans la page Manuel pour le lien "En savoir plus" */
  doc?: string;
}

export interface ManualSection {
  id: string;
  title: string;
  /** Contenu HTML simple (bold, liens, listes) — rédigé par les devs, pas par les users */
  content: string;
  /** Sous-sections pour le sommaire imbriqué */
  children?: ManualSection[];
}

// ─── Contenus d'aide contextuels ──────────────────────────────

export const helpContent: Record<string, HelpEntry> = {
  // ── Logement : Règles ──
  buffer_heures: {
    short: 'Temps minimum entre le départ d\'un locataire et l\'arrivée du suivant. Permet de planifier le ménage et la préparation du logement.',
    long: 'Le tampon ménage définit la durée minimale entre un check-out et le check-in suivant. Si vous avez besoin de 3 heures pour nettoyer et préparer le logement, indiquez 3. Le calendrier bloquera automatiquement les réservations qui ne respectent pas ce délai.',
    doc: 'logements-regles',
  },
  taux_taxe_sejour: {
    short: 'Montant de la taxe de séjour par personne et par nuit, fixé par votre commune. Consultez votre mairie pour connaître le taux applicable.',
    long: 'La taxe de séjour est collectée par le propriétaire auprès du locataire, puis reversée à la commune. Le montant varie selon la commune et le classement du logement (de 0,20 € à 4,20 € par personne et par nuit). Elle est calculée automatiquement dans l\'échéancier de paiement en fonction du nombre de personnes et de la durée du séjour.',
    doc: 'paiements-taxe-sejour',
  },
  duree_expiration_option_jours: {
    short: 'Nombre de jours avant qu\'une option non confirmée expire automatiquement et libère les dates sur le calendrier.',
    long: 'Lorsqu\'un locataire potentiel réserve en « option », les dates sont bloquées provisoirement. Si l\'option n\'est pas confirmée (passage en réservation ferme) dans le délai défini ici, elle expire automatiquement et les dates redeviennent disponibles. Par défaut : 3 jours.',
    doc: 'reservations-options',
  },
  taches_auto_enabled: {
    short: 'Crée automatiquement des tâches de ménage, check-in et check-out pour chaque nouvelle réservation confirmée.',
    long: 'Lorsque cette option est activée, la confirmation d\'une réservation génère automatiquement trois tâches : une tâche de ménage (planifiée entre les deux séjours), une tâche de check-in (jour d\'arrivée) et une tâche de check-out (jour de départ). Ces tâches sont assignables à vos concierges ou co-hôtes.',
    doc: 'taches-automatiques',
  },
  heure_checkin: {
    short: 'Heure à partir de laquelle le locataire peut accéder au logement le jour d\'arrivée.',
    doc: 'logements-regles',
  },
  heure_checkout: {
    short: 'Heure limite à laquelle le locataire doit quitter le logement le jour de départ.',
    doc: 'logements-regles',
  },

  // ── Logement : Charges & Description ──
  charges_incluses: {
    short: 'Charges comprises dans le loyer (eau, électricité, wifi…). Mentionnées dans le contrat de location.',
    long: 'Listez ici toutes les charges incluses dans le prix de la nuitée. Ces informations apparaissent dans le contrat de location généré. Exemples : eau, électricité, chauffage, wifi, linge de maison, produits d\'entretien.',
    doc: 'logements-charges',
  },
  description: {
    short: 'Description libre du logement visible dans les documents générés (contrat, fiche).',
    doc: 'logements-general',
  },
  equipements: {
    short: 'Liste des équipements disponibles dans le logement (cuisine équipée, lave-linge, parking…).',
    doc: 'logements-general',
  },

  // ── Logement : Animaux ──
  animaux_autorises: {
    short: 'Autorise ou interdit les animaux de compagnie. Si activé, vous pouvez préciser les types, nombre et gabarit maximum acceptés.',
    long: 'Cette option permet d\'indiquer clairement si les animaux sont acceptés dans votre logement. Si vous l\'activez, précisez les types d\'animaux (chiens, chats…), le nombre maximum et le gabarit. Ces informations figurent dans le contrat.',
    doc: 'logements-animaux',
  },
  animaux_types: {
    short: 'Types d\'animaux acceptés (ex : chiens, chats). Texte libre.',
    doc: 'logements-animaux',
  },
  animaux_taille_max: {
    short: 'Gabarit maximum des animaux acceptés. Informatif, mentionné dans le contrat.',
    doc: 'logements-animaux',
  },

  // ── Tarification ──
  forfait_menage: {
    short: 'Montant facturé au locataire pour le nettoyage du logement. Apparaît comme ligne séparée sur le contrat et l\'échéancier de paiements.',
    long: 'Le forfait ménage est un montant fixe facturé en sus du loyer. Il couvre le nettoyage complet du logement après le départ du locataire. Il est affiché séparément dans le contrat et dans l\'échéancier de paiement.',
    doc: 'paiements-menage',
  },
  tarification_saisonniere: {
    short: 'Définissez des tarifs différents selon la saison. La haute saison couvre automatiquement les périodes non attribuées aux deux autres saisons.',
    long: 'La tarification saisonnière permet de définir trois niveaux de prix : basse saison, haute saison et très haute saison. Vous configurez les dates de basse et très haute saison ; la haute saison couvre automatiquement le reste de l\'année. Chaque saison peut avoir un tarif nuit et un tarif semaine distincts.',
    doc: 'tarifs-saisons',
  },
  loyer_nuit_defaut: {
    short: 'Tarif de base par nuit, utilisé quand aucune tarification saisonnière n\'est définie ou pour les périodes non couvertes.',
    doc: 'tarifs-defaut',
  },
  loyer_semaine_defaut: {
    short: 'Tarif préférentiel pour les séjours d\'une semaine complète. Si renseigné, appliqué automatiquement au lieu du tarif nuit × 7.',
    doc: 'tarifs-defaut',
  },

  // ── Pièces EDL ──
  pieces_edl: {
    short: 'Liste des pièces utilisées lors de l\'état des lieux (EDL). Chaque pièce sera inspectée individuellement.',
    long: 'Les pièces EDL définissent la structure de l\'état des lieux. Ajustez le nombre de chambres et salles de bain pour générer automatiquement la liste, puis personnalisez les noms ou ajoutez des pièces supplémentaires (terrasse, buanderie…). L\'ordre est modifiable par glisser-déposer.',
    doc: 'edl',
  },

  // ── Réservations ──
  arrhes_vs_acompte: {
    short: 'Arrhes : chaque partie peut se désister (le locataire perd les arrhes, le bailleur rembourse le double). Acompte : engagement ferme, le solde est dû.',
    long: 'En droit français, les arrhes permettent à chaque partie de se désister : si le locataire annule, il perd le montant versé ; si le bailleur annule, il doit rembourser le double. Un acompte, en revanche, constitue un engagement ferme : le solde total reste dû même en cas d\'annulation par le locataire.',
    doc: 'paiements-versement',
  },

  // ── Accès logement ──
  acces_logement: {
    short: 'Sélectionnez les co-hôtes et concierges autorisés à accéder à ce logement. L\'administrateur a toujours accès.',
    doc: 'utilisateurs-permissions',
  },

  // ── Dashboard ──
  taches_a_faire: {
    short: 'Tâches en attente assignées à vous ou non assignées : ménage, check-in, check-out, maintenance.',
    doc: 'taches-automatiques',
  },
  paiements_en_attente: {
    short: 'Paiements dont la date d\'échéance approche ou est dépassée. « En retard » = date d\'échéance dépassée.',
    doc: 'paiements',
  },
  options_expirant: {
    short: 'Options (réservations provisoires) qui expirent bientôt. Si non confirmées, les dates seront libérées automatiquement.',
    doc: 'reservations-options',
  },
  anomalies_edl: {
    short: 'Anomalies détectées lors d\'un état des lieux : dégâts, éléments manquants, problèmes de propreté.',
    doc: 'edl',
  },
  incidents_edl: {
    short: 'Problèmes EDL nécessitant un suivi (réparation, remplacement). Classés par sévérité : mineur ou majeur.',
    doc: 'edl',
  },

  // ── Dossiers (filtres) ──
  dossiers_en_cours: {
    short: 'Dossiers actifs : de la demande initiale jusqu\'au check-out. Inclut les options, réservations confirmées et séjours en cours.',
    doc: 'reservations-pipeline',
  },
  dossiers_clotures: {
    short: 'Dossiers terminés : le séjour est fini, l\'EDL de sortie est réalisé et tous les paiements sont soldés.',
    doc: 'reservations-pipeline',
  },
  dossiers_annules: {
    short: 'Dossiers annulés : la réservation a été annulée avant ou pendant le séjour.',
    doc: 'reservations-pipeline',
  },

  // ── Paiements ──
  paiement_statut_du: {
    short: 'Le paiement est attendu mais sa date d\'échéance n\'est pas encore dépassée.',
    doc: 'paiements',
  },
  paiement_statut_en_retard: {
    short: 'La date d\'échéance est dépassée et le paiement n\'a pas été reçu.',
    doc: 'paiements',
  },
  paiement_types: {
    short: 'Types de paiement : Arrhes (désistement possible), Acompte (engagement ferme), Solde, Taxe de séjour, Extra (frais supplémentaires).',
    doc: 'paiements-versement',
  },

  // ── Pipeline ──
  pipeline: {
    short: 'Le pipeline suit chaque dossier étape par étape : demande → option → contrat → paiements → check-in → EDL → check-out → clôture.',
    doc: 'reservations-pipeline',
  },

  // ── EDL (État des lieux) ──
  edl_entree: {
    short: 'État des lieux d\'entrée : documente l\'état du logement à l\'arrivée du locataire. Sert de référence pour la sortie.',
    doc: 'edl',
  },
  edl_sortie: {
    short: 'État des lieux de sortie : compare l\'état du logement au départ avec l\'état d\'entrée pour identifier les dégradations.',
    doc: 'edl',
  },
};

// ─── Sections du manuel utilisateur ───────────────────────────

export const manualSections: ManualSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    content: `
      <p><strong>LocaBoard</strong> est votre tableau de bord de gestion locative saisonnière. Il centralise la gestion de vos logements, réservations, paiements, états des lieux et tâches en un seul outil.</p>
      <p>Ce manuel vous guide à travers chaque fonctionnalité pour tirer le meilleur parti de l'application.</p>
    `,
  },
  {
    id: 'logements',
    title: 'Logements',
    content: `
      <p>La section <strong>Logements</strong> (accessible via Paramètres) permet de configurer chacun de vos biens locatifs.</p>
      <p>Chaque logement comporte quatre onglets : Général, Pièces EDL, Tarifs et Accès.</p>
    `,
    children: [
      {
        id: 'logements-general',
        title: 'Informations générales',
        content: `
          <p>Renseignez le nom, l'adresse (avec autocomplétion), le type de bien, la surface et la capacité d'accueil.</p>
          <p>La <strong>description</strong> et les <strong>équipements</strong> apparaissent dans les documents générés (contrats, fiches).</p>
        `,
      },
      {
        id: 'logements-regles',
        title: 'Règles du logement',
        content: `
          <p>Définissez les heures de <strong>check-in</strong> et <strong>check-out</strong>, ainsi que le <strong>tampon ménage</strong> (durée minimale entre deux séjours pour le nettoyage).</p>
          <p>La <strong>taxe de séjour</strong> est fixée par votre commune — renseignez le montant par personne et par nuit.</p>
          <p>L'<strong>expiration des options</strong> définit le délai avant qu'une option non confirmée libère automatiquement les dates.</p>
          <p>Les <strong>tâches automatiques</strong>, si activées, créent des tâches de ménage, check-in et check-out à chaque réservation confirmée.</p>
        `,
      },
      {
        id: 'logements-charges',
        title: 'Charges incluses',
        content: `
          <p>Listez les charges comprises dans le loyer : eau, électricité, chauffage, wifi, linge de maison, etc.</p>
          <p>Ces informations figurent dans le contrat de location généré automatiquement.</p>
        `,
      },
      {
        id: 'logements-animaux',
        title: 'Animaux',
        content: `
          <p>Indiquez si les animaux de compagnie sont acceptés dans votre logement.</p>
          <p>Si oui, précisez les <strong>types acceptés</strong> (chiens, chats…), le <strong>nombre maximum</strong> et le <strong>gabarit maximum</strong> (petit, moyen, grand).</p>
          <p>Ces conditions sont mentionnées dans le contrat de location.</p>
        `,
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Réservations & Pipeline',
    content: `
      <p>Le système de réservation suit un <strong>pipeline</strong> avec plusieurs états : option, confirmée, en cours, terminée, annulée.</p>
      <p>Le calendrier affiche visuellement l'occupation de chaque logement avec un code couleur par statut.</p>
    `,
    children: [
      {
        id: 'reservations-options',
        title: 'Options',
        content: `
          <p>Une <strong>option</strong> est une réservation provisoire. Les dates sont bloquées mais pas confirmées.</p>
          <p>Si le locataire ne confirme pas dans le délai défini (par défaut 3 jours), l'option <strong>expire automatiquement</strong> et les dates redeviennent disponibles.</p>
          <p>Vous pouvez configurer la durée d'expiration dans les paramètres de chaque logement.</p>
        `,
      },
      {
        id: 'reservations-pipeline',
        title: 'Pipeline de réservation',
        content: `
          <p>Chaque dossier de location passe par plusieurs étapes :</p>
          <ul>
            <li><strong>Option</strong> — Réservation provisoire, en attente de confirmation</li>
            <li><strong>Confirmée</strong> — Réservation ferme, contrat signé</li>
            <li><strong>En cours</strong> — Séjour en cours</li>
            <li><strong>Terminée</strong> — Séjour terminé, en attente de clôture</li>
            <li><strong>Annulée</strong> — Réservation annulée</li>
          </ul>
          <p>Le pipeline est visible dans l'onglet « Pipeline » de chaque dossier.</p>
        `,
      },
    ],
  },
  {
    id: 'paiements',
    title: 'Paiements',
    content: `
      <p>La gestion des paiements permet de suivre l'échéancier de chaque réservation : acomptes, solde, forfait ménage et taxe de séjour.</p>
    `,
    children: [
      {
        id: 'paiements-taxe-sejour',
        title: 'Taxe de séjour',
        content: `
          <p>La <strong>taxe de séjour</strong> est collectée par le propriétaire auprès du locataire, puis reversée à la commune.</p>
          <p>Le montant varie selon la commune et le classement du logement (de 0,20 € à 4,20 € par personne et par nuit).</p>
          <p>Elle est calculée automatiquement dans l'échéancier en fonction du nombre de personnes et de la durée du séjour.</p>
          <p>Renseignez le taux applicable dans les paramètres du logement (onglet Général, section Règles).</p>
        `,
      },
      {
        id: 'paiements-menage',
        title: 'Forfait ménage',
        content: `
          <p>Le <strong>forfait ménage</strong> est un montant fixe facturé au locataire pour le nettoyage après son départ.</p>
          <p>Il apparaît comme ligne séparée dans le contrat et dans l'échéancier de paiement.</p>
          <p>Configurez le montant dans l'onglet Tarifs du logement.</p>
        `,
      },
      {
        id: 'paiements-versement',
        title: 'Arrhes vs Acompte',
        content: `
          <p>En droit français, il existe deux types de versements :</p>
          <ul>
            <li><strong>Arrhes</strong> — Chaque partie peut se désister : le locataire perd les arrhes, le bailleur rembourse le double.</li>
            <li><strong>Acompte</strong> — Engagement ferme : le solde total reste dû même en cas d'annulation par le locataire.</li>
          </ul>
          <p>Choisissez le type de versement lors de la création de la réservation.</p>
        `,
      },
    ],
  },
  {
    id: 'tarifs',
    title: 'Tarification',
    content: `
      <p>Configurez vos tarifs dans l'onglet <strong>Tarifs</strong> de chaque logement.</p>
    `,
    children: [
      {
        id: 'tarifs-defaut',
        title: 'Tarifs par défaut',
        content: `
          <p>Le <strong>loyer par nuit</strong> est le tarif de base appliqué à chaque nuitée.</p>
          <p>Le <strong>loyer par semaine</strong> (optionnel) est un tarif préférentiel pour les séjours de 7 nuits ou plus. S'il est renseigné, il remplace automatiquement le calcul nuit × 7.</p>
        `,
      },
      {
        id: 'tarifs-saisons',
        title: 'Tarification saisonnière',
        content: `
          <p>La tarification saisonnière permet de définir <strong>trois niveaux de prix</strong> :</p>
          <ul>
            <li><strong>Basse saison</strong> — Vous définissez les dates et les tarifs</li>
            <li><strong>Très haute saison</strong> — Vous définissez les dates et les tarifs</li>
            <li><strong>Haute saison</strong> — Couvre automatiquement toutes les périodes non attribuées</li>
          </ul>
          <p>Chaque saison peut avoir un tarif nuit et un tarif semaine distincts.</p>
        `,
      },
    ],
  },
  {
    id: 'taches-automatiques',
    title: 'Tâches',
    content: `
      <p>Les <strong>tâches automatiques</strong>, si activées dans les paramètres du logement, créent trois tâches à chaque réservation confirmée :</p>
      <ul>
        <li><strong>Ménage</strong> — Planifié entre deux séjours</li>
        <li><strong>Check-in</strong> — Jour d'arrivée du locataire</li>
        <li><strong>Check-out</strong> — Jour de départ du locataire</li>
      </ul>
      <p>Ces tâches sont assignables à vos concierges ou co-hôtes depuis la page Tâches.</p>
      <p>Vous pouvez également créer des tâches manuelles à tout moment.</p>
    `,
  },
  {
    id: 'edl',
    title: 'États des lieux',
    content: `
      <p>L'<strong>état des lieux</strong> (EDL) permet de documenter l'état du logement à l'entrée et à la sortie du locataire.</p>
      <p>Chaque EDL est structuré par <strong>pièces</strong> (configurées dans l'onglet Pièces EDL du logement). Pour chaque pièce, vous inspectez les éléments et pouvez signaler des anomalies avec photos.</p>
      <p>Les anomalies génèrent automatiquement des <strong>incidents</strong> à traiter.</p>
      <p>L'EDL dispose d'une vue mobile optimisée pour la réalisation sur le terrain.</p>
    `,
  },
  {
    id: 'utilisateurs-permissions',
    title: 'Utilisateurs & Permissions',
    content: `
      <p>LocaBoard gère trois rôles :</p>
      <ul>
        <li><strong>Administrateur</strong> — Accès complet à tous les logements et paramètres</li>
        <li><strong>Co-hôte</strong> — Accès aux logements assignés, peut gérer les réservations et paiements</li>
        <li><strong>Concierge</strong> — Accès aux logements assignés, focalisé sur les tâches et EDL</li>
      </ul>
      <p>L'accès par logement se configure dans l'onglet <strong>Accès</strong> de chaque logement.</p>
    `,
  },
  {
    id: 'faq',
    title: 'FAQ',
    content: `
      <dl>
        <dt><strong>Comment modifier les dates d'une réservation ?</strong></dt>
        <dd>Ouvrez le dossier de la réservation, puis modifiez les dates dans l'onglet Résumé. Le calendrier se met à jour automatiquement.</dd>

        <dt><strong>Puis-je avoir plusieurs logements ?</strong></dt>
        <dd>Oui, ajoutez autant de logements que nécessaire dans Paramètres → Logements. Utilisez le sélecteur en haut de page pour naviguer entre eux.</dd>

        <dt><strong>Comment fonctionne la taxe de séjour ?</strong></dt>
        <dd>Le taux est défini par logement (Paramètres → Logement → Règles). Le montant total est calculé automatiquement : taux × nombre de personnes × nombre de nuits.</dd>

        <dt><strong>Comment inviter un co-hôte ou concierge ?</strong></dt>
        <dd>Allez dans Paramètres → Utilisateurs, créez le compte avec le rôle souhaité, puis assignez-lui l'accès aux logements concernés.</dd>
      </dl>
    `,
  },
  {
    id: 'bonnes-pratiques',
    title: 'Bonnes pratiques',
    content: `
      <ul>
        <li><strong>Configurez vos logements complètement</strong> avant de créer des réservations (tarifs, règles, pièces EDL).</li>
        <li><strong>Activez les tâches automatiques</strong> pour ne jamais oublier un ménage ou un check-in.</li>
        <li><strong>Utilisez les options</strong> pour les demandes non confirmées, plutôt que de créer directement une réservation.</li>
        <li><strong>Réalisez les EDL sur mobile</strong> pour photographier et documenter facilement sur le terrain.</li>
        <li><strong>Vérifiez le taux de taxe de séjour</strong> auprès de votre mairie chaque année, il peut changer.</li>
        <li><strong>Assignez les accès logement</strong> à vos co-hôtes et concierges pour qu'ils ne voient que les biens qui les concernent.</li>
      </ul>
    `,
  },
];
