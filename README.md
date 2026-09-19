# 🧵 EmbroideryTrace AI Engine

> Browser-first AI embroidery digitizing engine: SVG & vector geometry to Satin, Tatami, Twill, and Tajima `.DST` / Melco `.EXP` machine files.

Reverse-engineered and enhanced from [EmbroideryTrace](https://embroiderytrace.com/).

---

## ⚡ Quick Start

Zero external dependencies. Pure native ES2022.

```bash
# 1. Run Automated Test Suite (48/48 tests passing)
npm test

# 2. Launch Interactive Studio
npm start
# -> Open http://localhost:3456 in your browser
```

---

## 📐 Mathematical Models Implemented

### 1. Dual-Rail Satin Stitch (`src/stitches/satin.js`)
* **Rails:** Two boundary splines $\mathbf{r}_1(u), \mathbf{r}_2(u)$ parameterized by normalized arc-length $u \in [0, 1]$.
* **Needle Point Zigzag:** Alternating sequence $\mathbf{r}_1(u_i) \to \mathbf{r}_2(u_i) \to \mathbf{r}_1(u_{i+1}) \to \dots$
* **Pull Compensation:** Normal vectors offset outward by $+0.3\text{mm}$ to prevent fabric puckering:
  $$\mathbf{r}^*(u) = \mathbf{r}(u) + \delta_{\text{pull}} \cdot \hat{\mathbf{n}}(u)$$
* **Underlay:** Central running line ("center-walk") laid down before the top cover.

### 2. Tatami & Twill Scanline Fill (`src/stitches/tatami.js`)
* **Coordinate Alignment:** Rotates polygon by $-\theta$ (user stitch angle).
* **Scanline Intersections:** Clips horizontal rays against polygon boundaries at row density $0.4\text{mm}$.
* **Twill Stagger Offset:** Shifts needle penetrations row-by-row using:
  $$\Delta_{\text{offset}}(k) = ((k \cdot \text{stagger}) \pmod 1) \cdot L_{\text{stitch}}$$
  *(e.g., $0.25$ produces a 4-step twill weave, avoiding fabric tear lines).*
* **Serpentine Traversal:** Alternates row directions (left-to-right, then right-to-left) to minimize jump stitches.

### 3. Tajima DST Machine Binary Exporter (`src/formats/dst.js`)
* **Header:** 512-byte ASCII header with design label, stitch counts, coordinate bounding box, and `0x1A` EOF marker.
* **Coordinate Encoding:** 3-byte ternary delta encoding ($\Delta x, \Delta y \in [-121, 121]$ in $0.1\text{mm}$ units).
* **Multi-Jump Chunking:** Displacements $>12.1\text{mm}$ are automatically chunked into sequences of valid machine jump commands.
* **Decoder:** Full round-trip binary verification decoder (`readDst`).

### 4. Interactive Knife / Split Tool (`src/geometry/slicer.js`)
* Directly implements the competitor's Split tool.
* Slices wide polygons along a cut line into separate sub-polygons for individual satin rail assignment.

---

## 🏗️ Architecture Directory

```
embroidery-trace-engine/
├── package.json
├── server.js                  # Zero-dependency local dev server
├── src/
│   ├── engine.js              # Unified DigitizerEngine
│   ├── geometry/
│   │   ├── point.js           # 2D Point & polyline math
│   │   ├── polygon.js         # Point-in-poly & scanline clipping
│   │   └── slicer.js          # Knife cut polygon slicer
│   ├── stitches/
│   │   ├── types.js           # Command enums & ColorLayer models
│   │   ├── running.js         # Running & Bean triple stitch
│   │   ├── satin.js           # Dual-rail satin with pull comp
│   │   └── tatami.js          # Twill & Tatami scanline fill
│   ├── formats/
│   │   ├── dst.js             # Tajima DST binary encoder & decoder
│   │   └── exp.js             # Melco EXP binary exporter
│   └── svg/
│       └── svg-parser.js      # SVG path 'd' parser & spline sampler
├── test/
│   └── run-all-tests.js       # 48-point test suite
└── public/
    ├── index.html             # Studio UI (Slate dark mode Bento)
    └── app.js                 # Realistic thread canvas & playback
```
