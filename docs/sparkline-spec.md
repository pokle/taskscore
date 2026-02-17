# Altitude Sparkline Specification

## Overview

The altitude sparkline is an interactive miniature altitude profile displayed in the analysis panel sidebar. It provides an at-a-glance view of the full flight's altitude changes and serves as a navigation tool for selecting events by clicking.

## Location

- **File**: `web/frontend/src/analysis/analysis-panel.ts`
- **Position**: Fixed above the scrollable event list, below the count bar
- **Visibility**: Shown on Events, Glides, Climbs, and Sinks tabs; hidden on the Task tab

## Layout

```
┌─────────────────────────┐
│ Flight info banner      │
├─────────────────────────┤
│ Tab row                 │
├─────────────────────────┤
│ Count bar               │
├─────────────────────────┤
│ Altitude sparkline      │  ← 72px fixed height, does not scroll
├─────────────────────────┤
│                         │
│ Scrollable event list   │  ← flex-1, overflow-y-auto
│                         │
└─────────────────────────┘
```

## Design Decisions

### Fixed position (not scrolling)
The sparkline is placed in the flex column outside the scrollable list container. This means it remains visible at all times regardless of scroll position, giving the user a persistent overview of the flight profile.

### Height: 72px
Approximately 1.5x the height of a single event-item (~48px). Large enough to show the altitude profile clearly, small enough to not steal too much space from the event list.

### Standalone element (not a background)
Originally the sparkline was rendered as a CSS `background-image` on the scrollable list container, displayed behind the event items at 0.15 opacity. It was moved to a dedicated container so it could be:
- Fixed in position (always visible)
- Clickable as a navigation element
- Rendered at higher opacity (0.4 vs 0.15) since text no longer overlays it

## Data Flow

### Altitude data
The sparkline receives altitude data via `setAltitudes(altitudes: number[])`, called from `main.ts` whenever an IGC file is loaded. The altitude array comes from `igcFile.fixes.map(f => f.gnssAltitude)` — one value per GPS fix in the flight.

When the flight is cleared, `setAltitudes([])` is called, which hides the sparkline container.

### fixIndex on point events
To position the selection marker for point events (takeoff, landing, turnpoint crossings, altitude/vario extremes), each point event includes a `fixIndex` in its `details` object. This was added to the event detector (`web/analysis/src/event-detector.ts`) and the Swift equivalent (`macos/TaskScoreLib/Analysis/EventDetector.swift`).

Segment events (glides, thermals) already have `segment.startIndex` / `segment.endIndex` which serve the same purpose.

## Rendering

### SVG generation (`generateAltitudeSparkline`)
- Altitude data is downsampled to ~200 points for performance
- Rendered as a filled area chart (SVG path closing to the bottom edge)
- Uses `preserveAspectRatio="none"` to stretch to fill the container
- SVG viewBox dimensions: width = number of sampled points - 1, height = 100
- The SVG is inlined as a data URI CSS background-image on the sparkline inner element

### Color gradient
Vertical linear gradient matching the track altitude colors on the map:

| Offset | Color | Meaning |
|--------|-------|---------|
| 0% | `rgb(139,90,43)` - Brown | Low altitude |
| 25% | `rgb(67,160,71)` - Green | Medium altitude |
| 50% | `rgb(3,155,229)` - Blue | Higher altitude |
| 75% | `rgb(41,182,246)` - Light blue | High altitude |
| 100% | `rgb(79,195,247)` - Lighter blue | Very high altitude |

Fill opacity: **0.4**

### Selection marker
When an event is selected (by clicking the list or the sparkline), an orange vertical line is overlaid at the corresponding position using a CSS `linear-gradient` layered on top of the sparkline background:
- Color: `rgb(249,115,22)` (orange-500)
- Rendered as a gradient with soft glow edges (±12px transparent fade, ±4px at 15% opacity, ±1px at 90% opacity)
- Position is calculated as: `(fixIndex / (fixCount - 1)) * 100` percent
- Cleared when selection is cleared via `clearSelection()`

## Click Interaction

### Behavior
Clicking the sparkline selects the nearest event **within the current tab** without switching tabs.

- **Cursor**: `crosshair` to indicate interactivity
- **Fix index mapping**: Click X position is mapped linearly to a fix index: `Math.round((x / width) * (fixCount - 1))`

### Per-tab selection logic

| Tab | Selection strategy |
|-----|-------------------|
| **Events** | Find nearest event by fix index — checks segment containment first, then finds closest segment start/end or point event fix index |
| **Glides** | Find the glide whose segment contains the fix index, or the glide with the nearest segment boundary |
| **Climbs** | Find the climb whose segment contains the fix index, or the climb with the nearest segment boundary |
| **Sinks** | Find the sink whose segment contains the fix index, or the sink with the nearest segment boundary |
| **Task** | Sparkline is hidden; no click interaction |

### Nearest segment algorithm (`findNearestSegmentEvent`)
For segment-based tabs (Glides, Climbs, Sinks):
1. First check if the fix index falls inside any segment → select that item
2. Otherwise, find the segment whose start or end index is closest to the clicked fix index

### External selection (`selectByFixIndex`)
The public `selectByFixIndex` method (used when clicking the track on the map) does switch tabs — it finds the best-matching event type and switches to the appropriate tab (glides, climbs, sinks, or events). This is distinct from sparkline clicks which stay on the current tab.

### After selection
- The sparkline marker updates to the clicked/selected position
- The event list re-renders with the matched item highlighted and scrolled into view
- The map pans to the selected event's location

## Evolution

1. **Basic sparkline** (`8410a06`): Added `generateAltitudeSparkline` SVG generation and `setAltitudes` API. Rendered as a CSS background-image on the scrollable track panel at 0.15 opacity.
2. **Selection marker and fixIndex** (`dbf7501`): Added orange marker line overlay on the sparkline when events are selected. Added `fixIndex` to all point event details in both TypeScript and Swift event detectors.
3. **Fixed position and click interaction** (`abe47dc`): Moved sparkline to a dedicated 72px container above the scroll area. Increased opacity to 0.4. Made it clickable with per-tab nearest-event selection.
