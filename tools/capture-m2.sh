#!/usr/bin/env bash
# M2 screenshot set from the RUNNING game (real renders), for the report and
# the before/after comparison with docs/media/m2/before. Needs `npm start`.
# Output: docs/media/m2/after/*.jpg
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=docs/media/m2/after
mkdir -p "$OUT"
cap() { node tools/capture.mjs --jpeg --out "$OUT" "$@"; }

# Desktop 1920x1080: prologue while booting, finished page, menu, vessel choice, free check,
# the opening briefing, flight with the tutorial card, hangar, orbital base, pause, settings.
cap --early --fresh --size 1920x1080 --steps "wait:1100;shot:desktop-1920-prologue-booting;ready;wait:600;key:ArrowRight:60;wait:250;key:ArrowRight:60;wait:250;key:ArrowRight:60;wait:600;shot:desktop-1920-prologue-panel4;key:ArrowRight:60;wait:250;key:ArrowRight:60;wait:250;key:ArrowRight:60;wait:900;shot:desktop-1920-prologue-begin;key:Space:60;wait:2500;shot:desktop-1920-menu;key:Space:60;wait:2500;shot:desktop-1920-select;key:Space:60;wait:900;shot:desktop-1920-free-check;key:Space:60;wait:4500;shot:desktop-1920-briefing;key:Space:60;wait:2200;shot:desktop-1920-briefing-reply;key:Space:60;wait:2500;key:Space:60;wait:1200;shot:desktop-1920-flight-tutorial;down:KeyA;wait:1600;up:KeyA;wait:1500;shot:desktop-1920-flight-turn;key:KeyH:60;wait:2500;shot:desktop-1920-hangar;key:Backspace:60;wait:1500;key:KeyB:60;wait:2500;shot:desktop-1920-base;key:Backspace:60;wait:1500;key:KeyP:60;wait:900;shot:desktop-1920-pause;key:ArrowDown:60;key:ArrowDown:60;key:ArrowDown:60;key:ArrowDown:60;key:Space:60;wait:900;shot:desktop-1920-settings"
mv "$OUT/report.json" "$OUT/report-desktop-1920.json"
# Desktop 1280x720 with the developer performance report.
cap --fresh --url "http://127.0.0.1:5500/?perf=1" --size 1280x720 --steps "wait:1000;shot:desktop-1280-prologue;key:KeyX:60;key:ArrowRight:60;wait:200;key:ArrowRight:60;wait:200;key:ArrowRight:60;wait:200;key:ArrowRight:60;wait:200;key:ArrowRight:60;wait:200;key:ArrowRight:60;wait:600;key:Space:60;wait:2000;key:Space:60;wait:2500;shot:desktop-1280-select;key:Space:60;wait:700;key:Space:60;wait:5000;key:Space:60;wait:1800;key:Space:60;wait:1800;key:Space:60;wait:1800;key:Space:60;wait:1800;key:Space:60;wait:4000;shot:desktop-1280-flight-perf"
mv "$OUT/report.json" "$OUT/report-desktop-1280.json"
# Phone portrait 390x844 (touch): prologue panels, menu, vessel choice, flight with the tutorial, hangar.
cap --early --fresh --size 390x844 --touch --steps "wait:1100;shot:phone-portrait-prologue-1;ready;wait:500;tap:290,790;wait:300;tap:290,790;wait:400;shot:phone-portrait-prologue-3;tap:290,790;wait:250;tap:290,790;wait:250;tap:290,790;wait:250;tap:290,790;wait:600;shot:phone-portrait-prologue-7;tap:290,790;wait:2000;shot:phone-portrait-menu;tap:195,556;wait:2500;shot:phone-portrait-select;tap:195,742;wait:1200;shot:phone-portrait-free-check;tap:195,420;wait:4500;shot:phone-portrait-briefing;tap:300,780;wait:1800;tap:300,780;wait:1800;tap:300,780;wait:1500;shot:phone-portrait-flight-tutorial;tap:353,75;wait:900;tap:195,320;wait:2500;shot:phone-portrait-hangar"
mv "$OUT/report.json" "$OUT/report-phone-portrait.json"
# Small phone 360x800.
cap --early --fresh --size 360x800 --touch --steps "ready;wait:600;shot:phone-360-prologue;tap:280,94;wait:2000;shot:phone-360-menu;tap:180,527;wait:2500;shot:phone-360-select;tap:180,700;wait:1200;tap:180,400;wait:4500;tap:270,738;wait:1800;tap:270,738;wait:1800;tap:270,738;wait:1500;shot:phone-360-flight"
mv "$OUT/report.json" "$OUT/report-phone-360.json"
# Phone landscape 844x390 (touch).
cap --early --fresh --size 844x390 --touch --steps "wait:1100;shot:phone-landscape-prologue-1;ready;wait:500;tap:700,350;wait:300;tap:700,350;wait:400;shot:phone-landscape-prologue-3;tap:760,104;wait:2000;shot:phone-landscape-menu;tap:188,174;wait:2500;shot:phone-landscape-select;tap:542,342;wait:1200;tap:330,229;wait:4500;shot:phone-landscape-briefing;tap:640,330;wait:1800;tap:640,330;wait:1800;tap:640,330;wait:1500;shot:phone-landscape-flight-tutorial"
mv "$OUT/report.json" "$OUT/report-phone-landscape.json"
echo "done: $OUT"
