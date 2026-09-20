import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Generates continuous non-crossing curvilinear meander / stippling fill stitches.
 * Ideal for quilt underlays, artistic textures, and open-weave backgrounds.
 * 
 * @param {Polygon} polygon - Closed boundary polygon
 * @param {Object} [options] - Meander options
 * @param {number} [options.density=2.0] - Nominal spacing between adjacent wavy passes (mm)
 * @param {number} [options.stitchLength=2.5] - Target stitch segment length along the curve (mm)
 * @param {number} [options.angle=0] - Orientation angle in degrees
 * @param {number} [options.amplitude] - Wave oscillation amplitude (mm, default density * 0.32)
 * @param {number} [options.wavelength] - Wave cycle length (mm, default density * 1.8)
 * @param {number} [options.colorIndex=0] - Layer color index
 * @returns {StitchPoint[]}
 */
export function generateMeanderFill(polygon, options = {}) {
  if (!polygon || !polygon.vertices || polygon.vertices.length < 3) return [];

  const {
    density = 2.0,
    stitchLength = 2.5,
    angle = 0,
    colorIndex = 0
  } = options;

  const amplitude = options.amplitude !== undefined ? options.amplitude : density * 0.32;
  const wavelength = options.wavelength !== undefined ? options.wavelength : density * 1.8;

  const angleRad = (angle * Math.PI) / 180;
  const rotatedPoly = polygon.rotate(-angleRad);
  const bounds = rotatedPoly.bounds();

  if (bounds.height < 1e-4 || bounds.width < 1e-4) return [];

  const yMin = bounds.minY;
  const yMax = bounds.maxY;
  const rowCount = Math.ceil((yMax - yMin) / density);

  const rawPoints = [];
  let movingRight = true;

  for (let k = 0; k < rowCount; k++) {
    const scanY = yMin + (k + 0.5) * density;
    if (scanY > yMax) break;

    const segments = rotatedPoly.intersectScanline(scanY);
    if (!segments || segments.length === 0) continue;

    // Order segments in travel direction
    const orderedSegments = movingRight ? segments : [...segments].reverse();

    for (let s = 0; s < orderedSegments.length; s++) {
      const [rawX1, rawX2] = orderedSegments[s];
      const xStart = movingRight ? rawX1 : rawX2;
      const xEnd = movingRight ? rawX2 : rawX1;
      const spanLen = Math.abs(xEnd - xStart);

      if (spanLen < 0.3) continue;

      const steps = Math.max(2, Math.ceil(spanLen / stitchLength));
      const phase = (k * Math.PI) / 2;

      const segPoints = [];
      for (let j = 0; j <= steps; j++) {
        const u = j / steps;
        const curX = xStart + (xEnd - xStart) * u;

        // Primary wave + secondary harmonic for organic hand-guided stippling look
        const xRel = Math.abs(curX - rawX1);
        const wy = amplitude * Math.sin((2 * Math.PI * xRel) / wavelength + phase)
          + (amplitude * 0.22) * Math.sin((4 * Math.PI * xRel) / wavelength + phase * 1.3);

        let candidateRotated = new Point2D(curX, scanY + wy);
        let candidateWorld = candidateRotated.rotate(angleRad);

        // Ensure wave peaks stay strictly inside polygon boundary
        if (!polygon.containsPoint(candidateWorld)) {
          // Clamp back towards flat scanline
          candidateRotated = new Point2D(curX, scanY + wy * 0.4);
          candidateWorld = candidateRotated.rotate(angleRad);
          if (!polygon.containsPoint(candidateWorld)) {
            candidateWorld = new Point2D(curX, scanY).rotate(angleRad);
          }
        }

        segPoints.push(candidateWorld);
      }

      rawPoints.push(segPoints);
    }

    movingRight = !movingRight;
  }

  if (rawPoints.length === 0) return [];

  // Convert raw segment points into a continuous stitch stream
  const stitches = [];
  let isFirst = true;

  for (let sIdx = 0; sIdx < rawPoints.length; sIdx++) {
    const pts = rawPoints[sIdx];
    if (pts.length === 0) continue;

    if (isFirst) {
      stitches.push(new StitchPoint(pts[0].x, pts[0].y, StitchCommand.JUMP, colorIndex));
      isFirst = false;
    } else {
      const lastPt = stitches[stitches.length - 1];
      const startPt = pts[0];
      const dist = lastPt.distance(startPt);

      if (dist > 3.5) {
        // Large gap (e.g. across a hole): emit jump
        stitches.push(new StitchPoint(startPt.x, startPt.y, StitchCommand.JUMP, colorIndex));
      } else {
        // Continuous transition along row boundary: step directly with STITCH
        stitches.push(new StitchPoint(startPt.x, startPt.y, StitchCommand.STITCH, colorIndex));
      }
    }

    // Sew the wave segment
    for (let i = 1; i < pts.length; i++) {
      stitches.push(new StitchPoint(pts[i].x, pts[i].y, StitchCommand.STITCH, colorIndex));
    }
  }

  return stitches;
}
