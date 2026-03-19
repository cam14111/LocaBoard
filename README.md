# LocaBoard

**LocaBoard** est une application web de gestion de locations saisonnières conçue pour les propriétaires, co-hôtes et concierges. Elle centralise l'ensemble du cycle de vie d'une location : réservations, dossiers locataires, paiements, états des lieux, tâches et documents — dans une interface claire et moderne, accessible depuis n'importe quel appareil.

---

## Fonctionnalités

### Tableau de bord
Vue d'ensemble en temps réel de votre activité :
- Arrivées et départs du jour et du lendemain
- Paiements en attente et en retard
- Anomalies d'états des lieux non résolues
- Incidents ouverts
- Tâches à venir

### Calendrier des réservations
- Vue mensuelle et hebdomadaire
- Visualisation simultanée des réservations et des blocages
- Création rapide de réservations directement depuis le calendrier
- Gestion des options (avec date d'expiration automatique) et des confirmations
- Détection automatique des conflits de dates

### Gestion des dossiers locataires
Chaque réservation génère un dossier qui suit un pipeline en 14 étapes, de la pré-réservation à la clôture :
- Vue Kanban ou liste filtrée par statut
- Avancement du pipeline avec validation à chaque étape
- Timeline d'audit complète (qui a fait quoi et quand)
- Notes internes par dossier
- Génération et envoi du contrat de location
- Suivi des pièces justificatives et de la signature

### Paiements
- Planification des versements (arrhes, acompte, solde, taxe de séjour, extras)
- Calcul automatique des montants selon les paramètres du logement
- Marquage du paiement avec mode de règlement et preuve jointe
- Alertes pour paiements en retard
- Vue globale de tous les paiements sur l'ensemble des logements

### États des lieux (EDL)
Interface mobile optimisée pour les inspections sur site :
- EDL d'entrée et de sortie
- Checklists personnalisables par logement et par pièce
- États par élément : OK / Anomalie / Anomalie résolue
- Upload de photos directement depuis le téléphone
- Création automatique d'incidents à partir des anomalies
- Comparaison entrée/sortie

### Gestion des incidents
- Signalement d'incidents avec niveau de gravité (mineur / majeur)
- Photos de preuve
- Génération automatique d'une tâche de maintenance associée
- Suivi de la résolution

### Tâches
- Tâches manuelles ou générées automatiquement (ménage, accueil, remise de clés, maintenance)
- Assignation à un membre de l'équipe
- Dates d'échéance et statuts (À faire / En cours / Fait / Annulée)
- Photo de preuve à la complétion

### Documents
- Stockage centralisé : contrats, preuves de paiement, pièces d'identité, EDL, etc.
- Historique de versions avec archivage
- Accès sécurisé via liens signés

### Blocages
- Bloquer des périodes pour travaux, usage personnel ou indisponibilité
- Visibles sur le calendrier et pris en compte dans la détection de conflits

### Notifications
- Notifications en temps réel dans l'application
- Notifications push sur mobile et desktop (même navigateur fermé)
- Types : paiement en retard, option expirée, EDL à faire, tâche à compléter, etc.

### Gestion multi-logements
- Basculez entre vos logements depuis n'importe quelle page
- Données isolées par logement
- Paramètres spécifiques par bien (capacité, check-in/out, équipements, saisons tarifaires)

### Gestion des utilisateurs et des rôles
Trois rôles avec des niveaux d'accès distincts :
- **Admin** : accès complet à toutes les fonctionnalités
- **Co-hôte** : gestion opérationnelle (réservations, EDL, tâches)
- **Concierge** : accès limité aux tâches et EDL

---

## Accès & Compatibilité

- Application web progressive (PWA) : installable sur iPhone, Android, PC et Mac
- Compatible avec tous les navigateurs modernes (Chrome, Firefox, Safari, Edge)
- Interface responsive : optimisée pour mobile, tablette et desktop
- Navigation simplifiée sur mobile avec barre d'actions en bas d'écran

---

## Démarrage rapide

### Prérequis
- Node.js 18+
- Un projet Supabase

### Installation

```bash
git clone https://github.com/cam14111/LocaBoard.git
cd LocaBoard
npm install
```

### Configuration

Créez un fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

### Lancement en développement

```bash
npm run dev
```

### Build de production

```bash
npm run build
```

### Lancer les tests

```bash
npm run test
```

---

## Déploiement

Le projet est configuré pour un déploiement automatique sur **GitHub Pages** via GitHub Actions. Chaque push sur la branche `main` déclenche un build et un déploiement automatique.

---

## Documentation

- [Documentation technique](./docs/TECHNICAL.md) — architecture, stack, base de données, API
- [Documentation fonctionnelle](./docs/FUNCTIONAL.md) — workflows, pipeline, règles métier, permissions

---

## Licence

Ce projet est privé. Tous droits réservés.
