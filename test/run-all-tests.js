/**
 * Comprehensive Automated Test Suite for AI Embroidery Digitizer Engine
 */

import { Point2D, computeCumulativeLengths, samplePolyline } from '../src/geometry/point.js';
import { Polygon, segmentIntersection } from '../src/geometry/polygon.js';
import { splitPolygonByLine, splitSatinByLine, splitPolylineByLine } from '../src/geometry/slicer.js';
import { generateRunningStitch } from '../src/stitches/running.js';
import { generateSatinColumn } from '../src/stitches/satin.js';
import { generateTatamiFill } from '../src/stitches/tatami.js';
import { StitchCommand, StitchPoint, StitchType } from '../src/stitches/types.js';
import { writeDst, readDst, encodeDstRecord, decodeDstRecord } from '../src/formats/dst.js';
import { writeExp } from '../src/formats/exp.js';
import { DigitizerEngine, quantizeColors, traceMaskToPolygons, ramerDouglasPeucker, isStickerBorder } from '../src/engine.js';

import { parseSvgPath } from '../src/svg/svg-parser.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertClose(val, expected, tolerance = 1e-3, message = '') {
  const diff = Math.abs(val - expected);
  assert(diff <= tolerance, `${message} (got ${val}, expected ${expected})`);
}

console.log('\n=============================================');
console.log(' RUNNING EMBROIDERY DIGITIZER ENGINE TESTS');
console.log('=============================================\n');

// -------------------------------------------------------------
// 1. GEOMETRY TESTS
// -------------------------------------------------------------
console.log('[1. Geometry & Vector Math]');

const p1 = new Point2D(0, 0);
const p2 = new Point2D(3, 4);
assertClose(p1.distance(p2), 5.0, 1e-4, 'Point2D distance');
assertClose(p2.length(), 5.0, 1e-4, 'Point2D length');

const norm = p2.normalize();
assertClose(norm.length(), 1.0, 1e-4, 'Point2D normalize length is 1');
assertClose(norm.x, 0.6, 1e-4, 'Point2D normalize x');
assertClose(norm.y, 0.8, 1e-4, 'Point2D normalize y');

const pRotated = new Point2D(10, 0).rotate(Math.PI / 2);
assertClose(pRotated.x, 0, 1e-4, 'Point2D rotate 90 deg x');
assertClose(pRotated.y, 10, 1e-4, 'Point2D rotate 90 deg y');

// Polygon tests
const rectVerts = [
  new Point2D(0, 0),
  new Point2D(20, 0),
  new Point2D(20, 10),
  new Point2D(0, 10)
];
const poly = new Polygon(rectVerts);
assert(poly.containsPoint(new Point2D(10, 5)), 'Polygon contains inside point (10, 5)');
assert(!poly.containsPoint(new Point2D(25, 5)), 'Polygon rejects outside point (25, 5)');
assertClose(Math.abs(poly.signedArea()), 200, 1e-3, 'Polygon area calculation');

// Scanline clipping
const scanSegments = poly.intersectScanline(5);
assert(scanSegments.length === 1, 'Scanline intersects polygon in exactly 1 segment');
assertClose(scanSegments[0][0], 0, 1e-3, 'Scanline segment start x');
assertClose(scanSegments[0][1], 20, 1e-3, 'Scanline segment end x');

// Polygon knife slicing
const splitCut = splitPolygonByLine(poly, new Point2D(10, -5), new Point2D(10, 15));
assert(splitCut.length === 2, 'Split tool splits rectangle into 2 polygons');
const area1 = Math.abs(splitCut[0].signedArea());
const area2 = Math.abs(splitCut[1].signedArea());
assertClose(area1 + area2, 200, 1e-2, 'Split sub-polygons total area equals original');

// Satin Column knife slicing
const testR1 = [new Point2D(0, 0), new Point2D(0, 10), new Point2D(0, 20)];
const testR2 = [new Point2D(4, 0), new Point2D(4, 10), new Point2D(4, 20)];
const satinCut = splitSatinByLine(testR1, testR2, new Point2D(-2, 10), new Point2D(6, 10));
assert(satinCut !== null && satinCut.length === 2, 'Split tool splits Satin column into 2 columns');
assert(satinCut[0].rail1.length >= 2 && satinCut[0].rail2.length >= 2, 'Satin piece A has valid rails');
assert(satinCut[1].rail1.length >= 2 && satinCut[1].rail2.length >= 2, 'Satin piece B has valid rails');

