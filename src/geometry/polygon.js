import { Point2D } from './point.js';

/**
 * Closed Polygon representation with hole support
 */
export class Polygon {
  constructor(vertices = []) {
    // Array of Point2D representing closed loop
    this.vertices = vertices.map(v => (v instanceof Point2D ? v.clone() : new Point2D(v.x, v.y)));
    this.holes = []; // Array of arrays of Point2D
  }

  addHole(holeVertices) {
    this.holes.push(holeVertices.map(v => (v instanceof Point2D ? v.clone() : new Point2D(v.x, v.y))));
  }

  clone() {
    const poly = new Polygon(this.vertices);
    poly.holes = this.holes.map(h => h.map(v => v.clone()));
    return poly;
  }

  bounds() {
    if (this.vertices.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const v of this.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  signedArea() {
    let area = 0;
    const n = this.vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += this.vertices[i].cross(this.vertices[j]);
    }
    return area / 2;
  }

  isClockwise() {
    return this.signedArea() < 0;
  }

  containsPoint(point) {
    if (!this._pointInLoop(point, this.vertices)) return false;
    for (const hole of this.holes) {
      if (this._pointInLoop(point, hole)) return false;
    }
    return true;
  }

  _pointInLoop(point, loop) {
    let inside = false;
    const n = loop.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = loop[i].x, yi = loop[i].y;
      const xj = loop[j].x, yj = loop[j].y;
      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Rotates polygon by angleRad around given origin
   */
  rotate(angleRad, origin = new Point2D(0, 0)) {
    const rotatedVertices = this.vertices.map(v => v.rotate(angleRad, origin));
    const rotatedPoly = new Polygon(rotatedVertices);
    rotatedPoly.holes = this.holes.map(hole => hole.map(v => v.rotate(angleRad, origin)));
    return rotatedPoly;
  }

  /**
   * Clips horizontal scanline y = scanY against this polygon.
   * Returns list of interior line segments [ [xStart, xEnd], ... ]
   */
  intersectScanline(scanY) {
    const xIntersections = [];

    const testLoop = (loop) => {
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const p1 = loop[i];
        const p2 = loop[(i + 1) % n];

        // Check if scanline crosses edge (p1, p2)
        if ((p1.y <= scanY && p2.y > scanY) || (p2.y <= scanY && p1.y > scanY)) {
          const dy = p2.y - p1.y;
          if (Math.abs(dy) > 1e-9) {
            const t = (scanY - p1.y) / dy;
            const x = p1.x + t * (p2.x - p1.x);
            xIntersections.push(x);
          }
        }
      }
    };

    testLoop(this.vertices);
    for (const hole of this.holes) {
      testLoop(hole);
    }

    xIntersections.sort((a, b) => a - b);

    // Group sorted x intersections into pairs [xStart, xEnd]
    const segments = [];
    for (let i = 0; i < xIntersections.length - 1; i += 2) {
      const x1 = xIntersections[i];
      const x2 = xIntersections[i + 1];
      if (x2 - x1 > 1e-5) {
        segments.push([x1, x2]);
      }
    }
    return segments;
  }

  /**
   * Simple inward/outward polygon offset (inset) for underlay passes
   */
  offset(delta) {
    const n = this.vertices.length;
    if (n < 3) return this.clone();

    const newVertices = [];
    const isCW = this.isClockwise();
    // For CW, outward normal is (dy, -dx). For CCW, outward normal is (-dy, dx).
    const sign = isCW ? 1 : -1;

    for (let i = 0; i < n; i++) {
      const pPrev = this.vertices[(i - 1 + n) % n];
      const pCurr = this.vertices[i];
      const pNext = this.vertices[(i + 1) % n];

      const d1 = pCurr.sub(pPrev).normalize();
      const d2 = pNext.sub(pCurr).normalize();

      const n1 = new Point2D(-d1.y * sign, d1.x * sign);
      const n2 = new Point2D(-d2.y * sign, d2.x * sign);

      const bisector = n1.add(n2).normalize();
      const cosAngle = bisector.dot(n1);
      const miter = cosAngle > 0.1 ? delta / cosAngle : delta;
      const clampedMiter = Math.max(-Math.abs(delta) * 2, Math.min(Math.abs(delta) * 2, miter));

      newVertices.push(pCurr.add(bisector.scale(clampedMiter)));
    }

    const newPoly = new Polygon(newVertices);
    // For underlay inset (delta < 0), hole boundary moves outward into hole (-delta)
    for (const hole of this.holes) {
      if (hole.length >= 3) {
        const holePoly = new Polygon(hole);
        const offsetHole = holePoly.offset(-delta);
        if (offsetHole && offsetHole.vertices.length >= 3) {
          newPoly.addHole(offsetHole.vertices);
        }
      }
    }

    return newPoly;
  }
}

/**
 * Line segment intersection between [p1, p2] and [p3, p4]
 */
export function segmentIntersection(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;

  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    return new Point2D(p1.x + u * (p2.x - p1.x), p1.y + u * (p2.y - p1.y));
  }
  return null;
}
