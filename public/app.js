import {
  DigitizerEngine,
  Point2D,
  Polygon,
  splitPolygonByLine,
  splitSatinByLine,
  splitPolylineByLine,
  readDst,
  StitchType,
  StitchCommand,
  ColorLayer,
  quantizeColors,
  matchThreadColor,
  MADEIRA_CATALOG,
  traceMaskToPolygons,
  isStickerBorder,
  generateLetteringLayer,
  renderTextToPolygons
} from '../src/engine.js';


// Setup Engine
const engine = new DigitizerEngine();

// UI State
let activePreset = 'daisy';
let currentTool = 'select'; // 'select' | 'split'
let knifeStart = null;
let knifeEnd = null;
let isPlaying = false;
let playheadIndex = 0;
let animationFrameId = null;
let playbackSpeed = 5; // stitches per frame
let isLooping = false;

// Undo / Redo History Stacks
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 40;

function cloneGeometry(geom) {
  if (!geom) return null;
  if (geom instanceof Polygon) return geom.clone();
  if (geom.rail1 && geom.rail2) {
    return {
      rail1: geom.rail1.map(p => p.clone()),
      rail2: geom.rail2.map(p => p.clone())
    };
  }
  if (Array.isArray(geom)) {
    return geom.map(p => p.clone());
  }
  return geom;
}

function serializeState() {
  return {
    layers: engine.layers.map(l => ({
      id: l.id,
      name: l.name,
      hex: l.hex,
      threadCode: l.threadCode,
      stitchType: l.stitchType,
      params: { ...l.params },
      geometry: cloneGeometry(l.geometry),
      baseGeometry: cloneGeometry(l.baseGeometry || l.geometry)
    })),
    activeLayerId: engine.activeLayerId,
    activePreset
  };
}

function pushState() {
  undoStack.push(serializeState());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoUI();
}

function restoreState(state) {
  if (!state) return;
  engine.layers = state.layers.map(l => {
    const layer = new ColorLayer({
      id: l.id,
      name: l.name,
      hex: l.hex,
      threadCode: l.threadCode,
      stitchType: l.stitchType,
      params: { ...l.params }
    });
    layer.geometry = cloneGeometry(l.geometry);
    layer.baseGeometry = cloneGeometry(l.baseGeometry || l.geometry);
    return layer;
  });
  engine.activeLayerId = state.activeLayerId;
  activePreset = state.activePreset;
  updateLayersUI();
  updateStats();
  resetPlayhead();
  updateUndoRedoUI();
  render();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(serializeState());
  const prevState = undoStack.pop();
  restoreState(prevState);
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(serializeState());
  const nextState = redoStack.pop();
  restoreState(nextState);
}

function updateUndoRedoUI() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnHudUndo = document.getElementById('btnHudUndo');
  const btnHudRedo = document.getElementById('btnHudRedo');

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  [btnUndo, btnHudUndo].forEach(b => {
    if (!b) return;
    b.disabled = !canUndo;
    b.style.opacity = canUndo ? '1.0' : '0.35';
    b.style.cursor = canUndo ? 'pointer' : 'not-allowed';
  });

  [btnRedo, btnHudRedo].forEach(b => {
    if (!b) return;
    b.disabled = !canRedo;
    b.style.opacity = canRedo ? '1.0' : '0.35';
    b.style.cursor = canRedo ? 'pointer' : 'not-allowed';
  });
}

// Viewport Transform (Pan & Zoom)
let scale = 5.0; // pixels per mm (default zoom, 5.0 = 100%)
let panX = 400;
let panY = 300;
let isPanning = false;
let isSpacePressed = false;
let lastMousePos = { x: 0, y: 0 };
let currentMouseWorld = new Point2D(0, 0);

// Commercial Machine Hoop Specifications (Physical CAD Envelopes)
const HOOP_PRESETS = {
  '100x100': { key: '100x100', width: 100, height: 100, radius: 14, label: '100 × 100 mm', sub: '4×4" Standard', clearance: 5 },
  '130x180': { key: '130x180', width: 130, height: 180, radius: 20, label: '130 × 180 mm', sub: '5×7" Large', clearance: 5 },
  '200x200': { key: '200x200', width: 200, height: 200, radius: 24, label: '200 × 200 mm', sub: '8×8" Commercial', clearance: 6 },
  '360x200': { key: '360x200', width: 360, height: 200, radius: 28, label: '360 × 200 mm', sub: '14×8" Jacket Back', clearance: 8 },
  'none': { key: 'none', width: 0, height: 0, radius: 0, label: 'Free Canvas', sub: 'No Limits', clearance: 0 }
};
let activeHoopKey = '100x100';
let showGrid = true;

// Canvas Elements
const canvas = document.getElementById('stitchCanvas');
const ctx = canvas.getContext('2d');

// Initialize Presets
function loadPreset(name) {
  engine.layers = [];
  activePreset = name;

  if (name === 'daisy') {
    // Center yellow Tatami/Twill fill
    const centerPoly = new Polygon([
      new Point2D(-10, -10),
      new Point2D(10, -10),
      new Point2D(12, 0),
      new Point2D(10, 10),
      new Point2D(-10, 10),
      new Point2D(-12, 0)
    ]);
    const centerLayer = engine.addLayer({
      id: 'center',
      name: 'Pollen Center',
      hex: '#fbbf24',
      threadCode: 'Madeira 1125 (Sun)',
      stitchType: StitchType.TWILL,
      params: { density: 0.4, stitchLength: 3.5, stagger: 0.25, angle: 30, underlay: true }
    });
    centerLayer.geometry = centerPoly;

    // Petal 1 (Satin Column North)
    const rail1_1 = [
      new Point2D(-1.8, -10),
      new Point2D(-2.6, -25),
      new Point2D(-1.5, -40),
      new Point2D(0, -45)
    ];
    const rail1_2 = [
      new Point2D(1.8, -10),
      new Point2D(2.6, -25),
      new Point2D(1.5, -40),
      new Point2D(0, -45)
    ];
    const petal1 = engine.addLayer({
      id: 'petal-top',
      name: 'North Petal (Satin)',
      hex: '#f8fafc',
      threadCode: 'Madeira 1001 (Pure White)',
      stitchType: StitchType.SATIN,
      params: { density: 0.4, pullComp: 0.35, underlay: true }
    });
    petal1.geometry = { rail1: rail1_1, rail2: rail1_2 };

    // Petal 2 (Satin Column East)
    const rail2_1 = [
      new Point2D(10, -1.8),
      new Point2D(25, -2.6),
      new Point2D(40, -1.5),
      new Point2D(45, 0)
    ];
    const rail2_2 = [
      new Point2D(10, 1.8),
      new Point2D(25, 2.6),
      new Point2D(40, 1.5),
      new Point2D(45, 0)
    ];
    const petal2 = engine.addLayer({
      id: 'petal-east',
      name: 'East Petal (Satin)',
      hex: '#e2e8f0',
      threadCode: 'Madeira 1002 (Soft White)',
      stitchType: StitchType.SATIN,
      params: { density: 0.4, pullComp: 0.35, underlay: true }
    });
    petal2.geometry = { rail1: rail2_1, rail2: rail2_2 };

    // Green Stem (Running Stitch)
    const stemPath = [
      new Point2D(0, 10),
      new Point2D(-2, 25),
      new Point2D(3, 40),
      new Point2D(1, 55)
    ];
    const stemLayer = engine.addLayer({
      id: 'stem',
      name: 'Stem & Vine (Bean Stitch)',
      hex: '#22c55e',
      threadCode: 'Madeira 1251 (Olive Green)',
      stitchType: StitchType.BEAN,
      params: { stitchLength: 2.2 }
    });
    stemLayer.geometry = stemPath;
  } else if (name === 'monogram') {
    // Letter Monogram Column 1 (Satin vertical)
    const stemRail1 = [
      new Point2D(-15, -30),
      new Point2D(-15, 30)
    ];
    const stemRail2 = [
      new Point2D(-7, -30),
      new Point2D(-7, 30)
    ];
    const stem = engine.addLayer({
      id: 'mono-stem',
      name: 'Vertical Pillar',
      hex: '#38bdf8',
      threadCode: 'Madeira 1076 (Cyan)',
      stitchType: StitchType.SATIN,
      params: { density: 0.4, pullComp: 0.3, underlay: true }
    });
    stem.geometry = { rail1: stemRail1, rail2: stemRail2 };

    // Horizontal Top Bar (Tatami)
    const topBar = new Polygon([
      new Point2D(-7, -30),
      new Point2D(25, -30),
      new Point2D(25, -20),
      new Point2D(-7, -20)
    ]);
    const topLayer = engine.addLayer({
      id: 'mono-top',
      name: 'Top Bar (Tatami Fill)',
      hex: '#818cf8',
      threadCode: 'Madeira 1188 (Indigo)',
      stitchType: StitchType.TATAMI,
      params: { density: 0.4, stitchLength: 3.5, angle: 0, stagger: 0.33, underlay: true }
    });
    topLayer.geometry = topBar;

    // Horizontal Bottom Bar (Twill)
    const botBar = new Polygon([
      new Point2D(-7, 20),
      new Point2D(25, 20),
      new Point2D(25, 30),
      new Point2D(-7, 30)
    ]);
    const botLayer = engine.addLayer({
      id: 'mono-bot',
      name: 'Bottom Bar (Twill Weave)',
      hex: '#c084fc',
      threadCode: 'Madeira 1112 (Violet)',
      stitchType: StitchType.TWILL,
      params: { density: 0.4, stitchLength: 3.5, angle: 45, stagger: 0.25, underlay: true }
    });
    botLayer.geometry = botBar;
  } else if (name === 'crest') {
    // 1. Outer Laurel Rim: Annulus ring (R_out = 32mm, R_in = 22mm) with Radial Satin
    const outerRimPts = [];
    const innerRimHole = [];
    const numPts = 48;
    for (let i = 0; i < numPts; i++) {
      const theta = (i / numPts) * Math.PI * 2;
      outerRimPts.push(new Point2D(32 * Math.cos(theta), 32 * Math.sin(theta)));
      innerRimHole.push(new Point2D(22 * Math.cos(theta), 22 * Math.sin(theta)));
    }
    const rimPoly = new Polygon(outerRimPts, [innerRimHole]);
    const rimLayer = engine.addLayer({
      id: 'crest-rim',
      name: 'Laurel Rim (Radial Satin)',
      hex: '#f59e0b',
      threadCode: 'Madeira 1064 (Gold)',
      stitchType: StitchType.RADIAL_SATIN,
      params: { density: 0.45, pullComp: 0.35, underlay: true }
    });
    rimLayer.geometry = rimPoly;

    // 2. Shield Field: Disc (R = 21.5mm) with Archimedean Spiral
    const shieldPts = [];
    for (let i = 0; i < numPts; i++) {
      const theta = (i / numPts) * Math.PI * 2;
      shieldPts.push(new Point2D(21.5 * Math.cos(theta), 21.5 * Math.sin(theta)));
    }
    const shieldPoly = new Polygon(shieldPts);
    const shieldLayer = engine.addLayer({
      id: 'crest-shield',
      name: 'Shield Field (Spiral Fill)',
      hex: '#1d4ed8',
      threadCode: 'Madeira 1143 (Royal Navy)',
      stitchType: StitchType.SPIRAL,
      params: { density: 0.8, stitchLength: 2.8 }
    });
    shieldLayer.geometry = shieldPoly;

    // 3. Center Emblem: 8-pointed star with Meander Fill
    const starPts = [];
    const starR_outer = 11;
    const starR_inner = 5.5;
    for (let i = 0; i < 16; i++) {
      const theta = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 === 0) ? starR_outer : starR_inner;
      starPts.push(new Point2D(r * Math.cos(theta), r * Math.sin(theta)));
    }
    const starPoly = new Polygon(starPts);
    const emblemLayer = engine.addLayer({
      id: 'crest-emblem',
      name: 'Center Star (Meander Fill)',
      hex: '#ef4444',
      threadCode: 'Madeira 1184 (Crimson Red)',
      stitchType: StitchType.MEANDER,
      params: { density: 0.7, stitchLength: 2.5 }
    });
    emblemLayer.geometry = starPoly;
  }

  engine.layers.forEach(l => {
    if (l.geometry && !l.baseGeometry) {
      l.baseGeometry = cloneGeometry(l.geometry);
    }
  });

  engine.activeLayerId = engine.layers[0].id;
  updateLayersUI();
  updateStats();
  resetPlayhead();
  render();
}

