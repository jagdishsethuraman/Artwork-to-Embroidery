import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { traceMaskToPolygons } from '../trace/contour-tracer.js';
import { StitchType, ColorLayer } from '../stitches/types.js';
import { convertGeometry, cloneGeometry } from '../engine.js';

/**
 * Built-in 8x12 vector stroke bitmap font for universal Node.js/headless compatibility.
 * Each glyph is represented as 12 rows of 8 bits (high bit = column 0).
 */
const BUILTIN_BITMAP_FONT = {
  'A': [0x3C, 0x66, 0x42, 0x42, 0x7E, 0x42, 0x42, 0x42, 0x42, 0x42, 0x00, 0x00],
  'B': [0x7C, 0x66, 0x66, 0x66, 0x7C, 0x66, 0x66, 0x66, 0x66, 0x7C, 0x00, 0x00],
  'C': [0x3C, 0x66, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x66, 0x3C, 0x00, 0x00],
  'D': [0x78, 0x6C, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x6C, 0x78, 0x00, 0x00],
  'E': [0x7E, 0x40, 0x40, 0x40, 0x7C, 0x40, 0x40, 0x40, 0x40, 0x7E, 0x00, 0x00],
  'F': [0x7E, 0x40, 0x40, 0x40, 0x7C, 0x40, 0x40, 0x40, 0x40, 0x40, 0x00, 0x00],
  'G': [0x3C, 0x66, 0x60, 0x60, 0x6E, 0x62, 0x62, 0x62, 0x66, 0x3C, 0x00, 0x00],
  'H': [0x66, 0x66, 0x66, 0x66, 0x7E, 0x66, 0x66, 0x66, 0x66, 0x66, 0x00, 0x00],
  'I': [0x3C, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00, 0x00],
  'J': [0x0E, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x66, 0x66, 0x3C, 0x00, 0x00],
  'K': [0x66, 0x6C, 0x78, 0x70, 0x68, 0x6C, 0x66, 0x66, 0x66, 0x66, 0x00, 0x00],
  'L': [0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7E, 0x00, 0x00],
  'M': [0x81, 0xC3, 0xA5, 0x99, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x00, 0x00],
  'N': [0x63, 0x73, 0x7B, 0x6B, 0x6F, 0x67, 0x63, 0x63, 0x63, 0x63, 0x00, 0x00],
  'O': [0x3C, 0x66, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x66, 0x3C, 0x00, 0x00],
  'P': [0x7C, 0x66, 0x66, 0x66, 0x7C, 0x60, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00],
  'Q': [0x3C, 0x66, 0x42, 0x42, 0x42, 0x42, 0x46, 0x6E, 0x7A, 0x3E, 0x00, 0x00],
  'R': [0x7C, 0x66, 0x66, 0x66, 0x7C, 0x68, 0x6C, 0x66, 0x66, 0x66, 0x00, 0x00],
  'S': [0x3C, 0x66, 0x60, 0x3C, 0x0E, 0x06, 0x06, 0x66, 0x66, 0x3C, 0x00, 0x00],
  'T': [0x7E, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x00],
  'U': [0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00, 0x00],
  'V': [0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x3C, 0x18, 0x18, 0x18, 0x00, 0x00],
  'W': [0x81, 0x81, 0x81, 0x81, 0x81, 0x99, 0xA5, 0xA5, 0x5A, 0x42, 0x00, 0x00],
  'X': [0x66, 0x66, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0x66, 0x66, 0x66, 0x00, 0x00],
  'Y': [0x66, 0x66, 0x66, 0x3C, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x00],
  'Z': [0x7E, 0x0C, 0x18, 0x30, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7E, 0x00, 0x00],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '0': [0x3C, 0x66, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x66, 0x3C, 0x00, 0x00],
  '1': [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3E, 0x00, 0x00],
  '2': [0x3C, 0x66, 0x06, 0x0C, 0x18, 0x30, 0x60, 0x60, 0x60, 0x7E, 0x00, 0x00],
  '3': [0x3C, 0x66, 0x06, 0x06, 0x1C, 0x06, 0x06, 0x06, 0x66, 0x3C, 0x00, 0x00],
  '4': [0x66, 0x66, 0x66, 0x7E, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x00, 0x00],
  '5': [0x7E, 0x60, 0x60, 0x7C, 0x06, 0x06, 0x06, 0x06, 0x66, 0x3C, 0x00, 0x00],
  '6': [0x3C, 0x66, 0x60, 0x7C, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00, 0x00],
  '7': [0x7E, 0x06, 0x0C, 0x18, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x00, 0x00],
  '8': [0x3C, 0x66, 0x66, 0x3C, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00, 0x00],
  '9': [0x3C, 0x66, 0x66, 0x66, 0x66, 0x3E, 0x06, 0x06, 0x66, 0x3C, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x00, 0x7E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00, 0x00],
  '!': [0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x18, 0x00, 0x00]
};

