import SwiftUI
import MapKit

/// MapKit view displaying the flight track, events, task cylinders, and optimized task line
struct MapView: View {
    let fixes: [IGCFix]
    let events: [FlightEvent]
    let task: XCTask?
    @Binding var selectedEvent: FlightEvent?

    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $cameraPosition) {
            // Track polyline
            if fixes.count >= 2 {
                let coordinates = fixes.map {
                    CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
                }
                MapPolyline(coordinates: coordinates)
                    .stroke(.blue, lineWidth: 2)
            }

            // Task cylinder overlays
            if let task = task {
                // Turnpoint cylinders
                ForEach(Array(task.turnpoints.enumerated()), id: \.offset) { index, tp in
                    // Cylinder circle
                    MapCircle(
                        center: CLLocationCoordinate2D(latitude: tp.waypoint.lat, longitude: tp.waypoint.lon),
                        radius: tp.radius
                    )
                    .foregroundStyle(turnpointFillColor(tp).opacity(0.15))
                    .stroke(turnpointStrokeColor(tp), lineWidth: 1.5)

                    // Turnpoint label
                    Annotation(
                        tp.waypoint.name,
                        coordinate: CLLocationCoordinate2D(latitude: tp.waypoint.lat, longitude: tp.waypoint.lon)
                    ) {
                        turnpointMarker(tp, index: index)
                    }
                }

                // Optimized task line
                let optimizedPath = XCTaskParser.calculateOptimizedTaskLine(task)
                if optimizedPath.count >= 2 {
                    let pathCoords = optimizedPath.map {
                        CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon)
                    }
                    MapPolyline(coordinates: pathCoords)
                        .stroke(.orange, style: StrokeStyle(lineWidth: 2, dash: [8, 4]))
                }
            }

            // Event markers
            ForEach(events.filter { shouldShowMarker($0) }) { event in
                Annotation(event.description, coordinate: CLLocationCoordinate2D(
                    latitude: event.latitude, longitude: event.longitude
                )) {
                    eventMarkerView(for: event)
                        .onTapGesture {
                            selectedEvent = event
                        }
                }
            }
        }
        .mapStyle(.hybrid(elevation: .realistic))
        .onChange(of: fixes) { _, newFixes in
            updateCamera(fixes: newFixes, task: task)
        }
        .onChange(of: selectedEvent) { _, event in
            if let event = event {
                withAnimation {
                    cameraPosition = .region(MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: event.latitude, longitude: event.longitude),
                        span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                    ))
                }
            }
        }
    }

    private func updateCamera(fixes: [IGCFix], task: XCTask?) {
        // Collect all coordinates (fixes + task turnpoints)
        var allPoints: [(latitude: Double, longitude: Double)] = []

        if !fixes.isEmpty {
            allPoints = fixes.map { (latitude: $0.latitude, longitude: $0.longitude) }
        }

        if let task = task {
            for tp in task.turnpoints {
                allPoints.append((latitude: tp.waypoint.lat, longitude: tp.waypoint.lon))
            }
        }

        guard !allPoints.isEmpty else { return }

        let bounds = Geo.getBoundingBox(allPoints)
        let center = CLLocationCoordinate2D(
            latitude: (bounds.minLat + bounds.maxLat) / 2,
            longitude: (bounds.minLon + bounds.maxLon) / 2
        )
        let span = MKCoordinateSpan(
            latitudeDelta: (bounds.maxLat - bounds.minLat) * 1.2,
            longitudeDelta: (bounds.maxLon - bounds.minLon) * 1.2
        )
        cameraPosition = .region(MKCoordinateRegion(center: center, span: span))
    }

    private func shouldShowMarker(_ event: FlightEvent) -> Bool {
        switch event.type {
        case .takeoff, .landing, .maxAltitude, .thermalEntry, .startCrossing, .goalCrossing:
            return true
        default:
            return false
        }
    }

    @ViewBuilder
    private func eventMarkerView(for event: FlightEvent) -> some View {
        let style = EventDetector.getEventStyle(event.type)
        Circle()
            .fill(Color(hex: style.color) ?? .blue)
            .frame(width: 12, height: 12)
            .overlay(
                Circle()
                    .stroke(.white, lineWidth: 1.5)
            )
    }

    // MARK: - Task Styling

    private func turnpointFillColor(_ tp: XCTaskTurnpoint) -> Color {
        switch tp.type {
        case "SSS": return .green
        case "ESS": return .yellow
        case "TAKEOFF": return .gray
        default: return .purple
        }
    }

    private func turnpointStrokeColor(_ tp: XCTaskTurnpoint) -> Color {
        switch tp.type {
        case "SSS": return .green
        case "ESS": return .yellow
        case "TAKEOFF": return .gray
        default: return .purple
        }
    }

    @ViewBuilder
    private func turnpointMarker(_ tp: XCTaskTurnpoint, index: Int) -> some View {
        let label: String = {
            if tp.type == "SSS" { return "S" }
            if tp.type == "ESS" { return "G" }
            if tp.type == "TAKEOFF" { return "T" }
            return "\(index)"
        }()

        Text(label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(turnpointStrokeColor(tp))
            .clipShape(Circle())
            .overlay(Circle().stroke(.white, lineWidth: 1))
    }
}

extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.hasPrefix("#") ? String(hexSanitized.dropFirst()) : hexSanitized

        guard hexSanitized.count == 6,
              let rgb = UInt64(hexSanitized, radix: 16) else {
            return nil
        }

        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
