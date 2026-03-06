-- Migration 038 : renommer la clé JSONB can_mark_payment → paiement:mark_paid
-- dans public.users pour les utilisateurs qui auraient encore l'ancienne clé.
--
-- Note : la politique RLS "Paiements: cohote mark paid" existe déjà (migration 017)
-- et current_user_has_permission() lit bien depuis public.users (migration 022/029).
-- Les utilisateurs réels ont déjà la clé paiement:mark_paid ; cette migration
-- ne touche que les éventuels profils créés avec l'ancienne clé.
--
-- Le trigger restrict_user_self_updates bloque les UPDATE directs depuis le rôle
-- authenticated. On utilise ici une fonction SECURITY DEFINER jetable pour bypasser
-- le trigger (s'exécute en tant que postgres, propriétaire de la table).

SET search_path TO public;

CREATE OR REPLACE FUNCTION _migrate_rename_permission_key()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET permissions =
    (permissions - 'can_mark_payment')
    || jsonb_build_object(
         'paiement:mark_paid',
         (permissions ->> 'can_mark_payment')::boolean
       )
  WHERE permissions ? 'can_mark_payment';
END;
$$;

SELECT _migrate_rename_permission_key();

DROP FUNCTION _migrate_rename_permission_key();