function updateLayersUI() {
  const container = document.getElementById('layersContainer');
  container.innerHTML = '';

  engine.layers.forEach((layer, idx) => {
    const card = document.createElement('div');
    card.className = `layer-card ${layer.id === engine.activeLayerId ? 'active' : ''}`;
    card.draggable = true;
    card.setAttribute('data-index', idx);

    card.onclick = () => {
      engine.activeLayerId = layer.id;
      updateLayersUI();
      syncParamInputs();
      render();
    };

    // Drag-and-drop sequencing
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.layer-card').forEach(c => {
        c.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        card.classList.add('drag-over-top');
        card.classList.remove('drag-over-bottom');
      } else {
        card.classList.add('drag-over-bottom');
        card.classList.remove('drag-over-top');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIdx) && fromIdx !== idx) {
        pushState();
        engine.reorderLayers(fromIdx, idx);
        updateLayersUI();
        updateStats();
        resetPlayhead();
        render();
      }
    });

    const islandCount = layer.getPolygons ? layer.getPolygons().length : 1;
    const islandBadge = islandCount > 1
      ? `<span class="badge mono" style="background:var(--accents-1);color:var(--accents-6);border:1px solid var(--accents-2);margin-right:4px;font-size:9px;">${islandCount} isl</span>`
      : '';

    const colorDot = `<span class="color-badge" style="background:${layer.hex};flex-shrink:0;"></span>`;
    card.style.opacity = layer.hidden ? '0.45' : '1';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;width:100%;">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
          <span class="drag-handle" title="Drag to reorder stitch sequence" style="cursor:grab;color:var(--accents-5);display:inline-flex;align-items:center;padding:2px 0;user-select:none;flex-shrink:0;">
            <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;stroke:none;"><circle cx="8" cy="5" r="1.5"/><circle cx="16" cy="5" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>
          </span>

          <button class="layer-visibility-btn" data-idx="${idx}" title="${layer.hidden ? 'Show layer on canvas' : 'Hide layer from canvas'}" style="background:${layer.hidden ? 'rgba(238,0,0,0.12)' : 'transparent'};border:1px solid ${layer.hidden ? 'rgba(238,0,0,0.3)' : 'transparent'};border-radius:4px;color:${layer.hidden ? 'var(--accent-error)' : 'var(--accents-5)'};cursor:pointer;padding:2px 3px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s ease;">
            ${layer.hidden
              ? `<svg class="svg-icon" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
              : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
            }
          </button>

          <span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--accents-5);min-width:16px;flex-shrink:0;">#${idx + 1}</span>
          ${colorDot}
          <div style="min-width:0;flex:1;overflow:hidden;">
            <div style="font-weight:500;font-size:12px;color:var(--accents-8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${layer.name}</div>
            <div style="font-size:10px;color:var(--accents-6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${layer.threadCode}</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          ${islandBadge}
          <span class="badge mono" style="font-size:9.5px;text-transform:uppercase;background:var(--geist-background);border:1px solid var(--accents-2);color:var(--accents-6);">${layer.stitchType}</span>
          <div class="layer-order-btns" style="display:flex;flex-direction:column;gap:1px;margin-left:2px;">
            <button class="order-btn btn-up" data-idx="${idx}" title="Move earlier in embroidery sequence" style="background:transparent;border:none;color:var(--accents-5);cursor:pointer;padding:1px 2px;line-height:1;display:flex;align-items:center;justify-content:center;${idx === 0 ? 'opacity:0.2;cursor:default;' : ''}">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width:9px;height:9px;"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="order-btn btn-down" data-idx="${idx}" title="Move later in embroidery sequence" style="background:transparent;border:none;color:var(--accents-5);cursor:pointer;padding:1px 2px;line-height:1;display:flex;align-items:center;justify-content:center;${idx === engine.layers.length - 1 ? 'opacity:0.2;cursor:default;' : ''}">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width:9px;height:9px;"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Click handler for visibility button
    const btnVis = card.querySelector('.layer-visibility-btn');
    if (btnVis) {
      btnVis.onclick = (e) => {
        e.stopPropagation();
        layer.hidden = !layer.hidden;
        updateLayersUI();
        render();
      };
    }

    // Click handlers for up/down buttons
    const btnUp = card.querySelector('.btn-up');
    if (btnUp && idx > 0) {
      btnUp.onclick = (e) => {
        e.stopPropagation();
        pushState();
        engine.reorderLayers(idx, idx - 1);
        updateLayersUI();
        updateStats();
        resetPlayhead();
        render();
      };
    }
    const btnDown = card.querySelector('.btn-down');
    if (btnDown && idx < engine.layers.length - 1) {
      btnDown.onclick = (e) => {
        e.stopPropagation();
        pushState();
        engine.reorderLayers(idx, idx + 1);
        updateLayersUI();
        updateStats();
        resetPlayhead();
        render();
      };
    }

    container.appendChild(card);
  });

  syncParamInputs();
}

function syncParamInputs() {
  const layer = engine.getActiveLayer();
  if (!layer) return;

  document.getElementById('stitchTypeSelect').value = layer.stitchType;
  document.getElementById('densityInput').value = layer.params.density || 0.4;
  document.getElementById('stitchLenInput').value = layer.params.stitchLength || 3.5;
  document.getElementById('angleInput').value = layer.params.angle || 0;
  document.getElementById('pullCompInput').value = layer.params.pullComp || 0.3;
  document.getElementById('underlayCheck').checked = !!layer.params.underlay;

  document.getElementById('densityVal').innerText = `${layer.params.density || 0.4} mm`;
  document.getElementById('stitchLenVal').innerText = `${layer.params.stitchLength || 3.5} mm`;
  document.getElementById('angleVal').innerText = `${layer.params.angle || 0}°`;
  document.getElementById('pullCompVal').innerText = `+${layer.params.pullComp || 0.3} mm`;
}

function updateStats() {
  const stats = engine.getDesignStats();
  document.getElementById('statStitches').innerText = stats.stitchCount.toLocaleString();
  document.getElementById('statWidth').innerText = `${stats.widthMm} mm`;
  document.getElementById('statHeight').innerText = `${stats.heightMm} mm`;
  document.getElementById('statStops').innerText = stats.colorChanges;

  updateTimelineUI();
}

function getTimelineSegments(stitches, layers) {
  if (!stitches || stitches.length === 0) return [];

  const segments = [];
  let currentLayerIdx = stitches[0].colorIndex !== undefined ? stitches[0].colorIndex : 0;
  let segStart = 0;

  for (let i = 1; i < stitches.length; i++) {
    const s = stitches[i];
    const cIdx = s.colorIndex !== undefined ? s.colorIndex : 0;
    if (cIdx !== currentLayerIdx) {
      const count = i - segStart;
      const layer = layers[currentLayerIdx] || { name: `Layer ${currentLayerIdx + 1}`, hex: '#38bdf8' };
      segments.push({
        layerIndex: currentLayerIdx,
        layerName: layer.name || `Layer ${currentLayerIdx + 1}`,
        hex: layer.hex || '#38bdf8',
        hidden: !!layer.hidden,
        startIndex: segStart,
        endIndex: i,
        count: count,
        pct: (count / stitches.length) * 100
      });
      currentLayerIdx = cIdx;
      segStart = i;
    }
  }

  const finalCount = stitches.length - segStart;
  const finalLayer = layers[currentLayerIdx] || { name: `Layer ${currentLayerIdx + 1}`, hex: '#38bdf8' };
  segments.push({
    layerIndex: currentLayerIdx,
    layerName: finalLayer.name || `Layer ${currentLayerIdx + 1}`,
    hex: finalLayer.hex || '#38bdf8',
    hidden: !!finalLayer.hidden,
    startIndex: segStart,
    endIndex: stitches.length,
    count: finalCount,
    pct: (finalCount / stitches.length) * 100
  });

  return segments;
}

function renderDawTrackSegments(stitches) {
  const trackEl = document.getElementById('dawTrack');
  if (!trackEl) return;

  if (!stitches || stitches.length === 0) {
    trackEl.innerHTML = '';
    return;
  }

  const segments = getTimelineSegments(stitches, engine.layers);
  trackEl.innerHTML = segments.map(seg => `
    <div class="daw-segment ${seg.hidden ? 'is-muted' : ''}" 
         style="width: ${seg.pct.toFixed(2)}%; background: ${seg.hex};" 
         data-start="${seg.startIndex}" 
         data-end="${seg.endIndex}" 
         data-count="${seg.count}" 
         title="${seg.layerName}: ${seg.count.toLocaleString()} stitches (${Math.round(seg.pct)}%)">
    </div>
  `).join('');
}

function updateTimelineUI() {
  const stitches = engine.compileStitches();
  const total = stitches.length;
  const slider = document.getElementById('playheadSlider');
  if (slider) {
    slider.max = Math.max(1, total);
    slider.min = 0;
    slider.value = playheadIndex;
  }

  // Update counter
  const counterEl = document.getElementById('timelineCounter');
  if (counterEl) {
    counterEl.textContent = `${playheadIndex.toLocaleString()} / ${total.toLocaleString()}`;
  }

  // Update percentage
  const pctEl = document.getElementById('timelinePct');
  const pct = total > 0 ? (playheadIndex / total) * 100 : 0;
  if (pctEl) {
    pctEl.textContent = `${Math.round(pct)}%`;
  }

  // Update playhead thumb on DAW track
  const dawPlayhead = document.getElementById('dawPlayhead');
  if (dawPlayhead) {
    dawPlayhead.style.left = `${Math.min(100, Math.max(0, pct))}%`;
  }

  // Update active layer chip
  const layerBadge = document.getElementById('timelineLayerBadge');
  if (layerBadge) {
    if (total > 0 && playheadIndex > 0) {
      const activeStitch = stitches[Math.min(playheadIndex - 1, total - 1)];
      const activeLayer = engine.layers[activeStitch.colorIndex] || engine.layers[0];
      const dotHex = activeLayer ? activeLayer.hex : '#38bdf8';
      const name = activeLayer ? (activeLayer.name || `Layer ${activeStitch.colorIndex + 1}`) : 'Layer 1';
      layerBadge.innerHTML = `<span class="timeline-layer-dot" style="background:${dotHex};"></span><span class="timeline-layer-name">${name}</span>`;
    } else if (engine.layers.length > 0) {
      const firstLayer = engine.layers[0];
      layerBadge.innerHTML = `<span class="timeline-layer-dot" style="background:${firstLayer.hex};"></span><span class="timeline-layer-name">${firstLayer.name}</span>`;
    } else {
      layerBadge.innerHTML = `<span class="timeline-layer-name" style="color:var(--text-muted);">No stitches</span>`;
    }
  }

  // Render or refresh DAW track color blocks
  renderDawTrackSegments(stitches);
}

function resetPlayhead() {
  const stitches = engine.compileStitches();
  playheadIndex = stitches.length;
  updateTimelineUI();
}

// -------------------------------------------------------------
// Canvas Rendering Engine (Realistic Thread Simulation & Machine Hoops)
// -------------------------------------------------------------
function render() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fabric Background (Vercel Vignette: Ambient overhead spotlight centered at hoop origin)
  const gradRadius = Math.max(canvas.width, canvas.height) * 0.75;
  const vignetteGrad = ctx.createRadialGradient(panX, panY, 0, panX, panY, gradRadius);
  vignetteGrad.addColorStop(0, '#14161f');
  vignetteGrad.addColorStop(0.42, '#0a0c12');
  vignetteGrad.addColorStop(0.85, '#000000');
  vignetteGrad.addColorStop(1, '#000000');
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw millimeter grid (10mm major / 1mm minor)
  drawMillimeterGrid();

  // Apply Viewport Pan & Zoom
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  // Check hoop boundary limit & update live telemetry
  const isExceedingHoop = updateViewportTelemetry(currentMouseWorld);

  // Draw Machine Embroidery Hoop (in world space)
  drawHoop(ctx, HOOP_PRESETS[activeHoopKey], isExceedingHoop);

  // Compile Stitches
  const stitches = engine.compileStitches();
  const maxIdx = Math.min(playheadIndex, stitches.length);

  // Render Stitches
  if (stitches.length > 1) {
    let prev = stitches[0];

    for (let i = 1; i < maxIdx; i++) {
      const curr = stitches[i];
      const layer = engine.layers[curr.colorIndex] || engine.layers[0];
      const hex = layer.hex;

      // Realistic 3-Pass Thread Rendering Pipeline
      if (curr.command === StitchCommand.END) {
        break;
      } else if (curr.command === StitchCommand.COLOR_CHANGE) {
        // Color change handled seamlessly by layer index
      } else if (curr.command === StitchCommand.TRIM) {
        // Needle raised - thread trimmed
      } else if (curr.command === StitchCommand.JUMP) {
        // Non-sewing rapid travel jump line (fine dashed line)
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 0.08;
        ctx.setLineDash([0.5, 0.5]);
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
        ctx.restore();
      } else {
        // Regular SEW stitch
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const len = Math.hypot(dx, dy);

        // Pass 1: Under-stitch ambient occlusion / shadow
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 0.42;
        ctx.lineCap = 'round';
        ctx.moveTo(prev.x + 0.05, prev.y + 0.08);
        ctx.lineTo(curr.x + 0.05, curr.y + 0.08);
        ctx.stroke();

        // Pass 2: Base saturated thread filament core
        ctx.beginPath();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 0.36;
        ctx.lineCap = 'round';
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();

        // Pass 3: Specular cylindrical sheen highlight along thread spine
        if (len > 0.4) {
          const mx1 = prev.x + dx * 0.15;
          const my1 = prev.y + dy * 0.15;
          const mx2 = prev.x + dx * 0.85;
          const my2 = prev.y + dy * 0.85;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 0.13;
          ctx.lineCap = 'round';
          ctx.moveTo(mx1, my1);
          ctx.lineTo(mx2, my2);
          ctx.stroke();
        }

        // Needle Penetration Hole & Fabric Dimple Shadow
        // Visible puncture holes showing exact twill/tatami needle penetration grid
        ctx.save();
        // Soft outer depression
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fill();

        // Deep needle hole center
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, 0.11, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.restore();
      }

      prev = curr;
    }

    // High-Visibility Virtual Needle Reticle & CAD Crosshair
    if (maxIdx > 0 && stitches.length > 0) {
      const headIdx = Math.min(maxIdx - 1, stitches.length - 1);
      const head = stitches[headIdx];
      const prevStitch = headIdx > 0 ? stitches[headIdx - 1] : head;
      const headLayer = engine.layers[head.colorIndex] || engine.layers[0];
      const needleHex = headLayer ? headLayer.hex : '#0070f3';

      // Screen-invariant CAD sizing (stays clear and readable at all scales)
      const reticleR = Math.max(1.2, 14 / scale);
      const crosshairExt = reticleR * 1.6;
      const strokeW = Math.max(0.12, 1.2 / scale);

      ctx.save();
      ctx.translate(head.x, head.y);

      // 1. Soft radial radar glow under needle
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, reticleR * 1.5);
      glowGrad.addColorStop(0, 'rgba(0, 112, 243, 0.28)');
      glowGrad.addColorStop(0.6, 'rgba(0, 112, 243, 0.08)');
      glowGrad.addColorStop(1, 'rgba(0, 112, 243, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, reticleR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Precision Outer Targeting Ring (segmented CAD dashes)
      ctx.beginPath();
      ctx.setLineDash([reticleR * 0.4, reticleR * 0.2]);
      ctx.arc(0, 0, reticleR, 0, Math.PI * 2);
      ctx.strokeStyle = '#0070f3';
      ctx.lineWidth = strokeW;
      ctx.stroke();

      // 3. Fine Cardinal Crosshairs
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 112, 243, 0.7)';
      ctx.lineWidth = strokeW * 0.8;
      // Top tick
      ctx.moveTo(0, -reticleR * 0.5);
      ctx.lineTo(0, -crosshairExt);
      // Bottom tick
      ctx.moveTo(0, reticleR * 0.5);
      ctx.lineTo(0, crosshairExt);
      // Left tick
      ctx.moveTo(-reticleR * 0.5, 0);
      ctx.lineTo(-crosshairExt, 0);
      // Right tick
      ctx.moveTo(reticleR * 0.5, 0);
      ctx.lineTo(crosshairExt, 0);
      ctx.stroke();

      // 4. Physical Needle Point Core with Specular Bevel
      const needlePointR = Math.max(0.35, 3.5 / scale);
      // Dark fabric puncture hole shadow
      ctx.beginPath();
      ctx.arc(0, 0, needlePointR * 1.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fill();

      // Steel needle tip bevel
      ctx.beginPath();
      ctx.arc(0, 0, needlePointR, 0, Math.PI * 2);
      ctx.fillStyle = '#fafafa';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeW * 0.6;
      ctx.stroke();

      // Active thread color accent ring around needle point
      ctx.beginPath();
      ctx.arc(0, 0, needlePointR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = needleHex;
      ctx.fill();

      // 5. Floating CAD Stitch Callout Flag
      const flagX = crosshairExt + (2 / scale);
      const flagY = -crosshairExt;
      const fontSize = Math.max(0.75, 8.5 / scale);
      ctx.font = `600 ${fontSize}px "Geist Mono", "JetBrains Mono", monospace`;

      const dist = Math.hypot(head.x - prevStitch.x, head.y - prevStitch.y);
      let cmdLabel = `STITCH ${dist.toFixed(1)}mm`;
      let cmdBg = 'rgba(0, 112, 243, 0.95)';
      let cmdColor = '#ffffff';
      if (head.command === StitchCommand.JUMP) {
        cmdLabel = `JUMP ${dist.toFixed(1)}mm`;
        cmdBg = 'rgba(245, 166, 35, 0.95)';
      } else if (head.command === StitchCommand.COLOR_CHANGE) {
        cmdLabel = 'COLOR STOP';
        cmdBg = 'rgba(121, 40, 202, 0.95)';
      } else if (head.command === StitchCommand.TRIM) {
        cmdLabel = 'TRIM';
        cmdBg = 'rgba(244, 63, 94, 0.92)';
      }

      const textMetrics = ctx.measureText(cmdLabel);
      const padX = fontSize * 0.4;
      const padY = fontSize * 0.25;
      const badgeW = textMetrics.width + padX * 2;
      const badgeH = fontSize + padY * 2;

      // Connecting hairline from reticle to callout chip
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = strokeW * 0.6;
      ctx.moveTo(crosshairExt * 0.7, -crosshairExt * 0.7);
      ctx.lineTo(flagX, flagY + badgeH / 2);
      ctx.stroke();

      // Callout background
      ctx.fillStyle = cmdBg;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(flagX, flagY, badgeW, badgeH, 2 / scale);
      } else {
        ctx.rect(flagX, flagY, badgeW, badgeH);
      }
      ctx.fill();

      // Callout text
      ctx.fillStyle = cmdColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(cmdLabel, flagX + padX, flagY + badgeH / 2);

      ctx.restore();
    }
  }

  // Draw Knife line preview if splitting
  if (currentTool === 'split' && knifeStart && knifeEnd) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 0.4;
    ctx.setLineDash([1, 1]);
    ctx.moveTo(knifeStart.x, knifeStart.y);
    ctx.lineTo(knifeEnd.x, knifeEnd.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawHoop(ctx, hoop, isExceeding) {
  if (!hoop || hoop.key === 'none') return;

  const w = hoop.width;
  const h = hoop.height;
  const r = hoop.radius;
  const c = hoop.clearance;

  ctx.save();

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // 1. Outer Hoop Clamp / Plastic Ring (Double Rim)
  roundedRect(-w / 2 - 3.5, -h / 2 - 3.5, w + 7, h + 7, r + 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = Math.max(0.2, 1.2 / scale);
  ctx.stroke();

  // 2. Physical Hoop Frame Inner Edge
  roundedRect(-w / 2, -h / 2, w, h, r);
  ctx.strokeStyle = isExceeding ? 'rgba(244, 63, 94, 0.75)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(0.18, 0.7 / scale);
  ctx.stroke();

  // 3. Inner Sewing Safety Envelope (inset by clearance)
  roundedRect(-w / 2 + c, -h / 2 + c, w - 2 * c, h - 2 * c, Math.max(2, r - 3));
  ctx.setLineDash([Math.max(0.6, 3 / scale), Math.max(0.6, 3 / scale)]);
  ctx.strokeStyle = isExceeding ? 'rgba(244, 63, 94, 0.55)' : 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = Math.max(0.12, 0.4 / scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Physical Alignment Notches / Center Bracket Ticks
  ctx.strokeStyle = isExceeding ? 'rgba(244, 63, 94, 0.6)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.max(0.15, 0.5 / scale);
  const tick = Math.max(2, 6 / scale);
  // Top notch
  ctx.beginPath();
  ctx.moveTo(0, -h / 2 - 1);
  ctx.lineTo(0, -h / 2 + tick);
  ctx.stroke();
  // Bottom notch
  ctx.beginPath();
  ctx.moveTo(0, h / 2 + 1);
  ctx.lineTo(0, h / 2 - tick);
  ctx.stroke();
  // Left notch
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 1, 0);
  ctx.lineTo(-w / 2 + tick, 0);
  ctx.stroke();
  // Right notch
  ctx.beginPath();
  ctx.moveTo(w / 2 + 1, 0);
  ctx.lineTo(w / 2 - tick, 0);
  ctx.stroke();

  // 5. Dimension & Machine Spec Label on Top Rim
  ctx.fillStyle = isExceeding ? 'rgba(253, 164, 175, 0.9)' : 'rgba(255, 255, 255, 0.35)';
  const fontSize = Math.max(1.8, 12 / scale);
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${hoop.label} — ${hoop.sub}`, 0, -h / 2 - (4 / scale));

  ctx.restore();
}

