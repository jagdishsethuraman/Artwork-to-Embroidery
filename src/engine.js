import { Point2D, samplePolyline } from './geometry/point.js';
import { Polygon } from './geometry/polygon.js';
import { splitPolygonByLine, splitSatinByLine, splitPolylineByLine } from './geometry/slicer.js';
import { generateRunningStitch } from './stitches/running.js';
import { generateSatinColumn } from './stitches/satin.js';
import { generateTatamiFill } from './stitches/tatami.js';
import { generateRadialSatin, generateSpiralFill } from './stitches/radial.js';
import { generateMeanderFill } from './stitches/meander.js';
import { ColorLayer, StitchCommand, StitchPoint, StitchType, createTieIn, createTieOff } from './stitches/types.js';
import { writeDst, readDst } from './formats/dst.js';
import { writeExp } from './formats/exp.js';
import { writePes, readPes, BROTHER_PEC_PALETTE, findNearestBrotherColor } from './formats/pes.js';
import { writeJef, readJef, JANOME_JEF_PALETTE, findNearestJanomeColor, JANOME_HOOPS } from './formats/jef.js';
import { parseSvgPath } from './svg/svg-parser.js';
import { quantizeColors, matchThreadColor, MADEIRA_CATALOG } from './trace/color-quantizer.js';
import { traceMaskToPolygons, marchSquares, ramerDouglasPeucker } from './trace/contour-tracer.js';
import { renderTextToPolygons, generateLetteringLayer, warpPolygonAlongArc } from './typography/lettering.js';

export {
  renderTextToPolygons,
  generateLetteringLayer,
  warpPolygonAlongArc,
  Point2D,
  Polygon,
  splitPolygonByLine,
  splitSatinByLine,
  splitPolylineByLine,
  generateRunningStitch,
  generateSatinColumn,
  generateTatamiFill,
  generateRadialSatin,
  generateSpiralFill,
  generateMeanderFill,
  ColorLayer,
  StitchCommand,
  StitchPoint,
  StitchType,
  writeDst,
  readDst,
  writeExp,
  writePes,
  readPes,
  BROTHER_PEC_PALETTE,
  findNearestBrotherColor,
  writeJef,
  readJef,
  JANOME_JEF_PALETTE,
  findNearestJanomeColor,
  JANOME_HOOPS,
  parseSvgPath,
  quantizeColors,
  matchThreadColor,
  MADEIRA_CATALOG,
  traceMaskToPolygons,
  marchSquares,
  ramerDouglasPeucker,
  isStickerBorder,
  sequencePolygons,
  createTieIn,
  createTieOff
};


/**
 * Deep clones geometry preserving Polygon, Rail, or Polyline instances.
 */
export function cloneGeometry(geom) {
  if (!geom) return null;
  if (geom instanceof Polygon || typeof geom.clone === 'function') return geom.clone();
  if (geom.rail1 && geom.rail2) {
    return {
      rail1: geom.rail1.map(p => (p && typeof p.clone === 'function' ? p.clone() : new Point2D(p.x, p.y))),
      rail2: geom.rail2.map(p => (p && typeof p.clone === 'function' ? p.clone() : new Point2D(p.x, p.y)))
    };
  }
  if (Array.isArray(geom)) {
    return geom.map(p => cloneGeometry(p));
  }
  return geom;
}

/**
 * Adapts geometry representation to match the requirements of the stitch weave type.
 * Ensures seamless switching between Satin, Tatami, Twill, and Running stitches.
 */