// Polyline knife slicing
const testPolyline = [new Point2D(0, 0), new Point2D(10, 0), new Point2D(20, 0)];
const polylineCut = splitPolylineByLine(testPolyline, new Point2D(10, -5), new Point2D(10, 5));
assert(polylineCut !== null && polylineCut.length === 2, 'Split tool splits polyline into 2 paths');

// -------------------------------------------------------------
// 2. STITCH GENERATOR TESTS
// -------------------------------------------------------------
console.log('\n[2. Stitch Weave Generators]');

// A. Running Stitch
const linePath = [new Point2D(0, 0), new Point2D(10, 0)];
const runStitches = generateRunningStitch(linePath, { stitchLength: 2.0 });
assert(runStitches.length >= 5, 'Running stitch produces expected needle intervals');
assert(runStitches[0].command === StitchCommand.JUMP, 'First running stitch is a JUMP travel');
assert(runStitches[1].command === StitchCommand.STITCH, 'Subsequent stitches are STITCH');

// B. Satin Column
const rail1 = [new Point2D(0, 0), new Point2D(0, 10), new Point2D(0, 20)];
const rail2 = [new Point2D(4, 0), new Point2D(4, 10), new Point2D(4, 20)];
const satinStitches = generateSatinColumn(rail1, rail2, {
  density: 0.5,
  pullComp: 0.2,
  underlay: true
});

assert(satinStitches.length > 20, 'Satin column generates comprehensive stitch sequence');
// Verify pull compensation widened the column beyond original 4mm
let maxSatinWidth = 0;
for (let i = 0; i < satinStitches.length - 1; i += 2) {
  const dist = new Point2D(satinStitches[i].x, satinStitches[i].y)
    .distance(new Point2D(satinStitches[i + 1].x, satinStitches[i + 1].y));
  if (dist > maxSatinWidth) maxSatinWidth = dist;
}
assert(maxSatinWidth > 4.0, `Satin pull compensation increased width (max ${maxSatinWidth.toFixed(2)}mm > 4.0mm)`);

// C. Tatami Fill
const tatamiStitches = generateTatamiFill(poly, {
  density: 0.4,
  stitchLength: 3.5,
  angle: 45,
  stagger: 0.25,
  underlay: true
});
assert(tatamiStitches.length > 50, 'Tatami fill generated scanline pattern with underlay');

// -------------------------------------------------------------
// 3. TAJIMA DST BINARY ENCODING & DECODING
// -------------------------------------------------------------
console.log('\n[3. Machine Formats (DST Binary Round-trip)]');

// Test single record encode/decode
const testDeltas = [
  { dx: 0, dy: 0, cmd: StitchCommand.STITCH },
  { dx: 50, dy: -30, cmd: StitchCommand.STITCH },
  { dx: -120, dy: 110, cmd: StitchCommand.JUMP },
  { dx: 15, dy: 80, cmd: StitchCommand.COLOR_CHANGE },
  { dx: 0, dy: 0, cmd: StitchCommand.END }
];

for (const t of testDeltas) {
  const enc = encodeDstRecord(t.dx, t.dy, t.cmd);
  assert(enc.length === 3, 'DST record is exactly 3 bytes');
  const dec = decodeDstRecord(enc[0], enc[1], enc[2]);
  if (t.cmd !== StitchCommand.END) {
    assert(dec.dx === t.dx && dec.dy === t.dy, `DST ternary round-trip exact delta (${t.dx}, ${t.dy})`);
    assert(dec.command === t.cmd, `DST command preserved (${t.cmd})`);
  } else {
    assert(dec.command === StitchCommand.END, 'DST end record decoded correctly');
  }
}