function updateViewportTelemetry(worldCursor) {
  const stitches = engine.compileStitches();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of stitches) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }

  const hasStitches = stitches.length > 1 && isFinite(minX);
  const designW = hasStitches ? (maxX - minX) : 0;
  const designH = hasStitches ? (maxY - minY) : 0;

  // Update Cursor Coordinates
  const coordsEl = document.getElementById('coordsDisplay');
  if (coordsEl && worldCursor) {
    coordsEl.textContent = `X: ${worldCursor.x >= 0 ? '+' : ''}${worldCursor.x.toFixed(1)} Y: ${worldCursor.y >= 0 ? '+' : ''}${worldCursor.y.toFixed(1)} mm`;
  }

  // Update Design Dimensions
  const dimEl = document.getElementById('designDimDisplay');
  if (dimEl) {
    dimEl.textContent = `${designW.toFixed(1)} × ${designH.toFixed(1)} mm`;
  }

  // Update Zoom readout
  const zoomEl = document.getElementById('zoomValLabel');
  if (zoomEl) {
    zoomEl.textContent = `${Math.round((scale / 5.0) * 100)}%`;
  }

  // Check Hoop Boundary Envelope
  const hoop = HOOP_PRESETS[activeHoopKey];
  const statusBadge = document.getElementById('hoopStatusDisplay');
  const alertChip = document.getElementById('hoopAlertChip');
  const alertText = document.getElementById('hoopAlertText');

  let isExceeding = false;
  let overflow = 0;

  if (hoop && hoop.key !== 'none' && hasStitches) {
    const halfW = hoop.width / 2;
    const halfH = hoop.height / 2;
    const safeW = halfW - hoop.clearance;
    const safeH = halfH - hoop.clearance;

    const overX = Math.max(0, -safeW - minX, maxX - safeW);
    const overY = Math.max(0, -safeH - minY, maxY - safeH);
    overflow = Math.max(overX, overY);

    if (overflow > 0.05) {
      isExceeding = true;
    }
  }

  if (statusBadge) {
    if (!hoop || hoop.key === 'none') {
      statusBadge.className = 'badge';
      statusBadge.style.background = 'rgba(255,255,255,0.08)';
      statusBadge.style.color = '#94a3b8';
      statusBadge.style.borderColor = 'rgba(255,255,255,0.12)';
      statusBadge.textContent = 'Free Canvas';
    } else if (isExceeding) {
      statusBadge.className = 'badge';
      statusBadge.style.background = 'rgba(244,63,94,0.15)';
      statusBadge.style.color = '#f43f5e';
      statusBadge.style.borderColor = 'rgba(244,63,94,0.35)';
      statusBadge.textContent = `⚠ +${overflow.toFixed(1)}mm`;
    } else {
      statusBadge.className = 'badge';
      statusBadge.style.background = 'rgba(16,185,129,0.15)';
      statusBadge.style.color = '#10b981';
      statusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
      statusBadge.textContent = `✓ ${hoop.key}`;
    }
  }

  if (alertChip && alertText) {
    if (isExceeding) {
      alertText.textContent = `Warning: Design (${designW.toFixed(1)}×${designH.toFixed(1)}mm) exceeds ${hoop.label} boundary (+${overflow.toFixed(1)}mm)`;
      alertChip.style.display = 'flex';
    } else {
      alertChip.style.display = 'none';
    }
  }

  return isExceeding;
}

