/**
 * Map Annotation Layer
 *
 * Freehand drawing overlay for Mapbox GL maps.
 * Strokes are geo-anchored (persist through pan/zoom/pitch) and
 * stored in IndexedDB. Uses roughjs for Excalidraw-style sketchy rendering.
 */

import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable } from 'roughjs/bin/core';
import type { Map as MapboxMap } from 'mapbox-gl';
import { storage, type AnnotationStroke } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnnotationMode = 'draw' | 'erase';

export interface MapAnnotationLayer {
  setEnabled(enabled: boolean): void;
  setMode(mode: AnnotationMode): void;
  undo(): void;
  redo(): void;
  clearAll(): void;
  isEnabled(): boolean;
  getMode(): AnnotationMode;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STROKE_COLOR = '#e03131';
const STROKE_WIDTH = 2.5;
const ROUGHNESS = 1.5;
const BOWING = 1;
const ERASE_HIT_DISTANCE = 12; // px
const RDP_TOLERANCE = 2; // px — Ramer-Douglas-Peucker simplification

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker line simplification
// ---------------------------------------------------------------------------

function perpendicularDistance(
  px: number, py: number,
  lx1: number, ly1: number,
  lx2: number, ly2: number,
): number {
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - lx1, py - ly1);
  const t = Math.max(0, Math.min(1, ((px - lx1) * dx + (py - ly1) * dy) / lenSq));
  return Math.hypot(px - (lx1 + t * dx), py - (ly1 + t * dy));
}

