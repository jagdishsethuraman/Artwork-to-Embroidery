import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';

/**
 * Marching Squares & Ramer-Douglas-Peucker Vector Contour Tracer
 * Converts binary bitmap masks into clean, simplified Polygon vectors scaled to embroidery hoop millimeters.
 */

/**
 * Perpendicular distance from a point to a line segment [p1, p2]
 */
function pointToSegmentDistance(p, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-10) {
    return p.distance(p1);
  }

  // Projection parameter t
  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Ramer-Douglas-Peucker (RDP) polyline simplification
 * @param {Point2D[]} points
 * @param {number} epsilon - Distance threshold
 * @returns {Point2D[]}
 */
export function ramerDouglasPeucker(points, epsilon = 1.0) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

/**
 * Simplifies a closed polygon loop using RDP
 */
export function simplifyPolygonLoop(loop, epsilon = 1.0) {
  if (loop.length <= 4) return loop;

  // Find point farthest from loop[0] to split into two paths
  let maxD = 0;
  let splitIdx = Math.floor(loop.length / 2);

  for (let i = 1; i < loop.length; i++) {
    const d = loop[i].distance(loop[0]);
    if (d > maxD) {
      maxD = d;
      splitIdx = i;
    }
  }

  const half1 = loop.slice(0, splitIdx + 1);
  const half2 = loop.slice(splitIdx).concat([loop[0]]);

  const simp1 = ramerDouglasPeucker(half1, epsilon);
  const simp2 = ramerDouglasPeucker(half2, epsilon);

  const merged = simp1.slice(0, simp1.length - 1).concat(simp2.slice(0, simp2.length - 1));
  return merged.length >= 3 ? merged : loop;
}

/**
 * Traces contours of a 2D binary grid mask using Marching Squares.
 * @param {Uint8Array} mask - Binary mask (1 for foreground, 0 for background)
 * @param {number} width - Grid width in pixels
 * @param {number} height - Grid height in pixels
 * @returns {Array<Point2D[]>} - Array of closed boundary loops in pixel space
 */
export function marchSquares(mask, width, height) {
  const getPixel = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x] ? 1 : 0;
  };

  // Build edge segments for each 2x2 square
  const segments = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tl = getPixel(x, y);
      const tr = getPixel(x + 1, y);
      const br = getPixel(x + 1, y + 1);
      const bl = getPixel(x, y + 1);

      const state = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (state === 0 || state === 15) continue;

      // Midpoints of cell edges
      const top = new Point2D(x + 0.5, y);
      const right = new Point2D(x + 1, y + 0.5);
      const bottom = new Point2D(x + 0.5, y + 1);
      const left = new Point2D(x, y + 0.5);

      switch (state) {
        case 1:  segments.push([left, bottom]); break;
        case 2:  segments.push([bottom, right]); break;
        case 3:  segments.push([left, right]); break;
        case 4:  segments.push([top, right]); break;
        case 5:  segments.push([left, top]); segments.push([bottom, right]); break; // Saddle
        case 6:  segments.push([top, bottom]); break;
        case 7:  segments.push([left, top]); break;
        case 8:  segments.push([top, left]); break;
        case 9:  segments.push([top, bottom]); break;
        case 10: segments.push([top, right]); segments.push([left, bottom]); break; // Saddle
        case 11: segments.push([top, right]); break;
        case 12: segments.push([right, left]); break;
        case 13: segments.push([bottom, right]); break;
        case 14: segments.push([bottom, left]); break;
      }
    }
  }

  if (segments.length === 0) return [];

  // Chain edge segments into closed loops
  const loops = [];
  const used = new Uint8Array(segments.length);

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;

    const currentLoop = [segments[i][0], segments[i][1]];
    used[i] = 1;

    let extended = true;
    while (extended) {
      extended = false;
      const tail = currentLoop[currentLoop.length - 1];

      // Check if loop has already closed onto itself
      if (currentLoop.length > 2 && tail.distance(currentLoop[0]) < 0.1) {
        break;
      }

      // Find connected segment
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;

        const [pA, pB] = segments[j];
        if (tail.distance(pA) < 0.1) {
          currentLoop.push(pB);
          used[j] = 1;
          extended = true;
          break;
        } else if (tail.distance(pB) < 0.1) {
          currentLoop.push(pA);
          used[j] = 1;
          extended = true;
          break;
        }
      }
    }

    // Ensure loop is closed
    if (currentLoop.length >= 4) {
      if (currentLoop[0].distance(currentLoop[currentLoop.length - 1]) > 0.5) {
        currentLoop.push(currentLoop[0].clone());
      }
      loops.push(currentLoop);
    }
  }

  return loops;
}

/**
 * Traces and simplifies binary mask into production-ready Polygon objects.
 * Scales and centers the output to physical embroidery hoop millimeters.
 * @param {Uint8Array} mask - Binary pixel mask
 * @param {number} imgWidth - Source image width in pixels
 * @param {number} imgHeight - Source image height in pixels
 * @param {Object} options
 * @param {number} options.targetWidthMm - Target embroidery hoop width in mm (default 75mm)
 * @param {number} options.simplification - RDP tolerance epsilon (default 1.2px)
 * @param {number} options.minAreaMm2 - Filter out noise speckles smaller than this (default 3.0 mm²)
 * @returns {Polygon[]}
 */
export function traceMaskToPolygons(mask, imgWidth, imgHeight, options = {}) {
  const {
    targetWidthMm = 75.0,
    simplification = 1.2,
    minAreaMm2 = 3.0
  } = options;

  // 1. Extract raw contours via Marching Squares
  const rawLoops = marchSquares(mask, imgWidth, imgHeight);
  if (rawLoops.length === 0) return [];

  // Calculate mm conversion factors
  const maxDimPx = Math.max(imgWidth, imgHeight);
  const mmPerPx = targetWidthMm / maxDimPx;
  const centerX = imgWidth / 2;
  const centerY = imgHeight / 2;

  const polygons = [];

  for (const loop of rawLoops) {
    // 2. Simplify contour with Ramer-Douglas-Peucker
    const simplifiedLoop = simplifyPolygonLoop(loop, simplification);
    if (simplifiedLoop.length < 3) continue;

    // 3. Transform pixel coordinates into centered hoop millimeters
    const mmVertices = simplifiedLoop.map(pt => {
      const xMm = (pt.x - centerX) * mmPerPx;
      const yMm = (pt.y - centerY) * mmPerPx;
      return new Point2D(parseFloat(xMm.toFixed(3)), parseFloat(yMm.toFixed(3)));
    });

    const poly = new Polygon(mmVertices);
    const area = Math.abs(poly.signedArea());

    // 4. Reject tiny noise fragments
    if (area >= minAreaMm2) {
      polygons.push(poly);
    }
  }

  return polygons;
}