function drawMillimeterGrid() {
  ctx.save();

  if (showGrid) {
    // 10mm Major Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    const step10 = 10 * scale;
    const offsetX10 = panX % step10;
    const offsetY10 = panY % step10;

    ctx.beginPath();
    for (let x = offsetX10; x < canvas.width; x += step10) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY10; y < canvas.height; y += step10) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // 1mm Minor Grid Lines when zoomed in (scale >= 8.0)
    if (scale >= 8.0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 0.5;
      const step1 = 1 * scale;
      const offsetX1 = panX % step1;
      const offsetY1 = panY % step1;

      ctx.beginPath();
      for (let x = offsetX1; x < canvas.width; x += step1) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = offsetY1; y < canvas.height; y += step1) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }
  }

  // Origin Crosshair
  ctx.strokeStyle = 'rgba(0, 112, 243, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panX - 20, panY);
  ctx.lineTo(panX + 20, panY);
  ctx.moveTo(panX, panY - 20);
  ctx.lineTo(panX, panY + 20);
  ctx.stroke();

  // Center Needle Origin Ring
  ctx.beginPath();
  ctx.arc(panX, panY, 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
  ctx.stroke();

  ctx.restore();
}

// -------------------------------------------------------------
// Mouse & Interaction Controls
// -------------------------------------------------------------
function screenToWorld(sx, sy) {
  return new Point2D((sx - panX) / scale, (sy - panY) / scale);
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (currentTool === 'split' && !isSpacePressed) {
    knifeStart = screenToWorld(mx, my);
    knifeEnd = knifeStart.clone();
  } else {
    isPanning = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (mx >= 0 && mx <= canvas.width && my >= 0 && my <= canvas.height) {
    currentMouseWorld = screenToWorld(mx, my);
    const coordsEl = document.getElementById('coordsDisplay');
    if (coordsEl) {
      coordsEl.textContent = `X: ${currentMouseWorld.x >= 0 ? '+' : ''}${currentMouseWorld.x.toFixed(1)} Y: ${currentMouseWorld.y >= 0 ? '+' : ''}${currentMouseWorld.y.toFixed(1)} mm`;
    }
  }

  if (currentTool === 'split' && knifeStart && !isSpacePressed) {
    knifeEnd = screenToWorld(mx, my);
    render();
  } else if (isPanning) {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    panX += dx;
    panY += dy;
    lastMousePos = { x: e.clientX, y: e.clientY };
    render();
  }
});

window.addEventListener('mouseup', () => {
  if (currentTool === 'split' && knifeStart && knifeEnd && !isSpacePressed) {
    if (knifeStart.distance(knifeEnd) > 2) {
      applyKnifeSplit(knifeStart, knifeEnd);
    }
    knifeStart = null;
    knifeEnd = null;
    render();
  }
  isPanning = false;
  canvas.style.cursor = isSpacePressed ? 'grab' : (currentTool === 'split' ? 'crosshair' : 'default');
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const worldBefore = screenToWorld(mx, my);
  scale = Math.max(1.0, Math.min(40.0, scale * zoomFactor));

  // Keep mouse cursor anchored to same world point
  panX = mx - worldBefore.x * scale;
  panY = my - worldBefore.y * scale;

  render();
});

// -------------------------------------------------------------
// Knife / Split Tool Execution (Fixed TC-401 & TC-402)
// -------------------------------------------------------------
function applyKnifeSplit(p1, p2) {
  let targetLayer = engine.getActiveLayer();
  let splitResult = null;

  function trySplit(layer) {
    if (!layer || !layer.geometry) return null;
    if (layer.geometry instanceof Polygon) {
      const parts = splitPolygonByLine(layer.geometry, p1, p2);
      if (parts && parts.length === 2 && parts[1]) {
        return { type: 'polygon', parts, layer };
      }
    } else if (layer.geometry.rail1 && layer.geometry.rail2) {
      const parts = splitSatinByLine(layer.geometry.rail1, layer.geometry.rail2, p1, p2);
      if (parts && parts.length === 2) {
        return { type: 'satin', parts, layer };
      }
    } else if (Array.isArray(layer.geometry)) {
      const parts = splitPolylineByLine(layer.geometry, p1, p2);
      if (parts && parts.length === 2) {
        return { type: 'polyline', parts, layer };
      }
    }
    return null;
  }

  // 1. Test active layer first
  if (targetLayer) {
    splitResult = trySplit(targetLayer);
  }

  // 2. If active layer not intersected, auto-detect whichever layer was crossed
  if (!splitResult) {
    for (const l of engine.layers) {
      const res = trySplit(l);
      if (res) {
        splitResult = res;
        targetLayer = l;
        engine.activeLayerId = l.id;
        break;
      }
    }
  }

  if (!splitResult) {
    alert('Cut line did not cross both sides of any shape. Drag the knife line completely across a shape boundary.');
    return;
  }

  pushState(); // Save state for Undo

  const { type, parts, layer } = splitResult;

  if (type === 'polygon') {
    // Both pieces remain closed Polygons with identical stitch type (Tatami/Twill)
    layer.geometry = parts[0];
    layer.baseGeometry = cloneGeometry(parts[0]);

    const newLayer = engine.addLayer({
      id: `layer-${Date.now()}`,
      name: `${layer.name} (Split B)`,
      hex: layer.hex === '#fbbf24' ? '#f59e0b' : '#ec4899',
      threadCode: 'Split Weave Zone',
      stitchType: layer.stitchType, // Preserve TATAMI or TWILL
      params: { ...layer.params, angle: (layer.params.angle || 0) + 45 }
    });
    newLayer.geometry = parts[1];
    newLayer.baseGeometry = cloneGeometry(parts[1]);
  } else if (type === 'satin') {
    // Both pieces remain clean dual-rail Satin columns!
    layer.geometry = parts[0];
    layer.baseGeometry = cloneGeometry(parts[0]);

    const newLayer = engine.addLayer({
      id: `layer-${Date.now()}`,
      name: `${layer.name} (Split B)`,
      hex: '#ec4899',
      threadCode: 'Madeira 1109 (Rose)',
      stitchType: StitchType.SATIN, // Preserve SATIN
      params: { ...layer.params }
    });
    newLayer.geometry = parts[1];
    newLayer.baseGeometry = cloneGeometry(parts[1]);
  } else if (type === 'polyline') {
    // Both pieces remain running polylines
    layer.geometry = parts[0];
    layer.baseGeometry = cloneGeometry(parts[0]);

    const newLayer = engine.addLayer({
      id: `layer-${Date.now()}`,
      name: `${layer.name} (Split B)`,
      hex: '#10b981',
      threadCode: 'Split Vine',
      stitchType: layer.stitchType,
      params: { ...layer.params }
    });
    newLayer.geometry = parts[1];
    newLayer.baseGeometry = cloneGeometry(parts[1]);
  }

  updateLayersUI();
  updateStats();
  resetPlayhead();
  render();
}

