# Fidelx Android CORS fix

This patch fixes native Capacitor/WebView API access without changing Fidelx authentication, wallet, payment, database, or business logic.

## What changed

`backend/server.js` now:
- accepts the Capacitor localhost origins used by Android WebViews;
- accepts `http://localhost` and localhost ports as well as the existing HTTPS/Capacitor/Ionic localhost origins;
- normalizes a trailing slash on configured origins;
- keeps the localhost allowance narrowly scoped to localhost;
- no longer converts an unrecognised CORS origin into an Express 500 error.

The Android workflow and `VITE_API_URL` remain unchanged.
