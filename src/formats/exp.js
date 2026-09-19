import { StitchCommand, StitchPoint } from '../stitches/types.js';

const PPMM = 10; // 0.1mm units

/**
 * Encodes StitchPoints into Melco .EXP format.
 * Format: 2 bytes per stitch [dx, dy] as signed 8-bit integers (-127 to +127).
 * Special command: 0x80 followed by command opcode.
 */
export function writeExp(stitches) {
  const bytes = [];
  let prevX = 0;
  let prevY = 0;

  for (const pt of stitches) {
    const targetX = Math.round(pt.x * PPMM);
    const targetY = Math.round(pt.y * PPMM);

    let dx = targetX - prevX;
    let dy = targetY - prevY;

    if (pt.command === StitchCommand.COLOR_CHANGE) {
      bytes.push(0x80, 0x01); // Color stop
    }

    // Melco EXP 8-bit signed delta [-127, 127]
    while (Math.abs(dx) > 127 || Math.abs(dy) > 127) {
      const stepX = Math.max(-127, Math.min(127, dx));
      const stepY = Math.max(-127, Math.min(127, dy));
      bytes.push(0x80, 0x04); // Jump indicator
      bytes.push((stepX + 256) & 0xFF, (stepY + 256) & 0xFF);
      prevX += stepX;
      prevY += stepY;
      dx = targetX - prevX;
      dy = targetY - prevY;
    }

    if (pt.command === StitchCommand.JUMP) {
      bytes.push(0x80, 0x04); // Jump indicator
    }

    bytes.push((dx + 256) & 0xFF, (dy + 256) & 0xFF);
    prevX = targetX;
    prevY = targetY;
  }

  return new Uint8Array(bytes);
}
