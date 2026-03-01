-- Migration 030 : Autoriser le co-hôte à insérer des documents CONTRAT
-- Le co-hôte peut désormais générer et sauvegarder un contrat (type CONTRAT).
-- Note : la policy CONCIERGE n'est pas recréée ici car la valeur 'CONCIERGE'
--        n'est pas encore présente dans l'enum user_role du live DB.

DROP POLICY IF EXISTS "Documents: cohote ou concierge insert edl" ON documents;
DROP POLICY IF EXISTS "Documents: cohote insert edl" ON documents;

-- Co-hôte : peut insérer EDL et CONTRAT
CREATE POLICY "Documents: cohote insert edl ou contrat" ON documents
  FOR INSERT WITH CHECK (
    get_user_role() = 'COHOTE'
    AND type IN ('EDL', 'CONTRAT')
  );
