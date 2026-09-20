import { StitchCommand, StitchPoint } from '../stitches/types.js';
import { colorDistanceSq } from '../trace/color-quantizer.js';

const PPMM = 10; // 0.1mm units

/**
 * Standard Brother 64-Color Embroidery Palette Table.
 * Index 0 is reserved/unknown, 1-64 are official Brother thread color definitions.
 */
export const BROTHER_PEC_PALETTE = [
  { index: 0, r: 0, g: 0, b: 0, name: 'Unknown' },
  { index: 1, r: 14, g: 31, b: 124, name: 'Prussian Blue' },
  { index: 2, r: 10, g: 85, b: 163, name: 'Blue' },
  { index: 3, r: 0, g: 135, b: 119, name: 'Teal Green' },
  { index: 4, r: 75, g: 107, b: 175, name: 'Cornflower Blue' },
  { index: 5, r: 237, g: 23, b: 31, name: 'Red' },
  { index: 6, r: 209, g: 92, b: 0, name: 'Reddish Brown' },
  { index: 7, r: 145, g: 54, b: 151, name: 'Magenta' },
  { index: 8, r: 228, g: 154, b: 203, name: 'Light Lilac' },
  { index: 9, r: 145, g: 95, b: 172, name: 'Lilac' },
  { index: 10, r: 158, g: 214, b: 125, name: 'Mint Green' },
  { index: 11, r: 232, g: 169, b: 0, name: 'Deep Gold' },
  { index: 12, r: 254, g: 186, b: 53, name: 'Orange' },
  { index: 13, r: 255, g: 255, b: 0, name: 'Yellow' },
  { index: 14, r: 112, g: 188, b: 31, name: 'Lime Green' },
  { index: 15, r: 186, g: 152, b: 0, name: 'Brass' },
  { index: 16, r: 168, g: 168, b: 168, name: 'Silver' },
  { index: 17, r: 125, g: 111, b: 0, name: 'Russet Brown' },
  { index: 18, r: 255, g: 255, b: 179, name: 'Cream Brown' },
  { index: 19, r: 79, g: 85, b: 86, name: 'Pewter' },
  { index: 20, r: 0, g: 0, b: 0, name: 'Black' },
  { index: 21, r: 11, g: 61, b: 145, name: 'Ultramarine' },
  { index: 22, r: 119, g: 1, b: 118, name: 'Royal Purple' },
  { index: 23, r: 41, g: 49, b: 51, name: 'Dark Gray' },
  { index: 24, r: 42, g: 19, b: 1, name: 'Dark Brown' },
  { index: 25, r: 246, g: 74, b: 138, name: 'Deep Rose' },
  { index: 26, r: 178, g: 118, b: 36, name: 'Light Brown' },
  { index: 27, r: 252, g: 187, b: 197, name: 'Salmon Pink' },
  { index: 28, r: 254, g: 55, b: 15, name: 'Vermilion' },
  { index: 29, r: 240, g: 240, b: 240, name: 'White' },
  { index: 30, r: 106, g: 28, b: 138, name: 'Violet' },
  { index: 31, r: 168, g: 221, b: 196, name: 'Seacrest' },
  { index: 32, r: 37, g: 132, b: 187, name: 'Sky Blue' },
  { index: 33, r: 254, g: 179, b: 67, name: 'Pumpkin' },
  { index: 34, r: 255, g: 243, b: 107, name: 'Cream Yellow' },
  { index: 35, r: 208, g: 166, b: 96, name: 'Khaki' },
  { index: 36, r: 209, g: 84, b: 0, name: 'Clay Brown' },
  { index: 37, r: 102, g: 186, b: 73, name: 'Leaf Green' },
  { index: 38, r: 19, g: 74, b: 70, name: 'Peacock Blue' },
  { index: 39, r: 135, g: 135, b: 135, name: 'Gray' },
  { index: 40, r: 216, g: 204, b: 198, name: 'Warm Gray' },
  { index: 41, r: 67, g: 86, b: 7, name: 'Dark Olive' },
  { index: 42, r: 253, g: 217, b: 222, name: 'Flesh Pink' },
  { index: 43, r: 249, g: 147, b: 188, name: 'Pink' },
  { index: 44, r: 0, g: 56, b: 34, name: 'Deep Green' },
  { index: 45, r: 178, g: 175, b: 212, name: 'Lavender' },
  { index: 46, r: 104, g: 106, b: 176, name: 'Wisteria Violet' },
  { index: 47, r: 239, g: 227, b: 185, name: 'Beige' },
  { index: 48, r: 247, g: 56, b: 102, name: 'Carmine' },
  { index: 49, r: 181, g: 75, b: 100, name: 'Amber Red' },
  { index: 50, r: 19, g: 43, b: 26, name: 'Olive Green' },
  { index: 51, r: 199, g: 1, b: 86, name: 'Dark Fuchsia' },
  { index: 52, r: 254, g: 158, b: 50, name: 'Tangerine' },
  { index: 53, r: 168, g: 222, b: 235, name: 'Light Blue' },
  { index: 54, r: 0, g: 103, b: 62, name: 'Emerald Green' },
  { index: 55, r: 78, g: 41, b: 144, name: 'Purple' },
  { index: 56, r: 47, g: 126, b: 32, name: 'Moss Green' },
  { index: 57, r: 255, g: 204, b: 204, name: 'Flesh Pink' },
  { index: 58, r: 255, g: 217, b: 17, name: 'Harvest Gold' },
  { index: 59, r: 9, g: 91, b: 166, name: 'Electric Blue' },
  { index: 60, r: 240, g: 249, b: 112, name: 'Lemon Yellow' },
  { index: 61, r: 227, g: 243, b: 91, name: 'Fresh Green' },
  { index: 62, r: 255, g: 153, b: 0, name: 'Orange' },
  { index: 63, r: 255, g: 240, b: 141, name: 'Cream Yellow' },
  { index: 64, r: 255, g: 200, b: 200, name: 'Applique' }
];

