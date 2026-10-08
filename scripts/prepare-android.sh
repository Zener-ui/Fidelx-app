#!/usr/bin/env bash
set -euo pipefail

RES_DIR="frontend/android/app/src/main/res"
ICON="frontend/public/pwa-512x512.png"

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
