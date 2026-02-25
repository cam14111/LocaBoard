// Types TypeScript correspondant au schéma BDD Supabase
// Ce fichier sera regénéré via `supabase gen types typescript` une fois le schéma déployé.
// Pour l'instant, définition manuelle alignée sur le PRD §9.

export type UserRole = 'ADMIN' | 'COHOTE' | 'CONCIERGE';

export type ReservationType = 'OPTION' | 'RESERVATION';
export type ReservationStatut = 'OPTION_ACTIVE' | 'CONFIRMEE' | 'OPTION_EXPIREE' | 'ANNULEE';

export type PipelineStatut =
  | 'DEMANDE_RECUE'
  | 'OPTION_POSEE'
  | 'CONTRAT_ENVOYE'
  | 'CONTRAT_SIGNE'
  | 'ACOMPTE_RECU'
  | 'SOLDE_DEMANDE'
  | 'SOLDE_RECU'
  | 'CHECKIN_FAIT'
  | 'EDL_ENTREE_OK'
  | 'EDL_ENTREE_INCIDENT'
  | 'CHECKOUT_FAIT'
  | 'EDL_OK'
  | 'EDL_INCIDENT'
  | 'CLOTURE'
  | 'ANNULE';

export type PaiementType = 'ARRHES' | 'ACOMPTE' | 'SOLDE' | 'TAXE_SEJOUR' | 'EXTRA';
export type PaiementStatut = 'DU' | 'EN_RETARD' | 'PAYE' | 'ANNULE';
export type PaiementMethod = 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'AUTRE';

export type DocumentType = 'CONTRAT' | 'PREUVE_PAIEMENT' | 'EDL' | 'PIECE_IDENTITE' | 'AUTRE';

export type EdlType = 'ARRIVEE' | 'DEPART';
export type EdlStatut = 'NON_COMMENCE' | 'EN_COURS' | 'TERMINE_OK' | 'TERMINE_INCIDENT';
export type EdlItemEtat = 'OK' | 'ANOMALIE';

export type IncidentSeverite = 'MINEUR' | 'MAJEUR';

export type TacheType = 'MENAGE' | 'ACCUEIL' | 'REMISE_CLES' | 'MAINTENANCE' | 'AUTRE';
export type TacheStatut = 'A_FAIRE' | 'EN_COURS' | 'FAIT' | 'ANNULEE';

export type NotificationType =
  | 'OPTION_EXPIRE_BIENTOT'
  | 'OPTION_EXPIREE'
  | 'PAIEMENT_EN_RETARD'
  | 'PAIEMENT_DU_BIENTOT'
  | 'ARRIVEE_IMMINENTE'
  | 'DEPART_IMMINENT'
  | 'TACHE_ASSIGNEE'
  | 'TACHE_EN_RETARD';

export type BlocageMotif = 'MAINTENANCE' | 'USAGE_PERSO' | 'AUTRE';

// ─── Row types ───────────────────────────────────────────────

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  created_at: string;
  archived_at: string | null;
}

