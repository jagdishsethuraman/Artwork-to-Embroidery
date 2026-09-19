# 🧵 Embroidery Digitizer Engine: Comprehensive Test Cases & Validation Matrix

**Target Version:** Phase 1 Core Mathematical Engine & Vector Pipeline  
**Document Purpose:** Systematic manual & automated validation checklist to verify embroidery physics, stitch generation geometry, and machine binary compatibility before advancing to Phase 2/3.

---

## 📋 Test Matrix Overview

| Suite ID | Category | Primary Focus | Target Tolerance / Metric |
| :--- | :--- | :--- | :--- |
| **TC-100** | Satin Weave Engine | Dual-rail interpolation, pull compensation, underlays | Stitch length $\le 6.0\text{mm}$, jump $\le 12.1\text{mm}$ |
| **TC-200** | Tatami / Twill Weave | Scanline clipping, angle rotation, stagger pitch | Zero points outside boundary, $0.25$ twill offset |
| **TC-300** | Running / Bean Stitch | Arc-length equidistant sampling, triple stitch | Step length $\pm 0.1\text{mm}$, $3\times$ stitch density |
| **TC-400** | Knife / Split Tool | Polygon Boolean slicing, area conservation | $100\%$ vertex closure, $\sum \text{Area} = \text{Area}_{\text{orig}}$ |
| **TC-500** | Machine DST / EXP Export | Ternary delta packing, jump-chunking, EOF | Header $= 512$ bytes, EOF $= \text{0x1A}$, deltas $\le 121$ |
| **TC-600** | Studio Simulation & State | Needle playback, scrub slider, Undo/Redo | Smooth needle tracking, non-destructive undo |

---

## 🔬 Detailed Test Cases

### TC-100: Satin Column Weave Engine

#### TC-101: Density & Row Pitch Scaling
* **Action:** Select `North Petal (Satin)`. Adjust `Stitch Density` slider from `0.2 mm` to `0.8 mm`.
* **Expected Result:**
  * At `0.2 mm` (high density): Stitch count increases significantly (dense glossy thread coverage).
  * At `0.8 mm` (low density): Thread lines become widely spaced.
  * No NaN or infinite loops. Total stitches updates in real time.

#### TC-102: Outward Pull Compensation
* **Action:** Select `North Petal (Satin)`. Toggle `Pull Compensation` from `0.0 mm` to `+0.8 mm`.
* **Expected Result:**
  * Needle penetrations push outward along rail normal vectors.
  * Measured design width expands by $2 \times \delta_{\text{pull}}$ (e.g. $+0.6\text{mm}$ to $+1.6\text{mm}$).
  * Compensates for fabric puckering along stitch direction.

#### TC-103: Center-Walk Running Underlay
* **Action:** Toggle `Generate Underlay` checkbox on and off while observing playback or first stitches.
* **Expected Result:**
  * When checked: A single running line stitches down the centerline *before* top zigzag stitches begin.
  * When unchecked: Zigzag top stitches start immediately without foundation pass.

---

### TC-200: Tatami & Twill Scanline Fill Engine

#### TC-201: Stitch Angle Rotation
* **Action:** Select `Pollen Center` (Twill Weave). Drag `Stitch Angle` from `0°` through `45°`, `90°`, and `135°`.
* **Expected Result:**
  * Scanline rows rotate smoothly across the shape.
  * All needle penetration points remain strictly bounded inside the polygon perimeter.
  * No stitches bleed into empty space.

#### TC-202: Twill Stagger Pitch vs. Standard Tatami
* **Action:** Compare `Pollen Center` set to `Twill Weave` vs `Tatami Fill`.
* **Expected Result:**
  * `Twill Weave`: Stitches shift row-to-row by $25\%$ ($0.25$ factor), creating a smooth 4-row diagonal twill weave (prevents needle penetrations from lining up into vertical tear lines).
  * `Tatami Fill`: Uses standard $0.33$ 3-row offset.

#### TC-203: Perimeter Inset Underlay
* **Action:** Verify initial stitches of `Pollen Center` with underlay enabled.
* **Expected Result:**
  * An inset contour ($0.6\text{mm}$ inside the outer edge) is laid down first, securing the stabilizer before the dense scanlines sew over it.

---

### TC-300: Running & Bean (Triple) Stitch Engine

#### TC-301: Uniform Step Resampling
* **Action:** Select `Stem & Vine (Bean Stitch)`. Adjust `Stitch Step Length` from `1.5 mm` to `4.5 mm`.
* **Expected Result:**
  * Needle intervals along curved vine expand/contract uniformly.
  * Arc-length calculation preserves smooth curve fidelity.

#### TC-302: Bean Triple-Run Density
* **Action:** Switch `Stem & Vine` between `Running Stitch` and `Bean Stitch`.
* **Expected Result:**
  * In `Running`: Stitches follow forward trail ($A \to B \to C$).
  * In `Bean`: Needle steps $A \to B \to A \to B \to C \to B \to C$, tripling thread weight for bold stems. Total stitch count triples for that layer.

