import { StitchCommand, StitchPoint } from '../stitches/types.js';
import { colorDistanceSq } from '../trace/color-quantizer.js';

const PPMM = 10; // 0.1mm units

export const JANOME_HOOPS = {
  HOOP_110X110: 0,
  HOOP_50X50: 1,
  HOOP_140X200: 2,
  HOOP_126X110: 3,
  HOOP_200X200: 4
};

/**
 * Standard Janome Embroidery Palette Table (79 catalog colors).
 */
export const JANOME_JEF_PALETTE = [
  { index: 0, code: '000', r: 0, g: 0, b: 0, name: 'Placeholder' },
  { index: 1, code: '002', r: 0, g: 0, b: 0, name: 'Black' },
  { index: 2, code: '001', r: 255, g: 255, b: 255, name: 'White' },
  { index: 3, code: '204', r: 255, g: 255, b: 23, name: 'Yellow' },
  { index: 4, code: '203', r: 255, g: 102, b: 0, name: 'Orange' },
  { index: 5, code: '219', r: 47, g: 89, b: 51, name: 'Olive Green' },
  { index: 6, code: '226', r: 35, g: 115, b: 54, name: 'Green' },
  { index: 7, code: '217', r: 101, g: 194, b: 200, name: 'Sky' },
  { index: 8, code: '208', r: 171, g: 90, b: 150, name: 'Purple' },
  { index: 9, code: '201', r: 246, g: 105, b: 160, name: 'Pink' },
  { index: 10, code: '225', r: 255, g: 0, b: 0, name: 'Red' },
  { index: 11, code: '214', r: 177, g: 112, b: 78, name: 'Brown' },
  { index: 12, code: '207', r: 11, g: 47, b: 132, name: 'Blue' },
  { index: 13, code: '003', r: 228, g: 195, b: 93, name: 'Gold' },
  { index: 14, code: '205', r: 72, g: 26, b: 5, name: 'Dark Brown' },
  { index: 15, code: '209', r: 172, g: 156, b: 199, name: 'Pale Violet' },
  { index: 16, code: '210', r: 252, g: 242, b: 148, name: 'Pale Yellow' },
  { index: 17, code: '211', r: 249, g: 153, b: 183, name: 'Pale Pink' },
  { index: 18, code: '212', r: 250, g: 179, b: 129, name: 'Peach' },
  { index: 19, code: '213', r: 201, g: 164, b: 128, name: 'Beige' },
  { index: 20, code: '215', r: 151, g: 5, b: 51, name: 'Wine Red' },
  { index: 21, code: '216', r: 160, g: 184, b: 204, name: 'Pale Sky' },
  { index: 22, code: '218', r: 127, g: 194, b: 28, name: 'Yellow Green' },
  { index: 23, code: '220', r: 229, g: 229, b: 229, name: 'Silver Gray' },
  { index: 24, code: '221', r: 136, g: 155, b: 155, name: 'Gray' },
  { index: 25, code: '227', r: 152, g: 214, b: 189, name: 'Pale Aqua' },
  { index: 26, code: '228', r: 178, g: 225, b: 227, name: 'Baby Blue' },
  { index: 27, code: '229', r: 54, g: 139, b: 160, name: 'Powder Blue' },
  { index: 28, code: '230', r: 79, g: 131, b: 171, name: 'Bright Blue' },
  { index: 29, code: '231', r: 56, g: 106, b: 145, name: 'Slate Blue' },
  { index: 30, code: '232', r: 7, g: 22, b: 80, name: 'Navy Blue' },
  { index: 31, code: '233', r: 249, g: 153, b: 162, name: 'Salmon Pink' },
  { index: 32, code: '234', r: 249, g: 103, b: 107, name: 'Coral' },
  { index: 33, code: '235', r: 227, g: 49, b: 31, name: 'Burnt Orange' },
  { index: 34, code: '236', r: 226, g: 161, b: 136, name: 'Cinnamon' },
  { index: 35, code: '237', r: 181, g: 148, b: 116, name: 'Umber' },
  { index: 36, code: '238', r: 228, g: 207, b: 153, name: 'Blond' },
  { index: 37, code: '239', r: 255, g: 203, b: 0, name: 'Sunflower' },
  { index: 38, code: '240', r: 225, g: 173, b: 212, name: 'Orchid Pink' },
  { index: 39, code: '241', r: 195, g: 0, b: 126, name: 'Peony Purple' },
  { index: 40, code: '242', r: 128, g: 0, b: 75, name: 'Burgundy' },
  { index: 41, code: '243', r: 84, g: 5, b: 113, name: 'Royal Purple' },
  { index: 42, code: '244', r: 177, g: 5, b: 37, name: 'Cardinal Red' },
  { index: 43, code: '245', r: 202, g: 224, b: 192, name: 'Opal Green' },
  { index: 44, code: '246', r: 137, g: 152, b: 86, name: 'Moss Green' },
  { index: 45, code: '247', r: 92, g: 148, b: 26, name: 'Meadow Green' },
  { index: 46, code: '248', r: 0, g: 49, b: 20, name: 'Dark Green' },
  { index: 47, code: '249', r: 93, g: 174, b: 148, name: 'Aquamarine' },
  { index: 48, code: '250', r: 76, g: 191, b: 143, name: 'Emerald Green' },
  { index: 49, code: '251', r: 0, g: 119, b: 114, name: 'Peacock Green' },
  { index: 50, code: '252', r: 89, g: 91, b: 97, name: 'Dark Gray' },
  { index: 51, code: '253', r: 255, g: 255, b: 242, name: 'Ivory White' },
  { index: 52, code: '254', r: 177, g: 88, b: 24, name: 'Hazel' },
  { index: 53, code: '255', r: 203, g: 138, b: 7, name: 'Toast' },
  { index: 54, code: '256', r: 152, g: 108, b: 128, name: 'Salmon' },
  { index: 55, code: '257', r: 152, g: 105, b: 45, name: 'Cocoa Brown' },
  { index: 56, code: '258', r: 77, g: 52, b: 25, name: 'Sienna' },
  { index: 57, code: '259', r: 76, g: 51, b: 11, name: 'Sepia' },
  { index: 58, code: '260', r: 51, g: 32, b: 10, name: 'Dark Sepia' },
  { index: 59, code: '261', r: 82, g: 58, b: 151, name: 'Violet Blue' },
  { index: 60, code: '262', r: 13, g: 33, b: 126, name: 'Blue Ink' },
  { index: 61, code: '263', r: 30, g: 119, b: 172, name: 'Sola Blue' },
  { index: 62, code: '264', r: 178, g: 221, b: 83, name: 'Green Dust' },
  { index: 63, code: '265', r: 243, g: 54, b: 137, name: 'Crimson' },
  { index: 64, code: '266', r: 222, g: 100, b: 158, name: 'Floral Pink' },
  { index: 65, code: '267', r: 152, g: 65, b: 97, name: 'Wine' },
  { index: 66, code: '268', r: 76, g: 86, b: 18, name: 'Olive Drab' },
  { index: 67, code: '269', r: 76, g: 136, b: 31, name: 'Meadow' },
  { index: 68, code: '270', r: 228, g: 222, b: 121, name: 'Mustard' },
  { index: 69, code: '271', r: 203, g: 138, b: 26, name: 'Yellow Ocher' },
  { index: 70, code: '272', r: 203, g: 162, b: 28, name: 'Old Gold' },
  { index: 71, code: '273', r: 255, g: 152, b: 5, name: 'Honey Dew' },
  { index: 72, code: '274', r: 252, g: 178, b: 87, name: 'Tangerine' },
  { index: 73, code: '275', r: 255, g: 229, b: 5, name: 'Canary Yellow' },
  { index: 74, code: '202', r: 240, g: 51, b: 31, name: 'Vermilion' },
  { index: 75, code: '206', r: 26, g: 132, b: 45, name: 'Bright Green' },
  { index: 76, code: '222', r: 56, g: 108, b: 174, name: 'Ocean Blue' },
  { index: 77, code: '223', r: 227, g: 196, b: 180, name: 'Beige Gray' },
  { index: 78, code: '224', r: 227, g: 172, b: 129, name: 'Bamboo' }
];

