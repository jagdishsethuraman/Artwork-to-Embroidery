import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Finds intersection between a ray from origin C in direction d and segment AB.
 * Returns { t, point } where t > 0 is distance along ray, or null if no intersection.
 */
function rayIntersectSegment(C, d, A, B) {
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const denom = d.x * vy - d.y * vx;
  if (Math.abs(denom) < 1e-9) return null;

  const t = ((A.x - C.x) * vy - (A.y - C.y) * vx) / denom;
  const u = ((A.x - C.x) * d.y - (A.y - C.y) * d.x) / denom;

  if (t > 1e-4 && u >= -1e-4 && u <= 1 + 1e-4) {
    return { t, point: new Point2D(C.x + t * d.x, C.y + t * d.y) };
  }
  return null;
}

/**
 * Finds all intersections of a ray from C with a closed polygon loop.
 */
function rayIntersectionsWithLoop(C, d, loop) {
  const hits = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p1 = loop[i];
    const p2 = loop[(i + 1) % n];
    const hit = rayIntersectSegment(C, d, p1, p2);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

/**
 * Generates Radial Satin stitches around a central point or within an annular ring.
 * Features:
 *  - 360-degree radial stepping calibrated to perimeter density
 *  - Concentric circular underlay line at mid-depth
 *  - Feathered inner hub stepping to prevent needle crowd perforation at center
 *  - Outward pull compensation along radial vectors
 * 
 * @param {Polygon} polygon - Closed boundary polygon (may contain holes for donut rings)
 * @param {Object} [options] - Generation options
 * @param {Point2D|{x: number, y: number}} [options.center] - Radial center (defaults to polygon centroid)
 * @param {number} [options.density=0.4] - Spacing between stitches at outer perimeter (mm)
 * @param {number} [options.innerRadius] - Radius of inner boundary if no hole exists (mm, default 1.5mm)
 * @param {number} [options.pullComp=0.3] - Outward pull compensation (mm)
 * @param {boolean} [options.underlay=true] - Generate concentric underlay ring
 * @param {boolean} [options.featherHub=true] - Retract every 2nd inner needle penetration near center
 * @param {number} [options.colorIndex=0] - Layer color index
 * @returns {StitchPoint[]}
 */
export function generateRadialSatin(polygon, options = {}) {
  if (!polygon || !polygon.vertices || polygon.vertices.length < 3) return [];

  const {
    density = 0.4,
    pullComp = 0.3,
    underlay = true,
    featherHub = true,
    colorIndex = 0
  } = options;

  const center = options.center instanceof Point2D
    ? options.center
    : (options.center ? new Point2D(options.center.x, options.center.y) : polygon.centroid());

  const hasHole = polygon.holes && polygon.holes.length > 0;
  const innerRadiusDefault = options.innerRadius !== undefined ? Math.max(0.5, options.innerRadius) : 1.5;

  // 1. Determine average outer radius to calibrate angular step count
  let sumR = 0;
  for (const v of polygon.vertices) {
    sumR += center.distance(v);
  }
  const avgOuterR = Math.max(2.0, sumR / polygon.vertices.length);

  // Angular resolution: arc length at perimeter ≈ density
  const circumference = 2 * Math.PI * avgOuterR;
  const numSteps = Math.max(16, Math.round(circumference / density));
  const deltaTheta = (2 * Math.PI) / numSteps;

  const stitches = [];

  // Helper to compute radial ray intersections at angle theta
  const getRadialBounds = (theta) => {
    const dir = new Point2D(Math.cos(theta), Math.sin(theta));
    const outerHits = rayIntersectionsWithLoop(center, dir, polygon.vertices);
    if (outerHits.length === 0) {
      // Fallback if ray missed (e.g. concave corner): use average radius
      return {
        inner: new Point2D(center.x + innerRadiusDefault * dir.x, center.y + innerRadiusDefault * dir.y),
        outer: new Point2D(center.x + (avgOuterR + pullComp) * dir.x, center.y + (avgOuterR + pullComp) * dir.y),
        outerR: avgOuterR
      };
    }

    // Outer-most intersection along ray
    const outerHit = outerHits[outerHits.length - 1];
    const outerR = outerHit.t + pullComp;
    const outerPt = new Point2D(center.x + outerR * dir.x, center.y + outerR * dir.y);

    let innerPt;
    if (hasHole) {
      // Find intersection with hole loop
      const holeHits = rayIntersectionsWithLoop(center, dir, polygon.holes[0]);
      if (holeHits.length > 0) {
        const innerR = Math.max(0.2, holeHits[0].t - pullComp);
        innerPt = new Point2D(center.x + innerR * dir.x, center.y + innerR * dir.y);
      } else {
        innerPt = new Point2D(center.x + innerRadiusDefault * dir.x, center.y + innerRadiusDefault * dir.y);
      }
    } else {
      innerPt = new Point2D(center.x + innerRadiusDefault * dir.x, center.y + innerRadiusDefault * dir.y);
    }

    return { inner: innerPt, outer: outerPt, outerR };
  };

  // 2. Concentric Underlay Ring (Mid-radius running stitch)
  if (underlay) {
    const underlaySteps = Math.max(8, Math.round(circumference / 2.5)); // ~2.5mm stitch spacing
    const underlayAngleStep = (2 * Math.PI) / underlaySteps;

    const firstPt = getRadialBounds(0);
    const midStart = new Point2D((firstPt.inner.x + firstPt.outer.x) / 2, (firstPt.inner.y + firstPt.outer.y) / 2);

    // Initial JUMP to underlay start
    stitches.push(new StitchPoint(midStart.x, midStart.y, StitchCommand.JUMP, colorIndex));

    for (let i = 0; i <= underlaySteps; i++) {
      const th = i * underlayAngleStep;
      const b = getRadialBounds(th);
      const mid = new Point2D((b.inner.x + b.outer.x) / 2, (b.inner.y + b.outer.y) / 2);
      stitches.push(new StitchPoint(mid.x, mid.y, StitchCommand.STITCH, colorIndex));
    }
  }

  // 3. Top Satin Zigzag Stitches
  const firstBounds = getRadialBounds(0);
  if (stitches.length === 0) {
    stitches.push(new StitchPoint(firstBounds.inner.x, firstBounds.inner.y, StitchCommand.JUMP, colorIndex));
  }

  for (let k = 0; k <= numSteps; k++) {
    const theta = k * deltaTheta;
    const { inner, outer, outerR } = getRadialBounds(theta);

    let actualInner = inner;

    // Feathered hub anti-perforation:
    // If no hole exists and spacing between adjacent inner needle drops < 0.35mm,
    // retract odd stitches outwards along radius to distribute needle load
    if (!hasHole && featherHub && (k % 2 === 1)) {
      const innerArcDist = deltaTheta * innerRadiusDefault;
      if (innerArcDist < 0.35) {
        // Retract inner point to 40% of radial span
        const dir = new Point2D(Math.cos(theta), Math.sin(theta));
        const featheredR = innerRadiusDefault + 0.45 * (outerR - innerRadiusDefault);
        actualInner = new Point2D(center.x + featheredR * dir.x, center.y + featheredR * dir.y);
      }
    }

    if (k % 2 === 0) {
      // Inner to Outer
      stitches.push(new StitchPoint(actualInner.x, actualInner.y, StitchCommand.STITCH, colorIndex));
      stitches.push(new StitchPoint(outer.x, outer.y, StitchCommand.STITCH, colorIndex));
    } else {
      // Outer to Inner
      stitches.push(new StitchPoint(outer.x, outer.y, StitchCommand.STITCH, colorIndex));
      stitches.push(new StitchPoint(actualInner.x, actualInner.y, StitchCommand.STITCH, colorIndex));
    }
  }

  return stitches;
}

/**
 * Generates an unbroken Archimedean spiral running fill with zero jumps.
 * Equation: r(theta) = r0 + (density / 2pi) * theta.
 * 
 * @param {Polygon} polygon - Bounding polygon (e.g. circle, badge, crest)
 * @param {Object} [options] - Spiral options
 * @param {Point2D|{x: number, y: number}} [options.center] - Spiral origin (defaults to polygon centroid)
 * @param {number} [options.density=0.6] - Distance between consecutive spiral rings (mm)
 * @param {number} [options.stitchLength=3.0] - Maximum stitch step along curve (mm)
 * @param {number} [options.innerRadius=0.5] - Starting center offset (mm)
 * @param {number} [options.colorIndex=0] - Layer color index
 * @returns {StitchPoint[]}
 */
export function generateSpiralFill(polygon, options = {}) {
  if (!polygon || !polygon.vertices || polygon.vertices.length < 3) return [];

  const {
    density = 0.6,
    stitchLength = 3.0,
    innerRadius = 0.5,
    colorIndex = 0
  } = options;

  const center = options.center instanceof Point2D
    ? options.center
    : (options.center ? new Point2D(options.center.x, options.center.y) : polygon.centroid());

  // Determine maximum radius from center to any polygon vertex
  let maxR = 0;
  for (const v of polygon.vertices) {
    const d = center.distance(v);
    if (d > maxR) maxR = d;
  }

  if (maxR <= innerRadius) return [];

  const b = density / (2 * Math.PI); // Radius growth per radian
  const maxTheta = ((maxR + density) - innerRadius) / b;

  const stitches = [];
  let theta = 0;
  let r = innerRadius;

  // Initial JUMP to spiral center start
  const startX = center.x + r * Math.cos(theta);
  const startY = center.y + r * Math.sin(theta);
  stitches.push(new StitchPoint(startX, startY, StitchCommand.JUMP, colorIndex));

  // Step along spiral
  while (theta <= maxTheta && r <= maxR + density) {
    // Angular step to achieve stitchLength along curve: ds ≈ r * dtheta
    const dTheta = Math.max(0.05, Math.min(Math.PI / 2, stitchLength / Math.max(r, 0.4)));
    theta += dTheta;
    r = innerRadius + b * theta;

    const pt = new Point2D(center.x + r * Math.cos(theta), center.y + r * Math.sin(theta));

    // Check boundary containment
    if (polygon.containsPoint(pt)) {
      stitches.push(new StitchPoint(pt.x, pt.y, StitchCommand.STITCH, colorIndex));
    }
  }

  return stitches;
}