// Test complete DST file writing and reading
const samplePattern = [
  new StitchPoint(0, 0, StitchCommand.JUMP, 0),
  new StitchPoint(2.5, 3.2, StitchCommand.STITCH, 0),
  new StitchPoint(5.0, 6.4, StitchCommand.STITCH, 0),
  new StitchPoint(10.0, 12.0, StitchCommand.STITCH, 0),
  // Large jump that requires chunking (>12.1mm)
  new StitchPoint(35.0, 40.0, StitchCommand.JUMP, 1),
  new StitchPoint(36.0, 41.0, StitchCommand.STITCH, 1)
];

const dstBytes = writeDst(samplePattern, 'FLOWER');
assert(dstBytes.length >= 512 + 6 * 3, 'DST file size >= 512 header + stitch records');
assert(dstBytes[511] === 0x1A, 'DST header terminates with EOF character 0x1A');

// Read back the DST file
const { headerStr, stitches: decodedStitches } = readDst(dstBytes.buffer);
assert(headerStr.startsWith('LA:FLOWER'), 'DST header contains correct design label');
assert(decodedStitches.length >= samplePattern.length, 'DST reader recovered all stitch positions');

// End position matches original final target
const lastOriginal = samplePattern[samplePattern.length - 1];
const lastDecoded = decodedStitches[decodedStitches.length - 1];
assertClose(lastDecoded.x, lastOriginal.x, 0.15, 'Final X position preserved after DST round-trip');
assertClose(lastDecoded.y, lastOriginal.y, 0.15, 'Final Y position preserved after DST round-trip');

// Commercial sewing stitch length test (subdivision of moves > 7.0mm)
const longSewTest = [
  new StitchPoint(0, 0, StitchCommand.JUMP, 0),
  new StitchPoint(15.0, 0, StitchCommand.STITCH, 0) // 15mm single stitch
];
const longDst = writeDst(longSewTest, 'LONG');
const { stitches: decodedLong } = readDst(longDst.buffer);
let maxDecodedSew = 0;
for (let i = 1; i < decodedLong.length; i++) {
  if (decodedLong[i].command === StitchCommand.STITCH) {
    const dist = decodedLong[i].distance(decodedLong[i - 1]);
    if (dist > maxDecodedSew) maxDecodedSew = dist;
  }
}
assert(maxDecodedSew <= 7.0, `DST long sewing stitch subdivided into safe segments (max ${maxDecodedSew.toFixed(2)}mm <= 7.0mm)`);
assert(decodedLong.length >= 4, '15mm stitch subdivided into 3+ intermediate stitches');

// -------------------------------------------------------------
// 4. UNIFIED ENGINE & SVG INTEGRATION
// -------------------------------------------------------------
console.log('\n[4. Unified Digitizer Engine]');

const engine = new DigitizerEngine();

// Layer 1: Tatami center
const petalPoly = new Polygon([
  new Point2D(10, 10),
  new Point2D(30, 10),
  new Point2D(35, 25),
  new Point2D(20, 35),
  new Point2D(5, 25)
]);
const layer1 = engine.addLayer({
  id: 'layer-tatami',
  name: 'Center Twill Fill',
  hex: '#f59e0b',
  stitchType: StitchType.TWILL,
  params: { density: 0.4, stitchLength: 3.5, stagger: 0.25 }
});
layer1.geometry = petalPoly;

// Layer 2: Satin border
const layer2 = engine.addLayer({
  id: 'layer-satin',
  name: 'Outer Satin Rim',
  hex: '#ef4444',
  stitchType: StitchType.SATIN,
  params: { density: 0.4, pullComp: 0.3 }
});
layer2.geometry = { rail1, rail2 };

const stats = engine.getDesignStats();
assert(stats.stitchCount > 50, `Engine compiled multi-layer design (${stats.stitchCount} stitches)`);
assert(stats.colorChanges === 1, `Engine inserted 1 thread color stop between 2 layers`);
assert(stats.widthMm > 0 && stats.heightMm > 0, `Engine computed design dimensions: ${stats.widthMm}mm x ${stats.heightMm}mm`);

const finalDst = engine.exportDst('TEST_PATCH');
assert(finalDst instanceof Uint8Array && finalDst.length > 512, 'Engine exported valid .DST binary');

const finalExp = engine.exportExp();
assert(finalExp instanceof Uint8Array && finalExp.length > 0, 'Engine exported valid .EXP binary');

