# Product & Engineering Roadmap

This document outlines the strategic roadmap and release milestones for the Artwork-to-Embroidery Engine.

---

## 🗺️ Milestone Summary

```
 Phase 1 & 2 (Complete) ──► Phase 3 & 4 (v1.5 & v1.6 Complete) ──► Phase 5 (v1.7 - v1.8) ──► Phase 6 (v2.0 - v3.0)
 • Core Geometry & Weave   • Multi-Format Exporters (PES/JEF) • Web Worker 4K & Wasm • Local ONNX SAM AI
 • CIELAB Quantization     • Radial, Spiral & Meander Weaves • Extended Exporters     • 3D Puff / Appliqué
 • Auto-Trims & Anchors    • In-Canvas Typography & Lettering • Modern UI/UX Rehaul   • Web Serial Direct
 • Canonical Branching     • Draggable Layer Construction Seq • Studio Polish         • Live Telemetry
```

---

## ✅ Completed Milestones

### v1.7.0 (Current Release) — UI/UX Overhaul & Zero-Emoji Vector Icon System
- [x] **OLED Industrial Design System Tokens:** Configured dark theme palette (`#090d16` canvas, `#0f172a` surface), Doppelrand border insets, typography scales, and spring physics micro-interactions (`transform: scale(0.975)`).
- [x] **Comprehensive Zero-Emoji Vector Icon Library:** Replaced all emojis across entire UI with unified inline vector SVGs (1.75px stroke, rounded terminals, `currentColor`).
- [x] **Layer Visibility Toggling:** Non-destructive per-layer eye/eye-off toggle integrated into sequence manager and canvas render loop.
- [x] **160/160 Tests Passing:** Complete test suite passing with 0 regressions.

### v1.6.0 — Typography, Layer Sequencing & Non-Destructive Stitch Switching
- [x] **Non-Destructive Geometry Architecture (`src/stitches/types.js` & `src/engine.js`):** `ColorLayer.baseGeometry` stores pristine original vector contours. Switching layers back and forth between `TATAMI`, `SATIN`, `RUNNING`, `SPIRAL`, `MEANDER`, and `TWILL` derives new stitch representations without corrupting or degrading original shape volumes. Verified across 6-hop stress cycles.
- [x] **Draggable Layer Construction Sequencing (`public/app.js` & `public/index.html`):** Drag handles (`⠿`), direct HTML5 drag-and-drop, and `▲`/`▼` quick reorder buttons in `#layersContainer`. Directly controls `engine.layers` order, machine stitching construction sequence (underlay vs top details), and export color change stops. Full Undo/Redo support.
- [x] **In-Canvas Typography & Satin Lettering Engine (`src/typography/lettering.js`):** High-resolution canvas/bitmap vectorizer with inner hole detection (`A`, `B`, `O`), baseline arc warping ($-60^\circ$ to $+60^\circ$), auto-spacing, and instant satin/tatami layer generation.
- [x] **Multi-Polygon Island Satin Rail Compiler:** Automatically converts multi-polygon layers into arrays of dual-rail satin segments with inter-island tie-offs, hardware TRIMs, jumps, and tie-ins.
- [x] **Automated Test Suite:** 160/160 tests passing with 0 regressions.

### v1.5.0 — Radial, Spiral & Meander Weave Generators
- [x] **Radial Satin Weave (`src/stitches/radial.js`):** Center-out $360^\circ$ angular ray-casting for circular crests, badges, and flower petals. Features angle-adaptive density stepping ($\Delta\theta$), outward pull compensation, concentric running underlay, and feathered inner hub anti-perforation ($40\text{–}45\%$ radial depth staggering).
- [x] **Archimedean Spiral Fill (`src/stitches/radial.js`):** Continuous center-out single-line spiral running weave ($r(\theta) = r_0 + \frac{d}{2\pi}\theta$) with uniform needle intervals ($\le 3.5\text{mm}$), boundary polygon clipping, and strictly **0 internal jump stitches**.
- [x] **Curvilinear Meander / Stippling Fill (`src/stitches/meander.js`):** Continuous harmonic sine undulation ($y(x) = y_{\text{base}} + A \sin(\omega_1 x) + \frac{A}{3} \sin(\omega_2 x)$) with boundary containment clamping and smooth perimeter connector steps ($\le 3.5\text{mm}$).
- [x] **DigitizerEngine Integration (`src/engine.js`):** Native polygon area handling for `RADIAL_SATIN`, `SPIRAL`, and `MEANDER` across single-geometry and multi-polygon island layers with auto-trim bracketing.
- [x] **Studio UI & Demo Preset:** Added `#stitchTypeSelect` and `#importStitchType` dropdown options, and added `🏅 Crest Badge` 3-layer demo preset (`public/app.js` & `public/index.html`).