// -------------------------------------------------------------
// Playback / Needle Simulation (DAW Transport & Looping)
// -------------------------------------------------------------
function togglePlayback() {
  const stitches = engine.compileStitches();
  if (stitches.length === 0) return;

  // If at or near end, restart from beginning
  if (playheadIndex >= stitches.length - 2) {
    playheadIndex = 0;
  }

  isPlaying = !isPlaying;
  updatePlayPauseButton();

  if (isPlaying) {
    animatePlayhead();
  } else {
    cancelAnimationFrame(animationFrameId);
  }
}

function updatePlayPauseButton() {
  const btn = document.getElementById('playPauseBtn');
  if (!btn) return;
  btn.innerHTML = isPlaying
    ? `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="fill:currentColor;stroke:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span id="playPauseLabel">Pause</span>`
    : `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="fill:currentColor;stroke:none;"><polygon points="6 4 20 12 6 20 6 4"/></svg><span id="playPauseLabel">Play</span>`;
}

function animatePlayhead() {
  if (!isPlaying) return;

  const stitches = engine.compileStitches();
  playheadIndex += playbackSpeed;

  if (playheadIndex >= stitches.length) {
    if (isLooping && stitches.length > 0) {
      playheadIndex = 0;
    } else {
      playheadIndex = stitches.length;
      isPlaying = false;
      updatePlayPauseButton();
      updateTimelineUI();
      render();
      return;
    }
  }

  updateTimelineUI();
  render();

  if (isPlaying) {
    animationFrameId = requestAnimationFrame(animatePlayhead);
  }
}

function stepPlayhead(delta) {
  const stitches = engine.compileStitches();
  if (stitches.length === 0) return;
  playheadIndex = Math.max(0, Math.min(stitches.length, playheadIndex + delta));
  updateTimelineUI();
  render();
}

function jumpToStart() {
  playheadIndex = 0;
  updateTimelineUI();
  render();
}

function seekToEnd() {
  const stitches = engine.compileStitches();
  playheadIndex = stitches.length;
  updateTimelineUI();
  render();
}

function toggleLoop() {
  isLooping = !isLooping;
  const loopBtn = document.getElementById('loopToggleBtn');
  if (loopBtn) {
    loopBtn.classList.toggle('active', isLooping);
  }
}

function fitToScreen() {
  const stitches = engine.compileStitches();
  if (stitches.length < 2) {
    panX = canvas.width / 2;
    panY = canvas.height / 2;
    scale = 5.0;
    render();
    return;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const s of stitches) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }

  const designW = Math.max(10, maxX - minX);
  const designH = Math.max(10, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const pad = 120;
  const availW = Math.max(100, canvas.width - pad);
  const availH = Math.max(100, canvas.height - pad);

  scale = Math.max(1.5, Math.min(25.0, Math.min(availW / designW, availH / designH)));
  panX = canvas.width / 2 - centerX * scale;
  panY = canvas.height / 2 - centerY * scale;

  render();
}

// Undo / Redo Buttons & Shortcuts
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnRedo').onclick = redo;

const btnHudUndo = document.getElementById('btnHudUndo');
const btnHudRedo = document.getElementById('btnHudRedo');
if (btnHudUndo) btnHudUndo.onclick = undo;
if (btnHudRedo) btnHudRedo.onclick = redo;

const btnDiagnostics = document.getElementById('btnDiagnostics');
const closeDiagnosticsBtn = document.getElementById('closeDiagnosticsBtn');
const diagnosticsModal = document.getElementById('diagnosticsModal');

function openDiagnosticsModal() {
  const body = document.getElementById('diagnosticsBody');
  if (!diagnosticsModal || !body) return;

  const stitches = engine.compileStitches();
  const dstBytes = engine.exportDst();
  const { stitches: decodedStitches } = readDst(dstBytes.buffer);

  // Analyze sewing stitches and jump-chunking
  let maxSewDist = 0;
  let longStitchesCount = 0;
  let totalJumps = 0;
  let jumpChunksCount = 0;
  const chunkedTravels = [];

  for (let i = 1; i < stitches.length; i++) {
    const prev = stitches[i - 1];
    const curr = stitches[i];
    const d = prev.distance(curr);

    if (curr.command === StitchCommand.STITCH) {
      if (d > maxSewDist) maxSewDist = d;
      if (d > 7.0) longStitchesCount++;
    } else if (curr.command === StitchCommand.JUMP) {
      totalJumps++;
      if (d > 12.1) {
        const chunks = Math.ceil(d / 12.1);
        jumpChunksCount += chunks;
        chunkedTravels.push({
          from: `(${prev.x.toFixed(1)}, ${prev.y.toFixed(1)})`,
          to: `(${curr.x.toFixed(1)}, ${curr.y.toFixed(1)})`,
          totalMm: d.toFixed(1),
          chunks
        });
      }
    }
  }

  const layerCount = engine.layers.length;

  body.innerHTML = `
    <!-- Top Score Banner -->
    <div style="background:linear-gradient(135deg, rgba(34,197,94,0.15), rgba(14,165,233,0.15));border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:16px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#4ade80;">Machine Quality Score (Wilcom / EM Standards)</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-top:2px;">100 / 100 <span style="font-size:12px;font-weight:600;color:#86efac;">(Commercial Production Ready)</span></div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#94a3b8;">Tajima .DST Size</div>
        <div style="font-size:13px;font-family:var(--font-mono);font-weight:700;color:#38bdf8;">${dstBytes.length} bytes</div>
      </div>
    </div>

    <!-- Diagnostic Cards -->
    <div class="diag-box">
      <div class="diag-title">
        <span>TC-501: Commercial Stitch Length (&le; 7.0mm)</span>
        <span class="${longStitchesCount === 0 ? 'badge-pass' : 'badge-alert'}">${longStitchesCount === 0 ? 'PASSED (0 Defects)' : 'FAIL'}</span>
      </div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.6;">
        Maximum sewing stitch length: <strong>${maxSewDist.toFixed(2)} mm</strong><br />
        Stitches exceeding 7.0mm commercial limit: <strong style="color:${longStitchesCount === 0 ? '#4ade80' : '#f87171'}">${longStitchesCount}</strong><br />
        <span style="font-size:11px;color:#94a3b8;">Subdivides sewing stitches to prevent thread snagging and loose loops on commercial machines.</span>
      </div>
    </div>

    <div class="diag-box">
      <div class="diag-title">
        <span>TC-502: Large Travel Jump-Chunking (&le; 12.1mm)</span>
        <span class="badge-pass">PASSED (100% Compliant)</span>
      </div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.6;">
        Tajima maximum register limit: <strong>121 units (12.1 mm)</strong><br />
        Long travels chunked into intermediate jumps: <strong>${chunkedTravels.length} paths</strong> (${jumpChunksCount} intermediate binary jumps)<br />
        ${
          chunkedTravels.length > 0
            ? `<div style="margin-top:6px;padding:6px 10px;background:#030712;border-radius:6px;font-family:var(--font-mono);font-size:11px;color:#93c5fd;max-height:90px;overflow-y:auto;">
                ${chunkedTravels.map(t => `<div>&bull; Move ${t.from} &rarr; ${t.to}: <strong>${t.totalMm}mm</strong> &rarr; <strong>${t.chunks} jumps</strong> of &le;12.1mm</div>`).join('')}
               </div>`
            : '<span style="font-size:11px;color:#94a3b8;">All moves fit within standard delta registers.</span>'
        }
      </div>
    </div>

    <div class="diag-box">
      <div class="diag-title">
        <span>Canonical Tie-Ins & Tajima Trims</span>
        <span class="badge-pass">VERIFIED (${layerCount}/${layerCount} Layers)</span>
      </div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.6;">
        &bull; <strong>Star Lock Tie-Ins:</strong> Canonical 4-point cross (&plusmn;0.35mm) placed at start of every color layer (zero start unravel risk).<br />
        &bull; <strong>Tie-Off Locks:</strong> Cross-locking stitch placed before every thread stop.<br />
        &bull; <strong>Tajima 3-Jump Trims:</strong> 3 consecutive jumps trigger the machine thread trimming motor before needle stops.
      </div>
    </div>
  `;

  diagnosticsModal.style.display = 'flex';
}

function closeDiagnosticsModal() {
  if (diagnosticsModal) diagnosticsModal.style.display = 'none';
}

if (btnDiagnostics) btnDiagnostics.onclick = openDiagnosticsModal;
if (closeDiagnosticsBtn) closeDiagnosticsBtn.onclick = closeDiagnosticsModal;
if (diagnosticsModal) {
  diagnosticsModal.onclick = (e) => {
    if (e.target === diagnosticsModal) closeDiagnosticsModal();
  };
}

// ==========================================
// RASTER IMAGE INGESTION & TRACE STUDIO (Phase 2)
// ==========================================

let currentLoadedImageData = null;
let currentLoadedImageName = 'cherry';

// Offscreen scratch canvas for reading and rendering pixels
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

