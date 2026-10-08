-- FCM reminder notifications (Customer Android app). ADDITIVE ONLY.
-- Creates 2 new tables + 5 pg_cron jobs. Does not touch notifications,
-- push_subscriptions, fcm_device_tokens, orders, or the existing trigger.
-- Review, then run in the Supabase SQL editor. Nothing sends until
-- FCM_PROMO_ENABLED=true is set on Render.

CREATE TABLE IF NOT EXISTS public.fcm_promo_optouts (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fcm_promo_log (
  id bigserial PRIMARY KEY,
  slot text NOT NULL,
  send_date date NOT NULL,
  sent int, failed int, invalid int, skipped_users int,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (slot, send_date)
);

-- Backend-only tables (service role), same pattern as push_subscriptions: RLS on, no policies.
ALTER TABLE public.fcm_promo_optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_promo_log ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_cron runs in UTC. Nigeria (WAT) = UTC+1. Times below are UTC.
--   breakfast 08:00 WAT | lunch 12:00 | afternoon 15:00 | dinner 18:30 | night 21:00
SELECT cron.schedule('fcm_promo_breakfast', '0 7 * * *',  $$SELECT net.http_post(url := 'https://fidelx-backend.onrender.com/api/push/fcm/promo-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Internal-Webhook-Secret', current_setting('app.settings.internal_webhook_secret', true)), body := '{"slot":"breakfast"}'::jsonb)$$);
SELECT cron.schedule('fcm_promo_lunch',     '0 11 * * *', $$SELECT net.http_post(url := 'https://fidelx-backend.onrender.com/api/push/fcm/promo-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Internal-Webhook-Secret', current_setting('app.settings.internal_webhook_secret', true)), body := '{"slot":"lunch"}'::jsonb)$$);
SELECT cron.schedule('fcm_promo_afternoon', '0 14 * * *', $$SELECT net.http_post(url := 'https://fidelx-backend.onrender.com/api/push/fcm/promo-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Internal-Webhook-Secret', current_setting('app.settings.internal_webhook_secret', true)), body := '{"slot":"afternoon"}'::jsonb)$$);
SELECT cron.schedule('fcm_promo_dinner',    '30 17 * * *', $$SELECT net.http_post(url := 'https://fidelx-backend.onrender.com/api/push/fcm/promo-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Internal-Webhook-Secret', current_setting('app.settings.internal_webhook_secret', true)), body := '{"slot":"dinner"}'::jsonb)$$);
SELECT cron.schedule('fcm_promo_night',     '0 20 * * *', $$SELECT net.http_post(url := 'https://fidelx-backend.onrender.com/api/push/fcm/promo-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Internal-Webhook-Secret', current_setting('app.settings.internal_webhook_secret', true)), body := '{"slot":"night"}'::jsonb)$$);

-- To stop all reminders instantly (any time):
--   SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'fcm_promo_%';