// SVG Path parsing
const svgPath = 'M 0 0 L 25 0 L 25 25 L 0 25 Z';
const { polygons, polylines } = parseSvgPath(svgPath);
assert(polygons.length === 1, 'SVG parser extracted closed polygon from SVG path');
assertClose(Math.abs(polygons[0].signedArea()), 625, 1e-2, 'SVG parsed polygon has correct dimensions');

// Stitch Type Switch / Geometry Auto-Conversion Test
console.log('\n[5. Stitch Type Switching & Geometry Auto-Conversion]');
const morphLayer = engine.addLayer({
  id: 'morph-layer',
  name: 'Morphing Shape',
  hex: '#10b981',
  stitchType: StitchType.TATAMI
});
morphLayer.geometry = petalPoly; // Starts as Polygon

// 1. Switch to Satin
engine.setLayerStitchType('morph-layer', StitchType.SATIN);
let morphStitches = engine.compileStitches();
assert(morphStitches.length > 10, 'Switching Polygon to SATIN automatically adapts geometry and produces stitches');

// 2. Switch back to Twill
engine.setLayerStitchType('morph-layer', StitchType.TWILL);
morphStitches = engine.compileStitches();
assert(morphStitches.length > 10, 'Switching SATIN rails back to TWILL polygon produces valid stitches');

// 3. Switch to Running
engine.setLayerStitchType('morph-layer', StitchType.RUNNING);
morphStitches = engine.compileStitches();
assert(morphStitches.length > 10, 'Switching to RUNNING creates perimeter outline stitches');

// -------------------------------------------------------------
// 6. RASTER IMAGE INGESTION, QUANTIZATION & TRACE (PHASE 2)
// -------------------------------------------------------------
console.log('\n[6. Raster Image Ingestion, Color Quantization & Vector Tracing]');

// A. Ramer-Douglas-Peucker simplification
const noisyLine = [
  new Point2D(0, 0), new Point2D(2, 0.2), new Point2D(5, -0.1),
  new Point2D(7, 0.1), new Point2D(10, 0)
];
const simplified = ramerDouglasPeucker(noisyLine, 0.5);
assert(simplified.length === 2, `RDP simplified 5 collinear points down to 2 (got ${simplified.length})`);
assert(simplified[0].x === 0 && simplified[1].x === 10, 'RDP preserved exact polyline endpoints');

// B. Color Quantization on synthetic 2-color bitmap (Red heart on Blue shield)
const imgW = 20;
const imgH = 20;
const pixelData = new Uint8Array(imgW * imgH * 4);

for (let y = 0; y < imgH; y++) {
  for (let x = 0; x < imgW; x++) {
    const idx = (y * imgW + x) * 4;
    // Central 10x10 square is Red (#dc2626)
    if (x >= 5 && x < 15 && y >= 5 && y < 15) {
      pixelData[idx] = 220;     // R
      pixelData[idx + 1] = 38;  // G
      pixelData[idx + 2] = 38;  // B
      pixelData[idx + 3] = 255; // A
    } else {
      // Background is Royal Blue (#2563eb)
      pixelData[idx] = 37;      // R
      pixelData[idx + 1] = 99;  // G
      pixelData[idx + 2] = 235; // B
      pixelData[idx + 3] = 255; // A
    }
  }
}

const quantResult = quantizeColors({ data: pixelData, width: imgW, height: imgH }, { k: 2 });
assert(quantResult.clusters.length === 2, `Quantizer isolated exactly 2 color clusters (got ${quantResult.clusters.length})`);
assert(quantResult.clusters.some(c => c.threadCode.includes('Red')), 'Cluster 1 matched Madeira Red');
assert(quantResult.clusters.some(c => c.threadCode.includes('Blue')), 'Cluster 2 matched Madeira Blue');

