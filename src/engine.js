import { Point2D, samplePolyline } from './geometry/point.js';
import { Polygon } from './geometry/polygon.js';
import { splitPolygonByLine, splitSatinByLine, splitPolylineByLine } from './geometry/slicer.js';
import { generateRunningStitch } from './stitches/running.js';
import { generateSatinColumn } from './stitches/satin.js';
import { generateTatamiFill } from './stitches/tatami.js';
import { ColorLayer, StitchCommand, StitchPoint, StitchType } from './stitches/types.js';
import { writeDst, readDst } from './formats/dst.js';
import { writeExp } from './formats/exp.js';
import { parseSvgPath } from './svg/svg-parser.js';
import { quantizeColors, matchThreadColor, MADEIRA_CATALOG } from './trace/color-quantizer.js';
import { traceMaskToPolygons, marchSquares, ramerDouglasPeucker } from './trace/contour-tracer.js';

export {
  Point2D,
  Polygon,
  splitPolygonByLine,
  splitSatinByLine,
  splitPolylineByLine,
  generateRunningStitch,
  generateSatinColumn,
  generateTatamiFill,
  ColorLayer,
  StitchCommand,
  StitchPoint,
  StitchType,
  writeDst,
  readDst,
  writeExp,
  parseSvgPath,
  quantizeColors,
  matchThreadColor,
  MADEIRA_CATALOG,
  traceMaskToPolygons,
  marchSquares,
  ramerDouglasPeucker
};

/**
 * Adapts geometry representation to match the requirements of the stitch weave type.
 * Ensures seamless switching between Satin, Tatami, Twill, and Running stitches.
 */
export function convertGeometry(geom, targetType) {
  if (!geom) return null;

  // 1. Target is SATIN (requires { rail1: Point2D[], rail2: Point2D[] })
  if (targetType === StitchType.SATIN) {
    if (geom.rail1 && geom.rail2) return geom;

    // Convert from Polygon to dual rails
    if (geom instanceof Polygon || geom.vertices) {
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

  // 2. Target is TATAMI or TWILL (requires Polygon)
  if (targetType === StitchType.TATAMI || targetType === StitchType.TWILL) {
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
    if (Array.isArray(geom)) return geom;

    // Convert from Polygon to perimeter outline loop
    if (geom instanceof Polygon) {
      return [...geom.vertices.map(v => v.clone()), geom.vertices[0].clone()];
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
    layer.stitchType = newType;
    layer.geometry = convertGeometry(layer.geometry, newType);
    return layer;
  }

  /**
   * Compiles all active layers into a single sequence of machine stitches.
   * Handles color changes, tie-ins, and tie-offs.
   * @returns {StitchPoint[]}
   */
  compileStitches() {
    const allStitches = [];

    for (let lIdx = 0; lIdx < this.layers.length; lIdx++) {
      const layer = this.layers[lIdx];
      if (!layer.geometry) continue;

      // Adapt geometry dynamically to match current stitch type
      const geom = convertGeometry(layer.geometry, layer.stitchType) || layer.geometry;

      // Add color change command if transitioning to a new layer
      if (allStitches.length > 0) {
        const lastStitch = allStitches[allStitches.length - 1];
        allStitches.push(new StitchPoint(lastStitch.x, lastStitch.y, StitchCommand.COLOR_CHANGE, lIdx));
      }

      let layerStitches = [];

      switch (layer.stitchType) {
        case StitchType.RUNNING:
        case StitchType.BEAN:
          if (Array.isArray(geom)) {
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

      // Add lock stitches (tie-in and tie-off)
      if (layerStitches.length > 2) {
        const withLocks = this._addLockStitches(layerStitches, lIdx);
        allStitches.push(...withLocks);
      } else {
        allStitches.push(...layerStitches);
      }
    }

    return allStitches;
  }

  /**
   * Adds canonical commercial tie-in and tie-off lock stitches (star cross pattern)
   * and Tajima 3-jump trim sequence to prevent thread unravelling.
   */
  _addLockStitches(stitches, colorIdx) {
    if (stitches.length < 2) return stitches;

    const result = [];
    const first = stitches[0];
    result.push(first); // JUMP to start point

    // Canonical 4-point star tie-in cross at start (0.35mm arms)
    // Standard commercial lock pattern recognized by Wilcom / EM Digitizer / Tajima Pulse
    const sx = first.x;
    const sy = first.y;
    result.push(new StitchPoint(sx, sy, StitchCommand.STITCH, colorIdx)); // initial needle penetration
    result.push(new StitchPoint(sx + 0.35, sy, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(sx - 0.35, sy, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(sx, sy + 0.35, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(sx, sy - 0.35, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(sx, sy, StitchCommand.STITCH, colorIdx)); // anchor center

    // Middle stitches (filter out redundant 0-distance initial stitch if present)
    for (let i = 1; i < stitches.length - 1; i++) {
      const s = stitches[i];
      if (i === 1 && Math.abs(s.x - sx) < 1e-4 && Math.abs(s.y - sy) < 1e-4) {
        continue;
      }
      result.push(stitches[i]);
    }

    // Canonical tie-off lock stitches before end of block (0.30mm arms)
    const last = stitches[stitches.length - 1];
    const lx = last.x;
    const ly = last.y;
    result.push(new StitchPoint(lx, ly, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(lx + 0.3, ly, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(lx - 0.3, ly, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(lx, ly + 0.3, StitchCommand.STITCH, colorIdx));
    result.push(new StitchPoint(lx, ly, StitchCommand.STITCH, colorIdx));

    // Tajima 3-Jump Trim Sequence (hardware trigger for thread trimmer motor)
    result.push(new StitchPoint(lx, ly, StitchCommand.JUMP, colorIdx));
    result.push(new StitchPoint(lx, ly, StitchCommand.JUMP, colorIdx));
    result.push(new StitchPoint(lx, ly, StitchCommand.JUMP, colorIdx));

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
   * Traces a raster image into discrete color layers and registers them with the engine.
   * @param {ImageData|{data: Uint8Array|number[], width: number, height: number}} imageData
   * @param {Object} options
   * @returns {ColorLayer[]}
   */
  importImage(imageData, options = {}) {
    const {
      k = 3,
      targetWidthMm = 75.0,
      simplification = 1.2,
      minAreaMm2 = 3.0,
      defaultStitchType = StitchType.TWILL,
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

    let angleCounter = 0;
    for (const cluster of clusters) {
      const polygons = traceMaskToPolygons(cluster.mask, width, height, {
        targetWidthMm,
        simplification,
        minAreaMm2
      });

      if (polygons.length === 0) continue;

      for (let pIdx = 0; pIdx < polygons.length; pIdx++) {
        const poly = polygons[pIdx];
        const layerId = `trace-${cluster.colorIndex}-${pIdx}`;
        const layerName = polygons.length > 1
          ? `${cluster.threadCode.split('(')[0].trim()} Pt.${pIdx + 1}`
          : cluster.threadCode.split('(')[0].trim();

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
            angle: (angleCounter * 35) % 180,
            underlay: true
          }
        });
        layer.geometry = poly;
        newLayers.push(layer);
      }
      angleCounter++;
    }

    if (this.layers.length > 0) {
      this.activeLayerId = this.layers[0].id;
    }

    return newLayers;
  }
}
