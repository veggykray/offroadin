#!/usr/bin/env bash
# Keep the key review moments as PNG; convert the rest of the walkthrough captures to JPEG (q82) to keep the repo/ZIP small.
set -e
cd "$(dirname "$0")/.."
KEEP='00_start_screen|01_initial_view|04_cyan_bridge_ready|09_cat_above_1A|10_dog_white_below|13_lift_strong|15_reunion|19_plain_geometry_dev'
for d in evidence/desktop_1280x800 evidence/phone_780x360 evidence/phone_932x430; do
  [ -d "$d" ] || continue
  for f in "$d"/*.png; do
    b=$(basename "$f" .png)
    if echo "$b" | grep -Eq "^(r1_)?($KEEP)$"; then continue; fi
    convert "$f" -quality 82 "${f%.png}.jpg" && rm "$f"
    sed -i "s#$f#${f%.png}.jpg#" "$d/report.json"
  done
done
du -sh evidence
