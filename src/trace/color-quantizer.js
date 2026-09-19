/**
 * Color Quantization & Thread Palette Matcher for Embroidery Digitizing
 * Uses K-Means++ clustering to isolate distinct thread color layers from bitmap images.
 */

// Curated standard embroidery thread catalog (Madeira Polyneon 40wt)
export const MADEIRA_CATALOG = [
  { code: 'Madeira 1801 (Super White)', hex: '#ffffff', rgb: [255, 255, 255] },
  { code: 'Madeira 1800 (Jet Black)',   hex: '#111827', rgb: [17, 24, 39] },
  { code: 'Madeira 1838 (Crimson Red)', hex: '#dc2626', rgb: [220, 38, 38] },
  { code: 'Madeira 1937 (Ruby Red)',    hex: '#b91c1c', rgb: [185, 28, 28] },
  { code: 'Madeira 1678 (Candy Pink)',  hex: '#f43f5e', rgb: [244, 63, 94] },
  { code: 'Madeira 1984 (Rose)',        hex: '#ec4899', rgb: [236, 72, 153] },
  { code: 'Madeira 1765 (Sunset Gold)', hex: '#f59e0b', rgb: [245, 158, 11] },
  { code: 'Madeira 1624 (Canary Sun)',  hex: '#fbbf24', rgb: [251, 191, 36] },
  { code: 'Madeira 1700 (Emerald)',     hex: '#10b981', rgb: [16, 185, 129] },
  { code: 'Madeira 1903 (Forest Green)',hex: '#15803d', rgb: [21, 128, 61] },
  { code: 'Madeira 1651 (Olive)',       hex: '#65a30d', rgb: [101, 163, 13] },
  { code: 'Madeira 1842 (Royal Blue)',  hex: '#2563eb', rgb: [37, 99, 235] },
  { code: 'Madeira 1932 (Sky Blue)',    hex: '#38bdf8', rgb: [56, 189, 248] },
  { code: 'Madeira 1743 (Navy)',        hex: '#1e3a8a', rgb: [30, 58, 138] },
  { code: 'Madeira 1832 (Violet)',      hex: '#8b5cf6', rgb: [139, 92, 246] },
  { code: 'Madeira 1722 (Deep Purple)', hex: '#6b21a8', rgb: [107, 33, 168] },
  { code: 'Madeira 1776 (Amber Orange)',hex: '#ea580c', rgb: [234, 88, 12] },
  { code: 'Madeira 1972 (Rich Chocolate)', hex: '#78350f', rgb: [120, 53, 15] },
  { code: 'Madeira 1840 (Steel Grey)',  hex: '#64748b', rgb: [100, 116, 139] },
  { code: 'Madeira 1618 (Silver Birch)',hex: '#cbd5e1', rgb: [203, 213, 225] }
];

/**
 * Computes perceptual color distance (weighted Euclidean approximation of CIELAB)
 */
export function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (((512 + rmean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rmean) * db * db) >> 8);
}

/**
 * Matches an RGB color to the closest physical Madeira thread code
 */
export function matchThreadColor(r, g, b) {
  let closest = MADEIRA_CATALOG[0];
  let minDist = Infinity;

  for (const item of MADEIRA_CATALOG) {
    const dist = colorDistanceSq(r, g, b, item.rgb[0], item.rgb[1], item.rgb[2]);
    if (dist < minDist) {
      minDist = dist;
      closest = item;
    }
  }

  return closest;
}

/**
 * Converts RGB tuple to Hex string '#rrggbb'
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

/**
 * Quantizes image pixels into K discrete thread color layers.
 * @param {ImageData|{data: Uint8Array|number[], width: number, height: number}} imageData
 * @param {Object} options
 * @param {number} options.k - Number of thread colors (2-8)
 * @param {boolean} options.ignoreTransparent - Treat alpha < 128 as background
 * @param {boolean} options.ignoreWhiteBg - Treat near-white pixels (> 245) as background
 * @param {number} options.maxIterations - Max K-means refinement loops
 * @returns {{clusters: Array, width: number, height: number, totalForegroundPixels: number}}
 */
