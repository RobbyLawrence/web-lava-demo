# Procedural Lava Demo — Techniques & Rationale (summary.md)

This document explains the ideas behind each file in the demo and the shader techniques used to synthesize a convincing lava surface with **fBm**, **Voronoi/Worley noise**, and **domain warping**.

---

## File-by-file overview

### `index.html`
- **Single-file shaders in `<script>` tags**: Keeps the demo dependency-free; the fragment shader is easy to tweak without a build step.
- **Fullscreen quad pipeline**: The vertex shader passes through clip-space positions for two triangles; the fragment shader does all the heavy lifting (raymarch-like pattern generation without geometry).
- **UI controls (semantic)**:
  - Mode selector toggles between *Lava*, *fBm*, *Voronoi (F1)*, *Crack mask (F2–F1)*, and *Warp debug* to expose each building block.
  - Ranged sliders for **Octaves**, **Lacunarity**, **Gain**, **fBm Scale**, **Voronoi Scale**, **Crack Width**, **Warp Strength**, **Flow Speed**; labels show live values.
  - **Palette** switch: color mapping can dramatically change perceived material.
- **Canvas-first layout**: The canvas fills available space; the right-side panel is an `aside` with minimal controls and tips.
- **No external frameworks**: Pure WebGL + vanilla JS for clarity and portability.

### `styles.css`
- **Dark, unobtrusive UI** to avoid contaminating perceived color of the emissive shader.
- **CSS Grid layout**: `1fr 360px` allocates a persistent controls column; collapses to a stacked layout under 960px.
- **DPI-aware typography**: Small, legible labels; muted body color to keep focus on the canvas.
- **Minimalism**: Soft borders, subtle gradients; no heavy box-shadows that could distract from the glow.

### `app.js`
- **WebGL setup**:
  - Compiles and links the shaders embedded in `index.html`.
  - Creates a single VBO containing a fullscreen triangle pair (two triangles) covering NDC, minimizing draw overhead.
- **Hi-DPI & resize**:
  - Uses `ResizeObserver` and device pixel ratio clamped to ≤2 for performance; resizes viewport and updates `iResolution`.
- **Uniform plumbing**:
  - Reads UI values every frame and updates uniforms: spectrum controls (octaves, lacunarity, gain), spatial scales, warp strength, flow speed, palette, and mode.
- **Animation loop**:
  - `requestAnimationFrame` drives time uniform `iTime`.
  - Screenshot button leverages `toDataURL`; Fullscreen toggles the document root.
- **Robustness**:
  - Shader compile/link errors are printed to console with source for quick iteration.
  - Stateless render: everything recomputed each frame; no textures or FBOs required.

### Shaders (embedded in `index.html`)

#### Vertex Shader
- **Pass-through quad**: Emits clip-space positions and a UV derived from them: `vUV = (aPos + 1.0)*0.5`. No projection matrices needed.

#### Fragment Shader — Key Techniques

1. **Coordinate conventions**
   - Normalizes UVs so that 1 shader unit equals `min(width, height)` in pixels to keep isotropy across aspect ratios.
   - Adds a small **advection vector** from `uFlowSpeed` so the material subtly drifts even when the warp is zero.

2. **Noise choice: value noise**
   - Implements a smooth **value noise** with cubic smoothing to keep the demo simple and fast. Any gradient/simplex noise could be swapped in with the same fBm scaffolding.
   - **Antialiasing hint**: Rather than using `fwidth` for exact octave rolloff, the implementation fades detail implicitly by gain and limited octaves (good tradeoff for a single-pass demo).

3. **fBm (fractal Brownian motion)**
   - Summation of noise across octaves: frequency multiplied by **lacunarity**, amplitude multiplied by **gain**.
   - Up to 8 unrolled iterations with a runtime mask `float(i < octaves)` to keep the loop GPU-friendly while letting the UI change octaves.
   - Two uses:
     - **Large-scale convection** (`nBig`) for primary hot pools.
     - **Secondary detail** (`nDetail`) for surface richness.
   - A third use provides **domain warp channels** (see below).

4. **Voronoi / Worley noise**
   - Computes **F1** and **F2** (nearest and second-nearest feature point distances) within a 3×3 neighborhood.
   - **Crack mask**: `smoothstep(uCrackWidth, 0.0, F2 - F1)` yields thin bright lines near cell borders; used to **darken** emissive color to mimic cooling crust seams.
   - **Cell interior**: `1 - F1` acts like a soft distance-to-center field for shaping lava *islands* when blended into the heat field.