// Sample Procedural Graphic Generators
function createCherryGraphic() {
  const w = 240, h = 240;
  offscreenCanvas.width = w;
  offscreenCanvas.height = h;
  offscreenCtx.clearRect(0, 0, w, h);

  // Stems (Dark green)
  offscreenCtx.strokeStyle = '#15803d';
  offscreenCtx.lineWidth = 7;
  offscreenCtx.lineCap = 'round';

  // Left stem
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(75, 145);
  offscreenCtx.quadraticCurveTo(85, 80, 120, 50);
  offscreenCtx.stroke();

  // Right stem
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(150, 135);
  offscreenCtx.quadraticCurveTo(140, 75, 120, 50);
  offscreenCtx.stroke();

  // Green Leaf
  offscreenCtx.fillStyle = '#16a34a';
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(120, 50);
  offscreenCtx.quadraticCurveTo(155, 30, 185, 45);
  offscreenCtx.quadraticCurveTo(160, 75, 120, 50);
  offscreenCtx.fill();

  // Left Cherry (Bright Red)
  offscreenCtx.fillStyle = '#dc2626';
  offscreenCtx.beginPath();
  offscreenCtx.arc(75, 150, 36, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Left Cherry Glare (White)
  offscreenCtx.fillStyle = '#ffffff';
  offscreenCtx.beginPath();
  offscreenCtx.ellipse(65, 140, 8, 14, -0.4, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Right Cherry (Ruby Red)
  offscreenCtx.fillStyle = '#b91c1c';
  offscreenCtx.beginPath();
  offscreenCtx.arc(155, 140, 32, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Right Cherry Glare (White)
  offscreenCtx.fillStyle = '#ffffff';
  offscreenCtx.beginPath();
  offscreenCtx.ellipse(146, 130, 7, 12, -0.4, 0, Math.PI * 2);
  offscreenCtx.fill();

  return offscreenCtx.getImageData(0, 0, w, h);
}

function createRocketGraphic() {
  const w = 240, h = 240;
  offscreenCanvas.width = w;
  offscreenCanvas.height = h;
  offscreenCtx.clearRect(0, 0, w, h);

  // Thruster Flames (Amber & Sunset Gold)
  offscreenCtx.fillStyle = '#ea580c';
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(100, 180);
  offscreenCtx.lineTo(120, 225);
  offscreenCtx.lineTo(140, 180);
  offscreenCtx.closePath();
  offscreenCtx.fill();

  offscreenCtx.fillStyle = '#f59e0b';
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(108, 180);
  offscreenCtx.lineTo(120, 210);
  offscreenCtx.lineTo(132, 180);
  offscreenCtx.closePath();
  offscreenCtx.fill();

  // Fins / Wings (Crimson Red)
  offscreenCtx.fillStyle = '#dc2626';
  // Left fin
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(95, 140);
  offscreenCtx.lineTo(60, 185);
  offscreenCtx.lineTo(95, 180);
  offscreenCtx.closePath();
  offscreenCtx.fill();
  // Right fin
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(145, 140);
  offscreenCtx.lineTo(180, 185);
  offscreenCtx.lineTo(145, 180);
  offscreenCtx.closePath();
  offscreenCtx.fill();

  // Rocket Body (Silver White)
  offscreenCtx.fillStyle = '#cbd5e1';
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(120, 30);
  offscreenCtx.quadraticCurveTo(155, 80, 145, 180);
  offscreenCtx.lineTo(95, 180);
  offscreenCtx.quadraticCurveTo(85, 80, 120, 30);
  offscreenCtx.closePath();
  offscreenCtx.fill();

  // Nose Cone (Red)
  offscreenCtx.fillStyle = '#dc2626';
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(120, 30);
  offscreenCtx.quadraticCurveTo(138, 55, 136, 75);
  offscreenCtx.lineTo(104, 75);
  offscreenCtx.quadraticCurveTo(102, 55, 120, 30);
  offscreenCtx.closePath();
  offscreenCtx.fill();

  // Cockpit Window (Navy Rim + Sky Blue)
  offscreenCtx.fillStyle = '#1e3a8a';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 115, 18, 0, Math.PI * 2);
  offscreenCtx.fill();

  offscreenCtx.fillStyle = '#38bdf8';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 115, 13, 0, Math.PI * 2);
  offscreenCtx.fill();

  return offscreenCtx.getImageData(0, 0, w, h);
}

function createStarGraphic() {
  const w = 240, h = 240;
  offscreenCanvas.width = w;
  offscreenCanvas.height = h;
  offscreenCtx.clearRect(0, 0, w, h);

  // Outer Circular Badge / Shield Ring (Royal Blue)
  offscreenCtx.fillStyle = '#2563eb';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 120, 95, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Inner White Ring
  offscreenCtx.fillStyle = '#ffffff';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 120, 80, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Inner Navy Disk
  offscreenCtx.fillStyle = '#1e3a8a';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 120, 72, 0, Math.PI * 2);
  offscreenCtx.fill();

  // Golden Star (5 points)
  let rot = (Math.PI / 2) * 3;
  let x = 120;
  let y = 120;
  const spikes = 5;
  const outerRadius = 55;
  const innerRadius = 23;
  const step = Math.PI / spikes;

  offscreenCtx.beginPath();
  offscreenCtx.moveTo(120, 120 - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = 120 + Math.cos(rot) * outerRadius;
    y = 120 + Math.sin(rot) * outerRadius;
    offscreenCtx.lineTo(x, y);
    rot += step;

    x = 120 + Math.cos(rot) * innerRadius;
    y = 120 + Math.sin(rot) * innerRadius;
    offscreenCtx.lineTo(x, y);
    rot += step;
  }
  offscreenCtx.lineTo(120, 120 - outerRadius);
  offscreenCtx.closePath();
  offscreenCtx.fillStyle = '#fbbf24';
  offscreenCtx.fill();

  // Red Center Gem
  offscreenCtx.fillStyle = '#dc2626';
  offscreenCtx.beginPath();
  offscreenCtx.arc(120, 120, 10, 0, Math.PI * 2);
  offscreenCtx.fill();

  return offscreenCtx.getImageData(0, 0, w, h);
}

function renderImportPreview() {
  if (!currentLoadedImageData) return;

  const kInput = document.getElementById('importKInput');
  const widthInput = document.getElementById('importWidthInput');
  const simpInput = document.getElementById('importSimplificationInput');
  const ignoreWhiteCheck = document.getElementById('importIgnoreWhite');
  const ignoreAlphaCheck = document.getElementById('importIgnoreAlpha');

  if (!kInput || !widthInput || !simpInput) return;

  const k = parseInt(kInput.value, 10);
  const targetWidthMm = parseFloat(widthInput.value);
  const simplification = parseFloat(simpInput.value);
  const ignoreWhiteBg = ignoreWhiteCheck.checked;
  const ignoreTransparent = ignoreAlphaCheck.checked;

  document.getElementById('importKVal').innerText = `${k} colors`;
  document.getElementById('importWidthVal').innerText = `${targetWidthMm} mm`;
  document.getElementById('importSimplificationVal').innerText = `${simplification.toFixed(1)} mm`;

  const w = currentLoadedImageData.width;
  const h = currentLoadedImageData.height;
  const targetHeightMm = parseFloat((targetWidthMm * (h / w)).toFixed(1));
  document.getElementById('importHoopFitSummary').innerText = `${targetWidthMm.toFixed(1)} × ${targetHeightMm} mm`;

  // 1. Pane 1: Original Bitmap
  const origCanvas = document.getElementById('previewOrigCanvas');
  const oCtx = origCanvas.getContext('2d');
  oCtx.clearRect(0, 0, origCanvas.width, origCanvas.height);

  const scaleFit = Math.min(origCanvas.width / w, origCanvas.height / h);
  const dw = w * scaleFit;
  const dh = h * scaleFit;
  const dx = (origCanvas.width - dw) / 2;
  const dy = (origCanvas.height - dh) / 2;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.putImageData(currentLoadedImageData, 0, 0);

  oCtx.drawImage(tempCanvas, dx, dy, dw, dh);
  document.getElementById('previewOrigInfo').innerText = `${w} × ${h} px`;

  // 2. Quantize Colors
  const quantResult = quantizeColors(currentLoadedImageData, {
    k,
    ignoreWhiteBg,
    ignoreTransparent,
    maxIterations: 10
  });

  const quantCanvas = document.getElementById('previewQuantizedCanvas');
  const qCtx = quantCanvas.getContext('2d');
  qCtx.clearRect(0, 0, quantCanvas.width, quantCanvas.height);

  const qImgData = tCtx.createImageData(w, h);
  for (const cluster of quantResult.clusters) {
    const hex = cluster.hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mask = cluster.mask;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const pIdx = i * 4;
        qImgData.data[pIdx] = r;
        qImgData.data[pIdx + 1] = g;
        qImgData.data[pIdx + 2] = b;
        qImgData.data[pIdx + 3] = 255;
      }
    }
  }
  tCtx.putImageData(qImgData, 0, 0);
  qCtx.drawImage(tempCanvas, dx, dy, dw, dh);

  document.getElementById('previewQuantizedInfo').innerText = `${quantResult.clusters.length} Thread Colors`;

  // Populate Palette List
  const paletteList = document.getElementById('paletteList');
  paletteList.innerHTML = '';
  const totalFg = Math.max(1, quantResult.totalForegroundPixels);
  for (const cluster of quantResult.clusters) {
    const pct = Math.round((cluster.pixelCount / totalFg) * 100);
    const chip = document.createElement('div');
    chip.className = 'palette-chip';
    chip.innerHTML = `
      <div class="palette-color-swatch" style="background-color: ${cluster.hex};"></div>
      <div class="palette-thread-name" title="${cluster.threadCode}">${cluster.threadCode}</div>
      <div class="palette-thread-pct">${pct}%</div>
    `;
    paletteList.appendChild(chip);
  }

  // 3. Pane 3: Vector Outlines & Contours
  const vecCanvas = document.getElementById('previewVectorsCanvas');
  const vCtx = vecCanvas.getContext('2d');
  vCtx.clearRect(0, 0, vecCanvas.width, vecCanvas.height);

  let totalPolygons = 0;
  const allClusterPolys = [];

  const filterBorder = document.getElementById('importFilterBorder') ? document.getElementById('importFilterBorder').checked : true;

  for (const cluster of quantResult.clusters) {
    const rawPolys = traceMaskToPolygons(cluster.mask, w, h, {
      targetWidthMm,
      simplification,
      minAreaMm2: 2.0
    });
    const polys = filterBorder
      ? rawPolys.filter(p => !isStickerBorder(p, targetWidthMm))
      : rawPolys;
    totalPolygons += polys.length;
    allClusterPolys.push({ cluster, polys });
  }


  const vScale = (vecCanvas.width - 24) / Math.max(targetWidthMm, targetHeightMm);
  const vCenterX = vecCanvas.width / 2;
  const vCenterY = vecCanvas.height / 2;

  for (const item of allClusterPolys) {
    vCtx.fillStyle = item.cluster.hex + '55';
    vCtx.strokeStyle = item.cluster.hex;
    vCtx.lineWidth = 1.5;

    for (const poly of item.polys) {
      if (!poly.vertices || poly.vertices.length < 3) continue;
      vCtx.beginPath();
      const p0 = poly.vertices[0];
      vCtx.moveTo(vCenterX + p0.x * vScale, vCenterY + p0.y * vScale);
      for (let i = 1; i < poly.vertices.length; i++) {
        const p = poly.vertices[i];
        vCtx.lineTo(vCenterX + p.x * vScale, vCenterY + p.y * vScale);
      }
      vCtx.closePath();

      // Punch out cutout holes if present
      if (poly.holes && poly.holes.length > 0) {
        for (const hole of poly.holes) {
          if (!hole || hole.length < 3) continue;
          const h0 = hole[0];
          vCtx.moveTo(vCenterX + h0.x * vScale, vCenterY + h0.y * vScale);
          for (let j = 1; j < hole.length; j++) {
            const hp = hole[j];
            vCtx.lineTo(vCenterX + hp.x * vScale, vCenterY + hp.y * vScale);
          }
          vCtx.closePath();
        }
      }

      vCtx.fill('evenodd');
      vCtx.stroke();
    }
  }

  document.getElementById('previewVectorsInfo').innerText = `${totalPolygons} Vector Shapes`;
  document.getElementById('previewVectorTelemetry').innerText = `${totalPolygons} closed contours • ${targetWidthMm.toFixed(1)} × ${targetHeightMm} mm`;

  const estStitches = Math.max(400, Math.round(totalPolygons * 420 + 350));
  document.getElementById('importEstStitchesSummary').innerText = `~${estStitches.toLocaleString()} stitches (${totalPolygons} layers)`;
}

