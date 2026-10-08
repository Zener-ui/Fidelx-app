# Fidelx Android permissions fix

This build keeps the existing Fidelx web/API/auth/business logic unchanged.

The Android preparation step now declares the native permissions required by features that already exist in the web app:

- Location: ACCESS_COARSE_LOCATION + ACCESS_FINE_LOCATION
- Voice notes: RECORD_AUDIO
- Camera access: CAMERA
- Notifications: POST_NOTIFICATIONS (Android 13+)

These declarations do not automatically prompt the user on app launch. Android prompts when the corresponding feature requests access. The existing Fidelx location and microphone flows remain the callers of those permissions.
