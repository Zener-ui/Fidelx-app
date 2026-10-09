#!/usr/bin/env bash
set -euo pipefail

RES_DIR="frontend/android/app/src/main/res"
ICON="frontend/public/pwa-512x512.png"
FIREBASE_JSON="frontend/google-services.json"

if [[ ! -f "$FIREBASE_JSON" ]]; then
  echo "Missing Firebase config: $FIREBASE_JSON" >&2
  exit 1
fi

cp "$FIREBASE_JSON" frontend/android/app/google-services.json
echo "Firebase google-services.json copied into Android app module."

if [[ ! -f "$ICON" ]]; then
  echo "Missing Fidelx icon: $ICON" >&2
  exit 1
fi

mkdir -p "$RES_DIR"/mipmap-mdpi "$RES_DIR"/mipmap-hdpi "$RES_DIR"/mipmap-xhdpi "$RES_DIR"/mipmap-xxhdpi "$RES_DIR"/mipmap-xxxhdpi

rm -f "$RES_DIR"/mipmap-anydpi-v26/ic_launcher.xml "$RES_DIR"/mipmap-anydpi-v26/ic_launcher_round.xml
rm -f "$RES_DIR"/mipmap-anydpi-v26/ic_launcher_foreground.xml "$RES_DIR"/mipmap-anydpi-v26/ic_launcher_background.xml

for spec in \
  "mdpi:48" \
  "hdpi:72" \
  "xhdpi:96" \
  "xxhdpi:144" \
  "xxxhdpi:192"; do
  density="${spec%%:*}"
  # Keep the source PNG intact and let Android scale it for each density.
  # This avoids requiring ImageMagick/ImageMagick `convert` on the GitHub runner.
  cp "$ICON" "$RES_DIR/mipmap-$density/ic_launcher.png"
  cp "$ICON" "$RES_DIR/mipmap-$density/ic_launcher_round.png"
done

echo "Fidelx Android launcher icons prepared."

# Capacitor generates the Android project during the workflow. Wire the
# Google Services Gradle plugin into that generated project so Firebase
# reads google-services.json and initializes FCM correctly.
ROOT_GRADLE="frontend/android/build.gradle"
APP_GRADLE="frontend/android/app/build.gradle"
if [[ -f "$ROOT_GRADLE" && -f "$APP_GRADLE" ]]; then
  if ! grep -q "com.google.gms:google-services" "$ROOT_GRADLE"; then
    python3 - "$ROOT_GRADLE" <<'PYGRADLE'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
needle='dependencies {'
if needle not in s:
    raise SystemExit('Gradle dependencies block not found')
s=s.replace(needle, needle + "\n        classpath 'com.google.gms:google-services:4.4.2'", 1)
p.write_text(s)
PYGRADLE
  fi
  if ! grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
    printf '\napply plugin: "com.google.gms.google-services"\n' >> "$APP_GRADLE"
  fi
fi

# Capacitor's WebView-backed browser APIs need the corresponding Android
# runtime permissions declared in the generated native app. These are
# declared here because `npx cap add android` recreates the android/ folder
# during the GitHub build.
MANIFEST="frontend/android/app/src/main/AndroidManifest.xml"
python3 - "$MANIFEST" <<'PYMANIFEST'
from pathlib import Path
import sys

path = Path(sys.argv[1])
s = path.read_text()
permissions = [
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.RECORD_AUDIO',
    'android.permission.CAMERA',
    'android.permission.POST_NOTIFICATIONS',
]
marker = '<uses-permission android:name="{}" />'
for permission in permissions:
    line = marker.format(permission)
    if line not in s:
        s = s.replace('<application', f'{line}\
    <application', 1)
path.write_text(s)
print('Fidelx Android runtime permissions declared:', ', '.join(permissions))
PYMANIFEST

# ---------------------------------------------------------------------------
# Release signing + version code.
#
# `npx cap add android` regenerates the android/ folder on every CI run, so
# signing has to be injected here. Without a permanent keystore, every build
# is signed with a fresh debug key: Android then flags the APK as unknown and
# refuses to install it over the previous version.
#
# Only active when the workflow provides FIDELX_KEYSTORE_PATH (decoded from the
# FIDELX_KEYSTORE_BASE64 GitHub secret). With no secrets, nothing changes and
# the workflow falls back to the debug build.
# ---------------------------------------------------------------------------
if [[ -n "${FIDELX_KEYSTORE_PATH:-}" && -f "$APP_GRADLE" ]]; then
  python3 - "$APP_GRADLE" <<'PYSIGN'
from pathlib import Path
import os, re, sys

p = Path(sys.argv[1])
s = p.read_text()

if "signingConfigs.release" not in s:
    block = (
        "    signingConfigs {\n"
        "        release {\n"
        "            storeFile file(System.getenv('FIDELX_KEYSTORE_PATH'))\n"
        "            storePassword System.getenv('FIDELX_KEYSTORE_PASSWORD')\n"
        "            keyAlias System.getenv('FIDELX_KEY_ALIAS')\n"
        "            keyPassword System.getenv('FIDELX_KEY_PASSWORD')\n"
        "        }\n"
        "    }\n"
    )
    i = s.find("buildTypes {")
    if i == -1:
        raise SystemExit("buildTypes block not found in app/build.gradle")
    s = s[:i] + block + "    " + s[i:]
    j = s.find("release {", s.find("buildTypes {"))
    if j == -1:
        raise SystemExit("release build type not found in app/build.gradle")
    k = s.find("{", j) + 1
    s = s[:k] + "\n            signingConfig signingConfigs.release" + s[k:]

code = os.environ.get("FIDELX_VERSION_CODE", "").strip()
if code.isdigit():
    s, n = re.subn(r"versionCode\s+\d+", "versionCode " + code, s, count=1)
    print("versionCode set to", code if n else "(not found, unchanged)")

p.write_text(s)
print("Release signing configured for the Fidelx Android build.")
PYSIGN
fi