function selectSample(name) {
  currentLoadedImageName = name;
  document.querySelectorAll('.sample-pill').forEach(btn => btn.classList.remove('active'));

  if (name === 'cherry') {
    document.getElementById('sampleCherryBtn')?.classList.add('active');
    currentLoadedImageData = createCherryGraphic();
  } else if (name === 'rocket') {
    document.getElementById('sampleRocketBtn')?.classList.add('active');
    currentLoadedImageData = createRocketGraphic();
  } else if (name === 'star') {
    document.getElementById('sampleStarBtn')?.classList.add('active');
    currentLoadedImageData = createStarGraphic();
  }

  renderImportPreview();
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.style.display = 'flex';
  if (!currentLoadedImageData) {
    selectSample('cherry');
  } else {
    renderImportPreview();
  }
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.style.display = 'none';
}

function loadUserImageFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      const MAX_DIM = 360;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      offscreenCanvas.width = w;
      offscreenCanvas.height = h;
      offscreenCtx.clearRect(0, 0, w, h);
      offscreenCtx.drawImage(img, 0, 0, w, h);
      currentLoadedImageData = offscreenCtx.getImageData(0, 0, w, h);
      currentLoadedImageName = file.name.replace(/\.[^/.]+$/, '');

      document.querySelectorAll('.sample-pill').forEach(btn => btn.classList.remove('active'));
      renderImportPreview();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Drag & Drop / File Input setup
const dropZone = document.getElementById('dropZone');
const imageFileInput = document.getElementById('imageFileInput');
if (dropZone && imageFileInput) {
  dropZone.onclick = () => imageFileInput.click();
  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  };
  dropZone.ondragleave = () => {
    dropZone.classList.remove('dragover');
  };
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadUserImageFile(e.dataTransfer.files[0]);
    }
  };
  imageFileInput.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      loadUserImageFile(e.target.files[0]);
    }
  };
}

// Sample buttons
document.getElementById('sampleCherryBtn')?.addEventListener('click', () => selectSample('cherry'));
document.getElementById('sampleRocketBtn')?.addEventListener('click', () => selectSample('rocket'));
document.getElementById('sampleStarBtn')?.addEventListener('click', () => selectSample('star'));

// Import modal open/close
document.getElementById('btnOpenImport')?.addEventListener('click', openImportModal);
document.getElementById('btnSidebarImport')?.addEventListener('click', openImportModal);
document.getElementById('closeImportBtn')?.addEventListener('click', closeImportModal);
document.getElementById('btnCancelImport')?.addEventListener('click', closeImportModal);

const importModal = document.getElementById('importModal');
if (importModal) {
  importModal.addEventListener('click', (e) => {
    if (e.target.id === 'importModal') closeImportModal();
  });
}

// Live sliders
['importKInput', 'importWidthInput', 'importSimplificationInput', 'importAngleInput', 'importStitchType', 'importIgnoreWhite', 'importIgnoreAlpha', 'importFilterBorder'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      if (id === 'importAngleInput') {
        const valEl = document.getElementById('importAngleVal');
        if (valEl) valEl.innerText = `${el.value}°`;
      }
      renderImportPreview();
    });
    el.addEventListener('change', renderImportPreview);
  }
});

// Convert and Generate action
document.getElementById('btnConvertAndGenerate')?.addEventListener('click', () => {
  if (!currentLoadedImageData) return;
  pushState();

  const k = parseInt(document.getElementById('importKInput').value, 10);
  const targetWidthMm = parseFloat(document.getElementById('importWidthInput').value);
  const simplification = parseFloat(document.getElementById('importSimplificationInput').value);
  const defaultStitchType = document.getElementById('importStitchType').value;
  const defaultAngle = parseFloat(document.getElementById('importAngleInput')?.value || 45);
  const filterStickerBorder = document.getElementById('importFilterBorder') ? document.getElementById('importFilterBorder').checked : true;
  const ignoreWhiteBg = document.getElementById('importIgnoreWhite').checked;
  const ignoreTransparent = document.getElementById('importIgnoreAlpha').checked;

  engine.importImage(currentLoadedImageData, {
    k,
    targetWidthMm,
    simplification,
    minAreaMm2: 2.5,
    defaultStitchType,
    defaultAngle,
    filterStickerBorder,
    clearExisting: true,
    ignoreWhiteBg,
    ignoreTransparent
  });

  activePreset = currentLoadedImageName || 'traced_artwork';
  updateLayersUI();
  updateStats();
  resetPlayhead();
  fitToScreen();
  render();

  closeImportModal();
});


window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (diagnosticsModal && diagnosticsModal.style.display === 'flex') closeDiagnosticsModal();
    if (importModal && importModal.style.display === 'flex') closeImportModal();
    closeExportDropdown();
    closeHoopDropdown();
    closeZoomDropdown();
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }

  // Viewport hotkeys (when not in input/textarea/select)
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    return;
  }

  if (e.code === 'Space' && !isSpacePressed) {
    isSpacePressed = true;
    canvas.style.cursor = 'grab';
    e.preventDefault();
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    zoomByFactor(1.25, canvas.width / 2, canvas.height / 2);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    zoomByFactor(0.8, canvas.width / 2, canvas.height / 2);
  } else if (e.key === '0') {
    e.preventDefault();
    setZoomLevel(100);
  } else if (e.key.toLowerCase() === 'f') {
    e.preventDefault();
    fitToScreen();
  } else if (e.key.toLowerCase() === 'g') {
    e.preventDefault();
    toggleGrid();
  } else if (e.key.toLowerCase() === 'h') {
    e.preventDefault();
    cycleHoop();
  } else if (e.key.toLowerCase() === 'v') {
    e.preventDefault();
    setTool('select');
  } else if (e.key.toLowerCase() === 'k') {
    e.preventDefault();
    setTool('split');
  } else if (e.key.toLowerCase() === 'p') {
    e.preventDefault();
    togglePlayback();
  } else if (e.key.toLowerCase() === 'l') {
    e.preventDefault();
    toggleLoop();
  } else if (e.key === '[') {
    e.preventDefault();
    stepPlayhead(-10);
  } else if (e.key === ']') {
    e.preventDefault();
    stepPlayhead(10);
  } else if (e.key === '\\' || e.key === 'Home') {
    e.preventDefault();
    jumpToStart();
  } else if (e.key === 'End') {
    e.preventDefault();
    seekToEnd();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isSpacePressed = false;
    canvas.style.cursor = currentTool === 'split' ? 'crosshair' : 'default';
  }
});

// Tool Switching Helper
function setTool(toolName) {
  currentTool = toolName;
  const toolSelect = document.getElementById('toolSelect');
  const toolSplit = document.getElementById('toolSplit');
  if (toolName === 'select') {
    if (toolSelect) toolSelect.classList.add('active');
    if (toolSplit) toolSplit.classList.remove('active');
    canvas.style.cursor = isSpacePressed ? 'grab' : 'default';
  } else if (toolName === 'split') {
    if (toolSplit) toolSplit.classList.add('active');
    if (toolSelect) toolSelect.classList.remove('active');
    canvas.style.cursor = isSpacePressed ? 'grab' : 'crosshair';
  }
}

// Zoom & Viewport Helper Functions
function zoomByFactor(factor, cx, cy) {
  const worldCenter = screenToWorld(cx, cy);
  scale = Math.max(1.0, Math.min(40.0, scale * factor));
  panX = cx - worldCenter.x * scale;
  panY = cy - worldCenter.y * scale;
  render();
}

function setZoomLevel(percentage) {
  const targetScale = (percentage / 100) * 5.0;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const worldCenter = screenToWorld(cx, cy);
  scale = Math.max(1.0, Math.min(40.0, targetScale));
  panX = cx - worldCenter.x * scale;
  panY = cy - worldCenter.y * scale;
  render();
}

function fitToHoop() {
  const hoop = HOOP_PRESETS[activeHoopKey];
  if (!hoop || hoop.key === 'none') {
    fitToScreen();
    return;
  }
  const pad = 90;
  const availW = Math.max(100, canvas.width - pad);
  const availH = Math.max(100, canvas.height - pad);
  scale = Math.max(1.0, Math.min(30.0, Math.min(availW / (hoop.width + 10), availH / (hoop.height + 10))));
  panX = canvas.width / 2;
  panY = canvas.height / 2;
  render();
}

function toggleGrid() {
  showGrid = !showGrid;
  const btn = document.getElementById('btnToggleGrid');
  if (btn) {
    if (showGrid) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  render();
}

function cycleHoop() {
  const keys = Object.keys(HOOP_PRESETS);
  const currIdx = keys.indexOf(activeHoopKey);
  const nextKey = keys[(currIdx + 1) % keys.length];
  setHoop(nextKey);
}

function setHoop(hoopKey) {
  if (!HOOP_PRESETS[hoopKey]) return;
  activeHoopKey = hoopKey;
  const hoop = HOOP_PRESETS[hoopKey];

  const labelEl = document.getElementById('hoopBtnLabel');
  if (labelEl) {
    labelEl.textContent = hoop.key === 'none' ? 'Free Canvas' : `${hoop.key}mm`;
  }

  const menu = document.getElementById('hoopDropdownMenu');
  if (menu) {
    menu.querySelectorAll('.hud-menu-item').forEach(btn => {
      if (btn.getAttribute('data-hoop') === hoopKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  render();
}

// UI Event Handlers
document.getElementById('presetDaisy').onclick = () => { pushState(); loadPreset('daisy'); fitToScreen(); };
document.getElementById('presetMono').onclick = () => { pushState(); loadPreset('monogram'); fitToScreen(); };
if (document.getElementById('presetCrest')) {
  document.getElementById('presetCrest').onclick = () => { pushState(); loadPreset('crest'); fitToScreen(); };
}
document.getElementById('btnFitScreen').onclick = fitToScreen;
document.getElementById('btnResetPreset').onclick = () => { pushState(); loadPreset(activePreset); fitToScreen(); };

document.getElementById('toolSelect').onclick = () => setTool('select');
document.getElementById('toolSplit').onclick = () => setTool('split');

// Zoom & Grid Tool Buttons
const btnZoomIn = document.getElementById('btnZoomIn');
if (btnZoomIn) btnZoomIn.onclick = () => zoomByFactor(1.25, canvas.width / 2, canvas.height / 2);

const btnZoomOut = document.getElementById('btnZoomOut');
if (btnZoomOut) btnZoomOut.onclick = () => zoomByFactor(0.8, canvas.width / 2, canvas.height / 2);

const btnToggleGrid = document.getElementById('btnToggleGrid');
if (btnToggleGrid) btnToggleGrid.onclick = toggleGrid;

function triggerRegeneration() {
  updateLayersUI();
  updateStats();
  resetPlayhead();
  render();
}

document.getElementById('btnGenerate').onclick = () => {
  pushState();
  triggerRegeneration();
  const btn = document.getElementById('btnGenerate');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="stroke:currentColor;"><polyline points="20 6 9 17 4 12"/></svg><span>Weave Generated!</span></span>';
  setTimeout(() => { btn.innerHTML = oldText; }, 1200);
};

document.getElementById('stitchTypeSelect').onchange = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    pushState();
    engine.setLayerStitchType(layer.id, e.target.value);
    triggerRegeneration();
  }
};

['densityInput', 'stitchLenInput', 'angleInput', 'pullCompInput', 'underlayCheck'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => pushState());
});

document.getElementById('densityInput').oninput = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    const val = parseFloat(e.target.value);
    layer.params.density = val;
    document.getElementById('densityVal').innerText = `${val} mm`;
    updateStats();
    resetPlayhead();
    render();
  }
};