/**
 * Warps a polygon along an arc centered at origin.
 * @param {Polygon} poly
 * @param {number} arcAngleDeg - Baseline arc angle in degrees (-90 to +90)
 * @param {number} textWidthMm - Total width of text baseline
 * @returns {Polygon}
 */
export function warpPolygonAlongArc(poly, arcAngleDeg, textWidthMm) {
  if (Math.abs(arcAngleDeg) < 1.0 || textWidthMm <= 0) return poly;

  const thetaTotal = (arcAngleDeg * Math.PI) / 180;
  const radius = textWidthMm / thetaTotal; // arc length s = r * theta => r = s / theta

  function warpPoint(p) {
    const angle = (p.x / textWidthMm) * thetaTotal;
    const r = radius - p.y;
    const wx = r * Math.sin(angle);
    const wy = radius - r * Math.cos(angle);
    return new Point2D(wx, wy);
  }

  const warpedVerts = poly.vertices.map(warpPoint);
  const warpedPoly = new Polygon(warpedVerts);
  for (const hole of poly.holes) {
    warpedPoly.addHole(hole.map(warpPoint));
  }
  return warpedPoly;
}

/**
 * Renders a text string into vector embroidery polygons with hole detection.
 * Works seamlessly in Browser (HTML5 Canvas) and Headless Node (Bitmap Font).
 *
 * @param {string} text - The text string to render (e.g. "ATHLETIC", "NYC 2026")
 * @param {Object} options
 * @param {number} [options.targetHeightMm=20.0] - Target text height in millimeters
 * @param {string} [options.fontFamily='sans-serif'] - Font family ('sans-serif', 'serif', 'varsity', 'script', 'monospace')
 * @param {number} [options.letterSpacingMm=1.5] - Spacing between adjacent letters in mm
 * @param {number} [options.arcAngle=0] - Arc bend angle in degrees (-60 to +60)
 * @returns {Polygon[]} Array of closed Polygon characters/loops with nested holes
 */
