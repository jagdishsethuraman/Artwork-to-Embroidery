import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { generateRunningStitch } from './running.js';
import { StitchCommand, StitchPoint } from './types.js';

/**
 * Checks if two scanline segments from adjacent rows overlap spatially.
 */
function segmentsOverlap(s1, s2) {
  return Math.min(s1.x2, s2.x2) - Math.max(s1.x1, s2.x1) > -0.2;
}

/**
 * Decomposes all scanline rows into continuous monotonic branches (ribbons).
 * Separates forks (e.g. star legs, arch columns, letters like U, V, M) into distinct branches.
 * @param {Array<Array<{k: number, scanY: number, x1: number, x2: number}>>} allRows
 * @returns {Array<Array<{k: number, scanY: number, x1: number, x2: number}>>}
 */
export function partitionScanlineBranches(allRows) {
  let activeBranches = [];
  const completedBranches = [];

  for (let k = 0; k < allRows.length; k++) {
    const rowSegs = allRows[k];
    if (!rowSegs || rowSegs.length === 0) {
      completedBranches.push(...activeBranches);
      activeBranches = [];
      continue;
    }

    const nextActiveBranches = [];
    const unmatchedRowSegs = [...rowSegs];

    for (const branch of activeBranches) {
      const lastSeg = branch[branch.length - 1];
      const matches = unmatchedRowSegs.filter(s => segmentsOverlap(lastSeg, s));

      if (matches.length === 1) {
        branch.push(matches[0]);
        nextActiveBranches.push(branch);
        unmatchedRowSegs.splice(unmatchedRowSegs.indexOf(matches[0]), 1);
      } else if (matches.length > 1) {
        // Fork detected (e.g. splitting into left and right legs)
        // Keep the match closest in center X to the parent branch
        const lastMidX = (lastSeg.x1 + lastSeg.x2) / 2;
        matches.sort((a, b) => {
          const midA = (a.x1 + a.x2) / 2;
          const midB = (b.x1 + b.x2) / 2;
          return Math.abs(midA - lastMidX) - Math.abs(midB - lastMidX);
        });

        branch.push(matches[0]);
        nextActiveBranches.push(branch);
        unmatchedRowSegs.splice(unmatchedRowSegs.indexOf(matches[0]), 1);
      } else {
        // Branch ended (tip or bay boundary)
        completedBranches.push(branch);
      }
    }

    // Any remaining unmatched segments start new branches
    for (const newSeg of unmatchedRowSegs) {
      nextActiveBranches.push([newSeg]);
    }

    activeBranches = nextActiveBranches;
  }

  completedBranches.push(...activeBranches);
  return completedBranches.filter(b => b.length > 0);
}

/**
 * Sequences partitioned branches using a greedy nearest-neighbor heuristic
 * with bidirectional traversal (can sew branch top-to-bottom or bottom-to-top).
 * @param {Array<Array<{k: number, scanY: number, x1: number, x2: number}>>} branches
 * @param {Point2D|null} startPt
 * @param {number} angleRad
 * @returns {Array<{branch: Array, reversed: boolean}>}
 */
export function sequenceBranches(branches, startPt, angleRad) {
  if (!branches || branches.length === 0) return [];

  const unvisited = [...branches];
  const sequenced = [];
  let currPos = startPt ? startPt.clone() : null;

  while (unvisited.length > 0) {
    if (!currPos) {
      // Start with the topmost branch (lowest row index k)
      unvisited.sort((a, b) => a[0].k - b[0].k);
      const first = unvisited.shift();
      sequenced.push({ branch: first, reversed: false });
      const lastSeg = first[first.length - 1];
      currPos = new Point2D(lastSeg.x2, lastSeg.scanY).rotate(angleRad);
    } else {
      let bestIdx = 0;
      let bestDist = Infinity;
      let bestReversed = false;

      for (let i = 0; i < unvisited.length; i++) {
        const b = unvisited[i];
        const segTop = b[0];
        const segBottom = b[b.length - 1];

        const topPt = new Point2D((segTop.x1 + segTop.x2) / 2, segTop.scanY).rotate(angleRad);
        const bottomPt = new Point2D((segBottom.x1 + segBottom.x2) / 2, segBottom.scanY).rotate(angleRad);

        const dTop = currPos.distance(topPt);
        const dBottom = currPos.distance(bottomPt);

        if (dTop < bestDist) {
          bestDist = dTop;
          bestIdx = i;
          bestReversed = false;
        }
        if (dBottom < bestDist) {
          bestDist = dBottom;
          bestIdx = i;
          bestReversed = true;
        }
      }

      const chosen = unvisited.splice(bestIdx, 1)[0];
      sequenced.push({ branch: chosen, reversed: bestReversed });
      const exitSeg = bestReversed ? chosen[0] : chosen[chosen.length - 1];
      currPos = new Point2D(exitSeg.x2, exitSeg.scanY).rotate(angleRad);
    }
  }

  return sequenced;
}

