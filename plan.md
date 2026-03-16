# Mapbox Annotation Tool — Implementation Plan

## Overview

A freehand drawing overlay for the Mapbox map that lets users scrawl annotations directly on the 3D map view. Strokes are geo-anchored (persist through pan/zoom/pitch/rotation) and stored in IndexedDB so they survive page reloads regardless of loaded track/task.

Uses **roughjs** for Excalidraw's sketchy hand-drawn rendering style.

## Core Architecture

### Drawing Model: Screen → Geo → Screen

1. **Draw phase**: User draws in screen coordinates on an HTML Canvas overlay
2. **Commit phase**: When stroke finishes, screen points are converted to `[lng, lat]` via `map.unproject()`
3. **Render phase**: On every map `render` event, all stored geo-strokes are projected back to screen via `map.project()` and drawn with roughjs

This approach handles all 3D camera transforms (pan, zoom, pitch, bearing) automatically — Mapbox's `project()`/`unproject()` account for the current 3D perspective.

### Stroke Simplification

Raw mouse/touch input generates many points. Before storing, strokes are simplified using the **Ramer-Douglas-Peucker** algorithm (screen-space, ~2px tolerance) to reduce storage size and improve render performance.

## New Files

### `web/frontend/src/analysis/map-annotations.ts`

Self-contained module (~400 lines). Exports a single factory function:

```typescript
export interface MapAnnotationLayer {
  /** Activate/deactivate the annotation overlay */
  setEnabled(enabled: boolean): void;
  /** Switch between draw and erase modes */
  setMode(mode: 'draw' | 'erase'): void;
  /** Undo last stroke */
  undo(): void;
  /** Redo last undone stroke */
  redo(): void;
  /** Clear all annotations */
  clearAll(): void;
  /** Whether annotation mode is currently active */
  isEnabled(): boolean;
  /** Current mode */
  getMode(): 'draw' | 'erase';
  /** Clean up event listeners and canvas */
  destroy(): void;
}

export function createMapAnnotationLayer(
  map: mapboxgl.Map,
  container: HTMLElement
): MapAnnotationLayer;
```

## Data Model

```typescript
interface AnnotationStroke {
  id: string;           // crypto.randomUUID()
  points: [lng: number, lat: number][];  // geo coordinates
  timestamp: number;    // Date.now()
  color: string;        // stroke color (default '#e03131' red)
  width: number;        // stroke width in pixels at reference zoom
}
```

### Storage

**IndexedDB** — new object store `annotations` in the existing `taskscore` DB. This requires a DB version bump (1 → 2) in `storage.ts`.

```
Store: 'annotations'
Key: 'id'
Indexes: 'by-timestamp'
```

Strokes are saved immediately on pen-up. Undo/redo operate on an in-memory stack and sync to IndexedDB (delete on undo, re-insert on redo).

## Canvas Overlay

- A `<canvas>` element positioned absolutely over the map container, matching its dimensions exactly
- `pointer-events: none` by default; switches to `auto` when annotation mode is active
- Resized via `ResizeObserver` on the map container
- When annotation mode is active, map dragging/rotation is disabled (`map.dragPan.disable()`, etc.) so pointer events go to the canvas

## Rendering Pipeline

On every Mapbox `render` event (fires each frame during animation):

1. Clear canvas
2. For each stored stroke: project all `[lng, lat]` points to screen `[x, y]` via `map.project()`
3. Draw each stroke using `rough.canvas(canvas).curve(points, options)` with roughness settings
4. If currently drawing (pen down), also render the in-progress stroke from live screen coordinates

### Rough.js Options (Excalidraw-like)

```typescript
{
  roughness: 1.5,
  strokeWidth: 2.5,
  stroke: '#e03131',      // red default
  bowing: 1,
  seed: <per-stroke>,     // stable seed so the sketch doesn't wobble on re-render
}
```

Each stroke gets a fixed `seed` (derived from its ID) so the roughjs randomization is deterministic across redraws.

## Interaction Modes

### Draw Mode (default when annotation active)
- `pointerdown` → start recording screen points
- `pointermove` → append points, render live preview (non-rough, just a smooth line for responsiveness)
- `pointerup` → simplify points (RDP), unproject to geo, save to IndexedDB, trigger rough re-render
- Cursor: `crosshair`

### Erase Mode
- `pointermove` while pointer down → hit-test each stroke (screen-space distance to projected path, threshold ~10px)
- Strokes that intersect the eraser path are removed
- Cursor: custom eraser circle (CSS)

