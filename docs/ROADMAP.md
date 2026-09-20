# Product & Engineering Roadmap

This document outlines the strategic roadmap and release milestones for the Artwork-to-Embroidery Engine.

---

## 🗺️ Milestone Summary

```
 Phase 1 & 2 (Complete) ──► Phase 3 (v1.5 Complete ──► v1.6 Next) ──► Phase 4 (v1.7 - v2.0) ──► Phase 5 (v3.0)
 • Core Geometry & Weave   • Multi-Format Exporters   • Radial & Spiral Weaves  • Typography Engine    • 3D Puff / Appliqué
 • CIELAB Quantization     • Brother .PES & Janome .JEF • Meander/Stippling Fill • Web Worker 4K        • Machine Fleet Sync
 • Auto-Trims & Anchors    • 135/135 Unit Tests       • Husqvarna .VP3 & Singer • Local ONNX AI SAM    • Web Serial Direct
 • Canonical Branching     • Crest Badge Demo Preset  • TrueType to Satin       • Thread Blending      • Live Telemetry
```

---

## ✅ Completed Milestones

### v1.5.0 (Current Release) — Radial, Spiral & Meander Weave Generators
- [x] **Radial Satin Weave (`src/stitches/radial.js`):** Center-out $360^\circ$ angular ray-casting for circular crests, badges, and flower petals. Features angle-adaptive density stepping ($\Delta\theta$), outward pull compensation, concentric running underlay, and feathered inner hub anti-perforation ($40\text{–}45\%$ radial depth staggering).
- [x] **Archimedean Spiral Fill (`src/stitches/radial.js`):** Continuous center-out single-line spiral running weave ($r(\theta) = r_0 + \frac{d}{2\pi}\theta$) with uniform needle intervals ($\le 3.5\text{mm}$), boundary polygon clipping, and strictly **0 internal jump stitches**.
- [x] **Curvilinear Meander / Stippling Fill (`src/stitches/meander.js`):** Continuous harmonic sine undulation ($y(x) = y_{\text{base}} + A \sin(\omega_1 x) + \frac{A}{3} \sin(\omega_2 x)$) with boundary containment clamping and smooth perimeter connector steps ($\le 3.5\text{mm}$).
- [x] **DigitizerEngine Integration (`src/engine.js`):** Native polygon area handling for `RADIAL_SATIN`, `SPIRAL`, and `MEANDER` across single-geometry and multi-polygon island layers with auto-trim bracketing.
- [x] **Studio UI & Demo Preset:** Added `#stitchTypeSelect` and `#importStitchType` dropdown options, and added `🏅 Crest Badge` 3-layer demo preset (`public/app.js` & `public/index.html`).
- [x] **Comprehensive Test Suite:** 135/135 unit and integration tests passing covering radial satin density, hub feathering, 0-jump spiral continuity, meander containment, and full multi-format export (DST, EXP, PES, JEF).

### v1.4.1 — Multi-Format Commercial Exporters
- [x] **Brother / Baby Lock (`.PES` v1 / `#PEC0001`):** Native `#PES0001` container with 22-byte header, embedded `#PEC0001` block, 64-color Brother thread palette mapping, 7-bit/12-bit signed delta encoding, color change opcodes, and blank icon blocks.
- [x] **Janome / Elna (`.JEF`):** 116-byte fixed LE header, timestamp string encoding, dynamic hoop selection (50x50, 110x110, 126x110, 140x200, 200x200), center-relative coordinate space, inverted machine Y deltas, and 79-color Janome thread chart matching.
- [x] **Engine Integration:** Added `engine.exportPes()` and `engine.exportJef()` methods.
- [x] **Studio Top-Bar UI:** Added one-click `.PES` and `.JEF` export buttons in `public/index.html` with reactive file download triggers in `public/app.js`.

---

## 🚀 Sub-Items for Next Release (v1.6 — Typography & Extended Exporters)

### 1. In-Canvas Typography & Satin Lettering Engine
- **Font-to-Satin Converter:** Ingest TrueType (`.ttf`) and OpenType (`.otf`) glyphs, extract bezier contours, dissect glyph centerlines into dual-rail guides, and synthesize clean satin columns.
- **Mitred & Overlapping Sharp Corners:** Automated corner cuts and under-lap calculation on acute vertices (`M`, `W`, `A`, `Z`) to prevent needle deflection and excessive thread buildup.
- **Auto-Kerning & Envelope Warping:** Bridge lettering along circular arcs, banners, and perspective envelopes.

### 2. Extended Exporter Formats
- **Husqvarna Viking (`.VP3` / `.VIP`):** Multi-hoop definitions, coordinate scaling, and compressed block encoding.
- **Singer (`.XXX`):** Consumer sewing machine binary protocol with hardware trim sequences.

---

## 🧠 Sub-Items for Subsequent Releases (v1.6 - v2.0)

### v1.6: In-Canvas Typography & Satin Lettering Engine
- **Font-to-Satin Converter:** Ingest TrueType (`.ttf`) and OpenType (`.otf`) glyphs, extract bezier contours, dissect glyph centerlines into dual-rail guides, and synthesize clean satin columns.
- **Mitred & Overlapping Sharp Corners:** Automated corner cuts and under-lap calculation on acute vertices (`M`, `W`, `A`, `Z`) to prevent needle deflection and excessive thread buildup.
- **Auto-Kerning & Envelope Warping:** Bridge lettering along circular arcs, banners, and perspective envelopes.

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
