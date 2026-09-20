# Architecture Overview: Artwork to Embroidery Engine

## 1. System Vision & Paradigm
The Artwork-to-Embroidery Engine is a browser-native, zero-cloud-dependency embroidery digitizer. It converts raster imagery (PNG, JPG, WebP) and vector paths (SVG) into industrial-grade commercial embroidery machine files (Tajima `.DST`, Melco `.EXP`) adhering to strict production quality standards.

```
 [Raster / Vector Input]
           │
           ▼
 [1. Ingestion & Color Quantization] ─── K-Means++ in CIELAB, Madeira 40wt Spools
           │
           ▼
 [2. Contour Tracing & Hierarchy]    ─── Marching Squares, RDP, Nested Hole Containment
           │
           ▼
 [3. Geometric Stitch Weaving]       ─── Satin Dual-Rail, 4-Row Twill, 3-Row Tatami
           │
           ▼
 [4. Branch Decomposition & Routing] ─── Canonical Forks/Merges, Interior Underlay Travel
           │
           ▼
 [5. Commercial Connector Optimizer] ─── Universal Auto-Trim (>5mm), Landing Anchor Tie-Ins
           │
           ▼
 [6. Binary Hardware Encoding]       ─── Tajima DST (Ternary Delta), Melco EXP
```

---

## 2. Core Architecture Pipeline

### Stage 1: Ingestion & Perceptual Color Quantization
- **Color Space:** Performs K-Means++ clustering exclusively in **CIE $L^*a^*b^*$ (CIELAB)** color space rather than sRGB. Euclidean distance in CIELAB mirrors human visual perception.
- **Background Filtering:** Automatically detects and strips transparent pixels (`alpha < 128`) and background canvas white (`RGB > 245`).
- **Die-Cut Sticker Filter:** `isStickerBorder` detects outer white shells ($\ge 85\%$ canvas dimension, $> 60\%$ cutout ratio) to prevent digitization of sticker backings.
- **Palette Mapping:** Quantized cluster centroids map to standard commercial embroidery thread libraries (**Madeira Polyneon 40wt**).

### Stage 2: Contour Tracing & Topological Hierarchy
- **Grid Contouring:** Marching Squares inspects quantized bitmap masks and traces boundary contours.
- **Spline Simplification:** Ramer-Douglas-Peucker (RDP) algorithm simplifies collinear pixel steps while retaining sharp corner definition ($\epsilon = 0.8\text{mm}$).
- **Nested Loop Hierarchy:** Uses area-sorted point-in-polygon containment (`evenodd` rule). Outer loops form `Polygon` boundaries; interior loops are assigned to `polygon.addHole(vertices)`.
- **Fringe Pruning:** Clusters with $< 1.5\%$ total foreground share are discarded to eliminate anti-aliasing edge halos.

### Stage 3: Geometric Stitch Weaving
- **Pull Compensation:** Perpendicular dilation offsets geometry along stitch angle ($\delta = +0.3\text{mm}$) to counteract column contraction from thread tension on woven fabrics.
- **Underlay Stabilization:** Automatically generates inset perimeter running stitches ($\text{offset} = -0.6\text{mm}$, step $2.5\text{mm}$) around outer perimeters and interior holes.
- **Stitch Weave Generators:**
  - **Running / Bean Stitch:** Single or triple-pass linear vector tracking.
  - **Satin Columns:** Dual-rail transverse stepping with adaptive density based on column curvature.
  - **Tatami Fill:** Parallel scanline fill with 3-row brick pattern (`stagger = 0.33`).
  - **Twill Weave:** 4-row diagonal twill weave (`stagger = 0.25`) for uniform sheen and structural integrity.
  - **Radial Satin:** $360^\circ$ angular ray-cast satin stepping with angle-adaptive density ($\Delta\theta$), concentric underlays, outward pull compensation, and feathered inner hub anti-perforation.
  - **Archimedean Spiral:** Pure single-line continuous spiral running fill ($r(\theta) = r_0 + \frac{d}{2\pi}\theta$) with strictly 0 internal jump stitches and $\le 3.5\text{mm}$ needle intervals.
  - **Curvilinear Meander / Stippling:** Continuous dual-harmonic sine undulation with strict polygon boundary clamping and smooth perimeter connector steps.