/**
 * Generates Tatami and Twill Fill stitches for any closed polygon.
 * Features monotonic branch partitioning to eliminate redundant travel jumps across bays and legs.
 * @param {Polygon} polygon
 * @param {Object} options
 * @returns {StitchPoint[]}
 */
export function generateTatamiFill(polygon, options = {}) {
  const {
    density = 0.4,           // Row spacing (mm)
    stitchLength = 3.5,      // Max stitch step within row (mm)
    angle = 0,               // Stitch angle in degrees
    stagger = 0.25,          // 0.25 = 4-row twill weave, 0.33 = 3-row tatami
    underlay = true,         // Inset perimeter underlay
    colorIndex = 0
  } = options;

  if (!polygon || polygon.vertices.length < 3) return [];

  const angleRad = (angle * Math.PI) / 180;
  const stitches = [];

  // 1. Underlay: Inset perimeter running stitch to stabilize fabric edges
  if (underlay) {
    const insetPoly = polygon.offset(-0.6);
    if (insetPoly && insetPoly.vertices.length >= 3) {
      const loop = [...insetPoly.vertices, insetPoly.vertices[0]];
      const underlayStitches = generateRunningStitch(loop, {
        stitchLength: 2.5,
        colorIndex
      });
      stitches.push(...underlayStitches);

      // Also trace underlay around cutout holes
      for (const hole of insetPoly.holes) {
        if (hole.length >= 3) {
          const holeLoop = [...hole, hole[0]];
          const holeUnderlay = generateRunningStitch(holeLoop, {
            stitchLength: 2.5,
            colorIndex
          });
          stitches.push(...holeUnderlay);
        }
      }
    }
  }

  // 2. Rotate polygon into horizontal scanline alignment
  const rotatedPoly = polygon.rotate(-angleRad);
  const bounds = rotatedPoly.bounds();

  if (bounds.height < 1e-4 || bounds.width < 1e-4) return stitches;

  const yMin = bounds.minY;
  const yMax = bounds.maxY;
  const rowCount = Math.ceil((yMax - yMin) / density);

  // 3. Collect all scanline rows and segments
  const allRows = [];
  for (let k = 0; k < rowCount; k++) {
    const scanY = yMin + (k + 0.5) * density;
    if (scanY > yMax) break;

    const segments = rotatedPoly.intersectScanline(scanY);
    if (!segments || segments.length === 0) {
      allRows.push([]);
    } else {
      allRows.push(segments.map(([x1, x2]) => ({ k, scanY, x1, x2 })));
    }
  }

  // 4. Partition scanlines into continuous monotonic branches
  const branches = partitionScanlineBranches(allRows);

  // 5. Sequence branches with greedy nearest-neighbor & bidirectional entry
  const startPt = stitches.length > 0 ? new Point2D(stitches[stitches.length - 1].x, stitches[stitches.length - 1].y) : null;
  const sequenced = sequenceBranches(branches, startPt, angleRad);

  // 6. Sew each branch sequentially
  let lastPt = stitches.length > 0 ? stitches[stitches.length - 1] : null;

  for (const { branch, reversed } of sequenced) {
    const orderedSegs = reversed ? [...branch].reverse() : branch;

    for (let r = 0; r < orderedSegs.length; r++) {
      const seg = orderedSegs[r];
      const segK = seg.k;
      const scanY = seg.scanY;

      // Alternate row direction (serpentine) within this branch
      const reverseRow = r % 2 === 1;
      const segStart = reverseRow ? seg.x2 : seg.x1;
      const segEnd = reverseRow ? seg.x1 : seg.x2;
      const segLen = Math.abs(segEnd - segStart);
      if (segLen < 1e-4) continue;

      const origStart = new Point2D(segStart, scanY).rotate(angleRad);
      if (!lastPt) {
        stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.JUMP, colorIndex));
      } else {
        const dist = lastPt.distance(origStart);
        // If moving to a new branch across empty space (> 1.6 * density), emit JUMP travel
        if (dist > density * 1.6) {
          stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.JUMP, colorIndex));
        } else {
          stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.STITCH, colorIndex));
        }
      }
      lastPt = origStart;

      // Stagger needle penetrations based on twill fraction (using absolute row k)
      const rowOffset = ((segK * stagger) % 1) * stitchLength;
      const stepCount = Math.max(1, Math.ceil(segLen / stitchLength));
      const stepSize = segLen / stepCount;

      // Intermediate stitches and end of segment are normal STITCH
      for (let s = 1; s <= stepCount; s++) {
        let xPos = reverseRow
          ? segStart - s * stepSize + (rowOffset % stepSize)
          : segStart + s * stepSize + (rowOffset % stepSize);

        if (s === stepCount) {
          xPos = segEnd;
        } else if (reverseRow) {
          xPos = Math.max(segEnd, Math.min(segStart, xPos));
        } else {
          xPos = Math.max(segStart, Math.min(segEnd, xPos));
        }

        const pt = new Point2D(xPos, scanY).rotate(angleRad);
        stitches.push(new StitchPoint(pt.x, pt.y, StitchCommand.STITCH, colorIndex));
        lastPt = pt;
      }
    }
  }

  return stitches;
}
