import { Point2D } from '../geometry/point.js';
import { Polygon } from '../geometry/polygon.js';
import { generateRunningStitch } from './running.js';
import { StitchCommand, StitchPoint, createTieIn, createTieOff } from './types.js';

/**
 * Checks if two scanline segments from adjacent rows overlap spatially.
 */
function segmentsOverlap(s1, s2) {
  return Math.min(s1.x2, s2.x2) - Math.max(s1.x1, s2.x1) > -0.2;
}

/**
 * Checks if a straight line segment between p1 and p2 stays fully within the polygon.
 */
function isSegmentInsidePolygon(poly, p1, p2, steps = 10) {
  if (!poly) return false;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const pt = new Point2D(p1.x * (1 - t) + p2.x * t, p1.y * (1 - t) + p2.y * t);
    if (!poly.containsPoint(pt)) return false;
  }
  return true;
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

    const branchToSegs = activeBranches.map(b => {
      const lastSeg = b[b.length - 1];
      return rowSegs.filter(s => segmentsOverlap(lastSeg, s));
    });

    const segToBranches = rowSegs.map(s => {
      return activeBranches.filter(b => segmentsOverlap(b[b.length - 1], s));
    });

    const nextActiveBranches = [];
    const claimedSegs = new Set();

    for (let bIdx = 0; bIdx < activeBranches.length; bIdx++) {
      const b = activeBranches[bIdx];
      const matchedSegs = branchToSegs[bIdx];

      if (matchedSegs.length === 1) {
        const seg = matchedSegs[0];
        const segIdx = rowSegs.indexOf(seg);
        const incomingBranches = segToBranches[segIdx];

        if (incomingBranches.length === 1) {
          b.push(seg);
          nextActiveBranches.push(b);
          claimedSegs.add(seg);
        } else {
          // Multiple branches merging into 1 segment: terminate branch cleanly at junction
          completedBranches.push(b);
        }
      } else {
        // Fork or termination: complete branch at junction
        completedBranches.push(b);
      }
    }

    for (const seg of rowSegs) {
      if (!claimedSegs.has(seg)) {
        nextActiveBranches.push([seg]);
      }
    }

    activeBranches = nextActiveBranches;
  }

  completedBranches.push(...activeBranches);
  return completedBranches.filter(b => b.length > 0);
}

/**
 * Sequences partitioned branches using direct physical continuity & greedy nearest-neighbor
 * with bidirectional traversal (can sew branch top-to-bottom or bottom-to-top).
 * @param {Array<Array<{k: number, scanY: number, x1: number, x2: number}>>} branches
 * @param {Point2D|null} startPt
 * @param {number} angleRad
 * @param {Polygon|null} polygon
 * @returns {Array<{branch: Array, reversed: boolean}>}
 */
