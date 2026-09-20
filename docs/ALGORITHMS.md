# Core Algorithms & Mathematical Specifications

This document serves as the deep technical and algorithmic reference for the Artwork-to-Embroidery Engine.

---

## 1. Canonical Branch Decomposition & Fork/Merge Detection

### Problem Formulation
In scanline tatami/twill fills, non-convex shapes (such as 5-pointed stars, archways, and letters like `U` and `M`) produce multiple disconnected line segments within a single horizontal row $y = y_k$.
If adjacent rows are arbitrarily linked or severed:
1. One branch absorbs the common trunk while the sibling branch is abruptly orphaned.
2. The sequencer stitches the fused branch completely, diving deep into the bottom of the shape, leaving the sibling branch to be sewn last.
3. This creates massive backtracking carriage jumps across outer air and visible diagonal seams where the late branch meets the pre-stitched, contracted fabric.

### Canonical Decomposition Algorithm
Given a set of scanline rows $\mathcal{R} = \{ R_0, R_1, \dots, R_{M-1} \}$, where each row $R_k = \{ s_{k,0}, s_{k,1}, \dots \}$ contains horizontal segments $s = [x_1, x_2]$:

1. **Spatial Overlap Metric:** Two segments $s_a$ and $s_b$ overlap if:
   $$\text{overlap}(s_a, s_b) = \min(s_a.x_2, s_b.x_2) - \max(s_a.x_1, s_b.x_1) > -0.2\text{ mm}$$
2. **Junction Classification:**
   - **1-to-1 Continuation:** Exactly one active branch $B_i$ overlaps exactly one row segment $s_{k,j}$, and $s_{k,j}$ overlaps no other active branch.
     $$\implies \text{Append } s_{k,j} \text{ to } B_i.$$
   - **Fork (Divergence):** Active branch $B_i$ overlaps $N \ge 2$ segments in row $R_k$.
     $$\implies \text{Complete } B_i \text{ at row } k-1. \text{ Spawn } N \text{ new branches at row } k.$$
   - **Merge (Convergence):** $M \ge 2$ active branches $\{ B_{i_1}, \dots, B_{i_M} \}$ all overlap the same segment $s_{k,j}$.
     $$\implies \text{Complete all } M \text{ incoming branches at row } k-1. \text{ Spawn 1 new trunk branch at row } k.$$
   - **Termination:** Active branch $B_i$ overlaps 0 segments in row $R_k$.
     $$\implies \text{Complete } B_i \text{ at row } k-1.$$

---

## 2. Topological Branch Sequencing with Physical Continuity

### Sequencer State Machine
To sew partitioned branches with minimal travel moves and 0 stranded dead-ends:

1. **Frontier Tracking:** When starting top-to-bottom fill, sort unvisited branches by entry row:
   $$B_{\text{start}} = \arg\min_{B \in \mathcal{U}} (B[0].k)$$
2. **Direct Continuation Priority:** When branch $B_{\text{curr}}$ finishes at exit segment $s_{\text{exit}}$, check unvisited set $\mathcal{U}$ for physical scanline adjacency:
   $$\exists B \in \mathcal{U} \quad \text{s.t.} \quad |B_{\text{entry}}.k - s_{\text{exit}}.k| \le 1 \quad \land \quad \text{overlap}(B_{\text{entry}}, s_{\text{exit}})$$
   If found, immediately stitch $B$ without jumping (e.g. Left Leg $\to$ Bottom Connector $\to$ Right Leg).
3. **Bidirectional Traversal Evaluation:** If no direct continuation exists, evaluate nearest neighbor distance from carriage position $p_{\text{curr}}$ to both top and bottom centroids:
   $$d_{\text{top}} = \| p_{\text{curr}} - \text{midpoint}(B[0]) \|, \quad d_{\text{bottom}} = \| p_{\text{curr}} - \text{midpoint}(B[\text{last}]) \|$$
   $$\text{reversed} = (d_{\text{bottom}} < d_{\text{top}})$$
   Choose branch $B \in \mathcal{U}$ that minimizes $\min(d_{\text{top}}, d_{\text{bottom}})$.

---

## 3. Star-Convex Kernel & Interior Underlay Travel

### Ray-March Spatial Containment Test
Before emitting any carriage `JUMP`, the engine tests if the move can be executed safely as an interior running stitch:
$$p(t) = (1 - t) p_1 + t p_2, \quad t \in [0, 1]$$
Sample $N = 10$ points along the path:
$$\forall i \in \{1, \dots, N-1\}, \quad \text{Polygon.containsPoint}(p(i/N)) == \text{true}$$