export interface Logement {
  id: string;
  nom: string;
  adresse: string;
  type: string;
  surface_m2: number | null;
  capacite_personnes: number;
  nb_pieces: number | null;
  heure_checkin: string;
  heure_checkout: string;
  buffer_heures: number;
  taux_taxe_sejour: number;
  duree_expiration_option_jours: number;
  taches_auto_enabled: boolean;
  photo_url: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface Reservation {
  id: string;
  logement_id: string;
  type: ReservationType;
  statut: ReservationStatut;
  date_debut: string;
  date_fin: string;
  expiration_at: string | null;
  locataire_nom: string;
  locataire_prenom: string;
  locataire_email: string | null;
  locataire_telephone: string | null;
  locataire_adresse: string | null;
  locataire_pays: string | null;
  nb_personnes: number;
  nb_adultes: number | null;
  nb_enfants: number | null;
  loyer_total: number | null;
  notes: string | null;
  motif_annulation: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Blocage {
  id: string;
  logement_id: string;
  date_debut: string;
  date_fin: string;
  motif: BlocageMotif;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  archived_at: string | null;
}

export interface Dossier {
  id: string;
  reservation_id: string;
  logement_id: string;
  pipeline_statut: PipelineStatut;
  type_premier_versement: 'ARRHES' | 'ACOMPTE';
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Paiement {
  id: string;
  dossier_id: string;
  type: PaiementType;
  montant_eur: number;
  echeance_date: string;
  statut: PaiementStatut;
  method: PaiementMethod | null;
  paid_at: string | null;
  paid_by_user_id: string | null;
  proof_document_id: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  dossier_id: string;
  type: DocumentType;
  nom_fichier: string;
  mime_type: string;
  taille_octets: number;
  storage_path: string;
  uploaded_by_user_id: string;
  uploaded_at: string;
  archived_at: string | null;
  remplace_document_id: string | null;
}

export interface Edl {
  id: string;
  dossier_id: string;
  type: EdlType;
  statut: EdlStatut;
  realise_par_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface EdlItem {
  id: string;
  edl_id: string;
  checklist_item_label: string;
  etat: EdlItemEtat | null;
  photo_url: string | null;
  commentaire: string | null;
  ordre: number;
}

export interface Incident {
  id: string;
  edl_id: string;
  dossier_id: string;
  description: string;
  severite: IncidentSeverite;
  created_by_user_id: string;
  created_at: string;
}

export interface IncidentPhoto {
  id: string;
  incident_id: string;
  photo_url: string;
  created_at: string;
}

export interface Tache {
  id: string;
  dossier_id: string | null;
  logement_id: string;
  titre: string;
  description: string | null;
  type: TacheType;
  statut: TacheStatut;
  echeance_at: string;
  assignee_user_id: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  proof_photo_url: string | null;
  auto_generated: boolean;
  created_at: string;
}

export interface Note {
  id: string;
  dossier_id: string;
  contenu: string;
  created_by_user_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  titre: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  logement_id: string | null;
  action: string;
  changed_fields: Record<string, { before: unknown; after: unknown }> | null;
  metadata: Record<string, unknown> | null;
  actor_user_id: string | null;
  timestamp: string;
}

export interface ChecklistModele {
  id: string;
  logement_id: string;
  nom: string;
  items: Array<{ label: string; ordre: number }>;
  created_at: string;
  updated_at: string;
}

// ─── Helpers Supabase ────────────────────────────────────────
// Supabase v2.95+ GenericTable exige Row/Insert/Update étendant Record<string, unknown>
// et un champ Relationships. Les interfaces TS n'ont pas d'index signature implicite,
// d'où les helpers ci-dessous.
type DbRow<T> = { [K in keyof T]: T[K] } & Record<string, unknown>;
type DbInsert<T> = { [K in keyof T]?: T[K] } & Record<string, unknown>;
type DbUpdate<T> = { [K in keyof T]?: T[K] } & Record<string, unknown>;
type DbTable<T> = { Row: DbRow<T>; Insert: DbInsert<T>; Update: DbUpdate<T>; Relationships: [] };

// ─── Database interface (pour le client Supabase typé) ───────

export interface Database {
  public: {
    Tables: {
      users: DbTable<Utilisateur>;
      logements: DbTable<Logement>;
      reservations: DbTable<Reservation>;
      blocages: DbTable<Blocage>;
      dossiers: DbTable<Dossier>;
      paiements: DbTable<Paiement>;
      documents: DbTable<Document>;
      edls: DbTable<Edl>;
      edl_items: DbTable<EdlItem>;
      incidents: DbTable<Incident>;
      incident_photos: DbTable<IncidentPhoto>;
      taches: DbTable<Tache>;
      notes: DbTable<Note>;
      notifications: DbTable<Notification>;
      audit_log: DbTable<AuditLog>;
      checklist_modeles: DbTable<ChecklistModele>;
    };
    Views: { [_ in never]: never };
    Functions: {
      check_and_create_reservation: {
        Args: {
          p_logement_id: string;
          p_date_debut: string;
          p_date_fin: string;
          p_type: ReservationType;
          p_statut: ReservationStatut;
          p_expiration_at?: string | null;
          p_locataire_nom?: string;
          p_locataire_prenom?: string;
          p_locataire_email?: string | null;
          p_locataire_telephone?: string | null;
          p_locataire_adresse?: string | null;
          p_locataire_pays?: string | null;
          p_nb_personnes?: number;
          p_nb_adultes?: number | null;
          p_nb_enfants?: number | null;
          p_loyer_total?: number | null;
          p_notes?: string | null;
          p_created_by?: string | null;
          p_exclude_reservation_id?: string;
        };
        Returns: string;
      };
      check_and_create_blocage: {
        Args: {
          p_logement_id: string;
          p_date_debut: string;
          p_date_fin: string;
          p_motif: BlocageMotif;
          p_notes?: string | null;
          p_created_by?: string | null;
        };
        Returns: string;
      };
      update_reservation_dates: {
        Args: {
          p_reservation_id: string;
          p_date_debut: string;
          p_date_fin: string;
        };
        Returns: void;
      };
      cancel_tache: {
        Args: { p_tache_id: string };
        Returns: void;
      };
      reactivate_tache: {
        Args: { p_tache_id: string };
        Returns: void;
      };
      dismiss_notifications_for_entity: {
        Args: { p_type: string; p_entity_type: string; p_entity_id: string };
        Returns: void;
      };
    };
    Enums: {
      user_role: UserRole;
      reservation_type: ReservationType;
      reservation_statut: ReservationStatut;
      pipeline_statut: PipelineStatut;
      paiement_type: PaiementType;
      paiement_statut: PaiementStatut;
      paiement_method: PaiementMethod;
      document_type: DocumentType;
      edl_type: EdlType;
      edl_statut: EdlStatut;
      edl_item_etat: EdlItemEtat;
      incident_severite: IncidentSeverite;
      tache_type: TacheType;
      tache_statut: TacheStatut;
      notification_type: NotificationType;
      blocage_motif: BlocageMotif;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