// C. Contour Tracing on red square mask
const redCluster = quantResult.clusters.find(c => c.threadCode.includes('Red'));
const tracedPolys = traceMaskToPolygons(redCluster.mask, imgW, imgH, {
  targetWidthMm: 50.0,
  simplification: 0.5,
  minAreaMm2: 5.0
});
assert(tracedPolys.length >= 1, `Tracer extracted closed polygon from bitmap mask (got ${tracedPolys.length})`);
const redPoly = tracedPolys[0];
assert(redPoly.vertices.length >= 4, `Extracted polygon has >= 4 vertices (got ${redPoly.vertices.length})`);
const redArea = Math.abs(redPoly.signedArea());
assert(redArea > 50, `Extracted polygon area is positive and physically realistic (${redArea.toFixed(1)}mm²)`);

// D. End-to-End Engine Image Import & DST Compilation
const traceEngine = new DigitizerEngine();
const importedLayers = traceEngine.importImage({ data: pixelData, width: imgW, height: imgH }, {
  k: 2,
  targetWidthMm: 60.0
});
assert(importedLayers.length >= 2, `Engine importImage created embroidery layers (got ${importedLayers.length})`);
const importedStitches = traceEngine.compileStitches();
assert(importedStitches.length > 50, `Imported design compiled into stitch stream (${importedStitches.length} stitches)`);

// Export to DST and verify round-trip
const importedDst = traceEngine.exportDst('TRACE_TEST');
assert(importedDst.length >= 512, 'Exported valid Tajima DST from traced bitmap');
const { stitches: decodedTraced } = readDst(importedDst.buffer);
assert(decodedTraced.length > 0, 'DST reader successfully decoded traced design stitches');

// E. Verify Commercial Stitch Limits on Decoded Traced DST
let maxSewDelta = 0;
let maxJumpEuclidean = 0;
for (let i = 1; i < decodedTraced.length; i++) {
  const prev = decodedTraced[i - 1];
  const curr = decodedTraced[i];
  const dx = Math.abs(curr.x - prev.x);
  const dy = Math.abs(curr.y - prev.y);
  if (curr.command === StitchCommand.STITCH) {
    const delta = Math.max(dx, dy);
    if (delta > maxSewDelta) maxSewDelta = delta;
  } else if (curr.command === StitchCommand.JUMP) {
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (dist > maxJumpEuclidean) maxJumpEuclidean = dist;
  }
}
assert(maxSewDelta <= 7.0 && maxSewDelta > 0, `Commercial sewing stitch limit respected on traced design (max ${maxSewDelta.toFixed(2)}mm <= 7.0mm)`);
assert(maxJumpEuclidean <= 12.1 && maxJumpEuclidean > 0, `Commercial jump delta limit respected on traced design (max ${maxJumpEuclidean.toFixed(2)}mm <= 12.1mm)`);

// F. Transparent & White Background Filtering Test
const bgImgW = 16;
const bgImgH = 16;
const bgData = new Uint8Array(bgImgW * bgImgH * 4);
for (let i = 0; i < bgImgW * bgImgH; i++) {
  const p = i * 4;
  if (i < 64) {
    // Transparent area
    bgData[p] = 255; bgData[p+1] = 0; bgData[p+2] = 0; bgData[p+3] = 0; // alpha=0
  } else if (i < 128) {
    // Pure white canvas area
    bgData[p] = 255; bgData[p+1] = 255; bgData[p+2] = 255; bgData[p+3] = 255;
  } else {
    // Foreground emerald green
    bgData[p] = 16; bgData[p+1] = 185; bgData[p+2] = 129; bgData[p+3] = 255;
  }
}

const bgQuant = quantizeColors({ data: bgData, width: bgImgW, height: bgImgH }, {
  k: 2,
  ignoreTransparent: true,
  ignoreWhiteBg: true
});
assert(bgQuant.clusters.length === 1, `Alpha and near-white pixels filtered out (got ${bgQuant.clusters.length} cluster)`);
assert(bgQuant.clusters[0].threadCode.includes('Emerald'), 'Foreground correctly matched to Madeira Emerald');