export function renderTextToPolygons(text, options = {}) {
  const {
    targetHeightMm = 20.0,
    fontFamily = 'sans-serif',
    letterSpacingMm = 1.0,
    arcAngle = 0
  } = options;

  if (!text || text.trim().length === 0) return [];

  const cleanText = text.toUpperCase();

  // 1. Browser Environment: Use high-res Canvas 2D
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const pxPerMm = 12; // 12 pixels per mm for clean vectorization
    const fontSizePx = Math.round(targetHeightMm * pxPerMm);

    let cssFontFamily = fontFamily;
    if (fontFamily === 'varsity') {
      cssFontFamily = 'Impact, "Arial Black", sans-serif';
    } else if (fontFamily === 'serif') {
      cssFontFamily = '"Times New Roman", Georgia, serif';
    } else if (fontFamily === 'script') {
      cssFontFamily = '"Brush Script MT", "Caveat", cursive';
    } else if (fontFamily === 'monospace') {
      cssFontFamily = '"Courier New", Courier, monospace';
    }

    ctx.font = `bold ${fontSizePx}px ${cssFontFamily}`;
    const metrics = ctx.measureText(cleanText);
    const textWidthPx = metrics.width;
    const paddingPx = Math.round(10 * pxPerMm);

    canvas.width = Math.ceil(textWidthPx + paddingPx * 2);
    canvas.height = Math.ceil(fontSizePx * 1.6 + paddingPx * 2);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSizePx}px ${cssFontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(cleanText, canvas.width / 2, canvas.height / 2);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imgData.data[i * 4] > 128 ? 1 : 0;
    }

    const targetWidthMm = (canvas.width / pxPerMm);
    const rawPolys = traceMaskToPolygons(mask, canvas.width, canvas.height, {
      targetWidthMm,
      simplification: 0.35,
      minAreaMm2: 2.0
    });

    if (rawPolys.length === 0) return [];

    // Center polygons at (0, 0)
    let allMinX = Infinity, allMaxX = -Infinity;
    let allMinY = Infinity, allMaxY = -Infinity;
    for (const p of rawPolys) {
      const b = p.bounds();
      if (b.minX < allMinX) allMinX = b.minX;
      if (b.maxX > allMaxX) allMaxX = b.maxX;
      if (b.minY < allMinY) allMinY = b.minY;
      if (b.maxY > allMaxY) allMaxY = b.maxY;
    }
    const midX = (allMinX + allMaxX) / 2;
    const midY = (allMinY + allMaxY) / 2;
    const totalW = allMaxX - allMinX;

    const centeredPolys = rawPolys.map(poly => {
      const shiftedVerts = poly.vertices.map(v => new Point2D(v.x - midX, v.y - midY));
      const shifted = new Polygon(shiftedVerts);
      for (const h of poly.holes) {
        shifted.addHole(h.map(v => new Point2D(v.x - midX, v.y - midY)));
      }
      return shifted;
    });

    if (Math.abs(arcAngle) >= 1.0) {
      return centeredPolys.map(p => warpPolygonAlongArc(p, arcAngle, totalW));
    }
    return centeredPolys;
  }

  // 2. Headless Node.js Environment: Use Built-in Scaled Bitmap Font
  const scale = 8;
  const numChars = cleanText.length;
  const activeRows = 10;
  const glyphBitW = 8;
  const glyphBitH = 12;

  const scaleMmPerPixel = targetHeightMm / (activeRows * scale);
  const spacingPx = Math.max(scale, Math.round(letterSpacingMm / scaleMmPerPixel));
  const paddingX = scale * 2;
  const paddingY = scale * 2;

  const canvasW = paddingX * 2 + numChars * (glyphBitW * scale) + Math.max(0, numChars - 1) * spacingPx;
  const canvasH = paddingY * 2 + glyphBitH * scale;

  const mask = new Uint8Array(canvasW * canvasH);
  let curX = paddingX;

  for (let c = 0; c < numChars; c++) {
    const ch = cleanText[c];
    const bmp = BUILTIN_BITMAP_FONT[ch] || BUILTIN_BITMAP_FONT[' '];
    for (let r = 0; r < glyphBitH; r++) {
      const rowByte = bmp[r];
      const startPy = paddingY + r * scale;
      for (let col = 0; col < glyphBitW; col++) {
        if ((rowByte & (0x80 >> col)) !== 0) {
          const startPx = curX + col * scale;
          for (let dy = 0; dy < scale; dy++) {
            const rowOffset = (startPy + dy) * canvasW;
            for (let dx = 0; dx < scale; dx++) {
              mask[rowOffset + startPx + dx] = 1;
            }
          }
        }
      }
    }
    curX += glyphBitW * scale + spacingPx;
  }

  const maxDimPx = Math.max(canvasW, canvasH);
  const totalWidthMm = maxDimPx * scaleMmPerPixel;

  const rawPolys = traceMaskToPolygons(mask, canvasW, canvasH, {
    targetWidthMm: totalWidthMm,
    simplification: 0.5,
    minAreaMm2: 1.0
  });

  if (rawPolys.length === 0) return [];

  // Center around (0, 0)
  let allMinX = Infinity, allMaxX = -Infinity;
  let allMinY = Infinity, allMaxY = -Infinity;
  for (const p of rawPolys) {
    const b = p.bounds();
    if (b.minX < allMinX) allMinX = b.minX;
    if (b.maxX > allMaxX) allMaxX = b.maxX;
    if (b.minY < allMinY) allMinY = b.minY;
    if (b.maxY > allMaxY) allMaxY = b.maxY;
  }
  const midX = (allMinX + allMaxX) / 2;
  const midY = (allMinY + allMaxY) / 2;
  const totalW = allMaxX - allMinX;

  const centeredPolys = rawPolys.map(poly => {
    const shiftedVerts = poly.vertices.map(v => new Point2D(v.x - midX, v.y - midY));
    const shifted = new Polygon(shiftedVerts);
    for (const h of poly.holes) {
      shifted.addHole(h.map(v => new Point2D(v.x - midX, v.y - midY)));
    }
    return shifted;
  });

  if (Math.abs(arcAngle) >= 1.0) {
    return centeredPolys.map(p => warpPolygonAlongArc(p, arcAngle, totalW));
  }
  return centeredPolys;
}

/**
 * Creates and attaches a new Typography Lettering ColorLayer to an engine instance.
 *
 * @param {Object} engine - DigitizerEngine instance
 * @param {string} text - Text string
 * @param {Object} [options]
 * @returns {ColorLayer}
 */
export function generateLetteringLayer(engine, text, options = {}) {
  const {
    id = `lettering-${Date.now()}`,
    name = `Text: "${text}"`,
    hex = '#f8fafc',
    threadCode = 'Madeira 1001 (Pure White)',
    stitchType = StitchType.SATIN,
    targetHeightMm = 18.0,
    fontFamily = 'varsity',
    letterSpacingMm = 1.0,
    arcAngle = 0,
    params = {}
  } = options;

  const polygons = renderTextToPolygons(text, {
    targetHeightMm,
    fontFamily,
    letterSpacingMm,
    arcAngle
  });

  if (polygons.length === 0) return null;

  const layer = engine.addLayer({
    id,
    name,
    hex,
    threadCode,
    stitchType,
    params: {
      density: stitchType === StitchType.SATIN ? 0.4 : 0.45,
      stitchLength: 3.5,
      pullComp: 0.35,
      underlay: true,
      ...params
    }
  });

  // Assign base geometry and convert for current stitch type
  const baseGeom = polygons.length === 1 ? polygons[0] : polygons;
  layer.baseGeometry = cloneGeometry(baseGeom);
  layer.geometry = convertGeometry(layer.baseGeometry, stitchType);

  return layer;
}
