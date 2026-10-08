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
  size="${spec##*:}"
  convert "$ICON" -resize "${size}x${size}" \
    "$RES_DIR/mipmap-$density/ic_launcher.png"
  cp "$RES_DIR/mipmap-$density/ic_launcher.png" \
     "$RES_DIR/mipmap-$density/ic_launcher_round.png"
done

echo "Fidelx Android launcher icons prepared."
