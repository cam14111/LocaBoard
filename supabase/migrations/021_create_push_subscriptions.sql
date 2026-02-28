-- Migration 021: Table des abonnements push (Web Push API / VAPID)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh_key text        NOT NULL,
  auth_key   text        NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour retrouver rapidement les subscriptions d'un utilisateur
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);

-- RLS : chaque utilisateur gère uniquement ses propres subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_push_subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