### v1.4.1 — Multi-Format Commercial Exporters
- [x] **Brother / Baby Lock (`.PES` v1 / `#PEC0001`):** Native `#PES0001` container with 22-byte header, embedded `#PEC0001` block, 64-color Brother thread palette mapping, 7-bit/12-bit signed delta encoding, color change opcodes, and blank icon blocks.
- [x] **Janome / Elna (`.JEF`):** 116-byte fixed LE header, timestamp string encoding, dynamic hoop selection (50x50, 110x110, 126x110, 140x200, 200x200), center-relative coordinate space, inverted machine Y deltas, and 79-color Janome thread chart matching.
- [x] **Engine Integration:** Added `engine.exportPes()` and `engine.exportJef()` methods.
- [x] **Studio Top-Bar UI:** Added one-click `.PES` and `.JEF` export buttons in `public/index.html` with reactive file download triggers in `public/app.js`.

---

## 🚀 Sub-Items for Next Release (v1.7 — Performance & Extended Exporters)

### 1. Performance Offloading & 4K Ingestion Pipeline
- **Web Worker Threading:** Offload K-Means++ clustering and Marching Squares contour extraction to a background Web Worker to preserve 60fps UI responsiveness during 4K artwork uploads.
- **Wasm Geometry Acceleration:** Compile Clipper2 and heavy matrix math into WebAssembly for 10x throughput on intricate vector files.

### 2. Extended Commercial Exporter Formats
- **Husqvarna Viking (`.VP3` / `.VIP`):** Multi-hoop definitions, coordinate scaling, and compressed block encoding.
- **Singer (`.XXX`):** Consumer sewing machine binary protocol with hardware trim sequences.

---

## 🎨 Sub-Items for Subsequent Releases (v1.8 - v2.0)

### v1.8: Modern UI/UX Rehaul & Design Studio Polish
- **Studio Aesthetics & Design System:** High-end agency visual polish aligned with user persona (clean Swiss typography, subtle borders, high contrast dark canvas, refined glassmorphic control panels).
- **Interactive Stitch Timeline Player:** Scrubbing progress bar, variable playback speed (1x to 100x), active thread color indicators, and live virtual needle simulation.
- **Visual Layer Stack Inspector:** Rich thumbnail previews for each layer, solo/mute toggles, lock layer, and double-click to center/zoom canvas viewport on layer bounds.
- **In-Canvas Transform Gizmos:** Interactive bounding box handles directly on canvas for smooth translation, uniform/free scaling, and rotation.
- **Collapsible Responsive Workspace:** Multi-monitor and tablet-ready layout with docking/collapsible panels and floating property inspectors.

### v1.7: Performance Offloading & 4K Ingestion Pipeline
- **Web Worker Threading:** Offload K-Means++ clustering and Marching Squares contour extraction to a background Web Worker to preserve 60fps UI responsiveness during 4K artwork uploads.
- **Wasm Geometry Acceleration:** Compile Clipper2 and heavy matrix math into WebAssembly for 10x throughput on intricate vector files.

### v2.0: Local On-Device AI Segmentation (MobileSAM / BiRefNet)
- **In-Browser ONNX Runtime Web:** Run MobileSAM or BiRefNet locally via WebGPU/WASM for instant 1-click foreground extraction without external server latency or cloud API costs.
- **Interactive Point & Box Prompts:** Click or drag bounding boxes directly on the canvas to segment intricate foreground artwork.
- **Photo-Stitch CMYK Thread Dithering:** Staggered multi-spool needle penetrations creating realistic photographic skin tones and gradient blends.

---

## 🏭 Sub-Items for Long-Term Releases (v3.0)

### 1. 3D Puffy Foam & Appliqué Automation
- **Puff Foam Mode:** Automated high-density satin caps with perforation needle cuts at column ends to cleanly slice 3D EVA craft foam.
- **Appliqué Workflow:** 3-step automated sequencing:
  1. Position placement run.
  2. Material tack-down stitch (with automatic machine stop).
  3. Final satin border cover with generous bite overlap.

### 2. Web Serial / WebUSB Direct Machine Link
- **Hardware Controller:** Direct streaming via browser Web Serial API to push DST streams directly into USB/Serial-connected commercial embroidery machines (Happy, Tajima, Brother PR series).
- **Live Needle Telemetry:** Real-time feedback showing active stitch count, current speed (SPM), and thread break alerts.

### 3. Realistic 3D Thread Texture & Fabric Draping Shader
- **Three.js / WebGL 2.0 PBR Shader:** Physically based rendering of twisted polyester threads with specular anisotropic reflections, metallic thread sparkle, and micro-shadowing between adjacent rows.
