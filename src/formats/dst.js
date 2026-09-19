import { StitchCommand, StitchPoint } from '../stitches/types.js';

const PPMM = 10; // 10 units per millimeter (0.1mm resolution)
const MAX_JUMP_DELTA = 121; // 12.1mm Tajima maximum displacement per ternary record
const MAX_SEW_DELTA = 70;   // 7.0mm Commercial sewing stitch limit (prevents long-stitch errors)

/**
 * Encodes relative movement (dx, dy) and command flag into Tajima 3-byte record.
 * @param {number} dx - Relative displacement in 0.1mm [-121, 121]
 * @param {number} dy - Relative displacement in 0.1mm [-121, 121] (inverted Y)
 * @param {number} command - StitchCommand enum
 * @returns {Uint8Array} - 3-byte encoded record
 */
export function encodeDstRecord(dx, dy, command) {
  let x = Math.round(dx);
  let y = Math.round(dy);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  // Set control flags in Byte 3
  if (command === StitchCommand.JUMP || command === StitchCommand.TRIM) {
    b2 |= 0x80; // Jump flag: bit 7 (0x83 total with sync bits)
  } else if (command === StitchCommand.COLOR_CHANGE) {
    b2 |= 0xC0; // Color change flag: bits 7 & 6 (0xC3 total with sync bits)
  } else if (command === StitchCommand.END) {
    return new Uint8Array([0x00, 0x00, 0xF3]); // End marker
  }

  // Sync bits (bits 0 and 1 always set in valid Tajima records)
  b2 |= 0x03;

  // Ternary decomposition for X
  if (x > 40)  { b2 |= (1 << 2); x -= 81; }
  if (x < -40) { b2 |= (1 << 3); x += 81; }
  if (x > 13)  { b1 |= (1 << 2); x -= 27; }
  if (x < -13) { b1 |= (1 << 3); x += 27; }
  if (x > 4)   { b0 |= (1 << 2); x -= 9; }
  if (x < -4)  { b0 |= (1 << 3); x += 9; }
  if (x > 1)   { b1 |= (1 << 0); x -= 3; }
  if (x < -1)  { b1 |= (1 << 1); x += 3; }
  if (x > 0)   { b0 |= (1 << 0); x -= 1; }
  if (x < 0)   { b0 |= (1 << 1); x += 1; }

  // Ternary decomposition for Y
  if (y > 40)  { b2 |= (1 << 5); y -= 81; }
  if (y < -40) { b2 |= (1 << 4); y += 81; }
  if (y > 13)  { b1 |= (1 << 5); y -= 27; }
  if (y < -13) { b1 |= (1 << 4); y += 27; }
  if (y > 4)   { b0 |= (1 << 5); y -= 9; }
  if (y < -4)  { b0 |= (1 << 4); y += 9; }
  if (y > 1)   { b1 |= (1 << 7); y -= 3; }
  if (y < -1)  { b1 |= (1 << 6); y += 3; }
  if (y > 0)   { b0 |= (1 << 7); y -= 1; }
  if (y < 0)   { b0 |= (1 << 6); y += 1; }

  return new Uint8Array([b0, b1, b2]);
}

/**
 * Decodes 3-byte Tajima record back into relative dx, dy (0.1mm) and command
 */