export function quantizeColors(imageData, options = {}) {
  const {
    k = 3,
    ignoreTransparent = true,
    ignoreWhiteBg = true,
    maxIterations = 10,
    minClusterFraction = 0.015
  } = options;

  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const pixelCount = width * height;

  // 1. Filter foreground pixels
  const foregroundIndices = [];
  const fgColors = []; // Flattened r, g, b array

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (ignoreTransparent && a < 128) continue;
    if (ignoreWhiteBg && r > 245 && g > 245 && b > 245) continue;

    foregroundIndices.push(i);
    fgColors.push(r, g, b);
  }

  const N = foregroundIndices.length;
  if (N === 0) {
    return { clusters: [], width, height, totalForegroundPixels: 0 };
  }

  const targetK = Math.min(k, N);

  // 2. K-Means++ Initialization
  const centroids = [];
  // Pick first centroid randomly from foreground pixels
  const firstIdx = Math.floor(Math.random() * N);
  centroids.push([fgColors[firstIdx * 3], fgColors[firstIdx * 3 + 1], fgColors[firstIdx * 3 + 2]]);

  const minDistSq = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    minDistSq[i] = colorDistanceSq(
      fgColors[i * 3], fgColors[i * 3 + 1], fgColors[i * 3 + 2],
      centroids[0][0], centroids[0][1], centroids[0][2]
    );
  }

  while (centroids.length < targetK) {
    let sumDist = 0;
    for (let i = 0; i < N; i++) sumDist += minDistSq[i];

    const targetSum = Math.random() * sumDist;
    let cumSum = 0;
    let chosenIdx = 0;

    for (let i = 0; i < N; i++) {
      cumSum += minDistSq[i];
      if (cumSum >= targetSum) {
        chosenIdx = i;
        break;
      }
    }

    const newCentroid = [fgColors[chosenIdx * 3], fgColors[chosenIdx * 3 + 1], fgColors[chosenIdx * 3 + 2]];
    centroids.push(newCentroid);

    // Update minDistSq
    for (let i = 0; i < N; i++) {
      const d = colorDistanceSq(
        fgColors[i * 3], fgColors[i * 3 + 1], fgColors[i * 3 + 2],
        newCentroid[0], newCentroid[1], newCentroid[2]
      );
      if (d < minDistSq[i]) minDistSq[i] = d;
    }
  }

  // 3. Iterative K-Means refinement
  const assignments = new Uint8Array(N);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = 0;

    // Assignment Step
    for (let i = 0; i < N; i++) {
      const r = fgColors[i * 3];
      const g = fgColors[i * 3 + 1];
      const b = fgColors[i * 3 + 2];

      let bestCluster = 0;
      let bestDist = Infinity;

      for (let c = 0; c < targetK; c++) {
        const d = colorDistanceSq(r, g, b, centroids[c][0], centroids[c][1], centroids[c][2]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed++;
      }
    }

    if (changed === 0 && iter > 0) break; // Converged

    // Update Step (recompute cluster centroids)
    const counts = new Uint32Array(targetK);
    const sumR = new Float64Array(targetK);
    const sumG = new Float64Array(targetK);
    const sumB = new Float64Array(targetK);

    for (let i = 0; i < N; i++) {
      const c = assignments[i];
      counts[c]++;
      sumR[c] += fgColors[i * 3];
      sumG[c] += fgColors[i * 3 + 1];
      sumB[c] += fgColors[i * 3 + 2];
    }

    for (let c = 0; c < targetK; c++) {
      if (counts[c] > 0) {
        centroids[c][0] = sumR[c] / counts[c];
        centroids[c][1] = sumG[c] / counts[c];
        centroids[c][2] = sumB[c] / counts[c];
      }
    }
  }

  // 4. Build output binary masks for each cluster
  const clusterMasks = [];
  const clusterCounts = new Uint32Array(targetK);

  for (let c = 0; c < targetK; c++) {
    clusterMasks.push(new Uint8Array(pixelCount));
  }

  for (let i = 0; i < N; i++) {
    const pixelIdx = foregroundIndices[i];
    const c = assignments[i];
    clusterMasks[c][pixelIdx] = 1;
    clusterCounts[c]++;
  }

  // Assemble cluster result objects
  const clusters = [];
  for (let c = 0; c < targetK; c++) {
    if (clusterCounts[c] === 0) continue;

    const r = Math.round(centroids[c][0]);
    const g = Math.round(centroids[c][1]);
    const b = Math.round(centroids[c][2]);
    const hex = rgbToHex(r, g, b);
    const matchedThread = matchThreadColor(r, g, b);

    clusters.push({
      id: `cluster-${c}`,
      colorIndex: c,
      rgb: [r, g, b],
      hex,
      threadCode: matchedThread.code,
      pixelCount: clusterCounts[c],
      mask: clusterMasks[c]
    });
  }

  // Sort by pixel count descending (largest areas first)
  clusters.sort((a, b) => b.pixelCount - a.pixelCount);

  // Prune anti-aliased edge fringe noise (clusters with < minClusterFraction of foreground)
  const filteredClusters = clusters.filter((cl, idx) => {
    if (idx === 0) return true; // Always keep dominant cluster
    return (cl.pixelCount / N) >= minClusterFraction;
  });

  return {
    clusters: filteredClusters,
    width,
    height,
    totalForegroundPixels: N
  };
}
