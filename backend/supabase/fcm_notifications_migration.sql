-- Fidelx Android FCM device registration.
-- Safe additive migration. Existing web-push subscriptions are untouched.
CREATE TABLE IF NOT EXISTS public.fcm_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform = 'android'),
  app_type TEXT NOT NULL DEFAULT 'customer' CHECK (app_type IN ('customer','vendor','rider')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fcm_device_tokens ADD COLUMN IF NOT EXISTS app_type TEXT;
ALTER TABLE public.fcm_device_tokens ADD COLUMN IF NOT EXISTS active BOOLEAN;
UPDATE public.fcm_device_tokens SET app_type = COALESCE(app_type, 'customer'), active = COALESCE(active, true);
ALTER TABLE public.fcm_device_tokens ALTER COLUMN app_type SET DEFAULT 'customer';
ALTER TABLE public.fcm_device_tokens ALTER COLUMN active SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_fcm_device_tokens_user_id ON public.fcm_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_device_tokens_app_type_active ON public.fcm_device_tokens(app_type, active);
ALTER TABLE public.fcm_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fcm_device_tokens_select_own ON public.fcm_device_tokens;
CREATE POLICY fcm_device_tokens_select_own ON public.fcm_device_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS fcm_device_tokens_insert_own ON public.fcm_device_tokens;
CREATE POLICY fcm_device_tokens_insert_own ON public.fcm_device_tokens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS fcm_device_tokens_update_own ON public.fcm_device_tokens;
CREATE POLICY fcm_device_tokens_update_own ON public.fcm_device_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS fcm_device_tokens_delete_own ON public.fcm_device_tokens;
CREATE POLICY fcm_device_tokens_delete_own ON public.fcm_device_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());
