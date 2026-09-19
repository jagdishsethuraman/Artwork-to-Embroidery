/**
 * 2D Vector & Point Mathematics for Embroidery Geometry
 */

export class Point2D {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Point2D(this.x, this.y);
  }

  add(p) {
    return new Point2D(this.x + p.x, this.y + p.y);
  }

  sub(p) {
    return new Point2D(this.x - p.x, this.y - p.y);
  }

  scale(s) {
    return new Point2D(this.x * s, this.y * s);
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  distance(p) {
    return Math.hypot(this.x - p.x, this.y - p.y);
  }

  normalize() {
    const len = this.length();
    if (len < 1e-9) return new Point2D(0, 0);
    return new Point2D(this.x / len, this.y / len);
  }

  dot(p) {
    return this.x * p.x + this.y * p.y;
  }

  cross(p) {
    return this.x * p.y - this.y * p.x;
  }

  normal() {
    // 90-degree counter-clockwise normal
    return new Point2D(-this.y, this.x);
  }

  rotate(angleRad, origin = new Point2D(0, 0)) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = this.x - origin.x;
    const dy = this.y - origin.y;
    return new Point2D(
      origin.x + (dx * cos - dy * sin),
      origin.y + (dx * sin + dy * cos)
    );
  }

  static lerp(p1, p2, t) {
    return new Point2D(
      p1.x + (p2.x - p1.x) * t,
      p1.y + (p2.y - p1.y) * t
    );
  }
}

/**
 * Computes cumulative lengths along a polyline
 */
export function computeCumulativeLengths(points) {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += points[i - 1].distance(points[i]);
    lengths.push(total);
  }
  return { lengths, total };
}

/**
 * Samples a point along a polyline at normalized parameter t in [0, 1]
 */
export function samplePolyline(points, t, cumulativeData = null) {
  if (points.length === 0) return null;
  if (points.length === 1 || t <= 0) return points[0].clone();
  if (t >= 1) return points[points.length - 1].clone();

  const { lengths, total } = cumulativeData || computeCumulativeLengths(points);
  if (total < 1e-9) return points[0].clone();

  const targetDist = t * total;

  // Binary search segment
  let low = 0;
  let high = lengths.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lengths[mid] <= targetDist) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx = Math.max(0, Math.min(points.length - 2, high));
  const segStartDist = lengths[idx];
  const segEndDist = lengths[idx + 1];
  const segLen = segEndDist - segStartDist;

  const segT = segLen > 1e-9 ? (targetDist - segStartDist) / segLen : 0;
  return Point2D.lerp(points[idx], points[idx + 1], segT);
}

/**
 * Computes outward normal at normalized parameter t in [0, 1]
 */
export function samplePolylineNormal(points, t, cumulativeData = null) {
  const dt = 0.005;
  const t0 = Math.max(0, t - dt);
  const t1 = Math.min(1, t + dt);
  const p0 = samplePolyline(points, t0, cumulativeData);
  const p1 = samplePolyline(points, t1, cumulativeData);
  const tangent = p1.sub(p0).normalize();
  return tangent.normal();
}

/**
 * Resamples polyline at fixed equidistant interval
 */
export function resamplePolylineAtInterval(points, interval) {
  if (points.length < 2) return points.map(p => p.clone());
  const { total } = computeCumulativeLengths(points);
  if (total < interval) return [points[0].clone(), points[points.length - 1].clone()];

  const count = Math.max(2, Math.round(total / interval));
  const res = [];
  for (let i = 0; i <= count; i++) {
    res.push(samplePolyline(points, i / count));
  }
  return res;
}