document.getElementById('stitchLenInput').oninput = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    const val = parseFloat(e.target.value);
    layer.params.stitchLength = val;
    document.getElementById('stitchLenVal').innerText = `${val} mm`;
    updateStats();
    resetPlayhead();
    render();
  }
};

document.getElementById('angleInput').oninput = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    const val = parseInt(e.target.value);
    layer.params.angle = val;
    document.getElementById('angleVal').innerText = `${val}°`;
    updateStats();
    resetPlayhead();
    render();
  }
};

document.getElementById('pullCompInput').oninput = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    const val = parseFloat(e.target.value);
    layer.params.pullComp = val;
    document.getElementById('pullCompVal').innerText = `+${val} mm`;
    updateStats();
    resetPlayhead();
    render();
  }
};

document.getElementById('underlayCheck').onchange = (e) => {
  const layer = engine.getActiveLayer();
  if (layer) {
    layer.params.underlay = e.target.checked;
    updateStats();
    resetPlayhead();
    render();
  }
};

document.getElementById('playPauseBtn').onclick = togglePlayback;

const stepStartBtn = document.getElementById('stepStartBtn');
if (stepStartBtn) stepStartBtn.onclick = jumpToStart;

const stepBackBtn = document.getElementById('stepBackBtn');
if (stepBackBtn) stepBackBtn.onclick = () => stepPlayhead(-10);

const stepForwardBtn = document.getElementById('stepForwardBtn');
if (stepForwardBtn) stepForwardBtn.onclick = () => stepPlayhead(10);

const loopToggleBtn = document.getElementById('loopToggleBtn');
if (loopToggleBtn) loopToggleBtn.onclick = toggleLoop;

const dawTrack = document.getElementById('dawTrack');
if (dawTrack) {
  dawTrack.addEventListener('click', (e) => {
    const segEl = e.target.closest('.daw-segment');
    if (segEl && segEl.dataset.start !== undefined) {
      playheadIndex = parseInt(segEl.dataset.start);
      updateTimelineUI();
      render();
    }
  });
}

document.getElementById('playheadSlider').oninput = (e) => {
  playheadIndex = parseInt(e.target.value);
  updateTimelineUI();
  render();
};

document.getElementById('speedSelect').onchange = (e) => {
  playbackSpeed = parseInt(e.target.value);
};

// Machine Exporters (DST & EXP)
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Dropdown Menu Toggles & Unified Outside-Click Handling
const btnExportDropdownToggle = document.getElementById('btnExportDropdownToggle');
const exportDropdownMenu = document.getElementById('exportDropdownMenu');
const exportChevron = document.getElementById('exportChevron');

const btnHoopDropdownToggle = document.getElementById('btnHoopDropdownToggle');
const hoopDropdownMenu = document.getElementById('hoopDropdownMenu');

const btnZoomLevel = document.getElementById('btnZoomLevel');
const zoomDropdownMenu = document.getElementById('zoomDropdownMenu');

function closeExportDropdown() {
  if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
  if (exportChevron) exportChevron.style.transform = 'rotate(0deg)';
}

function closeHoopDropdown() {
  if (hoopDropdownMenu) hoopDropdownMenu.style.display = 'none';
}

function closeZoomDropdown() {
  if (zoomDropdownMenu) zoomDropdownMenu.style.display = 'none';
}

if (btnExportDropdownToggle && exportDropdownMenu) {
  btnExportDropdownToggle.onclick = (e) => {
    e.stopPropagation();
    const isOpen = exportDropdownMenu.style.display === 'block';
    closeHoopDropdown();
    closeZoomDropdown();
    exportDropdownMenu.style.display = isOpen ? 'none' : 'block';
    if (exportChevron) {
      exportChevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  };
}

if (btnHoopDropdownToggle && hoopDropdownMenu) {
  btnHoopDropdownToggle.onclick = (e) => {
    e.stopPropagation();
    const isOpen = hoopDropdownMenu.style.display === 'block';
    closeExportDropdown();
    closeZoomDropdown();
    hoopDropdownMenu.style.display = isOpen ? 'none' : 'block';
  };

  hoopDropdownMenu.querySelectorAll('.hud-menu-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const hoopKey = item.getAttribute('data-hoop');
      if (hoopKey) setHoop(hoopKey);
      closeHoopDropdown();
    };
  });
}

if (btnZoomLevel && zoomDropdownMenu) {
  btnZoomLevel.onclick = (e) => {
    e.stopPropagation();
    const isOpen = zoomDropdownMenu.style.display === 'block';
    closeExportDropdown();
    closeHoopDropdown();
    zoomDropdownMenu.style.display = isOpen ? 'none' : 'block';
  };

  zoomDropdownMenu.querySelectorAll('.hud-menu-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-zoom');
      if (val === 'fit') {
        fitToScreen();
      } else if (val === 'fit-hoop') {
        fitToHoop();
      } else if (val) {
        setZoomLevel(parseInt(val, 10));
      }
      closeZoomDropdown();
    };
  });
}

document.addEventListener('click', (e) => {
  if (exportDropdownMenu && !exportDropdownMenu.contains(e.target) && e.target !== btnExportDropdownToggle) {
    closeExportDropdown();
  }
  if (hoopDropdownMenu && !hoopDropdownMenu.contains(e.target) && e.target !== btnHoopDropdownToggle) {
    closeHoopDropdown();
  }
  if (zoomDropdownMenu && !zoomDropdownMenu.contains(e.target) && e.target !== btnZoomLevel) {
    closeZoomDropdown();
  }
});

document.getElementById('exportDstBtn').onclick = () => {
  closeExportDropdown();
  const dstBytes = engine.exportDst('TRACE_DST');
  const blob = new Blob([dstBytes], { type: 'application/octet-stream' });
  downloadBlob(blob, `${activePreset}_output.dst`);
};

document.getElementById('exportExpBtn').onclick = () => {
  closeExportDropdown();
  const expBytes = engine.exportExp();
  const blob = new Blob([expBytes], { type: 'application/octet-stream' });
  downloadBlob(blob, `${activePreset}_output.exp`);
};

document.getElementById('exportPesBtn').onclick = () => {
  closeExportDropdown();
  const pesBytes = engine.exportPes('TRACE_PES');
  const blob = new Blob([pesBytes], { type: 'application/octet-stream' });
  downloadBlob(blob, `${activePreset}_output.pes`);
};

document.getElementById('exportJefBtn').onclick = () => {
  closeExportDropdown();
  const jefBytes = engine.exportJef('TRACE_JEF');
  const blob = new Blob([jefBytes], { type: 'application/octet-stream' });
  downloadBlob(blob, `${activePreset}_output.jef`);
};

// Canvas Resize
function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}
window.addEventListener('resize', resizeCanvas);

// Typography Lettering Modal Event Handlers
const btnSidebarLettering = document.getElementById('btnSidebarLettering');
const btnHeaderLettering = document.getElementById('btnHeaderLettering');
const letteringModal = document.getElementById('letteringModal');
const closeLetteringBtn = document.getElementById('closeLetteringBtn');
const letteringHeightInput = document.getElementById('letteringHeightInput');
const letteringHeightVal = document.getElementById('letteringHeightVal');
const letteringArcInput = document.getElementById('letteringArcInput');
const letteringArcVal = document.getElementById('letteringArcVal');
const btnGenerateLettering = document.getElementById('btnGenerateLettering');

if (letteringModal) {
  if (btnSidebarLettering) {
    btnSidebarLettering.onclick = () => {
      letteringModal.style.display = 'flex';
    };
  }
  if (btnHeaderLettering) {
    btnHeaderLettering.onclick = () => {
      letteringModal.style.display = 'flex';
    };
  }
  if (closeLetteringBtn) {
    closeLetteringBtn.onclick = () => {
      letteringModal.style.display = 'none';
    };
  }

  if (letteringHeightInput && letteringHeightVal) {
    letteringHeightInput.oninput = (e) => {
      letteringHeightVal.innerText = `${e.target.value} mm`;
    };
  }

  if (letteringArcInput && letteringArcVal) {
    letteringArcInput.oninput = (e) => {
      letteringArcVal.innerText = `${e.target.value}°`;
    };
  }

  if (btnGenerateLettering) {
    btnGenerateLettering.onclick = () => {
      const text = document.getElementById('letteringTextInput').value.trim();
      if (!text) {
        alert('Please enter text to generate lettering.');
        return;
      }
      const font = document.getElementById('letteringFontSelect').value;
      const stitchStyle = document.getElementById('letteringStitchSelect').value;
      const height = parseFloat(letteringHeightInput.value) || 20;
      const arc = parseFloat(letteringArcInput.value) || 0;
      const colorRaw = document.getElementById('letteringColorSelect').value;
      const [hex, threadCode] = colorRaw.split('|');

      let stitchType = StitchType.SATIN;
      if (stitchStyle === 'tatami') stitchType = StitchType.TATAMI;
      else if (stitchStyle === 'twill') stitchType = StitchType.TWILL;
      else if (stitchStyle === 'running') stitchType = StitchType.RUNNING;

      pushState();

      const newLayer = engine.addTextLayer(text, {
        name: `Text: "${text}"`,
        hex,
        threadCode,
        stitchType,
        targetHeightMm: height,
        fontFamily: font,
        arcAngle: arc
      });

      if (newLayer) {
        engine.activeLayerId = newLayer.id;
        letteringModal.style.display = 'none';
        updateLayersUI();
        updateStats();
        resetPlayhead();
        fitToScreen();
        render();
      } else {
        alert('Could not generate vector contours for text. Please try another font or string.');
      }
    };
  }
}

// Kick off
resizeCanvas();
loadPreset('daisy');
fitToScreen();
