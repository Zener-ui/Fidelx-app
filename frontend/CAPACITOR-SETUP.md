# Fidelx Capacitor Android setup

This frontend is prepared to use Capacitor 8 with Android.

## First local setup

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

For subsequent changes:

```bash
npm run cap:sync
```

The Android package ID is `com.fidelx.app`.
