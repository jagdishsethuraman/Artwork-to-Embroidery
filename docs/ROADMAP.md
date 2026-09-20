# Product & Engineering Roadmap

This document outlines the strategic roadmap and future milestones for the Artwork-to-Embroidery Engine.

---

## 🗺️ Milestone Summary

```
 Phase 1 & 2 (Complete) ──► Phase 3 (Current Focus) ──► Phase 4 (Mid-Term) ──► Phase 5 (Long-Term)
 • Core Geometry & Weave   • Radial & Spiral Weaves    • Local ONNX AI SAM    • 3D Puff / Appliqué
 • CIELAB Quantization     • Web Worker Offloading     • Typography Engine     • Machine Fleet Sync
 • Auto-Trims & Anchors    • Multi-Format Exporters    • Thread Blending       • Web Serial Direct
 • Canonical Branching       (.PES, .JEF, .VP3)          (Photo-Stitch)          (Live Hardware)
```

---

## 🚀 Phase 3: Advanced Fill Geometry & Multi-Format Exporters (Target: v1.5 - v1.6)

### 1. Radial & Spiral Weave Generators
- **Curved / Radial Satin:** Implement center-out radial stepping for circular crests, badges, and flower petals.
- **Spiral Fill:** Logarithmic and Archimedean spiral running fills for circular shields and badges.
- **Meander / Stippling Fill:** Continuous non-crossing Hilbert or Voronoi meander paths for quilt underlay and background fills.

### 2. Multi-Format Exporter Suite
Expand beyond Tajima `.DST` and Melco `.EXP` to support the full ecosystem of domestic and commercial machines:
- **Brother / Baby Lock (`.PES` / `.PEC`):** Native multi-color headers, thread brand palettes, hoop definitions.
- **Janome / Elna (`.JEF`):** Little-endian coordinate encoding and hoop limit validation.
- **Husqvarna Viking (`.VP3` / `.VIP`):** Precise coordinate scaling and compression.
- **Singer (`.XXX`):** Standard consumer format support.

### 3. Web Worker Threading & UI Optimization
- **Background Ingestion Worker:** Offload K-Means++ clustering and Marching Squares contouring to a dedicated Web Worker to maintain 60fps UI responsiveness during 4K image uploads.
- **Wasm Acceleration:** Compile Clipper2 and heavy matrix math into WebAssembly for 10x throughput on complex graphics.

---

## 🧠 Phase 4: Local AI Segmentation & Typography Engine (Target: v2.0)

### 1. In-Browser On-Device AI Segmentation (MobileSAM / BiRefNet)
- **Local ONNX Runtime Web:** Run MobileSAM or BiRefNet locally via WebGPU/WASM for instant 1-click foreground extraction without sending images to external cloud APIs.
- **Interactive Prompting:** User clicks or box-draws on canvas to segment intricate foreground elements (e.g. isolating sports mascot from noisy background).

### 2. Commercial Typography & Lettering Engine
- **Font-to-Satin Converter:** Ingest TrueType (`.ttf`) and OpenType (`.otf`) glyphs, dissect glyph contours into dual-rail centerlines, and synthesize clean satin columns.
- **Automated Under-Lap & Corner Cuts:** Calculate mitred and overlapping corners on sharp vertices (`M`, `W`, `A`) to prevent excessive thread buildup and needle deflection.
- **Auto-Kerning & Envelope Warping:** Bridge text along circular arches, banners, and perspective envelopes.

### 3. Photo-Stitch & Thread Blending
- **CMYK / Thread Dithering:** Staggered multi-spool needle penetrations creating photographic skin tones and gradient blends.
- **Cross-Stitch Mode:** Automated pixel-to-cross conversion with simulated linen fabric backing.

---

## 🏭 Phase 5: Industrial Automation & Hardware Fleet Integration (Target: v3.0)

### 1. 3D Puffy Foam & Appliqué Automation
- **Puff Foam Mode:** Automated high-density satin caps with perforation needle cuts at column ends to cleanly slice 3D EVA craft foam.
- **Appliqué Workflow:** 3-step automated sequencing:
  1. Position placement run.
  2. Material tack-down stitch (with automatic machine stop).
  3. Final satin border cover with generous bite overlap.

### 2. Web Serial / WebUSB Direct Machine Link
- **Hardware Controller:** Direct driver via the browser Web Serial API to push DST streams directly into USB/Serial-connected machines (Happy, Tajima, Brother PR series).
- **Live Needle Telemetry:** Real-time feedback showing active stitch count, current speed (SPM), and thread break detection.

### 3. Realistic 3D Thread Texture & Fabric Draping Shader
- **Three.js / WebGL 2.0 PBR Shader:** Physically based rendering of twisted polyester threads with specular anisotropic reflections, metallic thread sparkle, and micro-shadowing between adjacent rows.