// G. Nested Loop & Hole Tracing Hierarchy Test
const holeMaskW = 30;
const holeMaskH = 30;
const holeMask = new Uint8Array(holeMaskW * holeMaskH);
for (let y = 3; y < 27; y++) {
  for (let x = 3; x < 27; x++) {
    // Cutout hole between 11 and 19
    if (x >= 11 && x <= 19 && y >= 11 && y <= 19) continue;
    holeMask[y * holeMaskW + x] = 1;
  }
}
const holePolys = traceMaskToPolygons(holeMask, holeMaskW, holeMaskH, {
  targetWidthMm: 60.0,
  simplification: 0.8,
  minAreaMm2: 2.0
});
assert(holePolys.length === 1, `Contour tracer isolated exactly 1 polygon for hollow shape (got ${holePolys.length})`);
assert(holePolys[0].holes.length === 1, `Outer polygon successfully has 1 nested hole (got ${holePolys[0].holes.length})`);
assert(!holePolys[0].containsPoint(new Point2D(0, 0)), 'Polygon with hole rejects point inside center cutout (0, 0)');
assert(holePolys[0].containsPoint(new Point2D(-18, 0)), 'Polygon with hole accepts point inside outer body (-18, 0)');

// Tatami Fill skips the hole
const holeStitches = generateTatamiFill(holePolys[0], {
  density: 0.5,
  stitchLength: 3.5,
  angle: 0,
  underlay: false
});
const holePolyTest = new Polygon(holePolys[0].holes[0]);
let stitchInHoleCount = 0;
for (const st of holeStitches) {
  if (st.command === StitchCommand.STITCH && holePolyTest.containsPoint(new Point2D(st.x, st.y))) {
    // Only flag if strictly inside interior (> 0.2mm away from edge)
    const insetHole = holePolyTest.offset(-0.2);
    if (insetHole.containsPoint(new Point2D(st.x, st.y))) {
      stitchInHoleCount++;
    }
  }
}
assert(stitchInHoleCount === 0, `Tatami fill cleanly jumped over cutout hole with 0 interior stitches (got ${stitchInHoleCount})`);

// H. Monotonic Leg & Branch Partitioning Test
// U-shaped polygon: two vertical legs (x: 0..10 and x: 20..30) connected at bottom (y: 20..30) with empty bay (y: 0..20)
const uShapeVerts = [
  new Point2D(0, 0),
  new Point2D(10, 0),
  new Point2D(10, 20),
  new Point2D(20, 20),
  new Point2D(20, 0),
  new Point2D(30, 0),
  new Point2D(30, 30),
  new Point2D(0, 30)
];
const uPoly = new Polygon(uShapeVerts);
const uStitches = generateTatamiFill(uPoly, {
  density: 0.5,
  stitchLength: 3.5,
  angle: 0,
  underlay: false
});

let uBayJumps = 0;
for (let i = 1; i < uStitches.length; i++) {
  const p1 = uStitches[i - 1];
  const p2 = uStitches[i];
  if (p2.command === StitchCommand.JUMP) {
    // Crosses empty central bay between x: 10..20 and y: 0..20
    if (Math.min(p1.x, p2.x) < 11 && Math.max(p1.x, p2.x) > 19 && (p1.y + p2.y) / 2 < 20) {
      uBayJumps++;
    }
  }
}
assert(uBayJumps <= 1, `Monotonic branch partitioning reduced cross-bay jumps to <= 1 (got ${uBayJumps})`);
assert(uStitches.length > 200, `U-shape tatami fill generated comprehensive stitches (got ${uStitches.length})`);

// I. 5-Pointed Star Solid Fill & Interior Underlay Travel
const starPoints = [];
const starCx = 50, starCy = 50, starROuter = 30, starRInner = 12;
for (let i = 0; i < 10; i++) {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? starROuter : starRInner;
  starPoints.push(new Point2D(starCx + r * Math.cos(angle), starCy + r * Math.sin(angle)));
}
const starPoly = new Polygon(starPoints);
const starStitches = generateTatamiFill(starPoly, {
  density: 0.4,
  stitchLength: 3.5,
  angle: 45,
  underlay: true
});

let starJumps = 0;
let starLongJumps = 0;
for (let i = 1; i < starStitches.length; i++) {
  if (starStitches[i].command === StitchCommand.JUMP) {
    starJumps++;
    if (starStitches[i].distance(starStitches[i - 1]) > 5.0) {
      starLongJumps++;
    }
  }
}
assert(starStitches.length > 800, `Star tatami fill generated full coverage stitches (got ${starStitches.length})`);
assert(starJumps <= 1, `Star tatami fill eliminated cross-tip air jumps (got ${starJumps} jumps)`);
assert(starLongJumps === 0, `Star tatami fill eliminated all long travels > 5.0mm (got ${starLongJumps})`);

