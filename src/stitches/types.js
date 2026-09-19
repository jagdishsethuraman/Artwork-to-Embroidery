/**
 * Standard Machine Stitch Commands & Types
 */

export const StitchCommand = {
  STITCH: 0,        // Normal needle penetration
  JUMP: 1,          // Travel without sewing
  COLOR_CHANGE: 2,  // Thread stop / color swap
  TRIM: 3,          // Thread cut (often encoded as multi-jump in DST)
  END: 4            // End of pattern
};

export const StitchType = {
  RUNNING: 'running',
  BEAN: 'bean',       // Triple-stitch running
  SATIN: 'satin',     // Dual-rail zigzag column
  TATAMI: 'tatami',   // Standard scanline weave
  TWILL: 'twill'      // 4-step or 3-step staggered twill weave
};

export class StitchPoint {
  constructor(x = 0, y = 0, command = StitchCommand.STITCH, colorIndex = 0) {
    this.x = x; // In millimeters
    this.y = y; // In millimeters
    this.command = command;
    this.colorIndex = colorIndex;
  }

  distance(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.hypot(dx, dy);
  }

  clone() {
    return new StitchPoint(this.x, this.y, this.command, this.colorIndex);
  }
}

export class ColorLayer {
  constructor({
    id = 'layer-0',
    name = 'Thread Color 1',
    hex = '#2563eb',
    threadCode = 'Madeira 1042',
    stitchType = StitchType.TATAMI,
    params = {}
  } = {}) {
    this.id = id;
    this.name = name;
    this.hex = hex;
    this.threadCode = threadCode;
    this.stitchType = stitchType;
    this.params = {
      density: 0.4,       // Row spacing (mm)
      stitchLength: 3.5,  // Max stitch length (mm)
      angle: 0,           // Stitch angle in degrees
      pullComp: 0.3,      // Outward pull compensation (mm)
      underlay: true,     // Generate underlay
      stagger: 0.25,      // Twill stagger factor (0.25 = 4-step)
      ...params
    };
    this.geometry = null; // Polygon, Polygon[], Rails, or Polyline
  }

  getPolygons() {
    if (!this.geometry) return [];
    if (Array.isArray(this.geometry)) {
      if (this.geometry.length > 0 && (this.geometry[0].vertices || typeof this.geometry[0].signedArea === 'function')) {
        return this.geometry;
      }
    }
    if (this.geometry.vertices || typeof this.geometry.signedArea === 'function') {
      return [this.geometry];
    }
    return [];
  }
}
