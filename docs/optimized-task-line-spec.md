# Optimized Task Line Specification

## Overview

The Optimized Task Line feature calculates and displays the shortest achievable distance through a paragliding/hanggliding competition task by finding optimal points to tag turnpoint cylinders, rather than flying through their centers.

This provides pilots with:
- **True task distance**: The actual shortest achievable distance
- **Visual guidance**: Optimal line showing where to tag each turnpoint
- **Segment distances**: Distance labels on each leg of the optimized route

## Background

In paragliding and hanggliding competitions, tasks are defined with cylindrical turnpoints. Pilots must enter each cylinder to validate the turnpoint, but they don't need to fly through the center. The shortest possible route tags each cylinder at its edge.

### Prior Art

This implementation is based on algorithms used in professional scoring systems:

- **LK8000** ([PR #286](https://github.com/LK8000/LK8000/pull/286)): "For exit turnpoint distance to circle equation have multiple local minimum, we always use local minimum point nearest of next turnpoint"
- **igclib** ([GitHub](https://github.com/teobouvard/igclib)): Uses Quasi-Newton methods for task optimization
- **XContest** / **XCTrack**: Industry-standard flight optimization
- **AirScore** ([GitHub](https://github.com/geoffwong/airscore)): GAP-based scoring software
- **Touring n Circles Problem** ([Research Paper](https://www.matec-conferences.org/articles/matecconf/pdf/2018/91/matecconf_eitce2018_03027.pdf)): Mathematical foundation for shortest paths through multiple circles

## Algorithm

### Core Principle

Each turnpoint cylinder is tagged at **one optimal point** on its perimeter that minimizes the total path distance. This is a constrained optimization problem where we must find points p₁, p₂, ..., pₙ such that:

- Each point pᵢ lies on the perimeter of circle i
- The sum of distances d(p₁,p₂) + d(p₂,p₃) + ... + d(pₙ₋₁,pₙ) is minimized

### Implementation

The algorithm has two layers: a per-cylinder optimizer and an outer iterative loop.

#### Per-Cylinder Optimization (Golden Section Search)

For each intermediate turnpoint, find the angle θ ∈ [0, 2π] that minimizes:
```
cost(θ) = distance(prevPoint, pointOnCircle(θ)) + distance(pointOnCircle(θ), nextPoint)
```

This cost function is unimodal, so golden section search converges in ~30 iterations (tolerance 1e-5 radians).

**First turnpoint (Start):** Point on circle along bearing toward next point.
**Last turnpoint (Goal):** Point on circle along bearing from previous point (entry side).

#### Iterative Convergence

A single forward pass uses the next turnpoint's *center* as the target, which is suboptimal — the actual touching point on the next cylinder may be far from its center, especially for large cylinders. The algorithm therefore iterates:

1. **First pass:** Optimize each cylinder using the previous optimized point and the next turnpoint *center*
2. **Subsequent passes:** Re-optimize each cylinder using the previous optimized point and the next *optimized point from the previous iteration*
3. **Converge:** Stop when total path distance changes by < 1 meter

This matches the CIVL GAP specification (Section 7F, Annex A) approach. On real tasks with large cylinders (e.g. `face.xctsk` with a 7 km cylinder), iteration shortens the task distance by ~200 m vs a single pass.

```
max_iterations = num_turnpoints × 10
convergence_tolerance = 1.0  // meters
```

### Cylinder Tolerance

CIVL GAP specifies a tolerance band on cylinder radii to compensate for differences between distance calculation methods:

- **Cat 1 (World/Continental championships):** 0.1%
- **Cat 2 (other FAI competitions):** up to 0.5%

This is applied in `detectCylinderCrossings()` via `XCTask.cylinderTolerance` (default 0.5%). The effective radius for crossing detection is `radius × (1 + tolerance)`, but the crossing point is interpolated to the nominal radius.

## Geometry Functions

All geographic calculations use the centralized `geo.ts` module, which implements WGS84 ellipsoid formulas for CIVL-accurate scoring:

```typescript
import { andoyerDistance, calculateBearingRadians, destinationPoint } from './geo';
```

### Available Functions

- `andoyerDistance(lat1, lon1, lat2, lon2)` - WGS84 ellipsoid distance in meters (Andoyer-Lambert formula, ~2 ppm vs Vincenty)
- `calculateBearingRadians(lat1, lon1, lat2, lon2)` - Initial bearing in radians
- `destinationPoint(lat, lon, distanceMeters, bearingRadians)` - Destination point on WGS84 ellipsoid (Vincenty direct formula)

**Note**: Never implement inline geo math. Always use the `geo.ts` module.

## Visual Representation

Visual styling for the task line, distance labels, and turnpoint rendering is defined in the "Task" section of [`mapbox-interactions-spec.md`](mapbox-interactions-spec.md) — the single source of truth for all map visuals.

### Total Distance Display
Shown in the flight info panel:
```
Task: 7 TPs, 133.08 km (optimized)
```

## API

### Core Functions

```typescript
/**
 * Calculate the optimized task line
 * Returns array of lat/lon points representing optimal tags
 */
export function calculateOptimizedTaskLine(
  task: XCTask
): { lat: number; lon: number }[]

/**
 * Calculate total optimized distance
 * Returns distance in meters
 */
export function calculateOptimizedTaskDistance(
  task: XCTask
): number

/**
 * Get individual segment distances
 * Returns array of distances in meters for each segment
 */
export function getOptimizedSegmentDistances(
  task: XCTask
): number[]
```

### Map Provider Integration

The MapBox provider renders the optimized task line:

```typescript
interface MapProvider {
  setTask(task: XCTask): Promise<void>
}
```

When a task is set:
1. Calculate optimized path using `calculateOptimizedTaskLine()`
2. Render the path as a polyline/LineString
3. Calculate segment distances using `getOptimizedSegmentDistances()`
4. Create labels at the midpoint of each segment

## Performance Considerations

### Computational Complexity
- **Two turnpoints**: O(1) - simple bearing calculation
- **N turnpoints**: O(I · N · log(1/ε)) where I = iterations to converge, ε = angle tolerance (1e-5)
  - Golden section search: O(log(1/ε)) per turnpoint per iteration (~30 evaluations)
  - Convergence iterations: typically 3-5 for most tasks

For typical tasks (5-10 turnpoints), optimization completes in < 10ms even with iteration.

### Caching
The optimized path is calculated on-demand when:
- A task is loaded
- The map provider's `setTask()` is called

Results are not cached as task changes are infrequent.

## Limitations and Future Enhancements

### Current Limitations
1. **Start cylinder assumption**: Assumes pilot approaches from outside the start cylinder. For "Enter" start cylinders (where pilot starts inside), the algorithm still works but may not be optimal.

2. **No turn direction constraints**: Doesn't account for sectors (e.g., "must turn left around turnpoint"). All turnpoints are treated as full cylinders.

### Potential Enhancements
1. **Sector support**: Handle sector turnpoints (entry/exit sectors with specific angles)

2. **Start cylinder types**: Distinguish between SSS (Start of Speed Section) types:
   - Exit start: Pilot starts inside, optimization begins at cylinder edge
   - Enter start: Pilot starts outside, must enter cylinder

3. **FAI triangle detection**: Detect and optimize FAI triangle tasks with their specific constraints

## Testing

Tests are in `web/engine/tests/task-optimizer.test.ts`.

### Unit Tests
1. **Two turnpoints**: Simple bearing-based approach
2. **Collinear turnpoints**: Produces straight-line path
3. **Complex task with large cylinders**: Iterative produces shorter distance
4. **Segment distances sum to total**: Consistency check
5. **Points on cylinders**: Each optimized point lies within 1m of its turnpoint cylinder

### Integration Tests
1. **face.xctsk**: Iterative distance < 77.5 km (vs 77.5 km single-pass) — validates that iteration matters on real tasks with large cylinders
2. **Corryong Cup T1 scoring**: Full pipeline test (IGC parsing → turnpoint sequence → GAP scoring) in `gap-scoring-integration.test.ts`

## References

- **FAI Sporting Code Section 7A**: Paragliding competition rules
- **GAP (GAP Annex to Section 7A)**: Scoring algorithm specifications
- **XContest Rules**: https://www.xcontest.org/world/en/rules/
- **LK8000 Task Optimization**: https://github.com/LK8000/LK8000/pull/286
- **Touring n Circles**: https://www.matec-conferences.org/articles/matecconf/pdf/2018/91/matecconf_eitce2018_03027.pdf
- **Golden Section Search**: https://en.wikipedia.org/wiki/Golden-section_search
- **Andoyer-Lambert Formula**: WGS84 ellipsoid distance approximation (~2 ppm accuracy vs Vincenty)

## Change Log

### 2026-03-20: CIVL-Accurate Scoring
- Added iterative convergence — re-runs until < 1m change, matching CIVL GAP Annex A
- Added cylinder tolerance (`XCTask.cylinderTolerance`) — default 0.5% (Cat 2), configurable to 0.1% (Cat 1)
- Replaced haversine (spherical) with Andoyer-Lambert distance formula (WGS84 ellipsoid)
- Replaced Turf.js destination with Vincenty direct formula (WGS84 ellipsoid)
- Removed `@turf/distance` and `@turf/destination` dependencies

### 2026-01-20: Simplified to MapBox Only
- Removed Google Maps and MapLibre providers
- MapBox GL JS is now the only supported map provider

### 2026-01-11: Initial Implementation
- Implemented optimized task line calculation using golden section search
- Added distance labels to task line segments
- Integrated with map providers
- Updated flight info display to show optimized distance