// -------------------------------------------------------------
// 7. MULTI-POLYGON COLOR CHANNELS, HARMONIOUS GRAIN & CLEAN DST
// -------------------------------------------------------------
console.log('\n[7. Multi-Polygon Color Channels, Harmonious Grain & Clean DST]');

// A. Island Consolidation & Multi-Polygon Handling
const island1 = new Polygon([
  new Point2D(0, 0), new Point2D(10, 0), new Point2D(10, 10), new Point2D(0, 10)
]);
const island2 = new Polygon([
  new Point2D(25, 0), new Point2D(35, 0), new Point2D(35, 10), new Point2D(25, 10)
]);
const island3 = new Polygon([
  new Point2D(12, 20), new Point2D(22, 20), new Point2D(22, 30), new Point2D(12, 30)
]);

const multiEngine = new DigitizerEngine();
const multiLayer = multiEngine.addLayer({
  id: 'multi-island-layer',
  name: 'Consolidated White Spool',
  hex: '#f8fafc',
  stitchType: StitchType.TWILL,
  params: { density: 0.4, stitchLength: 3.5, stagger: 0.25, angle: 45, underlay: false }
});
multiLayer.geometry = [island1, island2, island3];

assert(multiLayer.getPolygons().length === 3, `ColorLayer consolidated 3 disconnected islands into 1 spool channel`);

const multiStitches = multiEngine.compileStitches();
const multiStats = multiEngine.getDesignStats();
assert(multiStats.colorChanges === 0, `Multi-island layer executes with exactly 0 internal color stops (got ${multiStats.colorChanges})`);

// B. Commercial Hardware Trims on Inter-Island Travels > 5mm
let hardwareTrims = 0;
let interIslandTieOffs = 0;
for (const s of multiStitches) {
  if (s.command === StitchCommand.TRIM) hardwareTrims++;
}
assert(hardwareTrims >= 3, `Inter-island travels > 5.0mm injected hardware TRIMs (got ${hardwareTrims})`);

// C. Zero Micro-Stitches & Commercial Limits on Exported DST
const multiDst = multiEngine.exportDst('MULTI_TEST');
const { stitches: decodedMulti } = readDst(multiDst.buffer);

let multiMicroCount = 0;
let multiLongSewCount = 0;
for (let i = 1; i < decodedMulti.length; i++) {
  const prev = decodedMulti[i - 1];
  const curr = decodedMulti[i];
  const dist = curr.distance(prev);
  if (curr.command === StitchCommand.STITCH) {
    if (dist < 0.35 && dist > 1e-4) multiMicroCount++;
    if (dist > 7.0) multiLongSewCount++;
  }
}
assert(multiMicroCount === 0, `Exported multi-island DST has zero micro-stitches < 0.35mm (got ${multiMicroCount})`);
assert(multiLongSewCount === 0, `Exported multi-island DST has zero sewing stitches > 7.0mm (got ${multiLongSewCount})`);

// D. Die-Cut Sticker Border Detection
const stickerBorderPoly = new Polygon([
  new Point2D(-35, -35), new Point2D(35, -35), new Point2D(35, 35), new Point2D(-35, 35)
]);
stickerBorderPoly.addHole([
  new Point2D(-32, -32), new Point2D(32, -32), new Point2D(32, 32), new Point2D(-32, 32)
]);
const solidEmblemPoly = new Polygon([
  new Point2D(-35, -35), new Point2D(35, -35), new Point2D(35, 35), new Point2D(-35, 35)
]);

assert(isStickerBorder(stickerBorderPoly, 75.0) === true, `isStickerBorder accurately identified thin outer sticker shell`);
assert(isStickerBorder(solidEmblemPoly, 75.0) === false, `isStickerBorder rejected solid filled graphics`);

