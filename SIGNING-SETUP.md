# Fidelx Android: signed release builds (one-time setup)

Files in this patch (copy into your repo, same paths):
- .github/workflows/android.yml
- scripts/prepare-android.sh

Until the secrets below exist, the workflow keeps building the debug APK exactly as before.

## 1. Create the keystore (once, on your computer)
Git Bash, in a folder OUTSIDE the repo (keytool comes with Android Studio's JDK or any installed JDK):

    keytool -genkeypair -v -keystore fidelx-release.jks -alias fidelx -keyalg RSA -keysize 2048 -validity 10000

- Choose ONE strong password and use it for both the keystore and the key (just press Enter if it asks to reuse it).
- Answer the name/organisation questions however you like.
- BACK UP fidelx-release.jks and the password somewhere safe (password manager + a second copy).
  If you lose them you can never publish an update signed the same way.
- NEVER commit the .jks file or the password to GitHub.

## 2. Turn the keystore into text
Git Bash, in that same folder:

    base64 -w0 fidelx-release.jks > fidelx-release.b64

Open fidelx-release.b64 and copy ALL of its contents.

## 3. Add four GitHub secrets
GitHub -> your repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Name                      | Value                                   |
|---------------------------|-----------------------------------------|
| FIDELX_KEYSTORE_BASE64    | the contents of fidelx-release.b64      |
| FIDELX_KEYSTORE_PASSWORD  | the password you chose                  |
| FIDELX_KEY_ALIAS          | fidelx                                  |
| FIDELX_KEY_PASSWORD       | the same password                       |

## 4. Run the build
Push to main (or Actions -> Build Fidelx Android -> Run workflow).
- Success: the artifact is named `fidelx-release-apk` (app-release.apk), versionCode = the run number.
- No secrets found: it builds `fidelx-debug-apk` as before.

## 5. Installing
Your phone currently has an APK signed with a different (debug) key. Uninstall the old app ONCE before installing the first release APK. After that, every release APK signed with this keystore installs over the previous one.

## If the release build fails
Open the failed step in the Actions log and send the last 30 lines (they contain no secrets).