---

### TC-400: Knife / Split Tool (Polygon Slicing)

#### TC-401: Manual Knife Slice across Shape
* **Action:**
  1. Click `🔪 Split Knife (Slice Shapes)` tool button in top toolbar.
  2. Select `Pollen Center` layer.
  3. Click and drag a line completely across the yellow pollen center.
* **Expected Result:**
  * Original polygon divides into two closed sub-polygons: `Piece A` and `Piece B (Split B)`.
  * `Piece B` is automatically assigned to a new Satin layer.
  * Total combined area matches the original polygon.

#### TC-402: Incomplete Knife Cut (Safety Rejection)
* **Action:** Drag a knife line that starts or ends *inside* the shape without crossing both opposite boundaries.
* **Expected Result:**
  * System alerts that cut line did not cross both sides of the shape.
  * Original polygon remains completely intact without corruption.

---

### TC-500: Machine File Export & Compatibility (DST / EXP)

#### TC-501: Tajima DST Header, Commercial Limits & Web Viewer Audit
* **Online Viewers (No local software required):**
  * **[EM Digitizer Viewer](https://emdigitizer.com/embroidery-viewer/)**
  * **[StitchOps Viewer](https://www.stitchops.app/en/viewer)**
* **Action:**
  1. Click `💾 Export .DST (Tajima Machine)` in top header.
  2. Upload the exported `.dst` file directly to [EM Digitizer Viewer](https://emdigitizer.com/embroidery-viewer/) or [StitchOps Viewer](https://www.stitchops.app/en/viewer).
* **Expected Result:**
  * **Score:** **100 / 100** Quality Score.
  * **Long Stitches:** `0 Long Stitches detected` (sewing lines $>7.0\text{mm}$ are automatically subdivided into safe $\le 6.0\text{mm}$ stitches).
  * **Tie-Ins:** `0 Missing Tie-Ins` (every color layer starts with canonical 4-point star lock stitches $\pm 0.35\text{mm}$ and ends with a tie-off cross + 3-jump trim sequence).
  * **Rendering:** Colors and stitch directions render cleanly without artifacts.

#### TC-502: Large Travel Jump-Chunking Compliance
* **Action:**
  1. Click `[ 🧪 Machine Diagnostics ]` button in the floating canvas top HUD (or header).
  2. Observe the **TC-502: Large Travel Jump-Chunking** audit card.
* **Expected Result:**
  * Shows exact list of moves with distance $>12.1\text{mm}$ (e.g., travel moves between flower center, petals, and stem).
  * Confirms each move is cleanly chunked into safe intermediate jumps $\le 11.0\text{mm}$ (Euclidean) and $\le 121$ delta units (component-wise).
  * Status displays `PASSED (100% Compliant, 0 motor overflow risks)`.

---

### TC-600: Studio Simulation, Playback & Undo/Redo

#### TC-601: Playback Restart & Scrubbing
* **Action:**
  1. Click `▶ Play`.
  2. Let needle play to the end, or drag the scrubber to the middle and click `▶ Play`.
* **Expected Result:**
  * When at the end, clicking `▶ Play` automatically wraps around to stitch 0 and sews forward.
  * Red needle crosshair tracks exact needle penetration in real time.
  * Speed dropdown ($2\times \to 50\times$) accelerates or decelerates playback smoothly.

#### TC-602: Multi-Level Undo & Redo
* **Action:**
  1. Split a polygon or switch stitch types.
  2. Press `Cmd+Z` (or click `↩ Undo`).
  3. Press `Cmd+Shift+Z` or `Cmd+Y` (or click `↪ Redo`).
* **Expected Result:**
  * State reverts non-destructively to previous configuration.
  * Undo button disables and dims when history stack is empty.

#### TC-603: Fit to Screen Auto-Framing
* **Action:** Zoom way in or pan design off-screen, then click `🎯 Fit to Screen`.
* **Expected Result:**
  * Canvas instantly re-centers and calculates optimal zoom scale to frame the entire design with clean margins.

---

## 📝 Feedback Reporting Template

When testing, please note your results in this format:

```markdown
### Test Run Feedback
- **Browser & OS:** [e.g., Chrome 128 / macOS]
- **TC-100 (Satin Weave):** [PASS / ISSUE + description]
- **TC-200 (Tatami/Twill):** [PASS / ISSUE + description]
- **TC-300 (Running/Bean):** [PASS / ISSUE + description]
- **TC-400 (Split Knife):** [PASS / ISSUE + description]
- **TC-500 (DST Export & Machine Import):** [PASS / ISSUE + description]
- **TC-600 (Playback & Undo/Redo):** [PASS / ISSUE + description]
- **Additional Observations / Feature Requests:**
```
