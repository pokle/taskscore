import SwiftUI
import MapKit

/// MapKit view displaying the flight track and events
struct MapView: View {
    let fixes: [IGCFix]
    let events: [FlightEvent]
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
            if !newFixes.isEmpty {
                let bounds = Geo.getBoundingBox(newFixes)
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
        }
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
