# macOS Native App — Plan

## Motivation

TaskScore currently runs as a Cloudflare Pages web app. A native macOS app would provide:

- **Native file handling**: Open IGC files via Finder, double-click to open, drag-and-drop from Finder, Spotlight integration
- **Offline-first**: Full functionality without internet (except map tiles and AirScore lookups)
- **Performance**: Native rendering for maps and 3D visualization
- **OS integration**: Menu bar, keyboard shortcuts, document model, Handoff, iCloud sync
- **Distribution**: Mac App Store or direct download with notarization

## Technology Choice: SwiftUI + MapKit

**Recommended stack:**

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI Framework | SwiftUI | Modern, declarative, good for sidebar+detail layout |
| Map | MapKit | Native Apple maps, 3D globe, no API key needed, free |
| 3D Rendering | SceneKit (via MapKit) | Native 3D for track visualization |
| Networking | URLSession | Native async/await HTTP |
| Storage | SwiftData | Apple's modern persistence (SQLite under the hood) |
| Preferences | UserDefaults / @AppStorage | Native settings persistence |
| File Handling | UTType + DocumentGroup | Native document model for IGC files |
| Geo Math | CoreLocation + native Swift | CLLocation distance/bearing calculations |
| Testing | XCTest + Swift Testing | Native test frameworks |

**Why not cross-platform (Electron, Tauri, React Native)?**
- The web version already exists for cross-platform access
- A native app should *feel* native — SwiftUI provides this with far less effort
- MapKit is free and integrates perfectly; MapBox native SDK requires a paid plan for mobile/desktop
- No runtime overhead (Electron bundles Chromium; Tauri bundles a webview)

**Why not reuse the TypeScript analysis code via JavaScriptCore?**
- The analysis package is ~3,600 lines — manageable to port to Swift
- Swift's type system catches errors the TypeScript code works around
- CoreLocation provides geographic calculations natively
- Eliminates JS↔Swift bridging complexity and debugging difficulty
- Port is a one-time cost; maintenance benefits are ongoing

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  SwiftUI App                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Sidebar  │  │ MapView  │  │  Inspector    │  │
│  │          │  │ (MapKit) │  │  (Detail)     │  │
│  │ Events   │  │          │  │               │  │
│  │ Glides   │  │ Track    │  │  Event info   │  │
│  │ Climbs   │  │ Task     │  │  Statistics   │  │
│  │ Sinks    │  │ Markers  │  │  Units config │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           Analysis Engine (Swift)         │    │
│  │  IGCParser · XCTaskParser · EventDetector │    │
│  │  GlideSpeed · Geo · Units                 │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           Data Layer                      │    │
│  │  SwiftData (tasks, tracks, preferences)   │    │
│  │  FileManager (IGC document handling)      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           Network Layer                   │    │
│  │  AirScoreClient · XContestClient          │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### App Structure (Swift Package)

```
TaskScore/
├── TaskScoreApp.swift              # @main, DocumentGroup, WindowGroup
├── Models/
│   ├── IGCFile.swift               # Parsed IGC data model
│   ├── XCTask.swift                # Task definition model
│   ├── FlightEvent.swift           # Event types and data
│   ├── GlideSegment.swift          # Glide analysis results
│   ├── Preferences.swift           # User preferences (units, theme)
│   └── StoredItem.swift            # SwiftData persistence models
├── Analysis/
│   ├── IGCParser.swift             # Port of igc-parser.ts (327 lines)
│   ├── XCTaskParser.swift          # Port of xctsk-parser.ts (721 lines)
│   ├── EventDetector.swift         # Port of event-detector.ts (888 lines)
│   ├── GlideSpeed.swift            # Port of glide-speed.ts (236 lines)
│   ├── Geo.swift                   # Port of geo.ts (wrap CoreLocation)
│   ├── Units.swift                 # Port of units.ts (164 lines)
│   └── Waypoints.swift             # Port of waypoints.ts (171 lines)
├── Views/
│   ├── ContentView.swift           # Main NavigationSplitView layout
│   ├── MapView.swift               # MapKit integration
│   ├── EventListView.swift         # Sidebar event list with filters
│   ├── EventDetailView.swift       # Individual event card
│   ├── TaskOverlayView.swift       # Task cylinder rendering on map
│   ├── TrackOverlayView.swift      # Flight track polyline on map
│   ├── GlideMarkersView.swift      # Chevron + speed labels
│   ├── FlightInfoView.swift        # Summary panel (pilot, date, etc.)
│   ├── SettingsView.swift          # Preferences (units, display)
│   └── AirScoreLoadView.swift      # AirScore URL input sheet
├── Services/
│   ├── AirScoreClient.swift        # HTTP client for AirScore API
│   ├── XContestClient.swift        # HTTP client for XContest
│   └── DocumentHandler.swift       # IGC file open/import logic
└── Resources/
    ├── SampleFlights/              # Bundled demo IGC files
    └── Waypoints/                  # Bundled waypoint CSVs
```

