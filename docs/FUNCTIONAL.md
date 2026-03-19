# Documentation Fonctionnelle — LocaBoard

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Acteurs et rôles](#2-acteurs-et-rôles)
3. [Gestion des logements](#3-gestion-des-logements)
4. [Gestion des réservations](#4-gestion-des-réservations)
5. [Pipeline dossier](#5-pipeline-dossier)
6. [Gestion des paiements](#6-gestion-des-paiements)
7. [États des lieux (EDL)](#7-états-des-lieux-edl)
8. [Incidents](#8-incidents)
9. [Tâches](#9-tâches)
10. [Documents](#10-documents)
11. [Notifications](#11-notifications)
12. [Journal d'audit](#12-journal-daudit)
13. [Règles métier transversales](#13-règles-métier-transversales)
14. [Matrice des permissions](#14-matrice-des-permissions)

---

## 1. Vue d'ensemble

LocaBoard est un outil de gestion opérationnelle pour la location saisonnière. L'application couvre l'intégralité du cycle de vie d'une réservation, de la première prise de contact jusqu'à la clôture administrative du séjour.

**Principes fondamentaux :**
- Un dossier est créé automatiquement pour chaque réservation et représente l'unité de travail centrale.
- Le pipeline (voir section 5) structure la progression du dossier en étapes obligatoires.
- Toutes les actions importantes sont tracées dans un journal d'audit.
- L'application est multi-logements : chaque logement dispose de ses propres données, paramètres et accès utilisateurs.

---

## 2. Acteurs et rôles

### ADMIN
Le propriétaire ou gestionnaire principal. Accès complet à toutes les fonctionnalités.

**Responsabilités typiques :**
- Configuration des logements et des saisons tarifaires
- Validation des étapes financières du pipeline (envoi/signature contrat, réception paiements)
- Gestion des utilisateurs et de leurs accès
- Clôture des dossiers

### COHOTE (Co-hôte)
Personne de confiance qui assiste dans la gestion opérationnelle. Ne peut pas valider les étapes financières.

**Responsabilités typiques :**
- Création et suivi des réservations
- Réalisation des états des lieux
- Gestion des tâches et des incidents
- Génération du contrat

### CONCIERGE
Prestataire ou employé chargé des opérations sur site. Accès restreint aux tâches et EDL.

**Responsabilités typiques :**
- Réalisation des EDL d'entrée et de sortie
- Complétion des tâches (ménage, remise de clés, etc.)

---

## 3. Gestion des logements

### Création d'un logement
Un logement contient :
- **Informations générales** : nom, adresse, capacité maximale, nombre de pièces, description, équipements
- **Règles d'exploitation** : heure de check-in, heure de check-out, durée minimale de séjour, buffer entre réservations (en heures)
- **Pièces** (`logement_pieces`) : liste des pièces avec leur type (CUISINE, CHAMBRE, SALON, SALLE_DE_BAIN, WC, EXTERIEUR, AUTRE) — utilisées pour structurer les EDL
- **Saisons tarifaires** (`logement_saisons`) : plages de dates avec tarifs spécifiques

### Archivage
Un logement peut être archivé (non supprimé). Il n'apparaît plus dans le sélecteur mais ses données historiques sont conservées.

### Checklist EDL
Chaque logement possède un modèle de checklist (`checklist_modeles`) définissant les éléments à vérifier lors des états des lieux, organisés par pièce.

---

## 4. Gestion des réservations

### Types de réservation

**OPTION**
- Réservation préliminaire non confirmée
- Possède une date d'expiration (définie par l'utilisateur)
- À l'expiration, une notification est générée et l'option peut être annulée ou convertie en confirmation
- Affichée sur le calendrier avec un style distinct

**CONFIRMATION**
- Réservation ferme
- Déclenche la création automatique d'un dossier si absent
- Bloque les dates sur le calendrier

### Informations d'une réservation
- Dates d'arrivée et de départ (avec heures)
- Informations locataire : nom, prénom, email, téléphone, nombre de voyageurs
- Tarification : prix de base, taxe de séjour, extras, montant total
- Source de réservation (libre)

### Règles de validation
- **Conflits** : vérification serveur via RPC `check_and_create_reservation` — une réservation ne peut pas chevaucher une autre réservation confirmée ni un blocage
- **Buffer** : durée minimale entre deux réservations (configurable par logement). Le buffer est un paramètre du logement exprimé en heures.
- **Dates** : la date de fin doit être postérieure à la date de début

### Blocages
Les blocages (`blocages`) permettent de marquer des périodes indisponibles pour usage personnel, maintenance ou travaux. Ils sont vérifiés dans la détection de conflits comme les réservations.

### Annulation
L'annulation d'une réservation déclenche une cascade :
1. Le statut de la réservation passe à `ANNULE`
2. Le dossier associé passe à `ANNULE`
3. Tous les paiements dus sont annulés (`cancel_paiements_bulk`)
4. Toutes les tâches non terminées sont annulées (`cancel_taches_bulk`)
5. Les notifications liées au dossier sont supprimées (`dismiss_dossier_cascade_notifications`)

---

## 5. Pipeline dossier

Le pipeline représente la progression administrative et opérationnelle d'un dossier. Il comporte 14 statuts ordonnés.

### Étapes du pipeline

```
PRE_RESERVATION
    │  Première prise de contact
    ▼
OPTION
    │  Réservation optionnelle créée (date d'expiration)
    ▼
CONFIRME
    │  Réservation confirmée
    ▼
CONTRAT_ENVOYE           ← ADMIN uniquement
    │  Contrat généré et envoyé au locataire
    ▼
CONTRAT_SIGNE            ← ADMIN uniquement
    │  Contrat signé par le locataire, uploadé
    ▼
ACOMPTE_RECU             ← ADMIN uniquement
    │  Paiement de l'acompte reçu et marqué
    ▼
SOLDE_RECU               ← ADMIN uniquement
    │  Solde total reçu et marqué
    ▼
REMISE_CLES
    │  Clés remises au locataire (check-in)
    ▼
SEJOUR_EN_COURS
    │  Séjour en cours
    ▼
CHECK_OUT
    │  Locataire parti (check-out)
    ▼
EDL_FAIT
    │  État des lieux de sortie réalisé
    ▼
CAUTION_TRAITEE          ← ADMIN uniquement
    │  Caution rendue ou retenue traitée
    ▼
CLOTURE                  ← ADMIN uniquement
    │  Dossier clôturé
    ▼
ANNULE (terminal)
    │  Annulation à tout moment
```

### Règles de progression

- **Avancement manuel** : l'utilisateur clique sur "Avancer" dans le stepper. Certaines étapes nécessitent une validation préalable (ex. un contrat doit être uploadé avant de passer à `CONTRAT_SIGNE`).
- **Avancement automatique** (`auto_advance_pipeline`) : le système peut avancer automatiquement certaines étapes en fonction d'actions réalisées (ex. tous les paiements requis reçus → passage automatique).
- **Étapes admin-only** : `CONTRAT_ENVOYE`, `CONTRAT_SIGNE`, `ACOMPTE_RECU`, `SOLDE_RECU`, `CAUTION_TRAITEE`, `CLOTURE` ne peuvent être franchies que par un ADMIN.
- **Retour en arrière** : non autorisé (le pipeline est unidirectionnel).
- **Annulation** : possible depuis n'importe quelle étape (sauf `CLOTURE`).

### Visualisation
Le `PipelineStepper` affiche les étapes comme une barre de progression horizontale. L'étape courante est mise en évidence. Les étapes passées sont cochées.

---

## 6. Gestion des paiements

### Types de paiements

| Type | Description |
|---|---|
| `ARRHES` | Versement initial symbolique |
| `ACOMPTE` | Versement partiel (généralement 30%) |
| `SOLDE` | Solde restant dû |
| `TAXE_SEJOUR` | Taxe de séjour réglementaire |
| `EXTRA` | Frais supplémentaires (ménage, animaux, etc.) |

### Statuts

| Statut | Description |
|---|---|
| `DU` | Paiement planifié, non encore reçu |
| `EN_RETARD` | Date d'échéance dépassée, paiement non reçu |
| `PAYE` | Paiement reçu et marqué |
| `ANNULE` | Paiement annulé (suite à annulation dossier) |

### Cycle de vie

1. Les paiements sont créés lors de la constitution du dossier (manuellement ou selon des règles paramétrées).
2. À chaque échéance, le système vérifie si le paiement est reçu. Si non, le statut passe à `EN_RETARD` et une notification est générée.
3. Le marquage comme payé (`PAYE`) requiert : mode de règlement, date de réception, optionnellement une preuve (document uploadé).
4. Certains paiements déclenchent un avancement automatique du pipeline (ex. solde reçu → `SOLDE_RECU`).

### Vue globale
La page `PaiementsGlobal` agrège tous les paiements de tous les logements avec filtres par statut, type et période.

---

## 7. États des lieux (EDL)

### Types d'EDL

- **ARRIVEE** (entrée) : réalisé avant ou lors du check-in
- **DEPART** (sortie) : réalisé après le départ du locataire

### Interface mobile

L'EDL est conçu pour être réalisé sur site depuis un smartphone. L'interface `EdlMobile` est en plein écran et optimisée pour le tactile :
- Navigation par pièce
- Boutons d'état larges (OK / Anomalie)
- Capture photo directe depuis l'appareil photo

### Déroulement d'un EDL

1. Depuis le dossier, créer ou ouvrir l'EDL correspondant.
2. Parcourir chaque pièce et chaque élément de la checklist.
3. Pour chaque élément, indiquer l'état :
   - **OK** : élément conforme
   - **ANOMALIE** : problème constaté (description + photo possible)
4. En cas d'anomalie, un incident peut être créé directement depuis l'item.
5. Une fois tous les éléments vérifiés, finaliser l'EDL (statut → `TERMINE`).
6. L'avancement du pipeline peut être déclenché automatiquement (`EDL_FAIT`).

### Comparaison entrée/sortie

L'application permet de comparer l'état des items entre l'EDL d'entrée et l'EDL de sortie pour identifier les dégradations survenues pendant le séjour.

### Gestion des photos

Les photos sont uploadées dans le bucket Supabase Storage. Chaque photo est associée à un `edl_item`. Les URLs signées garantissent un accès sécurisé et temporaire.

---

## 8. Incidents

### Création

Un incident peut être créé :
- Directement depuis un item d'EDL en anomalie
- Manuellement depuis la liste des incidents d'un dossier

### Niveaux de gravité

| Niveau | Usage |
|---|---|
| `MINEUR` | Usure normale, petit défaut esthétique |
| `MAJEUR` | Dégradation significative, équipement endommagé |

### Cycle de vie

1. Création avec description, niveau de gravité et photos de preuve.
2. Une tâche de type `MAINTENANCE` est automatiquement créée et associée à l'incident.
3. La résolution de l'incident est possible manuellement (`resolve_incident`).
4. L'item EDL associé passe en état `ANOMALIE_RESOLUE`.

---

## 9. Tâches

### Types de tâches

| Type | Description |
|---|---|
| `MENAGE` | Nettoyage du logement |
| `ACCUEIL` | Accueil du locataire |
| `REMISE_CLES` | Remise ou récupération des clés |
| `MAINTENANCE` | Réparation, entretien |
| `AUTRE` | Tâche libre |

### Création

- **Manuelle** : depuis la liste des tâches ou depuis un dossier
- **Automatique** :
  - Tâche `MENAGE` générée après chaque départ
  - Tâche `MAINTENANCE` générée à la création d'un incident majeur
  - Tâche `REMISE_CLES` générée à la confirmation d'une réservation (selon paramètres)

### Assignation et suivi

- Une tâche peut être assignée à un utilisateur spécifique
- Date d'échéance obligatoire
- Statuts : `A_FAIRE` → `EN_COURS` → `FAIT` (ou `ANNULEE`)
- La complétion peut nécessiter une photo de preuve

### Vue globale

La page `Tasks` liste toutes les tâches avec filtres par type, statut, logement et période.

---

## 10. Documents

### Types de documents supportés

| Type | Description |
|---|---|
| `CONTRAT` | Contrat de location |
| `PREUVE_PAIEMENT` | Justificatif de paiement |
| `EDL` | Rapport d'état des lieux |
| `PIECE_IDENTITE` | Document d'identité du locataire |
| `AUTRE` | Tout autre document |

### Gestion des versions

- Uploader un document du même type sur le même dossier **archive** automatiquement la version précédente.
- L'historique complet des versions est conservé et consultable.
- L'accès aux fichiers se fait via des **URLs signées** Supabase (valables temporairement) pour garantir la sécurité.

### Contrat de location

La génération du contrat est réalisée côté client par `contractGenerator.ts` :
1. Les données du dossier, du locataire et du logement sont injectées dans un template HTML.
2. Le contrat est affiché dans une modale (`ContractGeneratorModal`).
3. L'utilisateur peut télécharger le PDF ou marquer le contrat comme envoyé.
4. Le contrat signé peut être uploadé (`SignedContractUploadModal`).

---

## 11. Notifications

### Génération des notifications

Les notifications sont créées automatiquement par le système lors d'événements métier :

| Événement | Notification générée | Destinataires |
|---|---|---|
| Paiement en retard | `PAIEMENT_EN_RETARD` | Admin, Co-hôte |
| Option expirée | `OPTION_EXPIREE` | Admin, Co-hôte |
| Arrivée sans EDL d'entrée | `EDL_A_FAIRE` | Tous |
| Départ sans EDL de sortie | `EDL_A_FAIRE` | Tous |
| Tâche dont l'échéance approche | `TACHE_A_COMPLETER` | Assigné + Admin |
| Réservation confirmée | `RESERVATION_CONFIRMEE` | Admin |
| Incident créé | `INCIDENT_SIGNALE` | Admin |
| Contrat en attente de signature | `CONTRAT_A_SIGNER` | Admin |

### Déduplication

Le système évite de créer plusieurs notifications identiques pour un même événement (même dossier, même type). Une notification existante non lue empêche la création d'un doublon.

### Lecture et gestion

- Les notifications apparaissent dans le panneau `NotificationsPanel` (icône cloche dans le header).
- Une pastille indique le nombre de notifications non lues.
- Les notifications peuvent être marquées comme lues individuellement ou toutes à la fois.
- Les notifications peuvent être rejetées (dismissed).

### Push notifications

Si l'utilisateur accepte les notifications du navigateur, les alertes sont également envoyées via la **Web Push API**, même si l'onglet est fermé.

---

## 12. Journal d'audit

Chaque action significative dans l'application génère une entrée dans `audit_log` :

| Champ | Description |
|---|---|
| `action` | Type d'action (create, update, delete, advance_pipeline, etc.) |
| `entity_type` | Entité concernée (reservation, dossier, paiement, edl, etc.) |
| `entity_id` | Identifiant de l'entité |
| `user_id` | Utilisateur ayant réalisé l'action |
| `old_values` | Valeurs avant modification (JSON) |
| `new_values` | Valeurs après modification (JSON) |
| `metadata` | Informations contextuelles supplémentaires |
| `created_at` | Horodatage |

Le journal est consultable depuis l'onglet **Timeline** d'un dossier (`AuditTimeline`), avec affichage chronologique de toutes les actions.

---

## 13. Règles métier transversales

### Détection de conflits de réservation

Une réservation ne peut être créée ou modifiée que si :
- Elle ne chevauche pas une réservation existante confirmée sur le même logement
- Elle ne chevauche pas un blocage existant
- Elle respecte le buffer minimum entre réservations (paramètre logement)

La vérification est effectuée **côté serveur** via une RPC atomique pour éviter les conditions de course.

### Cascade d'annulation

L'annulation d'un dossier ou d'une réservation déclenche automatiquement :
- Annulation de tous les paiements `DU` ou `EN_RETARD`
- Annulation de toutes les tâches `A_FAIRE` ou `EN_COURS`
- Suppression des notifications actives liées au dossier

### Avancement automatique du pipeline

Le système vérifie après certaines actions si le pipeline peut avancer automatiquement :
- Tous les paiements d'un type requis reçus → avancement financier
- EDL finalisé → passage à `EDL_FAIT`

### Expiration des options

Les réservations de type `OPTION` avec une date d'expiration dépassée peuvent être :
- Annulées automatiquement (selon configuration)
- Signalées par notification pour action manuelle

### Gestion des photos

- Format accepté : JPEG, PNG, WebP
- Redimensionnement côté client avant upload (`imageUtils.ts`) pour réduire la bande passante
- Stockage dans Supabase Storage avec organisation par dossier/EDL/incident
- Accès via URLs signées (expiration configurable)

---

## 14. Matrice des permissions

| Permission | ADMIN | COHOTE | CONCIERGE |
|---|:---:|:---:|:---:|
| `logement:create` | ✓ | | |
| `logement:edit` | ✓ | | |
| `logement:archive` | ✓ | | |
| `reservation:create` | ✓ | ✓ | |
| `reservation:edit` | ✓ | ✓ | |
| `reservation:cancel` | ✓ | ✓ | |
| `blocage:create` | ✓ | ✓ | |
| `dossier:view` | ✓ | ✓ | ✓ |
| `dossier:advance_pipeline` | ✓ | ✓* | |
| `dossier:cancel` | ✓ | ✓ | |
| `paiement:create` | ✓ | ✓ | |
| `paiement:mark_paid` | ✓ | | |
| `paiement:cancel` | ✓ | | |
| `edl:create` | ✓ | ✓ | ✓ |
| `edl:edit` | ✓ | ✓ | ✓ |
| `incident:create` | ✓ | ✓ | ✓ |
| `incident:resolve` | ✓ | ✓ | |
| `tache:create` | ✓ | ✓ | |
| `tache:complete` | ✓ | ✓ | ✓ |
| `tache:cancel` | ✓ | ✓ | |
| `document:upload` | ✓ | ✓ | |
| `document:delete` | ✓ | | |
| `contrat:generate` | ✓ | ✓ | |
| `note:create` | ✓ | ✓ | ✓ |
| `utilisateur:manage` | ✓ | | |

*Le Co-hôte peut avancer le pipeline sauf les étapes marquées ADMIN-only (financières et clôture).