/**
 * Finds the closest Brother standard color index for an RGB or Hex color.
 * @param {number|string} r - Red (0-255) or Hex '#rrggbb'
 * @param {number} [g] - Green (0-255)
 * @param {number} [b] - Blue (0-255)
 * @returns {number} - Brother palette index (1-64)
 */
export function findNearestBrotherColor(r, g, b) {
  if (typeof r === 'string') {
    const hex = r.replace('#', '');
    const num = parseInt(hex, 16);
    r = (num >> 16) & 0xFF;
    g = (num >> 8) & 0xFF;
    b = num & 0xFF;
  }

  let bestIdx = 1;
  let minDist = Infinity;

  // Search indices 1 through 64
  for (let i = 1; i < BROTHER_PEC_PALETTE.length; i++) {
    const p = BROTHER_PEC_PALETTE[i];
    const dist = colorDistanceSq(r, g, b, p.r, p.g, p.b);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = p.index;
    }
  }

  return bestIdx;
}

/**
 * Helper to parse signed 7-bit PEC delta.
 */
function signed7(b) {
  return b > 63 ? b - 128 : b;
}

/**
 * Helper to parse signed 12-bit PEC delta.
 */
function signed12(code) {
  const b = code & 0x0FFF;
  return b > 0x07FF ? b - 0x1000 : b;
}

/**
 * Writes a PEC value (either 1-byte 7-bit or 2-byte 12-bit with flags).
 */
function writePecValue(bytes, value, isLong = false, flag = 0) {
  if (!isLong && value > -64 && value < 63) {
    bytes.push(value & 0x7F);
  } else {
    let v = value & 0x0FFF;
    v |= 0x8000; // FLAG_LONG
    v |= (flag << 8);
    bytes.push((v >> 8) & 0xFF);
    bytes.push(v & 0xFF);
  }
}

/**
 * Exports StitchPoint array to a Brother .PES (v1 with embedded #PEC0001) binary buffer.
 * Fully compliant with Brother PR/Innov-is/PE-Design specifications.
 * @param {StitchPoint[]} stitches - Compiled machine stitches
 * @param {Object} [options] - Export options
 * @param {string} [options.label='EMBROID'] - Design label (up to 16 chars)
 * @param {Array<string|{r: number, g: number, b: number}>} [options.threads] - Thread colors for stops
 * @returns {Uint8Array}
 */