## Feature Mapping: Web → Native

### File Handling

| Web | macOS Native |
|-----|-------------|
| `<input type="file">` | `NSOpenPanel` / DocumentGroup |
| Drag-and-drop to browser | Native Finder drag-and-drop (`onDrop`) |
| IndexedDB storage | SwiftData + file bookmarks |
| SHA-256 via Web Crypto | `CryptoKit.SHA256` |

The app should register as a handler for `.igc` files (UTType), so double-clicking an IGC file in Finder opens TaskScore directly.

```swift
// Info.plist / UTType declaration
UTType("com.taskscore.igc-file",
       conformingTo: .plainText,
       filenameExtension: "igc",
       description: "IGC Flight Log")
```

### Map Rendering

| Web (MapBox GL JS) | macOS Native (MapKit) |
|--------------------|-----------------------|
| `mapboxgl.Map` | `Map` (SwiftUI) or `MKMapView` |
| GeoJSON polylines | `MKPolyline` / MapKit overlays |
| Circle markers | `MKCircle` overlays |
| Popup on click | `MKAnnotation` with callout |
| Style switching | `mapStyle` modifier (.standard, .imagery, .hybrid) |
| 3D via Threebox | MapKit 3D with `MKMapCamera` pitch |
| Altitude coloring | Custom `MKPolylineRenderer` with gradient |

**MapKit advantages over MapBox:**
- No API key or usage limits
- Native 3D globe with terrain
- Smooth integration with SwiftUI animations
- Offline map caching built in (Apple handles it)
- Look Around (Street View equivalent) for free

**MapKit limitations to work around:**
- No custom vector tile styles (but satellite/standard/hybrid covers the use cases)
- Overlay rendering is less flexible than WebGL — gradient polylines require a custom `MKOverlayRenderer` subclass

### Track Visualization

```swift
// Altitude-colored track as segmented polyline
class AltitudePolylineRenderer: MKOverlayPathRenderer {
    let fixes: [IGCFix]
    let altitudeRange: ClosedRange<Double>

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        // Draw segments with color interpolated by altitude
        // Brown (low) → Green → Blue → Sky blue (high)
    }
}
```

### Task Visualization

```swift
// Turnpoint cylinders as MKCircle overlays
func renderTask(_ task: XCTask) -> [MKOverlay] {
    task.turnpoints.map { tp in
        MKCircle(
            center: CLLocationCoordinate2D(latitude: tp.lat, longitude: tp.lon),
            radius: tp.radius
        )
    }
}
```

### Event Detection

Direct port of the TypeScript event detector. The algorithm is well-documented in `docs/events/thermal-detection-spec.md` and `docs/events/glide-detection-spec.md`.

Key parameters remain the same:
- Thermal: window=10, minClimb=0.5 m/s, minDuration=20s, exitThreshold=3
- Glide: minFixes=10, minDuration=30s
- Sink: L/D ≤ 5:1

The Swift port benefits from:
- `CLLocation.distance(from:)` replacing custom haversine
- `Measurement<UnitSpeed>` for unit conversions
- Value types (structs) for event data — no accidental mutation
- Strong enums for event types with associated values

```swift
enum FlightEvent {
    case thermal(ThermalEvent)
    case glide(GlideEvent)
    case sink(SinkEvent)
    case maxAltitude(FixIndex)
    case maxClimb(FixIndex, rate: Double)
    case maxSink(FixIndex, rate: Double)
    case turnpointEntry(FixIndex, turnpoint: Turnpoint)
    case turnpointExit(FixIndex, turnpoint: Turnpoint)
    case startCrossing(FixIndex)
    case goalCrossing(FixIndex)
    case takeoff(FixIndex)
    case landing(FixIndex)
}
```

