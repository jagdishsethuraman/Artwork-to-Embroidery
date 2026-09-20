# Changelog

All notable changes to the Artwork-to-Embroidery Engine are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-09-20

### Added
- **DAW-Style Multi-Color Stitch Timeline (`public/app.js` & `public/index.html`):**
  - Proportional multi-layer color blocks on timeline track displaying exact percentage and stitch count of each thread spool (`.daw-segment`).
  - Interactive scrubbing with native range accessibility overlay and synchronized visual playhead thumb with specular hairline marker.
  - One-click layer seeking: clicking any colored segment jumps the playhead directly to that layer's start index.
  - Hover tooltips detailing layer name, stitch count, and design percentage.
  - Live telemetry readout: `${playheadIndex} / ${totalStitches} sts`, percentage indicator, and dynamic active thread layer pill with live color dot.
- **Hardware Simulation Transport Controls (`public/app.js` & `public/index.html`):**
  - Transport buttons: Jump to Start (`⏮`), Step Backward 10 stitches (`⏪`), Play / Pause (`▶`/`⏸`), Step Forward 10 stitches (`⏩`), and Simulation Loop Toggle (`🔁`).
  - Configurable simulation speeds: `1x`, `2x`, `5x`, `15x`, `50x`, `100x`.
  - Seamless loop repeat: automatically wraps to start when reaching end if loop mode is toggled on.
  - Complete keyboard hotkey map: `P` (Play/Pause), `L` (Toggle Loop), `[` (Step -10), `]` (Step +10), `\` / `Home` (Jump to Start), `End` (Seek to End).
- **High-Visibility CAD Virtual Needle Reticle (`public/app.js`):**
  - Screen-invariant CAD reticle rendering at active needle penetration coordinates.
  - Soft radial radar glow and outer segmented CAD dashed targeting ring.
  - Fine cardinal crosshairs with steel needle tip and specular bevel.
  - Dynamic floating CAD callout flag connected via hairline pointer displaying active machine operation and distance in real time (`STITCH 2.8mm`, `JUMP 8.4mm`, `COLOR STOP`, `TRIM`).

## [1.8.0] - 2026-09-20

### Added
- **Commercial Machine Embroidery Hoop CAD System (`public/app.js` & `public/index.html`):**
  - Selectable physical machine hoop boundaries centered at origin: `100×100mm` (4×4" Standard single-needle), `130×180mm` (5×7" Large garment/chest), `200×200mm` (8×8" Commercial multi-needle), `360×200mm` (14×8" Jacket back/jumbo tubular), and `None / Free Canvas`.
  - Realistic CAD hoop rendering: outer plastic clamp double rim, physical alignment notches/ticks at 4 cardinal positions, dashed inner 5mm safety clearance margin, and millimeter dimension tags.
  - Real-time CAD compliance and boundary alert engine: calculates design bounding box against active hoop clearance. Displays warning banner (`⚠ Design exceeds hoop boundary by +X mm`), pulses hoop boundary in crimson (`#f43f5e`), and updates status badge.
- **Precision Viewport Zoom HUD & Segmented CAD Deck (`public/app.js` & `public/index.html`):**
  - Floating segmented control in top canvas HUD with interactive zoom presets (25%, 50%, 75%, 100%, 150%, 200%, 400%, Fit Design, Fit Hoop).
  - 10mm primary metric CAD grid with 1mm minor subdivision grid lines at high zoom levels (scale >= 8.0).
  - Floating real-time telemetry deck: continuous cursor coordinates (`X: +0.0 Y: +0.0 mm`), live design dimensions (`W × H mm`), and hoop compliance chip (`✓ 100×100` or `⚠ +Xmm`).
  - Keyboard shortcuts: `+`/`=` (Zoom In), `-`/`_` (Zoom Out), `0` (Reset 100%), `F` (Fit Design), `G` (Toggle Grid), `H` (Cycle Hoops), `V` (Inspect), `K` (Knife), `Space + Drag` (Canvas Pan).
- **Responsive Dynamic Moldable Panels:**
  - Auto-collapsing top HUD into compact icon pills on viewports `<= 1320px`.
  - Stacked bottom layout on viewports `<= 1240px` (Telemetry positioned above playback bar), completely eliminating overlap or out-of-scope clipping.

## [1.7.0] - 2026-09-20

### Added
- **OLED Industrial Design Token System (`public/index.html`):**
  - High-contrast OLED dark palette (`--bg-canvas: #090d16`, `--bg-surface: #0f172a`, `--border-subtle: #1e293b`).
  - Doppelrand dual-layer box shadows and hairline border insets.
  - Micro-haptic tactile active states with spring physics (`transform: scale(0.975)`).
- **Comprehensive Zero-Emoji Vector SVG Icon System (`public/index.html` & `public/app.js`):**
  - Replaced all emojis across entire application with unified inline vector SVGs (1.75px stroke, rounded terminals, inheriting `currentColor`).
  - Includes Header actions (thread spool brand, curved undo/redo arrows, image frame, format badges for DST/EXP/PES/JEF), Sidebar presets (daisy, typography, crest shield), Canvas HUD controls (split knife, pan reticle, reset, diagnostics), Layer sequence controls (6-dot grip, chevrons, eye visibility toggle), Playback controls (play/pause SVGs), and all Modals.
- **Layer Visibility Toggle (`public/app.js`):**
  - Added eye/eye-off toggle button to each layer card in the sequence manager.
  - Non-destructive canvas rendering toggle allowing individual embroidery layers to be shown or hidden during preview and stitch playback.

