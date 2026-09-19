import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';

/**
 * Evaluates cubic Bézier curve at parameter t in [0, 1]
 */
function evalCubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return new Point2D(
    mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  );
}

/**
 * Parses SVG path 'd' string into an array of polylines and closed polygons.
 * @param {string} d - SVG path data
 * @param {number} scale - Scaling factor from SVG units to millimeters (default 1.0)
 * @returns {{ polygons: Polygon[], polylines: Point2D[][] }}
 */
export function parseSvgPath(d, scale = 1.0) {
  const commands = d.match(/[a-df-z]|[\-+]?(?:\d*\.\d+|\d+)(?:[eE][\-+]?\d+)?/gi) || [];

  const polylines = [];
  const polygons = [];

  let currentPolyline = [];
  let currentPos = new Point2D(0, 0);
  let startPos = new Point2D(0, 0);
  let prevControl = null;

  let i = 0;
  let cmd = '';

  while (i < commands.length) {
    const token = commands[i];

    if (/^[a-df-z]$/i.test(token)) {
      cmd = token;
      i++;
    }

    const isRel = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === 'M') {
      const x = parseFloat(commands[i++]);
      const y = parseFloat(commands[i++]);
      const nextPos = isRel
        ? currentPos.add(new Point2D(x * scale, y * scale))
        : new Point2D(x * scale, y * scale);

      if (currentPolyline.length > 0) {
        polylines.push(currentPolyline);
        currentPolyline = [];
      }

      currentPos = nextPos;
      startPos = nextPos.clone();
      currentPolyline.push(currentPos.clone());
      prevControl = null;
    } else if (type === 'L') {
      const x = parseFloat(commands[i++]);
      const y = parseFloat(commands[i++]);
      currentPos = isRel
        ? currentPos.add(new Point2D(x * scale, y * scale))
        : new Point2D(x * scale, y * scale);
      currentPolyline.push(currentPos.clone());
      prevControl = null;
    } else if (type === 'H') {
      const x = parseFloat(commands[i++]);
      currentPos = new Point2D(
        isRel ? currentPos.x + x * scale : x * scale,
        currentPos.y
      );
      currentPolyline.push(currentPos.clone());
      prevControl = null;
    } else if (type === 'V') {
      const y = parseFloat(commands[i++]);
      currentPos = new Point2D(
        currentPos.x,
        isRel ? currentPos.y + y * scale : y * scale
      );
      currentPolyline.push(currentPos.clone());
      prevControl = null;
    } else if (type === 'C') {
      // Cubic Bézier: x1, y1, x2, y2, x, y
      const x1 = parseFloat(commands[i++]) * scale;
      const y1 = parseFloat(commands[i++]) * scale;
      const x2 = parseFloat(commands[i++]) * scale;
      const y2 = parseFloat(commands[i++]) * scale;
      const x = parseFloat(commands[i++]) * scale;
      const y = parseFloat(commands[i++]) * scale;

      const cp1 = isRel ? currentPos.add(new Point2D(x1, y1)) : new Point2D(x1, y1);
      const cp2 = isRel ? currentPos.add(new Point2D(x2, y2)) : new Point2D(x2, y2);
      const end = isRel ? currentPos.add(new Point2D(x, y)) : new Point2D(x, y);

      const segments = 12;
      for (let s = 1; s <= segments; s++) {
        currentPolyline.push(evalCubicBezier(currentPos, cp1, cp2, end, s / segments));
      }

      prevControl = cp2;
      currentPos = end;
    } else if (type === 'Z') {
      if (currentPolyline.length >= 3) {
        polygons.push(new Polygon(currentPolyline));
      }
      currentPolyline = [];
      currentPos = startPos.clone();
      prevControl = null;
    } else {
      // Unhandled or skip coordinate tokens
      i++;
    }
  }

  if (currentPolyline.length > 1) {
    polylines.push(currentPolyline);
  }

  return { polygons, polylines };
}
