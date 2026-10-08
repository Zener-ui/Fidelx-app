# Fidelx Android build

This project is configured to build the existing Fidelx Vite/React frontend as a Capacitor Android app.

- Existing Fidelx business, wallet, payment, API, and UI logic should remain unchanged.
- The Android project is generated during CI with `npx cap add android`.
- GitHub Actions performs the Android/Gradle work remotely, so the local machine does not need Android Studio just to produce the debug APK.
- Do not put Paystack or Supabase secrets in this repository or workflow.

## Build

1. Create a GitHub repository and upload this project.
2. Push the `main` branch.
3. Open Actions → Build Fidelx Android.
4. Download the `fidelx-debug-apk` artifact after the workflow succeeds.