export function convertGeometry(geom, targetType) {
  if (!geom) return null;

  const isPolygonAreaType = targetType === StitchType.TATAMI ||
    targetType === StitchType.TWILL ||
    targetType === StitchType.RADIAL_SATIN ||
    targetType === StitchType.SPIRAL ||
    targetType === StitchType.MEANDER;

  // Handle array of rails [{ rail1, rail2 }, ...]
  if (Array.isArray(geom) && geom.length > 0 && geom[0] && geom[0].rail1 && geom[0].rail2) {
    if (targetType === StitchType.SATIN) return geom;
    return geom.map(r => convertGeometry(r, targetType));
  }

  // Multi-polygon support (Polygon[])
  if (Array.isArray(geom) && geom.length > 0 && (geom[0] instanceof Polygon || (geom[0] && geom[0].vertices))) {
    if (isPolygonAreaType) {
      return geom;
    }
    return geom.map(p => convertGeometry(p, targetType));
  }

  // 1. Target is SATIN (requires { rail1: Point2D[], rail2: Point2D[] })
  if (targetType === StitchType.SATIN) {
    if (geom.rail1 && geom.rail2) return geom;

    // Convert from Polygon to dual rails
    if (geom instanceof Polygon || geom.vertices) {
      // If closed polygon, generate a dual-rail contour satin border
      if (typeof geom.offset === 'function') {
        const innerPoly = geom.offset(-2.0);
        if (innerPoly && innerPoly.vertices && innerPoly.vertices.length >= 3) {
          const r1 = [...geom.vertices.map(p => p.clone()), geom.vertices[0].clone()];
          const r2 = [...innerPoly.vertices.map(p => p.clone()), innerPoly.vertices[0].clone()];
          return { rail1: r1, rail2: r2 };
        }
      }
      const verts = geom.vertices || geom;
      if (verts.length >= 3) {
        const half = Math.floor(verts.length / 2);
        return {
          rail1: verts.slice(0, half + 1).map(p => p.clone()),
          rail2: verts.slice(half).reverse().map(p => p.clone())
        };
      }
    }

    // Convert from Polyline to dual rails by expanding outward along normal
    if (Array.isArray(geom) && geom.length >= 2) {
      const rail1 = [];
      const rail2 = [];
      const ribbonWidth = 2.0; // 2mm each side
      for (let i = 0; i < geom.length; i++) {
        const p = geom[i];
        const prev = geom[Math.max(0, i - 1)];
        const next = geom[Math.min(geom.length - 1, i + 1)];
        const dir = next.sub(prev).normalize();
        const norm = dir.normal();
        rail1.push(p.add(norm.scale(ribbonWidth)));
        rail2.push(p.sub(norm.scale(ribbonWidth)));
      }
      return { rail1, rail2 };
    }
  }

  // 2. Target is Polygon-based fill (TATAMI, TWILL, RADIAL_SATIN, SPIRAL, MEANDER)
  if (isPolygonAreaType) {
    if (geom instanceof Polygon) return geom;

    // Convert from Rails { rail1, rail2 } to closed Polygon
    if (geom.rail1 && geom.rail2) {
      const loop = [...geom.rail1, ...[...geom.rail2].reverse()];
      return new Polygon(loop);
    }

    // Convert from Polyline to ribbon Polygon
    if (Array.isArray(geom) && geom.length >= 2) {
      const left = [];
      const right = [];
      const ribbonWidth = 2.0;
      for (let i = 0; i < geom.length; i++) {
        const p = geom[i];
        const prev = geom[Math.max(0, i - 1)];
        const next = geom[Math.min(geom.length - 1, i + 1)];
        const dir = next.sub(prev).normalize();
        const norm = dir.normal();
        left.push(p.add(norm.scale(ribbonWidth)));
        right.push(p.sub(norm.scale(ribbonWidth)));
      }
      return new Polygon([...left, ...right.reverse()]);
    }
  }

  // 3. Target is RUNNING or BEAN (requires Point2D[] polyline)
  if (targetType === StitchType.RUNNING || targetType === StitchType.BEAN) {
    if (Array.isArray(geom) && geom.length > 0 && geom[0].x !== undefined) return geom;

    // Convert from Polygon to perimeter outline loop
    if (geom instanceof Polygon || geom.vertices) {
      const verts = geom.vertices || geom;
      return [...verts.map(v => v.clone()), verts[0].clone()];
    }

    // Convert from Rails to centerline
    if (geom.rail1 && geom.rail2) {
      const steps = Math.max(geom.rail1.length, geom.rail2.length, 10);
      const centerline = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const p1 = samplePolyline(geom.rail1, u);
        const p2 = samplePolyline(geom.rail2, u);
        centerline.push(new Point2D((p1.x + p2.x) / 2, (p1.y + p2.y) / 2));
      }
      return centerline;
    }
  }

  return geom;
}

/**
 * Detects whether a polygon is a die-cut sticker frame (outer shell border).
 * Sticker frames span >= 85% of target width and have high hole area ratio (> 60%).
 */
