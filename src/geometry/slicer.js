import { Point2D } from './point.js';
import { Polygon, segmentIntersection } from './polygon.js';

/**
 * Splits a polygon across an intersecting cut line segment [cutP1, cutP2].
 * Returns [PolygonA, PolygonB] if split succeeds, or [originalPolygon] if no clean split.
 */
export function splitPolygonByLine(polygon, cutP1, cutP2) {
  const vertices = polygon.vertices;
  const n = vertices.length;
  if (n < 3) return [polygon.clone()];

  // Extend cut line slightly (0.3mm) to prevent floating-point boundary rounding issues
  const dir = cutP2.sub(cutP1).normalize();
  const extP1 = cutP1.sub(dir.scale(0.3));
  const extP2 = cutP2.add(dir.scale(0.3));

  // Find intersections with polygon edges
  const intersections = [];
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const hit = segmentIntersection(p1, p2, extP1, extP2);
    if (hit) {
      // Record edge index and distance along cut line
      const distAlongCut = hit.sub(extP1).dot(dir);
      intersections.push({
        point: hit,
        edgeIndex: i,
        distAlongCut
      });
    }
  }

  // Need at least 2 intersection points crossing opposite edges to split
  if (intersections.length < 2) {
    return [polygon.clone()];
  }

  // Sort intersections along the cut line
  intersections.sort((a, b) => a.distAlongCut - b.distAlongCut);

  // Take the first two crossing points
  const hitA = intersections[0];
  const hitB = intersections[intersections.length - 1];

  let idxA = hitA.edgeIndex;
  let idxB = hitB.edgeIndex;
  if (idxA > idxB) {
    const tmp = idxA;
    idxA = idxB;
    idxB = tmp;
  }

  // Loop 1: from hitA -> vertices from idxA+1 to idxB -> hitB -> close
  const loop1 = [hitA.point.clone()];
  for (let i = idxA + 1; i <= idxB; i++) {
    loop1.push(vertices[i].clone());
  }
  loop1.push(hitB.point.clone());

  // Loop 2: from hitB -> vertices from idxB+1 to end + 0 to idxA -> hitA -> close
  const loop2 = [hitB.point.clone()];
  for (let i = idxB + 1; i < n; i++) {
    loop2.push(vertices[i].clone());
  }
  for (let i = 0; i <= idxA; i++) {
    loop2.push(vertices[i].clone());
  }
  loop2.push(hitA.point.clone());

  return [new Polygon(loop1), new Polygon(loop2)];
}

/**
 * Splits a dual-rail Satin column into two shorter Satin columns.
 * @param {Point2D[]} rail1 - First boundary rail
 * @param {Point2D[]} rail2 - Opposite boundary rail
 * @param {Point2D} cutP1 - Start of cut line
 * @param {Point2D} cutP2 - End of cut line
 * @returns {[{rail1: Point2D[], rail2: Point2D[]}, {rail1: Point2D[], rail2: Point2D[]}] | null}
 */
export function splitSatinByLine(rail1, rail2, cutP1, cutP2) {
  if (!rail1 || rail1.length < 2 || !rail2 || rail2.length < 2) return null;

  const dir = cutP2.sub(cutP1).normalize();
  const extP1 = cutP1.sub(dir.scale(0.3));
  const extP2 = cutP2.add(dir.scale(0.3));

  // Find intersection with rail1
  let hit1 = null;
  let idx1 = -1;
  for (let i = 0; i < rail1.length - 1; i++) {
    const hit = segmentIntersection(rail1[i], rail1[i + 1], extP1, extP2);
    if (hit) {
      hit1 = hit;
      idx1 = i;
      break;
    }
  }

  // Find intersection with rail2
  let hit2 = null;
  let idx2 = -1;
  for (let j = 0; j < rail2.length - 1; j++) {
    const hit = segmentIntersection(rail2[j], rail2[j + 1], extP1, extP2);
    if (hit) {
      hit2 = hit;
      idx2 = j;
      break;
    }
  }

  // Knife cut line must intersect both rails cleanly
  if (!hit1 || !hit2) return null;

  const r1A = [...rail1.slice(0, idx1 + 1), hit1];
  const r2A = [...rail2.slice(0, idx2 + 1), hit2];

  const r1B = [hit1, ...rail1.slice(idx1 + 1)];
  const r2B = [hit2, ...rail2.slice(idx2 + 1)];

  if (r1A.length < 2 || r2A.length < 2 || r1B.length < 2 || r2B.length < 2) return null;

  return [
    { rail1: r1A, rail2: r2A },
    { rail1: r1B, rail2: r2B }
  ];
}

/**
 * Splits a polyline (running or bean stitch) into two paths.
 * @param {Point2D[]} polyline
 * @param {Point2D} cutP1
 * @param {Point2D} cutP2
 * @returns {[Point2D[], Point2D[]] | null}
 */
export function splitPolylineByLine(polyline, cutP1, cutP2) {
  if (!polyline || polyline.length < 2) return null;

  const dir = cutP2.sub(cutP1).normalize();
  const extP1 = cutP1.sub(dir.scale(0.3));
  const extP2 = cutP2.add(dir.scale(0.3));

  for (let i = 0; i < polyline.length - 1; i++) {
    const hit = segmentIntersection(polyline[i], polyline[i + 1], extP1, extP2);
    if (hit) {
      const lineA = [...polyline.slice(0, i + 1), hit];
      const lineB = [hit, ...polyline.slice(i + 1)];
      if (lineA.length >= 2 && lineB.length >= 2) {
        return [lineA, lineB];
      }
    }
  }
  return null;
}
