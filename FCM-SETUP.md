# Fidelx customer Android — FCM setup

This build is configured for the customer Android app (`com.fidelx.app`).

## Included
- Firebase `google-services.json` for the Fidelx Firebase Android app.
- Capacitor Push Notifications plugin.
- Android FCM registration and order/promotion notification channels.
- Customer-only registration behavior for the native customer build.
- Persistent local Fidelx login session for the native app.
- GitHub Actions Android debug build with `VITE_APP_ROLE=customer` and the live Fidelx API URL.
- Existing Android CORS fix.

## Database safety
The FCM database migration is intentionally isolated in:
`backend/supabase/fcm_notifications_migration.sql`

It creates/updates only `public.fcm_device_tokens` and its policies/indexes. Do not run any other migration as part of this Android FCM setup.

The migration is NOT automatically executed by the Android build.

## Important
The Firebase client configuration is not a server secret. Never commit a Firebase service-account private key. A Firebase Admin service-account credential, if needed later for server-side FCM sending, belongs only in the backend host's secret environment variables.