## Keyboard Shortcuts (Excalidraw-compatible)

| Action | Shortcut | Excalidraw match |
|--------|----------|------------------|
| Toggle annotation mode | `P` | `P` = Pen/Draw tool |
| Switch to eraser | `E` | `E` = Eraser |
| Switch to draw (while in annotation mode) | `P` | Back to pen |
| Undo | `Cmd/Ctrl+Z` | Yes |
| Redo | `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` | Yes |
| Clear all | `Cmd/Ctrl+Shift+Delete` | Custom (destructive, needs modifier) |
| Exit annotation mode | `Escape` or `V` | `Escape`/`V` = back to select |

Shortcuts are only active when the map container has focus. They don't fire when an input/dialog is focused.

**Conflict avoidance**: `Cmd/Ctrl+Z` / `Cmd/Ctrl+Y` are only intercepted when annotation mode is active (to avoid hijacking browser undo in text inputs).

## UI Indicators

When annotation mode is active, show a small floating toolbar (bottom-left of map, above scale bar):

```
┌──────────────────────────────┐
│  ✏️ Draw  │  🧹 Erase  │  🗑️  │
│   [P]     │    [E]     │     │
└──────────────────────────────┘
```

- Built with simple HTML/CSS (no Basecoat needed for this tiny toolbar)
- Active tool highlighted
- Trash icon = clear all (with confirm)
- Toolbar appears/disappears with annotation mode toggle
- Semi-transparent background so it doesn't obscure the map

## Map Interaction Management

When annotation mode activates:
- `map.dragPan.disable()`
- `map.scrollZoom.disable()`
- `map.doubleClickZoom.disable()`
- `map.dragRotate.disable()`
- `map.touchZoomRotate.disable()`
- `map.keyboard.disable()`
- Canvas `pointer-events` → `auto`

When annotation mode deactivates:
- Re-enable all the above
- Canvas `pointer-events` → `none`
- Annotations remain visible (canvas still renders on `render` events)

## Integration Points

### `mapbox-provider.ts`
- Import `createMapAnnotationLayer`
- Create the annotation layer after map initialization
- Expose annotation controls on the MapProvider interface (new optional methods)

### `map-provider.ts` (interface)
- Add optional annotation methods to `MapProvider`:
  ```typescript
  /** Get the annotation layer for direct control */
  getAnnotationLayer?(): MapAnnotationLayer | null;
  ```

### `main.ts` (keyboard shortcuts)
- Add global keyboard listener for `P` to toggle annotation mode
- Add `E`, `Escape`, `V` handlers (delegated to annotation layer)
- Add `Cmd/Ctrl+Z`/`Cmd/Ctrl+Y` interception when annotation mode is active
- Add "Annotate map" item to command palette

### `storage.ts`
- Bump `DB_VERSION` to 2
- Add `annotations` object store in `onupgradeneeded`
- Add CRUD methods: `storeAnnotation()`, `listAnnotations()`, `deleteAnnotation()`, `clearAnnotations()`

### `docs/mapbox-interactions-spec.md`
- Add "Annotation Overlay" section documenting the visual spec

## Step-by-Step Implementation Order

1. **Storage**: Bump DB version, add `annotations` store + CRUD methods
2. **Core module** (`map-annotations.ts`): Canvas setup, draw/erase logic, geo projection, roughjs rendering, undo/redo stack, IndexedDB persistence
3. **Mapbox integration**: Wire into `mapbox-provider.ts`, expose on `MapProvider` interface
4. **Keyboard shortcuts + command palette**: Wire in `main.ts`
5. **Interaction spec**: Update `mapbox-interactions-spec.md`
6. **Install roughjs**: `bun add roughjs`

## Dependencies

- **roughjs** (new, ~9kB gzipped) — hand-drawn rendering
- No other new dependencies needed

## Edge Cases & Considerations

- **3D terrain**: `map.unproject()` returns lng/lat at terrain surface level, which is correct for our use case
- **Style changes**: Canvas overlay is independent of Mapbox styles, so annotations survive style switches without any special handling
- **Performance**: roughjs re-renders all strokes every frame. For large numbers of strokes this could get slow. Mitigation: cache roughjs drawable objects and only regenerate when strokes change (not on every frame). The projection step (geo→screen) still runs each frame but is cheap.
- **High-DPI**: Canvas uses `devicePixelRatio` for crisp rendering on Retina displays
- **Touch support**: Uses pointer events (not mouse events) for unified mouse/touch/pen handling
