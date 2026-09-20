# Changelog

All notable changes to the Artwork-to-Embroidery Engine are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.1] - 2026-09-20

### Added
- **Brother .PES / .PEC Exporter (`src/formats/pes.js`):** Native `#PES0001` container with embedded `#PEC0001` block. Implements 7-bit signed displacements, 12-bit signed jump escapes, color stop opcodes, and blank thumbnail icon blocks.
- **Brother 64-Color Thread Palette:** Built-in standard Brother embroidery color chart with nearest-color perceptual mapping for Madeira spools and arbitrary hex colors.
- **Janome .JEF Exporter (`src/formats/jef.js`):** 116-byte fixed LE header with timestamp, dynamic hoop selection (`50x50`, `110x110`, `126x110`, `140x200`, `200x200`), center-relative coordinate space, and inverted machine Y stitch deltas.
- **Janome 79-Color Thread Palette:** Built-in Janome thread chart with nearest-color matching.
- **DigitizerEngine API Methods:** Added `engine.exportPes(label)` and `engine.exportJef(label)`.
- **Studio UI Export Buttons:** Added one-click `.PES (Brother)` and `.JEF (Janome)` download buttons in top navigation bar (`public/index.html` & `public/app.js`).
- **Comprehensive Unit Tests:** Added 25 automated round-trip encode/decode tests in `test/run-all-tests.js` (total 120/120 tests passing).

---

## [1.4.0] - 2026-09-20

### Added
- **Canonical Branch Partitioning:** Scanline rows decompose at true fork and merge junctions (`partitionScanlineBranches`). All sibling tips and trunk segments are isolated as coherent monotonic units.
- **Centroid Kernel Method in Polygon:** Added `Polygon.prototype.centroid()` to calculate precise geometric center of closed polygons.
- **Interior Underlay & Spine Travel:** Inter-branch movements strictly check polygon containment (`isSegmentInsidePolygon`). When inside the polygon (or routed via centroid inside star domains), travel executes as running stitches ($\le 2.5\text{mm}$) within the fabric footprint.
- **Contour Connector Stitches:** Adjacent row-to-row transitions along tapering edges ($\le 3.5\text{mm}$) are classified as continuous `STITCH`es rather than false `JUMP`s.
- **Unit Test 6.I (Star Tatami Fill):** Added automated test asserting $\ge 1,000$ stitches, $\le 1$ jump, and 0 long travels $> 5.0\text{mm}$ for 5-pointed star geometries.

### Fixed
- **Star Tip Fragmentation & Seam Cuts:** Resolved bug where legacy branch merging fused one star tip with the body while severing the sibling tip into an orphaned island, leaving visible diagonal gaps and backtracking jumps.
- **Dashed Line Clutter on Angled Contours:** Eliminated legacy `density * 1.6` (0.64mm) threshold that caused normal edge contour steps to be marked as JUMPs.
- **U-Shape Bay Jumps:** Maintained 0 bay jumps on U-shaped geometry through direct physical continuity sequencing.

---

## [1.3.0] - 2026-09-19

### Added
- **Multi-Polygon Island Channels:** Grouped all vector islands of the same quantized thread code into a single `ColorLayer` (`Polygon[]`). Reduced stops on complex mascots from 11 down to 2 stops.
- **Universal Commercial Auto-Trim Connector:** Any travel move $> 5.0\text{mm}$ automatically injects a 4-point tie-off + Tajima 3-jump hardware TRIM sequence (`dx=0, dy=0, JUMP` $\times 3$) + carriage travel + 4-point star tie-in.
- **Landing Anchor Penetration:** `writeDst` forces an in-place needle drop (`encodeDstRecord(0, 0, STITCH)`) immediately upon arriving at jump destination coordinates before executing the tie-in cross.
- **Unified Grain Flow Control:** Added 45° default grain flow control slider in image import modal, ensuring adjacent fur patches share harmonious grain angles.
- **Die-Cut Sticker Filter (`isStickerBorder`):** Detects shells spanning $\ge 85\%$ canvas dimension with $> 60\%$ cutout ratio and suppresses them from digitization.

### Fixed
- **Untrimmed Long Stitches:** Reduced long stitch defects (>7.5mm) from 23 to 0 on EM Digitizer benchmark.
- **Missing Tie-Ins (Start Risk):** Eliminated all start-unravel risks on color change and island transitions.
- **Micro-Stitches (<0.35mm):** Clamped lock arms to $0.42\text{mm}$ and pruned tatami end remainders $< 0.40\text{mm}$, reducing micro-stitch count to 0.

---

## [1.2.0] - 2026-09-19

### Added
- **Nested Loop Hierarchy & Hole Detection:** Area-sorted topological containment assigns interior loops directly to `poly.addHole(vertices)`.
- **Scanline Hole Clipping:** Scanline intersections automatically split across hole cutouts, emitting travel jumps and maintaining 0 stitch penetrations in negative space.
- **Monotonic Leg & Branch Partitioning:** Decomposed scanlines into continuous monotonic ribbons to reduce cross-bay travel jumps across split U-shapes and arches.
- **Anti-Aliasing Fringe Pruning:** Clusters with $< 1.5\%$ foreground share are automatically filtered out to prevent blurry bitmap edge artifacts from creating ghost layers.

---

## [1.1.0] - 2026-09-19

### Added
- **In-Browser Image Ingestion:** Drag-and-drop file upload for PNG, JPG, and WebP, plus built-in sample graphics (Cherry Patch, Retro Rocket, Star Emblem).
- **Perceptual Color Quantization:** K-Means++ clustering in CIELAB color space with Madeira Polyneon 40wt thread library matching.
- **Marching Squares Contouring:** Grid cell traversal and loop chaining with RDP spline simplification.
- **Live 3-Pane Pipeline Modal:** Real-time preview showing Original Bitmap $\to$ Quantized Thread Palette Chips $\to$ Vector Outlines with hoop fit telemetry and stitch estimation.

---

## [1.0.0] - 2026-09-19

### Added
- **Core Geometry Engine:** Vector primitives (`Point2D`, `Polygon`, `Clipper` polygon Boolean slicing and offsetting).
- **Stitch Weave Generators:** Satin dual-rail column generator, Twill 4-row weave, Tatami 3-row brick weave, Running and Bean triple-stitch generators.
- **Pull Compensation:** Perpendicular dilation offsets geometry along stitch angle (+0.3mm).
- **Underlay Stabilization:** Perimeter running stitch offset underlay generation (-0.6mm).
- **Binary Machine Exporters:** Tajima `.DST` (ternary delta format with 512-byte header) and Melco `.EXP`.
- **Interactive Studio UI:** Vanilla Canvas 2D / WebGL interactive renderer with 60fps pan/zoom, split knife tool, scrub simulation with loop playback, and machine diagnostics modal.