export function writePes(stitches, options = {}) {
  const label = (options.label || 'EMBROID').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  if (!stitches || stitches.length === 0) {
    stitches = [new StitchPoint(0, 0, StitchCommand.STITCH)];
  }

  // 1. Determine bounding box and palette mapping
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const colorChangeStitchIndices = [];

  for (let i = 0; i < stitches.length; i++) {
    const s = stitches[i];
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
    if (s.command === StitchCommand.COLOR_CHANGE) {
      colorChangeStitchIndices.push(i);
    }
  }

  if (minX === Infinity) {
    minX = maxX = minY = maxY = 0;
  }

  const widthUnits = Math.max(0, Math.round((maxX - minX) * PPMM));
  const heightUnits = Math.max(0, Math.round((maxY - minY) * PPMM));

  // Determine thread colors (stops + initial color = colorChanges + 1)
  const totalColors = colorChangeStitchIndices.length + 1;
  const paletteIndices = [];

  if (options.threads && options.threads.length > 0) {
    for (let i = 0; i < totalColors; i++) {
      const th = options.threads[i % options.threads.length];
      const r = typeof th === 'string' ? th : (th.r !== undefined ? th.r : 0);
      const g = typeof th === 'object' && th.g !== undefined ? th.g : 0;
      const b = typeof th === 'object' && th.b !== undefined ? th.b : 0;
      paletteIndices.push(findNearestBrotherColor(r, g, b));
    }
  } else {
    // Default Brother palette sequence (Prussian Blue, Red, Deep Gold, Emerald Green...)
    const defaultSequence = [1, 5, 11, 54, 13, 20, 29, 32];
    for (let i = 0; i < totalColors; i++) {
      paletteIndices.push(defaultSequence[i % defaultSequence.length]);
    }
  }

  // 2. Build PES v1 header
  // 8 bytes: '#PES0001'
  // 4 bytes: 0x00000016 (LE pointer to PEC section at byte 22)
  // 10 bytes: 0x00 padding
  const pesHeader = new Uint8Array(22);
  const textEncoder = new TextEncoder();
  pesHeader.set(textEncoder.encode('#PES0001'), 0);
  const pesView = new DataView(pesHeader.buffer);
  pesView.setUint32(8, 0x16, true); // Little-endian 22

  // 3. Build PEC section
  const pecBytes = [];

  // Magic '#PEC0001' (8 bytes)
  for (const b of textEncoder.encode('#PEC0001')) {
    pecBytes.push(b);
  }

  // Label: 'LA:' (3 bytes) + 16 chars padded with spaces + '\r' (20 bytes total)
  const paddedLabel = label.padEnd(16, ' ').slice(0, 16);
  for (const b of textEncoder.encode(`LA:${paddedLabel}\r`)) {
    pecBytes.push(b);
  }

  // 12 spaces + 0xFF + 0x00 (14 bytes)
  for (let i = 0; i < 12; i++) pecBytes.push(0x20);
  pecBytes.push(0xFF, 0x00);

  // Graphic byte stride (6) & icon height (38)
  pecBytes.push(0x06, 0x26);

  // 12 spaces (12 bytes)
  for (let i = 0; i < 12; i++) pecBytes.push(0x20);

  // Color count minus 1 (1 byte)
  pecBytes.push((paletteIndices.length - 1) & 0xFF);

  // Mapped Brother palette indices
  for (const idx of paletteIndices) {
    pecBytes.push(idx & 0xFF);
  }

  // Space padding up to 463 bytes total for color section
  for (let i = paletteIndices.length; i < 463; i++) {
    pecBytes.push(0x20);
  }

  // 4. Stitch block header at offset 520 in PEC
  const stitchBlockStartPos = pecBytes.length; // 520
  pecBytes.push(0x00, 0x00);

  // Placeholder for 3-byte LE stitch block length
  const lengthPlaceholderIdx = pecBytes.length;
  pecBytes.push(0x00, 0x00, 0x00);

  // 0x31, 0xFF, 0xF0
  pecBytes.push(0x31, 0xFF, 0xF0);

  // Width & height (uint16 LE)
  pecBytes.push(widthUnits & 0xFF, (widthUnits >> 8) & 0xFF);
  pecBytes.push(heightUnits & 0xFF, (heightUnits >> 8) & 0xFF);

  // 0x01E0, 0x01B0 (uint16 LE constants)
  pecBytes.push(0xE0, 0x01, 0xB0, 0x01);

  // 5. Encode stitches
  const JUMP_CODE = 0x10;
  const TRIM_CODE = 0x20;

  let prevX = 0;
  let prevY = 0;
  let colorToggle = false;

  for (let i = 0; i < stitches.length; i++) {
    const pt = stitches[i];
    const targetX = Math.round(pt.x * PPMM);
    const targetY = Math.round(pt.y * PPMM);

    let dx = targetX - prevX;
    let dy = targetY - prevY;

    if (pt.command === StitchCommand.COLOR_CHANGE) {
      pecBytes.push(0xFE, 0xB0);
      pecBytes.push(colorToggle ? 0x02 : 0x01);
      colorToggle = !colorToggle;
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    if (pt.command === StitchCommand.TRIM) {
      writePecValue(pecBytes, dx, true, TRIM_CODE);
      writePecValue(pecBytes, dy, true, TRIM_CODE);
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    if (pt.command === StitchCommand.JUMP) {
      // Chunk large jumps (> 2000 units) to fit within 12-bit range
      while (Math.abs(dx) > 1000 || Math.abs(dy) > 1000) {
        const stepX = Math.max(-1000, Math.min(1000, dx));
        const stepY = Math.max(-1000, Math.min(1000, dy));
        writePecValue(pecBytes, stepX, true, JUMP_CODE);
        writePecValue(pecBytes, stepY, true, JUMP_CODE);
        prevX += stepX;
        prevY += stepY;
        dx = targetX - prevX;
        dy = targetY - prevY;
      }
      writePecValue(pecBytes, dx, true, JUMP_CODE);
      writePecValue(pecBytes, dy, true, JUMP_CODE);
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    // Standard STITCH command
    if (Math.abs(dx) > 1000 || Math.abs(dy) > 1000) {
      const stepX = Math.max(-1000, Math.min(1000, dx));
      const stepY = Math.max(-1000, Math.min(1000, dy));
      writePecValue(pecBytes, stepX, true, 0);
      writePecValue(pecBytes, stepY, true, 0);
      prevX += stepX;
      prevY += stepY;
      dx = targetX - prevX;
      dy = targetY - prevY;
    }

    writePecValue(pecBytes, dx, false, 0);
    writePecValue(pecBytes, dy, false, 0);
    prevX = targetX;
    prevY = targetY;
  }

  // End marker: 0xFF, 0x00
  pecBytes.push(0xFF, 0x00);

  // Patch 3-byte LE stitch block length
  const stitchBlockLength = pecBytes.length - stitchBlockStartPos;
  pecBytes[lengthPlaceholderIdx] = stitchBlockLength & 0xFF;
  pecBytes[lengthPlaceholderIdx + 1] = (stitchBlockLength >> 8) & 0xFF;
  pecBytes[lengthPlaceholderIdx + 2] = (stitchBlockLength >> 16) & 0xFF;

  // 6. Append blank graphics blocks (228 bytes each, 1 for design + 1 per color)
  const graphicBlocksCount = paletteIndices.length + 1;
  const blankBlock = new Uint8Array(228); // Filled with 0x00
  for (let b = 0; b < graphicBlocksCount; b++) {
    for (let k = 0; k < 228; k++) {
      pecBytes.push(0x00);
    }
  }

  // 7. Combine PES header (22 bytes) and PEC section
  const total = new Uint8Array(pesHeader.length + pecBytes.length);
  total.set(pesHeader, 0);
  total.set(new Uint8Array(pecBytes), pesHeader.length);

  return total;
}

/**
 * Reads a Brother .PES or standalone .PEC binary buffer and reconstructs StitchPoints.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {{ label: string, widthMm: number, heightMm: number, colorIndices: number[], stitches: StitchPoint[] }}
 */
export function readPes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 22) {
    throw new Error('Invalid PES/PEC file: file too short (< 22 bytes)');
  }

  const decoder = new TextDecoder('ascii');
  let pecOffset = 0;

  const magic8 = decoder.decode(bytes.subarray(0, 8));
  if (magic8 === '#PES0001') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    pecOffset = view.getUint32(8, true);
  } else if (magic8 === '#PEC0001') {
    pecOffset = 0;
  } else {
    throw new Error(`Invalid PES file: unexpected signature "${magic8}"`);
  }

  if (pecOffset + 536 > bytes.length) {
    throw new Error(`Invalid PES file: truncated PEC block at offset ${pecOffset}`);
  }

  const pecMagic = decoder.decode(bytes.subarray(pecOffset, pecOffset + 8));
  if (pecMagic !== '#PEC0001') {
    throw new Error(`Invalid PEC block signature "${pecMagic}" at offset ${pecOffset}`);
  }

  // Extract label
  const labelRaw = decoder.decode(bytes.subarray(pecOffset + 11, pecOffset + 27));
  const label = labelRaw.replace(/[\r\n\0]/g, '').trim();

  // Extract color table
  const colorChanges = bytes[pecOffset + 56];
  const countColors = (colorChanges + 1) & 0xFF;
  const colorIndices = [];
  for (let c = 0; c < countColors; c++) {
    colorIndices.push(bytes[pecOffset + 57 + c]);
  }

  // Dimensions
  const view = new DataView(bytes.buffer, bytes.byteOffset + pecOffset, bytes.byteLength - pecOffset);
  const widthUnits = view.getUint16(528, true);
  const heightUnits = view.getUint16(530, true);
  const widthMm = widthUnits / PPMM;
  const heightMm = heightUnits / PPMM;

  // Stitch block length
  const b0 = bytes[pecOffset + 522];
  const b1 = bytes[pecOffset + 523];
  const b2 = bytes[pecOffset + 524];
  const stitchBlockLength = b0 | (b1 << 8) | (b2 << 16);
  const stitchBlockEnd = pecOffset + 520 + stitchBlockLength;

  // Read stitches starting at offset 536
  const stitches = [];
  let currX = 0;
  let currY = 0;
  let currentColorIdx = 0;
  let ptr = pecOffset + 536;
  const maxPtr = Math.min(bytes.length, stitchBlockEnd);

  while (ptr < maxPtr) {
    const val1 = bytes[ptr++];
    if (ptr >= maxPtr) break;
    const val2 = bytes[ptr++];

    if (val1 === 0xFF && (val2 === 0x00 || ptr >= maxPtr)) {
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.END, currentColorIdx));
      break;
    }

    if (val1 === 0xFE && val2 === 0xB0) {
      if (ptr < maxPtr) ptr++; // skip third byte
      currentColorIdx++;
      stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, StitchCommand.COLOR_CHANGE, currentColorIdx));
      continue;
    }

    let isJump = false;
    let isTrim = false;
    let dx = 0;
    let dy = 0;

    let v2 = val2;

    if ((val1 & 0x80) !== 0) {
      if ((val1 & 0x20) !== 0) isTrim = true;
      if ((val1 & 0x10) !== 0) isJump = true;
      const code = (val1 << 8) | val2;
      dx = signed12(code);
      if (ptr >= maxPtr) break;
      v2 = bytes[ptr++];
    } else {
      dx = signed7(val1);
    }

    if ((v2 & 0x80) !== 0) {
      if ((v2 & 0x20) !== 0) isTrim = true;
      if ((v2 & 0x10) !== 0) isJump = true;
      if (ptr >= maxPtr) break;
      const v3 = bytes[ptr++];
      const code = (v2 << 8) | v3;
      dy = signed12(code);
    } else {
      dy = signed7(v2);
    }

    currX += dx;
    currY += dy;

    let cmd = StitchCommand.STITCH;
    if (isTrim) cmd = StitchCommand.TRIM;
    else if (isJump) cmd = StitchCommand.JUMP;

    stitches.push(new StitchPoint(currX / PPMM, currY / PPMM, cmd, currentColorIdx));
  }

  return {
    label,
    widthMm,
    heightMm,
    colorIndices,
    stitches
  };
}