function isStickerBorder(poly, targetWidthMm) {
  if (!poly) return false;
  const b = poly.bounds();
  const outerArea = Math.abs(poly.signedArea());
  let holeArea = 0;
  if (poly.holes && poly.holes.length > 0) {
    for (const h of poly.holes) {
      let a = 0;
      for (let k = 0; k < h.length; k++) {
        const j = (k + 1) % h.length;
        a += h[k].cross(h[j]);
      }
      holeArea += Math.abs(a) / 2;
    }
  }
  return b.width >= targetWidthMm * 0.85 && outerArea > 0 && (holeArea / outerArea) > 0.60;
}

function sequencePolygons(polys, startPt) {
  if (!polys || polys.length <= 1) return polys || [];
  const unvisited = [...polys];
  const ordered = [];
  let curr = startPt || null;

  while (unvisited.length > 0) {
    if (!curr) {
      unvisited.sort((a, b) => {
        const bA = a.bounds();
        const bB = b.bounds();
        return (bA.minY - bB.minY) || (bA.minX - bB.minX);
      });
      const first = unvisited.shift();
      ordered.push(first);
      const b = first.bounds();
      curr = new Point2D((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    } else {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const b = unvisited[i].bounds();
        const center = new Point2D((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
        const d = curr.distance(center);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const chosen = unvisited.splice(bestIdx, 1)[0];
      ordered.push(chosen);
      const b = chosen.bounds();
      curr = new Point2D((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    }
  }
  return ordered;
}

/**
 * Main Embroidery Digitizer Engine
 */
export class DigitizerEngine {
  constructor() {
    this.layers = [];
    this.activeLayerId = null;
  }

  addLayer(layerOptions) {
    const layer = new ColorLayer(layerOptions);
    this.layers.push(layer);
    if (!this.activeLayerId) {
      this.activeLayerId = layer.id;
    }
    return layer;
  }

  getLayer(id) {
    return this.layers.find(l => l.id === id);
  }

  getActiveLayer() {
    return this.getLayer(this.activeLayerId);
  }

  setLayerStitchType(layerId, newType) {
    const layer = this.getLayer(layerId);
    if (!layer) return;
    if (!layer.baseGeometry && layer.geometry) {
      layer.baseGeometry = cloneGeometry(layer.geometry);
    }
    layer.stitchType = newType;
    layer.geometry = convertGeometry(layer.baseGeometry || layer.geometry, newType);
    return layer;
  }

  reorderLayers(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) {
      return this.layers;
    }
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    return this.layers;
  }

  addTextLayer(text, options = {}) {
    return generateLetteringLayer(this, text, options);
  }

  /**
   * Compiles all active layers into a single sequence of machine stitches.
   * Handles multi-polygon color spools, nearest-neighbor sequencing,
   * inter-island tie-off + TRIM + tie-in on travels > 5mm, and thread color stops.
   * @returns {StitchPoint[]}
   */
  compileStitches() {
    const rawStitches = [];
    let lastNeedlePos = null;

    for (let lIdx = 0; lIdx < this.layers.length; lIdx++) {
      const layer = this.layers[lIdx];
      if (!layer.geometry) continue;

      // Add color change command if transitioning to a new layer
      if (rawStitches.length > 0) {
        const lastStitch = rawStitches[rawStitches.length - 1];
        rawStitches.push(new StitchPoint(lastStitch.x, lastStitch.y, StitchCommand.COLOR_CHANGE, lIdx));
      }

      const polys = layer.getPolygons();

      const isAreaFill = layer.stitchType === StitchType.TATAMI ||
        layer.stitchType === StitchType.TWILL ||
        layer.stitchType === StitchType.RADIAL_SATIN ||
        layer.stitchType === StitchType.SPIRAL ||
        layer.stitchType === StitchType.MEANDER;

      if (polys.length > 0 && isAreaFill) {
        // Multi-island fill: sequence polygons with nearest-neighbor
        const orderedPolys = sequencePolygons(polys, lastNeedlePos);

        for (let pIdx = 0; pIdx < orderedPolys.length; pIdx++) {
          const poly = orderedPolys[pIdx];
          let polyStitches = [];
          switch (layer.stitchType) {
            case StitchType.RADIAL_SATIN:
              polyStitches = generateRadialSatin(poly, { ...layer.params, colorIndex: lIdx });
              break;
            case StitchType.SPIRAL:
              polyStitches = generateSpiralFill(poly, { ...layer.params, colorIndex: lIdx });
              break;
            case StitchType.MEANDER:
              polyStitches = generateMeanderFill(poly, { ...layer.params, colorIndex: lIdx });
              break;
            case StitchType.TWILL:
            case StitchType.TATAMI:
            default:
              polyStitches = generateTatamiFill(poly, {
                ...layer.params,
                stagger: layer.stitchType === StitchType.TWILL ? 0.25 : (layer.params.stagger || 0.33),
                colorIndex: lIdx
              });
              break;
          }
          if (polyStitches.length < 2) continue;

          const firstPt = polyStitches[0];
          const lastPt = polyStitches[polyStitches.length - 1];

          if (lastNeedlePos) {
            const travelDist = lastNeedlePos.distance(new Point2D(firstPt.x, firstPt.y));
            if (pIdx > 0) {
              // Inter-island travel within the same layer
              if (travelDist > 5.0) {
                rawStitches.push(...createTieOff(lastNeedlePos.x, lastNeedlePos.y, lIdx));
                rawStitches.push(new StitchPoint(lastNeedlePos.x, lastNeedlePos.y, StitchCommand.TRIM, lIdx));
                rawStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
                rawStitches.push(...createTieIn(firstPt.x, firstPt.y, lIdx));
              } else {
                rawStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
              }
            } else {
              // First island of new layer (after COLOR_CHANGE)
              rawStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
              rawStitches.push(...createTieIn(firstPt.x, firstPt.y, lIdx));
            }
          } else {
            // First island of entire design
            rawStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
            rawStitches.push(...createTieIn(firstPt.x, firstPt.y, lIdx));
          }

          // Main body stitches (skip leading jump since already positioned & tied in)
          const startIdx = (polyStitches[0].command === StitchCommand.JUMP) ? 1 : 0;
          for (let i = startIdx; i < polyStitches.length; i++) {
            rawStitches.push(polyStitches[i]);
          }

          lastNeedlePos = new Point2D(lastPt.x, lastPt.y);

          // End of layer: tie-off and hardware TRIM
          if (pIdx === orderedPolys.length - 1) {
            rawStitches.push(...createTieOff(lastPt.x, lastPt.y, lIdx));
            rawStitches.push(new StitchPoint(lastPt.x, lastPt.y, StitchCommand.TRIM, lIdx));
          }
        }
      } else {
        // Single geometry (Rails, Polyline, or Single Polygon)
        const geom = convertGeometry(layer.geometry, layer.stitchType) || layer.geometry;
        let layerStitches = [];

        switch (layer.stitchType) {
          case StitchType.RUNNING:
          case StitchType.BEAN:
            if (Array.isArray(geom) && geom.length > 0 && Array.isArray(geom[0])) {
              for (const polyline of geom) {
                const run = generateRunningStitch(polyline, {
                  ...layer.params,
                  bean: layer.stitchType === StitchType.BEAN,
                  colorIndex: lIdx
                });
                if (layerStitches.length > 0 && run.length > 0) {
                  const firstPt = run[0];
                  layerStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
                }
                layerStitches.push(...run);
              }
            } else if (Array.isArray(geom)) {
              layerStitches = generateRunningStitch(geom, {
                ...layer.params,
                bean: layer.stitchType === StitchType.BEAN,
                colorIndex: lIdx
              });
            }
            break;

          case StitchType.SATIN:
            if (geom && geom.rail1 && geom.rail2) {
              layerStitches = generateSatinColumn(geom.rail1, geom.rail2, {
                ...layer.params,
                colorIndex: lIdx
              });
            } else if (Array.isArray(geom) && geom.length > 0 && geom[0].rail1 && geom[0].rail2) {
              for (let rIdx = 0; rIdx < geom.length; rIdx++) {
                const r = geom[rIdx];
                const pieceStitches = generateSatinColumn(r.rail1, r.rail2, {
                  ...layer.params,
                  colorIndex: lIdx
                });
                if (pieceStitches.length === 0) continue;
                if (layerStitches.length > 0) {
                  const lastPt = layerStitches[layerStitches.length - 1];
                  const firstPt = pieceStitches[0];
                  layerStitches.push(...createTieOff(lastPt.x, lastPt.y, lIdx));
                  layerStitches.push(new StitchPoint(lastPt.x, lastPt.y, StitchCommand.TRIM, lIdx));
                  layerStitches.push(new StitchPoint(firstPt.x, firstPt.y, StitchCommand.JUMP, lIdx));
                  layerStitches.push(...createTieIn(firstPt.x, firstPt.y, lIdx));
                }
                layerStitches.push(...pieceStitches);
              }
            }
            break;

          case StitchType.RADIAL_SATIN:
            if (geom instanceof Polygon) {
              layerStitches = generateRadialSatin(geom, {
                ...layer.params,
                colorIndex: lIdx
              });
            }
            break;

          case StitchType.SPIRAL:
            if (geom instanceof Polygon) {
              layerStitches = generateSpiralFill(geom, {
                ...layer.params,
                colorIndex: lIdx
              });
            }
            break;

          case StitchType.MEANDER:
            if (geom instanceof Polygon) {
              layerStitches = generateMeanderFill(geom, {
                ...layer.params,
                colorIndex: lIdx
              });
            }
            break;

          case StitchType.TATAMI:
          case StitchType.TWILL:
          default:
            if (geom instanceof Polygon) {
              layerStitches = generateTatamiFill(geom, {
                ...layer.params,
                stagger: layer.stitchType === StitchType.TWILL ? 0.25 : (layer.params.stagger || 0.33),
                colorIndex: lIdx
              });
            }
            break;
        }

        if (layerStitches.length > 2) {
          const withLocks = this._addLockStitches(layerStitches, lIdx);
          rawStitches.push(...withLocks);
          const last = withLocks[withLocks.length - 1];
          lastNeedlePos = new Point2D(last.x, last.y);
        } else if (layerStitches.length > 0) {
          rawStitches.push(...layerStitches);
          const last = layerStitches[layerStitches.length - 1];
          lastNeedlePos = new Point2D(last.x, last.y);
        }
      }
    }

    // Universal Commercial Connector Pass:
    // Ensures no un-trimmed jump > 5.0mm can ever exist across any stitch type or complex geometry
    return this._enforceCommercialConnectors(rawStitches);
  }

  /**
   * Enforces commercial auto-trim rules: Any travel move > 5.0mm without a preceding TRIM
   * is automatically bracketed by a tie-off, hardware Tajima TRIM, travel jump, and tie-in.
   */
  _enforceCommercialConnectors(stitches) {
    if (!stitches || stitches.length === 0) return [];
    const result = [];
    let currentColor = 0;
    let lastSewPt = null;
    let hadTrimOrColor = true;

    for (let i = 0; i < stitches.length; i++) {
      const pt = stitches[i];
      if (pt.command === StitchCommand.COLOR_CHANGE) {
        currentColor = pt.colorIndex;
        result.push(pt);
        hadTrimOrColor = true;
        continue;
      }
      if (pt.command === StitchCommand.TRIM) {
        result.push(pt);
        hadTrimOrColor = true;
        continue;
      }
      if (pt.command === StitchCommand.JUMP) {
        const prev = result.length > 0 ? result[result.length - 1] : null;
        const d = prev ? prev.distance(pt) : 0;
        if (d > 5.0 && !hadTrimOrColor && lastSewPt) {
          result.push(...createTieOff(prev.x, prev.y, currentColor));
          result.push(new StitchPoint(prev.x, prev.y, StitchCommand.TRIM, currentColor));
          result.push(pt);
          result.push(...createTieIn(pt.x, pt.y, currentColor));
          hadTrimOrColor = false;
          lastSewPt = pt;
        } else {
          result.push(pt);
        }
        continue;
      }
      // StitchCommand.STITCH
      result.push(pt);
      lastSewPt = pt;
      hadTrimOrColor = false;
    }
    return result;
  }

  /**
   * Adds canonical commercial tie-in and tie-off lock stitches (star cross pattern)
   * and Tajima hardware TRIM to prevent thread unravelling.
   */
  _addLockStitches(stitches, colorIdx) {
    if (stitches.length < 2) return stitches;

    const result = [];
    const first = stitches[0];
    result.push(first); // JUMP to start point

    // Canonical 4-point star tie-in cross at start (0.42mm arms)
    const sx = first.x;
    const sy = first.y;
    result.push(...createTieIn(sx, sy, colorIdx));

    // Middle stitches (filter out redundant 0-distance initial stitch if present)
    for (let i = 1; i < stitches.length - 1; i++) {
      const s = stitches[i];
      if (i === 1 && Math.abs(s.x - sx) < 1e-4 && Math.abs(s.y - sy) < 1e-4) {
        continue;
      }
      result.push(stitches[i]);
    }

    // Canonical tie-off lock stitches before end of block (0.42mm arms)
    const last = stitches[stitches.length - 1];
    const lx = last.x;
    const ly = last.y;
    result.push(...createTieOff(lx, ly, colorIdx));

    // Tajima hardware TRIM command
    result.push(new StitchPoint(lx, ly, StitchCommand.TRIM, colorIdx));

    return result;
  }

  /**
   * Calculates overall design metadata (dimensions, stitch count, thread stops)
   */
  getDesignStats() {
    const stitches = this.compileStitches();
    if (stitches.length === 0) {
      return { stitchCount: 0, widthMm: 0, heightMm: 0, colorChanges: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let colorChanges = 0;

    for (const s of stitches) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
      if (s.command === StitchCommand.COLOR_CHANGE) colorChanges++;
    }

    return {
      stitchCount: stitches.length,
      widthMm: parseFloat((maxX - minX).toFixed(2)),
      heightMm: parseFloat((maxY - minY).toFixed(2)),
      colorChanges,
      bounds: { minX, maxX, minY, maxY }
    };
  }

  /**
   * Exports compiled stitches as a Tajima .DST binary buffer
   */
  exportDst(label = 'DESIGN') {
    const stitches = this.compileStitches();
    return writeDst(stitches, label);
  }

  /**
   * Exports compiled stitches as a Melco .EXP binary buffer
   */
  exportExp() {
    const stitches = this.compileStitches();
    return writeExp(stitches);
  }

  /**
   * Exports compiled stitches as a Brother .PES (v1 with embedded #PEC0001) binary buffer.
   * Maps layer colors to standard Brother 64-color palette table.
   */
  exportPes(label = 'DESIGN') {
    const stitches = this.compileStitches();
    const threads = this.layers.map(l => l.hex || l.color || '#000000');
    return writePes(stitches, { label, threads });
  }

  /**
   * Exports compiled stitches as a Janome .JEF binary buffer with hoop boundary code.
   * Maps layer colors to standard Janome 79-color palette table and centers design coordinates.
   */
  exportJef(label = 'DESIGN') {
    const stitches = this.compileStitches();
    const threads = this.layers.map(l => l.hex || l.color || '#000000');
    return writeJef(stitches, { label, threads });
  }

  /**
   * Traces a raster image into discrete color layers and registers them with the engine.
   * Consolidates disconnected islands into single ColorLayer spool channels,
   * eliminates outer die-cut sticker frames, and applies unified grain flow.
   * @param {ImageData|{data: Uint8Array|number[], width: number, height: number}} imageData
   * @param {Object} options
   * @returns {ColorLayer[]}
   */
  importImage(imageData, options = {}) {
    const {
      k = 3,
      targetWidthMm = 75.0,
      simplification = 0.8,
      minAreaMm2 = 3.0,
      defaultStitchType = StitchType.TWILL,
      defaultAngle = 45,
      filterStickerBorder = true,
      clearExisting = true,
      ignoreTransparent = true,
      ignoreWhiteBg = true
    } = options;

    if (clearExisting) {
      this.layers = [];
    }

    const { clusters, width, height } = quantizeColors(imageData, {
      k,
      ignoreTransparent,
      ignoreWhiteBg
    });
    const newLayers = [];

    for (const cluster of clusters) {
      const polygons = traceMaskToPolygons(cluster.mask, width, height, {
        targetWidthMm,
        simplification,
        minAreaMm2
      });

      if (polygons.length === 0) continue;

      // Filter out die-cut sticker frames if enabled
      const validPolys = filterStickerBorder
        ? polygons.filter(p => !isStickerBorder(p, targetWidthMm))
        : polygons;

      if (validPolys.length === 0) continue;

      // Consolidate all islands of this cluster into a single ColorLayer spool channel
      const layerId = `layer-${cluster.colorIndex}`;
      const layerName = cluster.threadCode.split('(')[0].trim();

      const layer = this.addLayer({
        id: layerId,
        name: layerName,
        hex: cluster.hex,
        threadCode: cluster.threadCode,
        stitchType: defaultStitchType,
        params: {
          density: 0.4,
          stitchLength: 3.5,
          stagger: 0.25,
          angle: defaultAngle,
          underlay: true
        }
      });
      layer.geometry = validPolys.length === 1 ? validPolys[0] : validPolys;
      layer.baseGeometry = cloneGeometry(layer.geometry);
      newLayers.push(layer);
    }

    if (this.layers.length > 0) {
      this.activeLayerId = this.layers[0].id;
    }

    return newLayers;
  }
}