// E. Multi-Island Color Clustering Ingestion (K=3)
const testW = 40;
const testH = 40;
const testPixels = new Uint8Array(testW * testH * 4);
// Background: White
testPixels.fill(255);
// Cluster 1 (Red): Top-left square
for (let y = 5; y < 15; y++) {
  for (let x = 5; x < 15; x++) {
    const idx = (y * testW + x) * 4;
    testPixels[idx] = 220; testPixels[idx+1] = 20; testPixels[idx+2] = 20;
  }
}
// Cluster 1 (Red): Disconnected bottom-right square (should consolidate into same layer!)
for (let y = 25; y < 35; y++) {
  for (let x = 25; x < 35; x++) {
    const idx = (y * testW + x) * 4;
    testPixels[idx] = 220; testPixels[idx+1] = 20; testPixels[idx+2] = 20;
  }
}
// Cluster 2 (Blue): Central diamond
for (let y = 15; y < 25; y++) {
  for (let x = 15; x < 25; x++) {
    const idx = (y * testW + x) * 4;
    testPixels[idx] = 30; testPixels[idx+1] = 60; testPixels[idx+2] = 220;
  }
}

const clusterEngine = new DigitizerEngine();
const clusterLayers = clusterEngine.importImage(
  { data: testPixels, width: testW, height: testH },
  { k: 2, targetWidthMm: 50.0, defaultAngle: 45, filterStickerBorder: true }
);

assert(clusterLayers.length === 2, `Image import consolidated disconnected patches into exactly 2 ColorLayers (got ${clusterLayers.length})`);
const redLayer = clusterLayers.find(l => l.getPolygons().length === 2);
assert(redLayer !== undefined, `Disconnected red patches successfully combined into 1 layer with 2 polygons`);
const clusterStats = clusterEngine.getDesignStats();
assert(clusterStats.colorChanges === 1, `Compiled 2-cluster design has exactly 1 machine color stop (got ${clusterStats.colorChanges})`);

// F. Universal Commercial Auto-Trim Connector Guarantee
const connectorEngine = new DigitizerEngine();
const lA = connectorEngine.addLayer({
  id: 'la', stitchType: StitchType.TATAMI, params: { underlay: false }
});
lA.geometry = new Polygon([new Point2D(-30, -30), new Point2D(-20, -30), new Point2D(-20, -20), new Point2D(-30, -20)]);
const lB = connectorEngine.addLayer({
  id: 'lb', stitchType: StitchType.TATAMI, params: { underlay: false }
});
lB.geometry = new Polygon([new Point2D(20, 20), new Point2D(30, 20), new Point2D(30, 30), new Point2D(20, 30)]);

const compiledConnectorStitches = connectorEngine.compileStitches();
let untrimmedMovesOver5 = 0;
let hadTrimOrColor = true;
for (let i = 1; i < compiledConnectorStitches.length; i++) {
  const s = compiledConnectorStitches[i];
  const p = compiledConnectorStitches[i - 1];
  if (s.command === StitchCommand.TRIM || s.command === StitchCommand.COLOR_CHANGE) {
    hadTrimOrColor = true;
  } else if (s.command === StitchCommand.JUMP) {
    if (s.distance(p) > 5.0 && !hadTrimOrColor) {
      untrimmedMovesOver5++;
    }
  } else if (s.command === StitchCommand.STITCH) {
    hadTrimOrColor = false;
  }
}
assert(untrimmedMovesOver5 === 0, `Commercial connector pass eliminated all untrimmed moves > 5.0mm (got ${untrimmedMovesOver5})`);

// G. Landing Anchor Penetration in Exported DST
const connectorDst = connectorEngine.exportDst('CONNECTOR');
const { stitches: decConnector } = readDst(connectorDst.buffer);
let firstStitchAfterJumpDistance = null;
for (let i = 1; i < decConnector.length; i++) {
  if (decConnector[i - 1].command === StitchCommand.JUMP && decConnector[i].command === StitchCommand.STITCH) {
    firstStitchAfterJumpDistance = decConnector[i].distance(decConnector[i - 1]);
    break;
  }
}
assert(firstStitchAfterJumpDistance !== null && firstStitchAfterJumpDistance < 0.1, `Landing needle penetration recorded at exact landing jump coordinates`);


console.log('\n=============================================');
console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed, ${totalTests} total.`);
console.log('=============================================\n');

if (failedTests > 0) {
  process.exit(1);
}