function simplifyRDP(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(
      points[i][0], points[i][1],
      first[0], first[1],
      last[0], last[1],
    );
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRDP(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

// ---------------------------------------------------------------------------
// Seed derivation (deterministic per stroke ID for stable roughjs rendering)
// ---------------------------------------------------------------------------

function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Point-to-polyline distance (screen space, for eraser hit testing)
// ---------------------------------------------------------------------------

function distanceToPolyline(px: number, py: number, line: [number, number][]): number {
  let minDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = perpendicularDistance(
      px, py,
      line[i][0], line[i][1],
      line[i + 1][0], line[i + 1][1],
    );
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMapAnnotationLayer(
  map: MapboxMap,
  container: HTMLElement,
): MapAnnotationLayer {
  // --- State ---
  let enabled = false;
  let mode: AnnotationMode = 'draw';
  let strokes: AnnotationStroke[] = [];
  let redoStack: AnnotationStroke[] = [];
  let drawing = false;
  let currentScreenPoints: [number, number][] = [];

  // Cache roughjs drawables keyed by stroke id (invalidated when strokes change)
  let drawableCache = new Map<string, Drawable>();

  // --- Canvas setup ---
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '10';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  let rc: RoughCanvas;

  function syncCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc = rough.canvas(canvas);
  }
  syncCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    syncCanvasSize();
    renderAll();
  });
  resizeObserver.observe(container);

  // --- Toolbar ---
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    position: absolute; bottom: 36px; left: 10px; z-index: 11;
    display: none; align-items: center; gap: 2px;
    background: rgba(255,255,255,0.92); border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18); padding: 4px 6px;
    font-family: system-ui, sans-serif; font-size: 13px;
    user-select: none;
  `;
  toolbar.innerHTML = `
    <button data-ann-tool="draw" title="Draw (P)" style="cursor:pointer;border:none;background:none;padding:4px 8px;border-radius:6px;font-size:13px;">&#9998; Draw</button>
    <button data-ann-tool="erase" title="Erase (E)" style="cursor:pointer;border:none;background:none;padding:4px 8px;border-radius:6px;font-size:13px;">&#9003; Erase</button>
    <span style="width:1px;height:20px;background:#ccc;margin:0 4px;"></span>
    <button data-ann-tool="undo" title="Undo (Ctrl+Z)" style="cursor:pointer;border:none;background:none;padding:4px 8px;border-radius:6px;font-size:13px;">&#8630;</button>
    <button data-ann-tool="redo" title="Redo (Ctrl+Shift+Z)" style="cursor:pointer;border:none;background:none;padding:4px 8px;border-radius:6px;font-size:13px;">&#8631;</button>
    <span style="width:1px;height:20px;background:#ccc;margin:0 4px;"></span>
    <button data-ann-tool="clear" title="Clear all" style="cursor:pointer;border:none;background:none;padding:4px 8px;border-radius:6px;font-size:13px;color:#e03131;">&#128465;</button>
  `;
  container.appendChild(toolbar);

  // Toolbar click handling
  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ann-tool]');
    if (!btn) return;
    const tool = btn.dataset.annTool;
    if (tool === 'draw') setMode('draw');
    else if (tool === 'erase') setMode('erase');
    else if (tool === 'undo') undo();
    else if (tool === 'redo') redo();
    else if (tool === 'clear') clearAll();
  });

  function updateToolbarHighlight() {
    toolbar.querySelectorAll<HTMLElement>('[data-ann-tool]').forEach((btn) => {
      const tool = btn.dataset.annTool;
      if (tool === 'draw' || tool === 'erase') {
        btn.style.background = tool === mode ? '#e8e8e8' : 'none';
        btn.style.fontWeight = tool === mode ? '600' : '400';
      }
    });
  }

  // --- Map interaction management ---
  const mapInteractions = ['dragPan', 'scrollZoom', 'doubleClickZoom', 'dragRotate', 'touchZoomRotate', 'keyboard'] as const;

  function disableMapInteractions() {
    for (const name of mapInteractions) {
      (map[name] as { disable(): void }).disable();
    }
  }

  function enableMapInteractions() {
    for (const name of mapInteractions) {
      (map[name] as { enable(): void }).enable();
    }
  }

  // --- Projection helpers ---
  function geoToScreen(lngLat: [number, number]): [number, number] {
    const p = map.project({ lng: lngLat[0], lat: lngLat[1] });
    return [p.x, p.y];
  }

  function screenToGeo(xy: [number, number]): [number, number] {
    const ll = map.unproject(xy);
    return [ll.lng, ll.lat];
  }

  // --- Rendering ---
  function renderAll() {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw stored strokes with roughjs
    for (const stroke of strokes) {
      const screenPts = stroke.points.map(geoToScreen);
      if (screenPts.length < 2) continue;

      let drawable = drawableCache.get(stroke.id);
      // We must regenerate every frame because screen positions change on pan/zoom
      drawable = rc.curve(screenPts, {
        roughness: ROUGHNESS,
        strokeWidth: stroke.width,
        stroke: stroke.color,
        bowing: BOWING,
        seed: seedFromId(stroke.id),
        disableMultiStroke: false,
      });
      rc.draw(drawable);
    }

    // Draw in-progress stroke (smooth, not rough, for responsiveness)
    if (drawing && currentScreenPoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(currentScreenPoints[0][0], currentScreenPoints[0][1]);
      for (let i = 1; i < currentScreenPoints.length; i++) {
        ctx.lineTo(currentScreenPoints[i][0], currentScreenPoints[i][1]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Render on every map frame
  function onRender() {
    if (strokes.length > 0 || drawing) {
      renderAll();
    }
  }
  map.on('render', onRender);

  // --- Pointer event handlers ---
  function onPointerDown(e: PointerEvent) {
    if (!enabled) return;
    if (e.button !== 0) return; // left button only

    drawing = true;
    currentScreenPoints = [[e.offsetX, e.offsetY]];

    if (mode === 'erase') {
      eraseAtPoint(e.offsetX, e.offsetY);
    }

    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!enabled || !drawing) return;

    const x = e.offsetX;
    const y = e.offsetY;

    if (mode === 'draw') {
      currentScreenPoints.push([x, y]);
      // Trigger a re-render for the live preview
      map.triggerRepaint();
    } else {
      eraseAtPoint(x, y);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!enabled || !drawing) return;
    drawing = false;

    if (mode === 'draw' && currentScreenPoints.length >= 2) {
      // Simplify in screen space
      const simplified = simplifyRDP(currentScreenPoints, RDP_TOLERANCE);
      if (simplified.length >= 2) {
        // Convert to geo coordinates
        const geoPoints = simplified.map(screenToGeo);
        const stroke: AnnotationStroke = {
          id: crypto.randomUUID(),
          points: geoPoints,
          timestamp: Date.now(),
          color: STROKE_COLOR,
          width: STROKE_WIDTH,
        };
        strokes.push(stroke);
        redoStack = []; // clear redo on new stroke
        drawableCache.clear();
        storage.storeAnnotation(stroke);
      }
    }

    currentScreenPoints = [];
    map.triggerRepaint();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  // --- Eraser ---
  function eraseAtPoint(x: number, y: number) {
    const toRemove: string[] = [];
    for (const stroke of strokes) {
      const screenPts = stroke.points.map(geoToScreen);
      if (distanceToPolyline(x, y, screenPts) < ERASE_HIT_DISTANCE) {
        toRemove.push(stroke.id);
      }
    }
    if (toRemove.length > 0) {
      for (const id of toRemove) {
        const idx = strokes.findIndex((s) => s.id === id);
        if (idx !== -1) {
          strokes.splice(idx, 1);
          storage.deleteAnnotation(id);
        }
      }
      drawableCache.clear();
      redoStack = [];
      map.triggerRepaint();
    }
  }

  // --- Undo / Redo ---
  function undo() {
    if (strokes.length === 0) return;
    const stroke = strokes.pop()!;
    redoStack.push(stroke);
    drawableCache.clear();
    storage.deleteAnnotation(stroke.id);
    map.triggerRepaint();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const stroke = redoStack.pop()!;
    strokes.push(stroke);
    drawableCache.clear();
    storage.storeAnnotation(stroke);
    map.triggerRepaint();
  }

  function clearAll() {
    if (strokes.length === 0) return;
    strokes = [];
    redoStack = [];
    drawableCache.clear();
    storage.clearAnnotations();
    map.triggerRepaint();
  }

  // --- Mode management ---
  function setMode(newMode: AnnotationMode) {
    mode = newMode;
    updateCursor();
    updateToolbarHighlight();
  }

  function updateCursor() {
    if (!enabled) {
      canvas.style.cursor = 'default';
      return;
    }
    canvas.style.cursor = mode === 'draw' ? 'crosshair' : 'pointer';
  }

  // --- Enable / Disable ---
  function setEnabled(value: boolean) {
    enabled = value;
    canvas.style.pointerEvents = value ? 'auto' : 'none';
    toolbar.style.display = value ? 'flex' : 'none';

    if (value) {
      disableMapInteractions();
      mode = 'draw';
      updateCursor();
      updateToolbarHighlight();
    } else {
      enableMapInteractions();
      drawing = false;
      currentScreenPoints = [];
      canvas.style.cursor = 'default';
    }

    map.triggerRepaint();
  }

  // --- Load persisted annotations on init ---
  storage.listAnnotations().then((stored) => {
    if (stored.length > 0) {
      strokes = stored;
      map.triggerRepaint();
    }
  });

  // --- Public API ---
  return {
    setEnabled,
    setMode,
    undo,
    redo,
    clearAll,
    isEnabled: () => enabled,
    getMode: () => mode,
    destroy() {
      map.off('render', onRender);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.remove();
      toolbar.remove();
      if (enabled) enableMapInteractions();
    },
  };
}
