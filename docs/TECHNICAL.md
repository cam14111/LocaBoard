# Documentation Technique — LocaBoard

## Table des matières

1. [Stack technique](#1-stack-technique)
2. [Architecture générale](#2-architecture-générale)
3. [Structure du projet](#3-structure-du-projet)
4. [Base de données](#4-base-de-données)
5. [API & couche de données](#5-api--couche-de-données)
6. [Authentification & autorisation](#6-authentification--autorisation)
7. [Composants & pages](#7-composants--pages)
8. [Gestion d'état](#8-gestion-détat)
9. [Temps réel & notifications](#9-temps-réel--notifications)
10. [Tests](#10-tests)
11. [Build & déploiement](#11-build--déploiement)
12. [Variables d'environnement](#12-variables-denvironnement)
13. [Conventions de code](#13-conventions-de-code)

---

## 1. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework UI | React | 19.2.0 |
| Langage | TypeScript | 5.9.3 |
| Build tool | Vite | 7.3.1 |
| Routing | React Router DOM | 7.13.0 |
| Styling | Tailwind CSS | 4.1.18 |
| Icônes | Lucide React | 0.563.0 |
| PWA | vite-plugin-pwa | 1.2.0 |
| Backend | Supabase (PostgreSQL) | 2.95.3 |
| Tests | Vitest + Testing Library | 4.0.18 |
| Linting | ESLint | 9.39.1 |
| Formatage | Prettier | 3.8.1 |

---

## 2. Architecture générale

```
┌────────────────────────────────────────────────────┐
│                    Client (Browser/PWA)             │
│                                                    │
│  React 19 + TypeScript                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Pages   │  │Components│  │  React Context   │ │
│  │(17 routes│  │(33 fichiers│ │  AuthContext     │ │
│  │lazy-load)│  │réutilis.)│  │  LogementContext  │ │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │              │                 │            │
│       └──────────────┴─────────────────┘           │
│                        │                           │
│              src/lib/api/ (16 modules)             │
│                        │                           │
└────────────────────────┼───────────────────────────┘
                         │ HTTPS / WebSocket
                         ▼
┌────────────────────────────────────────────────────┐
│                    Supabase                         │
│                                                    │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ PostgREST  │  │ Realtime │  │    Storage     │ │
│  │ (REST API) │  │ (WS sub) │  │ (photos, docs) │ │
│  └─────┬──────┘  └────┬─────┘  └────────────────┘ │
│        │               │                           │
│  ┌─────▼───────────────▼──────────────────────┐   │
│  │         PostgreSQL (20+ tables)             │   │
│  │         + RLS policies                      │   │
│  │         + 20+ RPC functions                 │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
                         │
┌────────────────────────┼───────────────────────────┐
│          GitHub Pages  │  (déploiement)             │
│          GitHub Actions (CI/CD)                     │
└────────────────────────────────────────────────────┘
```

---

## 3. Structure du projet

```
LocaBoard/
├── public/                    # Actifs statiques (icônes PWA, fonts, logos)
├── src/
│   ├── pages/                 # 17 pages (lazy-loaded)
│   │   ├── Dashboard.tsx
│   │   ├── Calendar.tsx
│   │   ├── Dossiers.tsx
│   │   ├── DossierDetail.tsx
│   │   ├── EdlMobile.tsx
│   │   ├── Tasks.tsx
│   │   ├── PaiementsGlobal.tsx
│   │   ├── Login.tsx
│   │   ├── Settings.tsx
│   │   └── ...
│   ├── components/
│   │   ├── calendar/          # Grilles, modales, panneau détail
│   │   ├── dossier/           # Kanban, stepper, onglets EDL/paiements/tâches/docs
│   │   ├── layout/            # AppLayout, Header, Sidebar, BottomNav
│   │   ├── ui/                # Composants génériques (ConfirmDialog, etc.)
│   │   └── ...
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Session utilisateur, profil, permissions
│   │   └── LogementContext.tsx # Logement courant sélectionné
│   ├── hooks/                 # 8 hooks personnalisés
│   │   ├── useCalendarEvents.ts
│   │   ├── useDossiers.ts
│   │   ├── useEdlItems.ts
│   │   ├── useNotifications.ts
│   │   └── ...
│   ├── lib/
│   │   ├── api/               # 16 modules API Supabase
│   │   │   ├── logements.ts
│   │   │   ├── reservations.ts
│   │   │   ├── dossiers.ts
│   │   │   ├── paiements.ts
│   │   │   ├── edl.ts
│   │   │   ├── incidents.ts
│   │   │   ├── taches.ts
│   │   │   ├── documents.ts
│   │   │   ├── notifications.ts
│   │   │   ├── audit.ts
│   │   │   ├── utilisateurs.ts
│   │   │   ├── notes.ts
│   │   │   ├── blocages.ts
│   │   │   ├── logementPieces.ts
│   │   │   ├── logementSaisons.ts
│   │   │   └── checklists.ts
│   │   ├── supabaseClient.ts  # Initialisation du client Supabase
│   │   ├── pipeline.ts        # Machine d'état du pipeline dossier
│   │   ├── pipelineAutomate.ts # Avancement automatique du pipeline
│   │   ├── permissions.ts     # Logique RBAC
│   │   ├── contractGenerator.ts # Génération HTML du contrat
│   │   ├── dateUtils.ts       # Utilitaires de manipulation de dates
│   │   ├── imageUtils.ts      # Traitement des photos
│   │   ├── pushNotifications.ts # Intégration Web Push API
│   │   └── rpcErrors.ts       # Normalisation des erreurs RPC
│   ├── types/
│   │   └── database.ts        # Types TypeScript générés depuis le schéma Supabase
│   └── App.tsx                # Configuration du routeur + providers
├── supabase/
│   ├── config.toml            # Config développement local
│   └── migrations/            # 75+ fichiers SQL de migration
├── docs/                      # Documentation
├── .github/workflows/         # GitHub Actions (déploiement)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── index.html
```

---

## 4. Base de données

### Tables principales

| Table | Description |
|---|---|
| `users` | Profils utilisateurs, rôles, permissions, signature |
| `logements` | Propriétés avec capacité, check-in/out, équipements |
| `logement_pieces` | Pièces par logement (cuisine, chambre, etc.) |
| `logement_saisons` | Règles de tarification saisonnière |
| `logement_users` | Mapping accès utilisateur ↔ logement |
| `reservations` | Réservations avec infos locataire et tarification |
| `blocages` | Périodes bloquées (maintenance, personnel) |
| `dossiers` | Dossiers liés aux réservations, statut pipeline |
| `paiements` | Échéancier de paiement et suivi |
| `documents` | Fichiers uploadés (contrats, preuves, etc.) |
| `edls` | États des lieux (entrée / sortie) |
| `edl_items` | Éléments de checklist avec état et photo |
| `incidents` | Incidents signalés lors des EDL |
| `incident_photos` | Photos de preuve des incidents |
| `taches` | Tâches manuelles ou auto-générées |
| `notes` | Commentaires internes par dossier |
| `notifications` | Notifications utilisateur |
| `audit_log` | Journal d'audit complet |
| `checklist_modeles` | Modèles de checklist EDL |
| `push_subscriptions` | Abonnements Web Push |
| `document_shares` | Liens de partage de documents |

### Enums PostgreSQL

```sql
-- Rôles utilisateur
UserRole: ADMIN | COHOTE | CONCIERGE

-- Statuts du pipeline dossier (14 étapes)
PipelineStatut:
  PRE_RESERVATION | OPTION | CONFIRME | CONTRAT_ENVOYE
  | CONTRAT_SIGNE | ACOMPTE_RECU | SOLDE_RECU
  | REMISE_CLES | SEJOUR_EN_COURS | CHECK_OUT
  | EDL_FAIT | CAUTION_TRAITEE | CLOTURE | ANNULE

-- Paiements
PaiementStatut: DU | EN_RETARD | PAYE | ANNULE
PaiementType: ARRHES | ACOMPTE | SOLDE | TAXE_SEJOUR | EXTRA

-- États des lieux
EdlStatut: EN_COURS | TERMINE
EdlType: ARRIVEE | DEPART
EdlItemEtat: OK | ANOMALIE | ANOMALIE_RESOLUE

-- Tâches
TacheType: MENAGE | ACCUEIL | REMISE_CLES | MAINTENANCE | AUTRE
TacheStatut: A_FAIRE | EN_COURS | FAIT | ANNULEE

-- Notifications
NotificationType:
  PAIEMENT_EN_RETARD | OPTION_EXPIREE | EDL_A_FAIRE
  | TACHE_A_COMPLETER | RESERVATION_CONFIRMEE
  | INCIDENT_SIGNALE | CONTRAT_A_SIGNER | AUTRE
```

### Sécurité (Row-Level Security)

Toutes les tables sont protégées par des politiques RLS. Un utilisateur ne peut accéder qu'aux données des logements auxquels il est rattaché (`logement_users`). Les admins ont un accès étendu. Les requêtes non authentifiées sont bloquées.

### Fonctions RPC (côté serveur)

| Fonction | Description |
|---|---|
| `check_and_create_reservation` | Vérification des conflits + création atomique |
| `update_reservation_dates` | Modification de dates avec revalidation |
| `cancel_taches_bulk` | Annulation en masse de tâches |
| `cancel_paiements_bulk` | Annulation en masse de paiements |
| `auto_advance_pipeline` | Avancement automatique du pipeline |
| `dismiss_dossier_cascade_notifications` | Nettoyage notifications sur annulation |
| `create_tache_for_incident` | Création auto d'une tâche depuis un incident |
| `resolve_incident` | Résolution d'un incident |
| `admin_set_logement_users` | Attribution des accès utilisateur/logement |

---

## 5. API & couche de données

Chaque module dans `src/lib/api/` expose des fonctions TypeScript qui encapsulent les appels Supabase. Pattern général :

```typescript
// Exemple : src/lib/api/reservations.ts
export async function createReservation(data: CreateReservationParams) {
  const { data: result, error } = await supabase
    .rpc('check_and_create_reservation', data)
  if (error) throw normalizeRpcError(error)
  return result
}
```

Les fonctions peuvent appeler :
- **PostgREST** (`.from('table').select/insert/update/delete`)
- **RPC** (`.rpc('function_name', params)`)
- **Storage** (`.storage.from('bucket').upload/download`)

Toutes les erreurs sont normalisées via `rpcErrors.ts` pour fournir des messages lisibles.

---

## 6. Authentification & autorisation

### Authentification

Gérée par **Supabase Auth**. Flux :

1. L'utilisateur saisit email/mot de passe sur `/login`
2. `AuthContext` appelle `supabase.auth.signInWithPassword()`
3. La session est persistée dans `localStorage`
4. `AuthContext` expose `user`, `profile`, `permissions`, `loading`
5. `ProtectedRoute` redirige vers `/login` si non authentifié

### Rôles et permissions

```
ADMIN
  └── Toutes les permissions

COHOTE
  ├── reservation:create / reservation:edit / reservation:cancel
  ├── dossier:view / dossier:advance_pipeline
  ├── edl:create / edl:edit
  ├── tache:complete / tache:create
  ├── document:upload
  ├── contrat:generate
  └── note:create

CONCIERGE
  ├── dossier:view
  ├── edl:create / edl:edit
  ├── tache:complete
  └── note:create
```

L'affichage conditionnel des éléments UI est géré par le composant `PermissionGate` :

```tsx
<PermissionGate permission="paiement:mark_paid">
  <Button>Marquer comme payé</Button>
</PermissionGate>
```

---

## 7. Composants & pages

### Pages (lazy-loaded)

| Page | Route | Description |
|---|---|---|
| `Login` | `/login` | Formulaire d'authentification |
| `Dashboard` | `/` | Vue d'ensemble |
| `Calendar` | `/calendar` | Calendrier mois/semaine |
| `Dossiers` | `/dossiers` | Liste/Kanban des dossiers |
| `DossierDetail` | `/dossiers/:id` | Détail complet d'un dossier |
| `EdlMobile` | `/edl/:id` | Interface EDL plein écran |
| `Tasks` | `/tasks` | Gestion des tâches |
| `PaiementsGlobal` | `/paiements` | Vue globale des paiements |
| `Settings` | `/settings/*` | Paramètres et sous-pages |

### Composants clés

**Layout**
- `AppLayout` — Shell principal avec header, sidebar, navigation mobile
- `LogementSelector` — Sélecteur de logement courant
- `NotificationsPanel` — Panneau de notifications (drawer)

**Calendrier**
- `MonthGrid` / `WeekGrid` — Affichage calendrier avec événements
- `ReservationModal` / `BlocageModal` — Création via calendrier
- `EventDetailPanel` — Inspection d'un événement

**Dossier**
- `DossiersKanban` — Vue Kanban par statut pipeline
- `PipelineStepper` — Visualisation des étapes du pipeline
- `EdlTab` / `PaiementsTab` / `TachesTab` / `DocumentsTab` — Onglets du dossier
- `AuditTimeline` — Journal des actions
- `ContractGeneratorModal` — Génération du contrat HTML

---

## 8. Gestion d'état

L'application utilise exclusivement React Context + hooks locaux. Pas de Redux ni de Zustand.

| Context | Contenu |
|---|---|
| `AuthContext` | Session, profil utilisateur, rôle, permissions |
| `LogementContext` | Logement actif, liste des logements accessibles |

Les données métier sont chargées à la demande dans chaque page via des hooks personnalisés (`useDossiers`, `useCalendarEvents`, etc.) qui appellent les modules API.

---

## 9. Temps réel & notifications

### Subscriptions Supabase Realtime

Utilisées pour les mises à jour en temps réel sans rechargement :
- Nouvelles notifications
- Changements de statut de réservation
- Mises à jour de tâches partagées

### Web Push API

- Clés VAPID configurées via `VITE_VAPID_PUBLIC_KEY`
- Abonnements stockés dans `push_subscriptions`
- Gestion dans `src/lib/pushNotifications.ts`
- Permet de notifier les utilisateurs même navigateur fermé

### Types de notifications

| Type | Déclencheur |
|---|---|
| `PAIEMENT_EN_RETARD` | Date d'échéance dépassée, paiement non reçu |
| `OPTION_EXPIREE` | Option réservation expirée |
| `EDL_A_FAIRE` | Arrivée ou départ prévu sans EDL |
| `TACHE_A_COMPLETER` | Tâche dont l'échéance approche |
| `RESERVATION_CONFIRMEE` | Nouvelle réservation confirmée |
| `INCIDENT_SIGNALE` | Incident créé lors d'un EDL |
| `CONTRAT_A_SIGNER` | Contrat envoyé en attente de signature |

---

## 10. Tests

Fichiers de tests dans `src/` couvrant la logique métier critique :

| Fichier test | Couverture |
|---|---|
| `dateUtils.test.ts` | Manipulation de dates, calculs de durée |
| `pipeline.test.ts` | Transitions d'état, règles de progression |
| `permissions.test.ts` | RBAC, vérification des droits |
| `paiements.test.ts` | Calcul des échéanciers, états |
| `edl.test.ts` | Logique de checklist, états des items |
| `notifications.test.ts` | Déduplication, création |
| `pipelineAutomate.test.ts` | Avancement automatique |
| `incidents.test.ts` | Création, résolution, liaison tâche |

### Commandes

```bash
npm run test           # Mode watch
npm run test -- --run  # Exécution unique
```

---

## 11. Build & déploiement

### Build local

```bash
npm run build
# Output dans dist/
```

Le build est configuré avec `base: '/LocaBoard/'` dans `vite.config.ts` pour GitHub Pages.

### CI/CD GitHub Actions

Fichier : `.github/workflows/deploy.yml`

Déclencheur : push sur `main`

Étapes :
1. Checkout du code
2. Installation des dépendances (`npm ci`)
3. Build (`npm run build`) avec injection des variables d'environnement depuis les secrets GitHub
4. Déploiement sur GitHub Pages

### PWA

La configuration PWA (via `vite-plugin-pwa`) génère :
- `manifest.webmanifest` — métadonnées de l'app (nom, icônes, thème)
- `sw.js` — Service Worker pour le cache offline
- Stratégie de cache : réseau en priorité, fallback cache

---

## 12. Variables d'environnement

| Variable | Description | Obligatoire |
|---|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase | Oui |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase (anon) | Oui |
| `VITE_VAPID_PUBLIC_KEY` | Clé publique VAPID pour Web Push | Oui |

Créez un fichier `.env` à la racine (non versionné) :

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BF...
```

Pour la production, ces variables sont injectées via les **Secrets GitHub**.

---

## 13. Conventions de code

- **Langue** : code et commentaires en français (domaine métier francophone)
- **Composants** : PascalCase (`DossierDetail.tsx`)
- **Fonctions** : camelCase (`fetchReservations`)
- **Types** : PascalCase (`ReservationWithDossier`)
- **Formatage** : Prettier avec configuration `.prettierrc`
- **Imports** : alias `@/` pointant vers `src/`
- **Routing** : lazy loading systématique des pages (`React.lazy + Suspense`)
- **Erreurs** : toujours propagées avec `throw`, jamais silencieuses
- **Typage** : strict TypeScript, pas de `any` implicite