export function decodeDstRecord(b0, b1, b2) {
  if (b0 === 0 && b1 === 0 && b2 === 0xF3) {
    return { dx: 0, dy: 0, command: StitchCommand.END };
  }

  let dx = 0;
  let dy = 0;

  // Byte 0
  if (b0 & (1 << 0)) dx += 1;
  if (b0 & (1 << 1)) dx -= 1;
  if (b0 & (1 << 2)) dx += 9;
  if (b0 & (1 << 3)) dx -= 9;
  if (b0 & (1 << 7)) dy += 1;
  if (b0 & (1 << 6)) dy -= 1;
  if (b0 & (1 << 5)) dy += 9;
  if (b0 & (1 << 4)) dy -= 9;

  // Byte 1
  if (b1 & (1 << 0)) dx += 3;
  if (b1 & (1 << 1)) dx -= 3;
  if (b1 & (1 << 2)) dx += 27;
  if (b1 & (1 << 3)) dx -= 27;
  if (b1 & (1 << 7)) dy += 3;
  if (b1 & (1 << 6)) dy -= 3;
  if (b1 & (1 << 5)) dy += 27;
  if (b1 & (1 << 4)) dy -= 27;

  // Byte 2
  if (b2 & (1 << 2)) dx += 81;
  if (b2 & (1 << 3)) dx -= 81;
  if (b2 & (1 << 5)) dy += 81;
  if (b2 & (1 << 4)) dy -= 81;

  let command = StitchCommand.STITCH;
  const ctrl = b2 & 0xC0;
  if (ctrl === 0x80) {
    command = StitchCommand.JUMP;
  } else if (ctrl === 0xC0) {
    command = StitchCommand.COLOR_CHANGE;
  }

  return { dx, dy, command };
}

/**
 * Exports an array of StitchPoints to a Tajima .DST binary buffer.
 * Enforces commercial embroidery standards:
 *  - Max sewing stitch <= 7.0mm (subdivides long sewing lines to prevent thread looping/flagging)
 *  - Max jump travel <= 12.1mm (chunks long travels to prevent motor overflow)
 * @param {StitchPoint[]} stitches - Sequence of stitch coordinates in millimeters
 * @param {string} label - Design title (max 8-16 chars)
 * @returns {Uint8Array} - Complete DST file binary
 */