/**
 * Finds the closest Janome standard color index for an RGB or Hex color.
 * @param {number|string} r - Red (0-255) or Hex '#rrggbb'
 * @param {number} [g] - Green (0-255)
 * @param {number} [b] - Blue (0-255)
 * @returns {number} - Janome palette index (1-78)
 */
export function findNearestJanomeColor(r, g, b) {
  if (typeof r === 'string') {
    const hex = r.replace('#', '');
    const num = parseInt(hex, 16);
    r = (num >> 16) & 0xFF;
    g = (num >> 8) & 0xFF;
    b = num & 0xFF;
  }

  let bestIdx = 1;
  let minDist = Infinity;

  // Search indices 1 through 78 (skip index 0 placeholder)
  for (let i = 1; i < JANOME_JEF_PALETTE.length; i++) {
    const p = JANOME_JEF_PALETTE[i];
    const dist = colorDistanceSq(r, g, b, p.r, p.g, p.b);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = p.index;
    }
  }

  return bestIdx;
}

/**
 * Helper to convert signed 8-bit integer (-128..127)
 */
function signed8(b) {
  return b > 127 ? b - 256 : b;
}

/**
 * Selects recommended Janome hoop size code based on design extents in 0.1mm units.
 */
export function getJefHoopSize(widthUnits, heightUnits) {
  if (widthUnits < 500 && heightUnits < 500) return JANOME_HOOPS.HOOP_50X50;
  if (widthUnits < 1260 && heightUnits < 1100) return JANOME_HOOPS.HOOP_126X110;
  if (widthUnits < 1400 && heightUnits < 2000) return JANOME_HOOPS.HOOP_140X200;
  if (widthUnits < 2000 && heightUnits < 2000) return JANOME_HOOPS.HOOP_200X200;
  return JANOME_HOOPS.HOOP_110X110;
}

