# README hero

Animated README hero: the app shows the verdict, then the "Rope" toggle drops WIP and raises throughput. Data: the fictional Northwind demo case (`examples/demo-crm`). Made with the Stageshow kit (MIT License, Copyright (c) 2026 Benji Taylor; see `STAGESHOW-LICENSE`).

| file | use |
|---|---|
| `src/GoalHero.tsx`, `src/goal-hero.css`, `src/index.tsx` | the scene (stageshow `Stage`, wide 1100×400, compact 358×296) |
| `record-frames.mjs` | steps the playground's virtual clock and saves one PNG per frame |
| `../screenshots/readme/hero.gif` | the loop (2200×802, 15 fps, 119 frames, ~7.9 s) |

## Rebuild

Needs a Stageshow folder (`STAGESHOW`), Node and ffmpeg.

```sh
S=$(mktemp -d) && cp -rL "$STAGESHOW"/. "$S" && (cd "$S" && npm install)
mkdir -p "$S/examples/goal-hero" && cp docs/hero/src/* "$S/examples/goal-hero/" && cp docs/hero/record-frames.mjs "$S/scripts/"
(cd "$S" && node node_modules/vite/bin/vite.js playground --config playground/vite.config.ts --port 5183 --strictPort &)
F=$(mktemp -d)
(cd "$S" && node scripts/record-frames.mjs http://127.0.0.1:5183 goal-hero "$F" 1100 140 4 2 400)
# Keep frames f0000-f0118: frame 119 matches frame 0.
mkdir "$F/loop" && cp "$F"/f00{0..9}?.png "$F"/f010?.png "$F"/f011[0-8].png "$F/loop/"
ffmpeg -framerate 15 -pattern_type glob -i "$F/loop/f*.png" -vf "palettegen=max_colors=128:stats_mode=diff" "$F/pal.png"
ffmpeg -framerate 15 -pattern_type glob -i "$F/loop/f*.png" -i "$F/pal.png" -lavfi "paletteuse=dither=none:diff_mode=rectangle" -loop 0 docs/screenshots/readme/hero.gif
```
