import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { generateRunningStitch } from './running.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Generates Tatami and Twill Fill stitches for any closed polygon.
 * @param {Polygon} polygon
 * @param {Object} options
 * @returns {StitchPoint[]}
 */
export function generateTatamiFill(polygon, options = {}) {
  const {
    density = 0.4,           // Row spacing (mm)
    stitchLength = 3.5,      // Max stitch step within row (mm)
    angle = 0,               // Stitch angle in degrees
    stagger = 0.25,          // 0.25 = 4-row twill weave, 0.33 = 3-row tatami
    underlay = true,         // Inset perimeter underlay
    colorIndex = 0
  } = options;

  if (!polygon || polygon.vertices.length < 3) return [];

  const angleRad = (angle * Math.PI) / 180;
  const stitches = [];

  // 1. Underlay: Inset perimeter running stitch to stabilize fabric edges
  if (underlay) {
    const insetPoly = polygon.offset(-0.6);
    if (insetPoly && insetPoly.vertices.length >= 3) {
      const loop = [...insetPoly.vertices, insetPoly.vertices[0]];
      const underlayStitches = generateRunningStitch(loop, {
        stitchLength: 2.5,
        colorIndex
      });
      stitches.push(...underlayStitches);
    }
  }

  // 2. Rotate polygon into horizontal scanline alignment
  const rotatedPoly = polygon.rotate(-angleRad);
  const bounds = rotatedPoly.bounds();

  if (bounds.height < 1e-4 || bounds.width < 1e-4) return stitches;

  const yMin = bounds.minY;
  const yMax = bounds.maxY;
  const rowCount = Math.ceil((yMax - yMin) / density);

  let isFirstStitch = true;

  for (let k = 0; k < rowCount; k++) {
    const scanY = yMin + (k + 0.5) * density;
    if (scanY > yMax) break;

    const segments = rotatedPoly.intersectScanline(scanY);
    if (!segments || segments.length === 0) continue;

    // Alternate row direction (serpentine) to minimize jumps
    const reverseRow = k % 2 === 1;
    const activeSegments = reverseRow ? [...segments].reverse() : segments;

    for (const [x1, x2] of activeSegments) {
      const segStart = reverseRow ? x2 : x1;
      const segEnd = reverseRow ? x1 : x2;
      const segLen = Math.abs(segEnd - segStart);
      if (segLen < 1e-4) continue;

      // Stagger needle penetrations based on twill fraction
      const rowOffset = ((k * stagger) % 1) * stitchLength;
      const stepCount = Math.max(1, Math.ceil(segLen / stitchLength));
      const stepSize = segLen / stepCount;

      const rowPts = [];
      // Start of segment
      rowPts.push(new Point2D(segStart, scanY));

      // Intermediate stitches with stagger
      for (let s = 1; s < stepCount; s++) {
        let xPos = reverseRow
          ? segStart - s * stepSize + (rowOffset % stepSize)
          : segStart + s * stepSize + (rowOffset % stepSize);

        // Ensure clamped inside segment
        if (reverseRow) {
          xPos = Math.max(segEnd, Math.min(segStart, xPos));
        } else {
          xPos = Math.max(segStart, Math.min(segEnd, xPos));
        }
        rowPts.push(new Point2D(xPos, scanY));
      }

      // End of segment
      rowPts.push(new Point2D(segEnd, scanY));

      // Add to stitch stream
      for (let pIdx = 0; pIdx < rowPts.length; pIdx++) {
        // Rotate point back to original space
        const originalPt = rowPts[pIdx].rotate(angleRad);
        const cmd = isFirstStitch ? StitchCommand.JUMP : StitchCommand.STITCH;
        stitches.push(new StitchPoint(originalPt.x, originalPt.y, cmd, colorIndex));
        isFirstStitch = false;
      }
    }
  }

  return stitches;
}
