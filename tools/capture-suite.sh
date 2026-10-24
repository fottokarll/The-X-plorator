#!/usr/bin/env bash
# Reproduces the documented screenshot set from the RUNNING game (real renders).
# Requires `npm start` in another terminal. Output: docs/media/m1/*.jpg
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=docs/media/m1
mkdir -p "$OUT"
cap() { node tools/capture.mjs --jpeg --fresh --out "$OUT" "$@"; }

# Desktop 1920x1080: menu, vessel select, flight, turn, hangar, base, map, pause, help.
cap --size 1920x1080 --steps "wait:5000;shot:desktop-1920-menu;key:Space:60;wait:2500;shot:desktop-1920-select;tap:1200,1000;wait:7000;shot:desktop-1920-flight;down:KeyA;wait:2200;up:KeyA;wait:900;shot:desktop-1920-turn;key:KeyH:60;wait:2500;shot:desktop-1920-hangar;key:Backspace:60;wait:1500;key:KeyB:60;wait:2500;shot:desktop-1920-base;key:Backspace:60;wait:1500;key:KeyM:60;wait:1500;shot:desktop-1920-map;key:Backspace:60;wait:1200;key:KeyP:60;wait:900;shot:desktop-1920-pause;fps:4000"
# Desktop 1280x720.
cap --size 1280x720 --steps "wait:5000;shot:desktop-1280-menu;key:Space:60;wait:2500;tap:800,668;wait:7000;shot:desktop-1280-flight;key:KeyH:60;wait:2500;shot:desktop-1280-hangar;fps:4000"
# Phone portrait 390x844 (touch).
cap --size 390x844 --touch --steps "wait:5000;shot:phone-portrait-menu;tap:195,618;wait:2500;shot:phone-portrait-select;tap:195,742;wait:7000;shot:phone-portrait-flight;drag:100,700,170,640,1600;wait:300;shot:phone-portrait-steer;tap:353,75;wait:900;shot:phone-portrait-pause;tap:195,320;wait:2500;shot:phone-portrait-hangar"
# Phone landscape 844x390 (touch).
cap --size 844x390 --touch --steps "wait:5000;shot:phone-landscape-menu;tap:188,174;wait:2500;shot:phone-landscape-select;tap:542,342;wait:7000;shot:phone-landscape-flight;drag:110,300,60,250,1500;wait:300;shot:phone-landscape-steer"
echo "done: $OUT"