### Kernel Centroid Routing
If a straight line between two tips crosses outside a concave notch:
1. Retrieve polygon centroid $C = \left( \frac{1}{V}\sum x_i, \frac{1}{V}\sum y_i \right)$.
2. If both segment legs stay inside the polygon:
   $$\text{isInside}(p_1 \to C) == \text{true} \quad \land \quad \text{isInside}(C \to p_2) == \text{true}$$
3. Route running travel stitches along $p_1 \to C \to p_2$ (step size $\le 2.5\text{mm}$).
4. The travel stitches lie buried inside the inset underlay and top fill, completely eliminating outer air jumps, hardware trims, and dashed lines.

---

## 4. Perceptual Color Quantization in CIELAB

### Color Space Transformation
sRGB values are converted to CIE $XYZ$ via gamma expansion:
$$V_{\text{linear}} = \begin{cases} V / 12.92 & V \le 0.04045 \\ \left( \frac{V + 0.055}{1.055} \right)^{2.4} & V > 0.04045 \end{cases}$$
$$X = 0.4124 R + 0.3576 G + 0.1805 B$$
$$Y = 0.2126 R + 0.7152 G + 0.0722 B$$
$$Z = 0.0193 R + 0.1192 G + 0.9505 B$$
Then transformed to $L^*a^*b^*$ using the D65 standard illuminant reference.

### Perceptual Distance ($\Delta E$)
Distance between pixel color $C_1$ and Madeira thread color $C_2$:
$$\Delta E_{ab}^* = \sqrt{(\Delta L^*)^2 + (\Delta a^*)^2 + (\Delta b^*)^2}$$
Clustering uses K-Means++ initialization to spread seeds widely across the chromatic spectrum before iterative Lloyd convergence.

---

## 5. Pull Compensation & Twill/Tatami Offset Math

### Pull Compensation
When an embroidery needle penetrates fabric under thread tension, the thread pulls opposite edges inward, shrinking column width by $5\text{--}15\%$.
To counteract this, boundary coordinates are expanded perpendicular to stitch angle $\theta$:
$$\mathbf{n}_{\perp} = (-\sin\theta, \cos\theta)$$
$$\mathbf{p}_{\text{compensated}} = \mathbf{p} + \delta_{\text{pull}} \cdot \mathbf{n}_{\perp}, \quad \delta_{\text{pull}} = +0.30\text{ mm}$$

### Twill & Tatami Needle Staggering
To prevent needle punctures from aligning into fabric-cutting grooves, penetrations are staggered by a fraction $f$ of the maximum stitch length $L$:
$$\text{offset}_k = (k \cdot f \pmod 1) \cdot L$$
- **Twill Weave:** $f = 0.25$ (4-row repeating cycle). Produces a smooth diagonal weave with uniform surface luster.
- **Tatami Weave:** $f = 0.333$ (3-row repeating cycle). Produces a standard brickwork texture.

---

## 6. Tajima 3-Byte Binary Record Encoding

### Coordinate Encoding (DST Ternary Base)
Tajima `.DST` records encode displacement $(\Delta x, \Delta y)$ in tenths of a millimeter ($0.1\text{mm}$ units). Each coordinate byte decomposes into weighted bits:

```
Byte 1: [ y+1,  y-1,  y+9,  y-9,  x-9,  x+9,  x-1,  x+1 ]
Byte 2: [ y+3,  y-3,  y+27, y-27, x-27, x+27, x-3,  x+3 ]
Byte 3: [ y+81, y-81, CMD1, CMD0, x-81, x+81, x-?,  x+? ]
```

### Command Flags in Byte 3
- `0x03` = Normal **STITCH** (needle penetrates and forms lock).
- `0x83` = **JUMP** (carriage moves without needle penetration).
- `0xC3` = **COLOR_CHANGE** (machine stops, trims, moves to next needle bar).
- `0xF3` = **END** (design complete, carriage returns to frame origin).

### Hardware TRIM Sequence
Because the standard DST specification lacks a dedicated native TRIM bytecode, commercial Tajima controllers interpret three consecutive JUMP records of zero displacement as a hardware thread trim command:
$$\text{TRIM} \equiv [(\Delta x = 0, \Delta y = 0, \text{JUMP}) \times 3]$$
This is followed immediately by a travel jump and a 4-point star tie-in at the destination.
