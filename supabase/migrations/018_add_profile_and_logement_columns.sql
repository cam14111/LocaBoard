SET search_path TO public;

-- US3 : Ajout des colonnes adresse et siret sur la table users (profil hôte)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS siret text;

-- US4 : Ajout des colonnes enrichies sur la table logements
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS equipements text;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS forfait_menage_eur numeric(10,2) DEFAULT 0;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS charges_incluses text;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS animaux_autorises boolean NOT NULL DEFAULT false;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS animaux_types text;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS animaux_nb_max integer;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS animaux_taille_max text;
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS loyer_nuit_defaut numeric(10,2);
ALTER TABLE public.logements ADD COLUMN IF NOT EXISTS loyer_semaine_defaut numeric(10,2);