### Storage

| Web | macOS Native |
|-----|-------------|
| IndexedDB (`taskscore` db) | SwiftData |
| localStorage (preferences) | `@AppStorage` / UserDefaults |

```swift
@Model
class StoredTrack {
    @Attribute(.unique) var sha256: String
    var filename: String
    var pilotName: String?
    var flightDate: Date?
    var content: Data  // Raw IGC bytes
    var storedAt: Date
    var lastAccessedAt: Date
}

@Model
class StoredTask {
    @Attribute(.unique) var code: String
    var name: String
    var taskData: Data  // Encoded XCTask
    var storedAt: Date
    var lastAccessedAt: Date
}
```

### UI Layout

The web app uses a sidebar + map layout. SwiftUI's `NavigationSplitView` provides this natively:

```swift
NavigationSplitView {
    // Sidebar: Event list with filter tabs
    EventListView(events: viewModel.events, filter: $filter)
} detail: {
    // Detail: Map with track + task overlays
    MapView(track: viewModel.track, task: viewModel.task)
        .overlay(alignment: .topTrailing) {
            FlightInfoView(summary: viewModel.summary)
        }
        .inspector(isPresented: $showInspector) {
            EventDetailView(event: viewModel.selectedEvent)
        }
}
```

### Command Palette

The web app's ⌘K command menu maps to:
- **Native menu bar**: File > Open, File > Open Recent, etc.
- **Toolbar**: Quick actions for display toggles
- **Settings window**: `Settings` scene for unit configuration
- **Spotlight/Quick Actions**: Could register as Spotlight importer for IGC metadata

```
Menu Bar:
├── File
│   ├── Open IGC File...          ⌘O
│   ├── Open Recent              ▶
│   ├── Load AirScore Task...     ⌘L
│   ├── Load XContest Task...     ⇧⌘L
│   └── Close                     ⌘W
├── View
│   ├── Show/Hide Sidebar         ⌘S (⌃⌘S)
│   ├── Show/Hide Inspector       ⌥⌘I
│   ├── Toggle 3D                 ⌘3
│   ├── Map Style                ▶
│   │   ├── Standard
│   │   ├── Satellite
│   │   └── Hybrid
│   ├── Show Task                 ⌘T
│   └── Altitude Coloring         ⌘A
├── Flight
│   ├── All Events                ⌘1
│   ├── Glides                    ⌘2
│   ├── Climbs                    ⌘3
│   └── Sinks                     ⌘4
├── Sample Flights               ▶
│   ├── Corryong 2025 Task 1
│   ├── ...
└── Window / Help (standard)
```

### Network Layer

```swift
actor AirScoreClient {
    private let baseURL: URL
    private let cache: URLCache

    func fetchTask(comPk: Int, tasPk: Int) async throws -> AirScoreTaskResponse {
        // Direct call to AirScore API (no need for CORS proxy in native)
        // Or continue using the existing worker for caching benefits
    }

    func fetchTrack(trackId: Int) async throws -> Data {
        // Returns raw IGC data
    }
}
```

**Key difference from web**: The native app can call AirScore's API directly (no CORS restrictions). The Cloudflare Worker could still be used for its caching benefits, or the app could implement its own URLCache-based caching.

## Implementation Phases

### Phase 1: Core Analysis (MVP)

**Goal**: Open and analyze IGC files with event detection and map display.

**Deliverables:**
1. Swift IGC parser (port `igc-parser.ts`)
2. Event detector (port `event-detector.ts`)
3. Geo utilities (wrap CoreLocation, port `geo.ts`)
4. Unit conversion (port `units.ts`)
5. MapKit view with track polyline (altitude-colored)
6. Event list sidebar with filter tabs
7. Click event → pan to location on map
8. File > Open for IGC files
9. Drag-and-drop IGC from Finder
10. Register as `.igc` file handler

**Estimated scope**: ~4,000 lines of Swift

### Phase 2: Task Support

**Goal**: Load and visualize competition tasks alongside tracks.

**Deliverables:**
1. XCTask parser (port `xctsk-parser.ts`)
2. Task cylinder overlays on map
3. Optimized task line calculation and display
4. Turnpoint entry/exit detection integrated with events
5. Start/goal crossing detection
6. AirScore client (direct API or via worker)
7. XContest task loading
8. Load AirScore Task sheet (paste URL)