export function writeDst(stitches, label = 'EMBROID') {
  if (!stitches || stitches.length === 0) {
    stitches = [new StitchPoint(0, 0, StitchCommand.STITCH)];
  }

  // 1. Calculate bounding box & total stitches with jump-chunking & stitch-subdivision
  let prevX = 0;
  let prevY = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  let colorChanges = 0;

  const records = [];

  for (let i = 0; i < stitches.length; i++) {
    const pt = stitches[i];
    const targetX = Math.round(pt.x * PPMM);
    const targetY = Math.round(-pt.y * PPMM); // Invert Y for machine coordinate system

    if (pt.command === StitchCommand.COLOR_CHANGE) {
      colorChanges++;
      // Color changes occur in place
      records.push(encodeDstRecord(0, 0, StitchCommand.COLOR_CHANGE));
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    if (pt.command === StitchCommand.TRIM) {
      // Tajima standard hardware trim: exactly 3 zero-length JUMP commands
      records.push(encodeDstRecord(0, 0, StitchCommand.JUMP));
      records.push(encodeDstRecord(0, 0, StitchCommand.JUMP));
      records.push(encodeDstRecord(0, 0, StitchCommand.JUMP));
      prevX = targetX;
      prevY = targetY;
      continue;
    }

    let dx = targetX - prevX;
    let dy = targetY - prevY;
    const dist = Math.hypot(dx, dy);

    if (pt.command === StitchCommand.JUMP) {
      if (dist === 0 && i > 0) continue; // Skip redundant intermediate zero-distance jumps


      // Decompose large travel jump into intermediate JUMP steps <= 11.0mm (Euclidean <= 110, components <= 121)
      if (dist > 110 || Math.abs(dx) > MAX_JUMP_DELTA || Math.abs(dy) > MAX_JUMP_DELTA) {
        const steps = Math.ceil(Math.max(dist / 100, Math.abs(dx) / 110, Math.abs(dy) / 110));
        const startX = prevX;
        const startY = prevY;
        for (let s = 1; s <= steps; s++) {
          const nextSubX = Math.round(startX + (dx * s) / steps);
          const nextSubY = Math.round(startY + (dy * s) / steps);
          const subDx = nextSubX - prevX;
          const subDy = nextSubY - prevY;
          records.push(encodeDstRecord(subDx, subDy, StitchCommand.JUMP));
          prevX = nextSubX;
          prevY = nextSubY;
        }
      } else {
        records.push(encodeDstRecord(dx, dy, StitchCommand.JUMP));
        prevX = targetX;
        prevY = targetY;
      }
    } else {
      // Standard STITCH command
      // Commercial micro-stitch elimination: ignore duplicate or < 0.35mm needle penetrations
      if (dist < 3.5) {
        continue;
      }

      // Commercial limit: sewing stitches must not exceed MAX_SEW_DELTA (70 = 7.0mm).
      // Longer stitches are split into intermediate needle penetrations along the stitch vector.
      if (dist > MAX_SEW_DELTA) {
        const steps = Math.ceil(dist / 60); // Subdivide into <= 6.0mm safe segments
        const startX = prevX;
        const startY = prevY;
        for (let s = 1; s <= steps; s++) {
          const nextSubX = Math.round(startX + (dx * s) / steps);
          const nextSubY = Math.round(startY + (dy * s) / steps);
          const subDx = nextSubX - prevX;
          const subDy = nextSubY - prevY;
          records.push(encodeDstRecord(subDx, subDy, StitchCommand.STITCH));
          prevX = nextSubX;
          prevY = nextSubY;
        }
      } else {
        // Fits safely inside commercial sewing tolerance
        records.push(encodeDstRecord(dx, dy, StitchCommand.STITCH));
        prevX = targetX;
        prevY = targetY;
      }
    }


    // Track bounds
    if (prevX < minX) minX = prevX;
    if (prevX > maxX) maxX = prevX;
    if (prevY < minY) minY = prevY;
    if (prevY > maxY) maxY = prevY;
  }

  // End record
  records.push(encodeDstRecord(0, 0, StitchCommand.END));

  const stitchCount = records.length;

  // 2. Build 512-byte ASCII header
  const headerBuf = new Uint8Array(512);
  headerBuf.fill(0x20); // Pad with spaces

  const cleanLabel = label.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16).padEnd(16, ' ');

  const formatField = (key, val, padLen) => {
    const s = String(val).padStart(padLen, ' ');
    return `${key}:${s}\r`;
  };

  let headerStr = '';
  headerStr += `LA:${cleanLabel}\r`;
  headerStr += formatField('ST', stitchCount, 7);
  headerStr += formatField('CO', colorChanges, 3);
  headerStr += formatField('+X', Math.max(0, maxX), 5);
  headerStr += formatField('-X', Math.abs(Math.min(0, minX)), 5);
  headerStr += formatField('+Y', Math.max(0, maxY), 5);
  headerStr += formatField('-Y', Math.abs(Math.min(0, minY)), 5);
  headerStr += formatField('AX', '+     0', 6);
  headerStr += formatField('AY', '+     0', 6);
  headerStr += formatField('MX', '+     0', 6);
  headerStr += formatField('MY', '+     0', 6);
  headerStr += 'PD:******\r';

  const encoder = new TextEncoder();
  const encodedHeader = encoder.encode(headerStr);
  headerBuf.set(encodedHeader);

  // Set EOF byte at 511
  headerBuf[511] = 0x1A;

  // 3. Assemble total binary file
  const totalFileSize = 512 + records.length * 3;
  const dstBinary = new Uint8Array(totalFileSize);
  dstBinary.set(headerBuf, 0);

  let offset = 512;
  for (const rec of records) {
    dstBinary.set(rec, offset);
    offset += 3;
  }

  return dstBinary;
}

/**
 * Reads a DST binary buffer and reconstructs StitchPoints in millimeters.
 */
export function readDst(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 512) {
    throw new Error('Invalid DST file: file too short (< 512 bytes)');
  }

  const decoder = new TextDecoder('ascii');
  const headerStr = decoder.decode(bytes.subarray(0, 512));

  const stitches = [];
  let currX = 0;
  let currY = 0;

  for (let offset = 512; offset + 2 < bytes.length; offset += 3) {
    const b0 = bytes[offset];
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];

    const { dx, dy, command } = decodeDstRecord(b0, b1, b2);
    if (command === StitchCommand.END) break;

    currX += dx;
    currY += dy;

    // Convert back to mm and revert machine Y-flip
    const xMm = currX / PPMM;
    const yMm = -currY / PPMM;

    stitches.push(new StitchPoint(xMm, yMm, command));
  }

  return { headerStr, stitches };
}
