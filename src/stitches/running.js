import { Point2D, computeCumulativeLengths, samplePolyline } from '../geometry/point.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Generates Running Stitch needle penetrations along a polyline.
 * @param {Point2D[]} polyline
 * @param {Object} options
 * @returns {StitchPoint[]}
 */
export function generateRunningStitch(polyline, options = {}) {
  const {
    stitchLength = 2.5,   // Step length in mm
    bean = false,         // Triple-stitch (forward-back-forward)
    colorIndex = 0
  } = options;

  if (polyline.length < 2) return [];

  const { lengths, total } = computeCumulativeLengths(polyline);
  if (total < 1e-6) return [];

  const count = Math.max(1, Math.round(total / stitchLength));
  const pts = [];

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    pts.push(samplePolyline(polyline, t, { lengths, total }));
  }

  const stitches = [];
  // Jump to first point
  stitches.push(new StitchPoint(pts[0].x, pts[0].y, StitchCommand.JUMP, colorIndex));

  if (!bean) {
    // Standard running stitch
    for (let i = 0; i < pts.length; i++) {
      stitches.push(new StitchPoint(pts[i].x, pts[i].y, StitchCommand.STITCH, colorIndex));
    }
  } else {
    // Bean stitch: 0 -> 1 -> 0 -> 1 -> 2 -> 1 -> 2...
    stitches.push(new StitchPoint(pts[0].x, pts[0].y, StitchCommand.STITCH, colorIndex));
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      stitches.push(new StitchPoint(curr.x, curr.y, StitchCommand.STITCH, colorIndex));
      stitches.push(new StitchPoint(prev.x, prev.y, StitchCommand.STITCH, colorIndex));
      stitches.push(new StitchPoint(curr.x, curr.y, StitchCommand.STITCH, colorIndex));
    }
  }

  return stitches;
}