5. **Domain warping**
   - Builds a 2D warp vector from **two low-frequency fBm channels**, decorrelated via constant offsets and opposite time panning.
   - The warp bends both the fBm and Voronoi sample coordinates: `pV = (uv + adv + w)*uVoroScale`.
   - Perceptual effect: eliminates linear UV artifacts and creates *advection-like* motion without fluid simulation.
   - **Control**: `uWarpStrength` scales the warp magnitude; `uFlowSpeed` independently pans base coordinates to simulate bulk flow.

6. **Heat field composition**
   - `heat = clamp(nBig + 0.6*nDetail + (1.0 - F1)*0.4 - cracks*0.5, 0.0, 1.0);`
     - **Convection blobs** dominate (`nBig`).
     - **Detail** modulates (`nDetail`).
     - **Voronoi centers** add bulging hot regions (`1 - F1`).
     - **Cracks** subtract to carve dark, cool seams.
   - The combined scalar field is then mapped through a **palette** and used for **emissive** shading.

7. **Color mapping & emissive look**
   - Three palettes:
     - **Classic Lava**: black→red→orange→yellow with a hot-core shoulder.
     - **Magma**: darker, red-biased, more subdued glow.
     - **Grayscale**: diagnostic.
   - **Pseudo-bloom**: adds `emiss = pow(heat, 3.2)` into the color for a screen-space lift. True bloom would require a multi-pass blur; this is a cheap stand-in.
   - **Crack darkening**: `mix(col, col*0.25, cracks)` sells the cooled crust.

8. **Performance considerations**
   - **Octave gating** avoids branches that cause loop divergence by using arithmetic masks.
   - **No dependent texture reads** keeps the fragment shader ALU-bound but cache-friendly.
   - **DPR clamp** in JS limits GPU workload on 4k/retina while remaining crisp.
   - Single draw call per frame; no uniforms change across batches.

---

## Design decisions & trade-offs

- **Value noise vs. simplex/gradient noise**: Value noise is inexpensive and artifact-free after smoothing. For production, simplex or domain-rotated gradient noise can reduce directional bias at high frequencies.
- **Antialiasing vs. clarity**: We avoided `fwidth`-based octave culling to keep the shader succinct. If you observe shimmer at glancing angles or during rapid motion, add derivative-aware attenuation per octave.
- **One-pass pseudo-bloom**: Real glow generally needs multiple passes and thresholded blurs. Here we add a non-linear lift to the emissive term; it’s cheap and good enough for a demo.
- **Crack modeling**: Using `F2 - F1` produces stable ridge lines at cell borders. Alternative: use **Voronoi edges from a distance metric mix (L1/L2)** or compute a cell-ID gradient and threshold its magnitude for more stylized fissures.
- **Warp separation**: Using two decorrelated noise channels prevents warp vectors collapsing to a scalar field, which would elongate features along a single axis.
- **Aspect invariance**: Normalizing by `min(width, height)` prevents feature stretching on ultra-wide screens.

---

## Extensions you might add

1. **Heat haze/refraction**: Add a screen-space post-process that offsets background UVs by a high-frequency noise field modulated by `heat`.
2. **Normal mapping**: Derive pseudo-normals from `∇heat` or a secondary noise to feed into a simple Lambert/Phong for specular ripples.
3. **True bloom**: Downsample → threshold → separable blur → add back (requires FBOs and an extra pass).
4. **Tileable domains**: Replace UVs with torus coordinates for seamless tiling (good for game textures); or use periodic noise.
5. **Palette authoring**: Expose a 1D LUT texture so artists can paint the ramp.
6. **Anisotropic warping**: Use a 2×2 Jacobian built from two gradients to create directional flow reminiscent of river-like advection.
7. **Performance knobs**: Dynamic octave reduction based on `fwidth`, or time-based resolution scaling on mobile.
8. **Physics-adjacent drift**: Drive advection from a curl-noise field to mimic incompressible flow.

---

## Gotchas & debugging tips

- **Shader compile errors**: The JS logs GLSL errors with full sources; check for precision qualifiers and typos in uniform names.
- **Precision issues on mobile**: If banding appears, raise precision to `highp` in the fragment shader (already specified), or dither the final color slightly.
- **UI range sanity**: Extreme values (e.g., `Warp Strength = 1`) can fold patterns; keep within the provided ranges for stable visuals.
- **Driver differences**: Some older GPUs dislike loops with non-constant bounds; we unroll to 8 and mask to avoid that.

---

## Quick mental model

- **fBm** gives you *continuous turbulence* at multiple scales.
- **Voronoi** gives you *discrete structure*—crust tiles and crack lines.
- **Domain warping** makes everything *flow* and look organic.
- Combine them into a **heat field**, map through a **palette**, and accent with an **emissive lift** and **crack darkening**.

---

Happy hacking! Feel free to adapt this into a material function in your engine of choice.