export function sequenceBranches(branches, startPt, angleRad, polygon = null) {
  if (!branches || branches.length === 0) return [];

  const unvisited = [...branches];
  const sequenced = [];
  let currPos = startPt ? startPt.clone() : null;
  let lastExitSeg = null;

  while (unvisited.length > 0) {
    let bestBranch = null;
    let bestDist = Infinity;
    let bestReversed = false;

    if (!currPos) {
      unvisited.sort((a, b) => a[0].k - b[0].k);
      bestBranch = unvisited[0];
      bestReversed = false;
    } else {
      // 1. Direct physical continuation (adjacent rows in scanline space)
      let directConnected = null;
      let directReversed = false;
      if (lastExitSeg) {
        for (const b of unvisited) {
          const topSeg = b[0];
          const btmSeg = b[b.length - 1];
          if (Math.abs(topSeg.k - lastExitSeg.k) <= 1 && segmentsOverlap(topSeg, lastExitSeg)) {
            directConnected = b;
            directReversed = false;
            break;
          }
          if (Math.abs(btmSeg.k - lastExitSeg.k) <= 1 && segmentsOverlap(btmSeg, lastExitSeg)) {
            directConnected = b;
            directReversed = true;
            break;
          }
        }
      }

      if (directConnected) {
        bestBranch = directConnected;
        bestReversed = directReversed;
      } else {
        for (const b of unvisited) {
          const segTop = b[0];
          const segBottom = b[b.length - 1];

          const topPt = new Point2D((segTop.x1 + segTop.x2) / 2, segTop.scanY).rotate(angleRad);
          const bottomPt = new Point2D((segBottom.x1 + segBottom.x2) / 2, segBottom.scanY).rotate(angleRad);

          const dTop = currPos.distance(topPt);
          const dBottom = currPos.distance(bottomPt);

          if (dTop < bestDist) {
            bestDist = dTop;
            bestBranch = b;
            bestReversed = false;
          }
          if (dBottom < bestDist) {
            bestDist = dBottom;
            bestBranch = b;
            bestReversed = true;
          }
        }
      }
    }

    unvisited.splice(unvisited.indexOf(bestBranch), 1);
    sequenced.push({ branch: bestBranch, reversed: bestReversed });
    lastExitSeg = bestReversed ? bestBranch[0] : bestBranch[bestBranch.length - 1];
    currPos = new Point2D(lastExitSeg.x2, lastExitSeg.scanY).rotate(angleRad);
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

  // 5. Sequence branches with direct continuity & bidirectional entry
  const startPt = stitches.length > 0 ? new Point2D(stitches[stitches.length - 1].x, stitches[stitches.length - 1].y) : null;
  const sequenced = sequenceBranches(branches, startPt, angleRad, polygon);

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
      if (segLen < 0.40) continue;

      const origStart = new Point2D(segStart, scanY).rotate(angleRad);

      if (r === 0) {
        // Inter-branch transition: travel inside polygon when possible
        if (!lastPt) {
          stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.JUMP, colorIndex));
        } else {
          const dist = lastPt.distance(origStart);
          const canDirect = isSegmentInsidePolygon(polygon, lastPt, origStart);

          if (canDirect && dist <= 25.0) {
            const steps = Math.max(1, Math.ceil(dist / 2.5));
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              stitches.push(new StitchPoint(
                lastPt.x * (1 - t) + origStart.x * t,
                lastPt.y * (1 - t) + origStart.y * t,
                StitchCommand.STITCH,
                colorIndex
              ));
            }
          } else if (polygon && polygon.holes.length === 0 && dist > 5.0) {
            const center = polygon.centroid();
            if (isSegmentInsidePolygon(polygon, lastPt, center) && isSegmentInsidePolygon(polygon, center, origStart)) {
              const d1 = lastPt.distance(center);
              const s1 = Math.max(1, Math.ceil(d1 / 2.5));
              for (let s = 1; s <= s1; s++) {
                const t = s / s1;
                stitches.push(new StitchPoint(
                  lastPt.x * (1 - t) + center.x * t,
                  lastPt.y * (1 - t) + center.y * t,
                  StitchCommand.STITCH,
                  colorIndex
                ));
              }
              const d2 = center.distance(origStart);
              const s2 = Math.max(1, Math.ceil(d2 / 2.5));
              for (let s = 1; s <= s2; s++) {
                const t = s / s2;
                stitches.push(new StitchPoint(
                  center.x * (1 - t) + origStart.x * t,
                  center.y * (1 - t) + origStart.y * t,
                  StitchCommand.STITCH,
                  colorIndex
                ));
              }
            } else {
              stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.JUMP, colorIndex));
            }
          } else {
            stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.JUMP, colorIndex));
          }
        }
      } else {
        // Intra-branch row-to-row transition: step along edge is a STITCH, not JUMP!
        if (lastPt) {
          const dist = lastPt.distance(origStart);
          if (dist <= Math.max(stitchLength, 3.5)) {
            if (dist >= 0.35) {
              stitches.push(new StitchPoint(origStart.x, origStart.y, StitchCommand.STITCH, colorIndex));
            }
          } else {
            const steps = Math.ceil(dist / 2.5);
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              stitches.push(new StitchPoint(
                lastPt.x * (1 - t) + origStart.x * t,
                lastPt.y * (1 - t) + origStart.y * t,
                StitchCommand.STITCH,
                colorIndex
              ));
            }
          }
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

        // Suppress intermediate stitches within 0.40mm of segment ends to prevent micro-stitches
        if (s < stepCount && (Math.abs(xPos - segEnd) < 0.40 || Math.abs(xPos - segStart) < 0.40)) {
          continue;
        }

        const pt = new Point2D(xPos, scanY).rotate(angleRad);
        stitches.push(new StitchPoint(pt.x, pt.y, StitchCommand.STITCH, colorIndex));
        lastPt = pt;
      }

    }
  }

  return stitches;
}