### Stage 4: Canonical Branch Partitioning & Spatial Routing
- **Canonical Branching:** Decomposes scanlines across bifurcated shapes (letters `U`, `M`, archways, multi-pointed stars) at true fork (1 segment $\to 2$) and merge (2 segments $\to 1$) points.
- **Direct Physical Continuation:** Sequencer prioritizes adjacent rows ($\Delta k \le 1$, overlapping $x$), generating continuous natural sweeps.
- **Interior Underlay & Centroid Routing:** When moving between branches within a solid shape, the engine tests line containment (`isSegmentInsidePolygon`). If internal, it routes running travel stitches along the underlay or spine. Zero air jumps or trims across star points.
- **Slanted Edge Connector Stitches:** Steps along contour edges ($\le 3.5\text{mm}$) are classified as continuous `STITCH`es, removing false jump vectors along tapering contours.

### Stage 5: Commercial Connector & Auto-Trim Optimization
- **Hardware Trims on Long Travels:** Every travel move $> 5.0\text{mm}$ is automatically bracketed:
  1. 4-point tie-off cross ($\pm 0.42\text{mm}$).
  2. Tajima 3-jump hardware TRIM sequence (`dx=0, dy=0, JUMP` $\times 3$).
  3. Non-stitching carriage displacement (`JUMP`).
  4. Landing anchor penetration (`STITCH` at destination coordinate).
  5. 4-point star tie-in cross ($\pm 0.42\text{mm}$).
- **Micro-Stitch Suppression:** Enforces minimum stitch length threshold ($\ge 0.35\text{mm}$) to prevent thread knots and needle breaks.

### Stage 6: Binary Hardware Encoding
- **Tajima DST:** 512-byte formatted header (design label, stitch count, coordinates) + 3-byte ternary record format:
  $$b_1, b_2, b_3 \in \{+1, -1, +3, -3, +9, -9, +27, -27, +81, -81\}$$
  supporting `STITCH`, `JUMP`, `COLOR_CHANGE`, and `END`.
- **Melco EXP:** 2-byte signed binary delta format with dedicated hardware escape flags.
- **Brother PES / PEC (`#PES0001` / `#PEC0001`):** 22-byte container header, embedded `#PEC0001` block, 64-color Brother palette mapping, 7-bit/12-bit signed displacements, and thumbnail graphics.
- **Janome JEF:** 116-byte fixed LE header with timestamp string, dynamic machine hoop fitting (`50x50` to `200x200`), inverted machine Y deltas, and 79-color thread chart.

---

## 3. Core Data Structures

```typescript
// Vector coordinate with full linear algebra support
class Point2D {
  x: number;
  y: number;
  distance(p: Point2D): number;
  rotate(rad: number, origin?: Point2D): Point2D;
  cross(p: Point2D): number;
}

// Closed boundary with nested hole and centroid support
class Polygon {
  vertices: Point2D[];
  holes: Point2D[][];
  bounds(): { minX: number, maxX: number, minY: number, maxY: number, width: number, height: number };
  centroid(): Point2D;
  containsPoint(p: Point2D): boolean;
  intersectScanline(scanY: number): [number, number][];
  offset(delta: number): Polygon;
  rotate(rad: number, origin?: Point2D): Polygon;
}

// Machine-ready needle penetration record
class StitchPoint {
  x: number;
  y: number;
  command: StitchCommand; // STITCH(0), JUMP(1), COLOR_CHANGE(2), END(3), TRIM(4)
  colorIndex: number;
}

// Consolidated spool layer for multi-polygon channels
class ColorLayer {
  id: string;
  name: string;
  hex: string;
  stitchType: StitchType;
  geometry: Polygon | Polygon[];
  params: StitchParams;
  getPolygons(): Polygon[];
}
```

---

## 4. Commercial Compliance Matrix

| Rule | Threshold | Engine Implementation |
| :--- | :--- | :--- |
| **TC-501 (Long Stitches)** | $\le 7.0\text{mm}$ | Subdivides moves $> 7.0\text{mm}$ into $\le 6.0\text{mm}$ sewing stitches. |
| **TC-502 (Travel Jumps)** | $\le 11.0\text{mm}$ ($12.1\text{mm}$ max) | Subdivides high-speed carriage jumps into safe ternary intervals. |
| **TC-503 (Micro-Stitches)** | $\ge 0.35\text{mm}$ | End-remainder pruning + 4-point lock arm clamping ($\ge 0.42\text{mm}$). |
| **TC-504 (Untrimmed Travel)** | $\le 5.0\text{mm}$ | Universal auto-trim pass injects 3-jump hardware trims on all moves $> 5.0\text{mm}$. |
| **TC-505 (Start Risk)** | Mandatory anchor | Destination coordinate drops initial anchor needle before 4-point tie-in. |