**Estimated scope**: ~2,500 lines of Swift

### Phase 3: Polish & Persistence

**Goal**: Full-featured app with storage, preferences, and native feel.

**Deliverables:**
1. SwiftData persistence for tracks and tasks
2. File > Open Recent integration
3. Settings window (unit preferences)
4. Glide visualization (chevrons + speed labels as map annotations)
5. 3D track visualization (MapKit camera pitch + altitude)
6. Sample flights bundled in app
7. Toolbar with display toggles
8. Keyboard shortcuts for all common actions
9. Dark mode support (automatic via SwiftUI)

**Estimated scope**: ~2,000 lines of Swift

### Phase 4: Distribution

**Goal**: Ship the app.

**Deliverables:**
1. App icon and branding
2. Code signing and notarization
3. Mac App Store submission (or direct DMG download)
4. Sparkle framework for auto-updates (if direct distribution)
5. Spotlight importer for IGC file metadata (optional)
6. iCloud sync for preferences and stored items (optional)

## Testing Strategy

### Unit Tests (Swift Testing framework)

Port the existing test suite and expand:

```swift
@Test func parsesBRecord() {
    let record = "B1234564523456N00612345EA0034500456"
    let fix = IGCParser.parseBRecord(record)
    #expect(fix.latitude == 45.39093, accuracy: 0.00001)
    #expect(fix.longitude == 6.20575, accuracy: 0.00001)
}

@Test func detectsThermals() {
    let fixes = loadTestIGC("thermal-test.igc")
    let events = EventDetector.detect(fixes: fixes)
    let thermals = events.compactMap { if case .thermal(let t) = $0 { t } else { nil } }
    #expect(thermals.count > 0)
    #expect(thermals[0].avgClimbRate > 0.5)
}
```

### Integration Tests

- Load each sample flight → verify event counts match web version
- Parse known XCTask files → verify turnpoint coordinates
- Verify unit conversions match web version output

### UI Tests (XCUITest)

- Open IGC file via menu → verify track appears on map
- Click event in sidebar → verify map pans
- Change units in settings → verify labels update

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MapKit overlay performance with large tracks (10K+ fixes) | Slow rendering | Downsample tracks for display; full data for analysis |
| Altitude-gradient polyline complexity | Custom renderer work | Start with solid-color polyline; add gradient in Phase 3 |
| IGC parser edge cases differ between TS and Swift | Incorrect parsing | Use identical test fixtures; run both parsers on same files |
| AirScore API changes | Broken integration | Keep worker as intermediary; version the transform layer |
| App Store review (maps, file handling) | Rejection | Follow Apple HIG; use standard document model |

## What Stays on the Web

The native app does **not** replace the web version. They serve different audiences:

| Capability | Web | macOS Native |
|-----------|-----|-------------|
| Email submission workflow | Yes | No |
| Admin/scorer features | Yes | No |
| Competition management (D1/R2) | Yes | No |
| IGC analysis | Yes | Yes |
| Task visualization | Yes | Yes |
| AirScore integration | Yes | Yes |
| Offline analysis | Partial (cached) | Full |
| File system integration | Limited | Full |

The native app is a **flight analysis companion** — it focuses entirely on the IGC analysis tool, which is the most interactive and compute-intensive part of TaskScore.

## Decision Log

| Decision | Chosen | Alternatives Considered | Reason |
|----------|--------|------------------------|--------|
| UI Framework | SwiftUI | AppKit, Catalyst | Modern, declarative, less code |
| Map SDK | MapKit | MapBox Native SDK | Free, no API key, native 3D, simpler |
| Analysis code | Swift port | JavaScriptCore bridge | Type safety, no bridging overhead, maintainable |
| Persistence | SwiftData | Core Data, SQLite, Realm | Modern Apple persistence, less boilerplate |
| Distribution | Direct + App Store | Homebrew, App Store only | Flexibility; avoid review delays during development |
| Geo calculations | CoreLocation | Turf.js via JSCore | Native, tested, no dependencies |

## Minimum System Requirements

- macOS 14 Sonoma (for SwiftUI improvements + SwiftData + MapKit SwiftUI)
- Apple Silicon or Intel Mac
- ~50MB disk space (app + sample flights)
