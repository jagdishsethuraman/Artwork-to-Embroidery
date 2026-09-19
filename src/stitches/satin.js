import { Point2D, computeCumulativeLengths, samplePolyline, samplePolylineNormal } from '../geometry/point.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Generates Satin Column stitches between two boundary rails.
 * @param {Point2D[]} rail1 - First boundary rail
 * @param {Point2D[]} rail2 - Opposite boundary rail
 * @param {Object} options
 * @returns {StitchPoint[]}
 */
export function generateSatinColumn(rail1, rail2, options = {}) {
  const {
    density = 0.4,       // Spacing between stitches along rail (mm)
    pullComp = 0.3,      // Outward pull compensation (mm)
    underlay = true,     // Center-walk underlay
    colorIndex = 0
  } = options;

  if (rail1.length < 2 || rail2.length < 2) return [];

  const data1 = computeCumulativeLengths(rail1);
  const data2 = computeCumulativeLengths(rail2);

  const maxLen = Math.max(data1.total, data2.total);
  if (maxLen < 1e-5) return [];

  const steps = Math.max(2, Math.round(maxLen / density));
  const stitches = [];

  // 1. Underlay (Center-Walk): Run stitches along centerline
  if (underlay) {
    const underlaySteps = Math.max(2, Math.round(maxLen / 2.5)); // ~2.5mm running stitch
    const centerPts = [];
    for (let i = 0; i <= underlaySteps; i++) {
      const u = i / underlaySteps;
      const p1 = samplePolyline(rail1, u, data1);
      const p2 = samplePolyline(rail2, u, data2);
      centerPts.push(new Point2D((p1.x + p2.x) / 2, (p1.y + p2.y) / 2));
    }

    // Jump to underlay start
    stitches.push(new StitchPoint(centerPts[0].x, centerPts[0].y, StitchCommand.JUMP, colorIndex));
    for (let i = 0; i < centerPts.length; i++) {
      stitches.push(new StitchPoint(centerPts[i].x, centerPts[i].y, StitchCommand.STITCH, colorIndex));
    }
  }

  // 2. Top Satin Stitches: Zigzag between Rail 1 and Rail 2
  const topStitches = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p1 = samplePolyline(rail1, u, data1);
    const p2 = samplePolyline(rail2, u, data2);

    // Compute normals for pull compensation
    // We want outward normals: pointing away from center
    const center = new Point2D((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);

    let n1 = samplePolylineNormal(rail1, u, data1);
    // Ensure n1 points away from center
    if (p1.add(n1).distance(center) < p1.distance(center)) {
      n1 = n1.scale(-1);
    }

    let n2 = samplePolylineNormal(rail2, u, data2);
    // Ensure n2 points away from center
    if (p2.add(n2).distance(center) < p2.distance(center)) {
      n2 = n2.scale(-1);
    }

    const p1Comp = p1.add(n1.scale(pullComp));
    const p2Comp = p2.add(n2.scale(pullComp));

    topStitches.push({ p1: p1Comp, p2: p2Comp });
  }

  if (topStitches.length === 0) return stitches;

  // Jump to first satin point
  stitches.push(new StitchPoint(topStitches[0].p1.x, topStitches[0].p1.y, StitchCommand.JUMP, colorIndex));

  // Zigzag sequence
  for (let i = 0; i < topStitches.length; i++) {
    const { p1, p2 } = topStitches[i];
    stitches.push(new StitchPoint(p1.x, p1.y, StitchCommand.STITCH, colorIndex));
    stitches.push(new StitchPoint(p2.x, p2.y, StitchCommand.STITCH, colorIndex));
  }

  return stitches;
}