## [1.6.0] - 2026-09-20

### Added
- **In-Canvas Typography & Satin Lettering Engine (`src/typography/lettering.js`):**
  - Universal text-to-vector polygon rasterizer supporting Browser (high-resolution HTML5 Canvas 2D) and Headless Node.js (airtight scaled 8x12 vector bitmap font).
  - Contour hierarchy analysis detecting outer character boundaries and inner holes (`A`, `B`, `O`, `P`, `D`, `0`, `8`, etc.).
  - Baseline arc warping (`warpPolygonAlongArc`) bending text along circular arcs ($-60^\circ$ to $+60^\circ$) with preserved vertex topology.
  - Multi-style typography selection: Varsity (Athletic Block), Sans-Serif, Elegant Serif, Script / Cursive, and Technical Monospace.
  - `DigitizerEngine.prototype.addTextLayer(text, options)`: Creates configured embroidery layers with density, pull compensation, underlays, and satin/tatami stitch generation.
  - Studio Lettering Modal (`#letteringModal` & `#btnSidebarLettering`): Live font preview, height slider, arc slider, Madeira thread color swatches, and instant stitch generation.
- **Draggable Layer Construction Sequence (`public/app.js` & `public/index.html`):**
  - HTML5 drag-and-drop layer reordering in left sidebar `#layersContainer`.
  - Added drag handles (`⠿`), layer sequence indicators (`#1`, `#2`, ...), and `▲`/`▼` quick reorder buttons on every layer card.
  - Directly reorders `engine.layers`, dynamically altering the physical embroidery construction sequence (underlay foundations before top detail satin stitches) and machine color stop sequence.
  - Full Undo/Redo stack integration with state persistence.
- **Multi-Polygon Island Satin Rail Compiler (`src/engine.js`):**
  - Extended `compileStitches()` to support arrays of satin rail pairs (`[{ rail1, rail2 }, ...]`).
  - Automatically synthesizes inter-island tie-off, hardware TRIM, jump travel, and tie-in between disconnected satin letters/islands.
- **Comprehensive Test Suite Expansion (`test/run-all-tests.js`):**
  - Added Section 8 tests verifying 6-hop non-destructive geometry preservation, multi-island satin compilation with TRIMs, layer reordering stitch stream verification, and typography generation with hole detection and arc warping (total 160/160 tests passing).

### Fixed
- **Satin Stitch Type Conversion Distortion (`src/engine.js` & `src/stitches/types.js`):**
  - Introduced `ColorLayer.prototype.baseGeometry` and non-destructive `cloneGeometry()`.
  - Previously, switching a layer to `SATIN` permanently overwrote its geometry with perimeter contour rails, causing subsequent switches to other weaves to degrade into thin ribbons.
  - `setLayerStitchType` now caches pristine vector geometry in `baseGeometry` and derives each stitch type's geometry from `baseGeometry`, ensuring lossless multi-hop switching.
  - Enhanced `convertGeometry` to handle `Polygon` to contour satin border via `poly.offset(-2.0)`, multi-polygon `Polygon[]` to array of rails, and arrays of rails back to polygons.

---

## [1.5.0] - 2026-09-20

### Added
- **Radial Satin Weave Generator (`src/stitches/radial.js`):** Full $360^\circ$ radial satin stepping with angle-adaptive density calibration ($\Delta\theta$), outward pull compensation dilation, concentric running underlay loops, and feathered inner hub anti-perforation ($40\text{–}45\%$ radial depth staggering when $\Delta\theta \cdot r_{inner} < 0.35\text{mm}$).
- **Archimedean Spiral Fill Generator (`src/stitches/radial.js`):** Pure continuous single-line spiral running weave ($r(\theta) = r_0 + \frac{d}{2\pi}\theta$) with uniform needle penetration intervals ($\le 3.5\text{mm}$), boundary polygon clipping, and strictly **0 internal jump stitches**.
- **Curvilinear Meander / Stippling Fill (`src/stitches/meander.js`):** Continuous harmonic sine stippling weave ($y(x) = y_{\text{base}} + A \sin(\omega_1 x) + \frac{A}{3} \sin(\omega_2 x)$) with strict polygon boundary clamping and smooth perimeter connector steps ($\le 3.5\text{mm}$).
- **StitchType Enum Additions (`src/stitches/types.js`):** Added `RADIAL_SATIN: 'radial_satin'`, `SPIRAL: 'spiral'`, and `MEANDER: 'meander'`.
- **DigitizerEngine Area Weave Support (`src/engine.js`):** Enabled `convertGeometry` polygon routing and `compileStitches()` support for single-geometry and multi-polygon island layers with auto-trim bracket sequences.
- **Studio UI Controls & Demo Preset (`public/index.html` & `public/app.js`):** Added new stitch types to Inspector `#stitchTypeSelect` and Image Import `#importStitchType`. Added 3-layer `🏅 Crest Badge` demo preset demonstrating Radial Satin laurel rim, Archimedean Spiral field, and Meander Fill star emblem.
- **Comprehensive Unit Tests (`test/run-all-tests.js`):** Added 15 new automated assertions testing radial satin underlays and hub feathering, 0-jump spiral thread continuity, meander polygon containment clamping, and multi-weave crest exports across Tajima DST, Melco EXP, Brother PES, and Janome JEF (total 135/135 tests passing).

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