/**
 * Exports StitchPoint array to a Janome .JEF binary buffer.
 * Automatically centers coordinates at (0, 0) and formats 116-byte fixed LE header.
 * @param {StitchPoint[]} stitches - Compiled machine stitches
 * @param {Object} [options] - Export options
 * @param {Array<string|{r: number, g: number, b: number}>} [options.threads] - Thread colors
 * @param {Date|string} [options.date] - Creation date
 * @returns {Uint8Array}
 */
export function writeJef(stitches, options = {}) {
  if (!stitches || stitches.length === 0) {
    stitches = [new StitchPoint(0, 0, StitchCommand.STITCH)];
  }

  // 1. Calculate design bounds in mm and center coordinates
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let colorChangeCount = 0;

  for (const s of stitches) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
    if (s.command === StitchCommand.COLOR_CHANGE) colorChangeCount++;
  }

  if (minX === Infinity) {
    minX = maxX = minY = maxY = 0;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const widthUnits = Math.max(0, Math.round((maxX - minX) * PPMM));
  const heightUnits = Math.max(0, Math.round((maxY - minY) * PPMM));
  const halfWidth = Math.round(widthUnits / 2);
  const halfHeight = Math.round(heightUnits / 2);

  const hoopCode = getJefHoopSize(widthUnits, heightUnits);

  // 2. Resolve thread palette
  const totalColors = colorChangeCount + 1;
  const palette = [];

  if (options.threads && options.threads.length > 0) {
    let lastIdx = -1;
    for (let i = 0; i < totalColors; i++) {
      const th = options.threads[i % options.threads.length];
      const r = typeof th === 'string' ? th : (th.r !== undefined ? th.r : 0);
      const g = typeof th === 'object' && th.g !== undefined ? th.g : 0;
      const b = typeof th === 'object' && th.b !== undefined ? th.b : 0;
      let idx = findNearestJanomeColor(r, g, b);
      if (idx === lastIdx) {
        // Shift slightly to maintain distinct color stops
        idx = (idx % (JANOME_JEF_PALETTE.length - 1)) + 1;
      }
      palette.push(idx);
      lastIdx = idx;
    }
  } else {
    // Default Janome palette sequence
    const defaultSeq = [12, 10, 3, 6, 4, 1, 2, 8];
    for (let i = 0; i < totalColors; i++) {
      palette.push(defaultSeq[i % defaultSeq.length]);
    }
  }

  // 3. Encode stitches into 2-byte records
  const stitchRecords = [];
  let prevX = 0;
  let prevY = 0;

  for (let i = 0; i < stitches.length; i++) {
    const pt = stitches[i];
    const targetX = Math.round((pt.x - cx) * PPMM);
    const targetY = Math.round((pt.y - cy) * PPMM);

    let dx = targetX - prevX;
    let dy = targetY - prevY;
    let machDy = -dy; // Machine Y is inverted

    if (pt.command === StitchCommand.COLOR_CHANGE) {
      stitchRecords.push(0x80, 0x01, dx & 0xFF, machDy & 0xFF);
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    if (pt.command === StitchCommand.JUMP || pt.command === StitchCommand.TRIM) {
      while (Math.abs(dx) > 127 || Math.abs(machDy) > 127) {
        const stepX = Math.max(-127, Math.min(127, dx));
        const stepMachY = Math.max(-127, Math.min(127, machDy));
        stitchRecords.push(0x80, 0x02, stepX & 0xFF, stepMachY & 0xFF);
        prevX += stepX;
        prevY -= stepMachY;
        dx = targetX - prevX;
        machDy = -(targetY - prevY);
      }
      stitchRecords.push(0x80, 0x02, dx & 0xFF, machDy & 0xFF);
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    // Standard STITCH command
    while (Math.abs(dx) > 127 || Math.abs(machDy) > 127) {
      const stepX = Math.max(-127, Math.min(127, dx));
      const stepMachY = Math.max(-127, Math.min(127, machDy));
      stitchRecords.push(0x80, 0x02, stepX & 0xFF, stepMachY & 0xFF); // Jump subdivision
      prevX += stepX;
      prevY -= stepMachY;
      dx = targetX - prevX;
      machDy = -(targetY - prevY);
    }

    stitchRecords.push(dx & 0xFF, machDy & 0xFF);
    prevX = targetX;
    prevY = targetY;
  }

  // End command: 0x80, 0x10
  stitchRecords.push(0x80, 0x10);

  const pointCount = stitchRecords.length / 2;

  // 4. Construct 116-byte fixed header
  const headerBuf = new Uint8Array(116);
  const view = new DataView(headerBuf.buffer);

  const stitchOffset = 0x74 + (palette.length * 8);
  view.setUint32(0x00, stitchOffset, true);
  view.setUint32(0x04, 0x00000014, true);

  // Date string (14 chars + 2 null bytes)
  const now = options.date instanceof Date ? options.date : new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const textEncoder = new TextEncoder();
  headerBuf.set(textEncoder.encode(dateStr.slice(0, 14)), 0x08);
  headerBuf[0x16] = 0x00;
  headerBuf[0x17] = 0x00;

  view.setUint32(0x18, palette.length, true);
  view.setUint32(0x1C, pointCount, true);
  view.setUint32(0x20, hoopCode, true);

  // Bounds from center
  view.setInt32(0x24, halfWidth, true);
  view.setInt32(0x28, halfHeight, true);
  view.setInt32(0x2C, halfWidth, true);
  view.setInt32(0x30, halfHeight, true);

  // Hoop edge margins helper
  const writeHoopMargins = (offset, hoopHalfW, hoopHalfH) => {
    const xEdge = hoopHalfW - halfWidth;
    const yEdge = hoopHalfH - halfHeight;
    const valX = Math.min(xEdge, yEdge) >= 0 ? xEdge : -1;
    const valY = Math.min(xEdge, yEdge) >= 0 ? yEdge : -1;
    view.setInt32(offset, valX, true);
    view.setInt32(offset + 4, valY, true);
    view.setInt32(offset + 8, valX, true);
    view.setInt32(offset + 12, valY, true);
  };

  writeHoopMargins(0x34, 550, 550);   // 110x110
  writeHoopMargins(0x44, 250, 250);   // 50x50
  writeHoopMargins(0x54, 700, 1000);  // 140x200
  writeHoopMargins(0x64, 700, 1000);  // Custom

  // 5. Palette and thread types (palette.length * 8 bytes)
  const paletteBuf = new Uint8Array(palette.length * 8);
  const paletteView = new DataView(paletteBuf.buffer);
  for (let i = 0; i < palette.length; i++) {
    paletteView.setUint32(i * 4, palette[i], true);
    paletteView.setUint32(palette.length * 4 + i * 4, 0x0000000D, true); // Thread material code
  }

  // 6. Assemble total binary
  const totalLength = 116 + paletteBuf.length + stitchRecords.length;
  const jefBinary = new Uint8Array(totalLength);
  jefBinary.set(headerBuf, 0);
  jefBinary.set(paletteBuf, 116);
  jefBinary.set(new Uint8Array(stitchRecords), 116 + paletteBuf.length);

  return jefBinary;
}

/**
 * Reads a Janome .JEF binary buffer and reconstructs StitchPoints.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {{ hoopCode: number, colorIndices: number[], widthMm: number, heightMm: number, stitches: StitchPoint[] }}
 */
export function readJef(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 116) {
    throw new Error('Invalid JEF file: file too short (< 116 bytes)');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const stitchOffset = view.getUint32(0x00, true);
  const colorCount = view.getUint32(0x18, true);
  const pointCount = view.getUint32(0x1C, true);
  const hoopCode = view.getUint32(0x20, true);

  const halfWidth = view.getInt32(0x24, true);
  const halfHeight = view.getInt32(0x28, true);
  const widthMm = (halfWidth * 2) / PPMM;
  const heightMm = (halfHeight * 2) / PPMM;

  // Extract color indices from 0x74
  const colorIndices = [];
  for (let i = 0; i < colorCount; i++) {
    const idx = view.getUint32(0x74 + i * 4, true);
    colorIndices.push(idx);
  }

  // Read stitches
  const stitches = [];
  let currX = 0;
  let currY = 0;
  let currentColorIdx = 0;
  let ptr = stitchOffset;

  while (ptr + 1 < bytes.length) {
    const b0 = bytes[ptr++];
    const b1 = bytes[ptr++];

    if (b0 !== 0x80) {
      const dx = signed8(b0);
      const dy = -signed8(b1); // Invert machine Y back to canvas space
      currX += dx;
      currY += dy;
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.STITCH, currentColorIdx));
      continue;
    }

    // Escape command 0x80
    const ctrl = b1;
    if (ctrl === 0x10) {
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.END, currentColorIdx));
      break;
    }

    if (ptr + 1 >= bytes.length) break;
    const b2 = bytes[ptr++];
    const b3 = bytes[ptr++];
    const dx = signed8(b2);
    const dy = -signed8(b3);
    currX += dx;
    currY += dy;

    if (ctrl === 0x01) {
      currentColorIdx++;
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.COLOR_CHANGE, currentColorIdx));
    } else if (ctrl === 0x02) {
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.JUMP, currentColorIdx));
    }
  }

  return {
    hoopCode,
    colorIndices,
    widthMm,
    heightMm,
    stitches
  };
}
