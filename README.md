# Procedural Lava Web Demo (WebGL)
A single-page WebGL demo showcasing **fBm**, **Voronoi/Worley noise**, and **domain warping** to build a lava-like shader.

## Files
- `index.html` — UI + shaders + canvas
- `styles.css` — minimal styling
- `app.js` — WebGL plumbing + UI wiring

## How to run
Just open `index.html` in a modern browser. No build step, no dependencies.

## Controls
- **Mode**: switch between the composite lava and its building blocks (fBm, Voronoi, crack mask, warp).
- **Octaves / Lacunarity / Gain**: fBm spectrum controls.
- **fBm Scale**: spatial scale for the fBm field.
- **Voronoi Scale**: cell size.
- **Crack Width**: thickness of fissures from `F2 - F1`.
- **Warp Strength**: domain warp intensity (bends/advection).
- **Flow Speed**: animates UV panning to simulate convection flow.
- **Palette**: color mapping for lava.

## Notes
- The shader uses **value noise** for simplicity (fast and good-looking). You can swap in gradient or simplex noise if desired.
- Looping supports up to 8 octaves; extra octaves are gated by a uniform.
- The app is DPI-aware and resizes automatically.
