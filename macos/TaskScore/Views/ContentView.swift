import SwiftUI
import MapKit

/// Main app layout: NavigationSplitView with sidebar + map detail
struct ContentView: View {
    @State private var viewModel = FlightViewModel()
    @State private var selectedEvent: FlightEvent?
    @State private var showInspector = false
    @State private var eventFilter: EventFilter = .all

    var body: some View {
        NavigationSplitView {
            EventListView(
                events: viewModel.filteredEvents(for: eventFilter),
                selectedEvent: $selectedEvent,
                filter: $eventFilter
            )
            .navigationTitle("Events")
        } detail: {
            MapView(
                fixes: viewModel.fixes,
                events: viewModel.events,
                selectedEvent: $selectedEvent
            )
            .overlay(alignment: .topTrailing) {
                if let summary = viewModel.summary {
                    FlightInfoView(summary: summary)
                        .padding()
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    openIGCFile()
                } label: {
                    Label("Open IGC", systemImage: "doc.badge.plus")
                }
                .keyboardShortcut("o", modifiers: .command)
            }
        }
    }

    private func openIGCFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.message = "Select an IGC flight log file"

        if panel.runModal() == .OK, let url = panel.url {
            viewModel.loadIGCFile(from: url)
        }
    }
}

/// Filter for event list
enum EventFilter: String, CaseIterable {
    case all = "All"
    case glides = "Glides"
    case climbs = "Climbs"
    case sinks = "Sinks"
}

/// View model managing flight data and analysis
@Observable
class FlightViewModel {
    var igcFile: IGCFileData?
    var fixes: [IGCFix] = []
    var events: [FlightEvent] = []
    var summary: FlightSummary?

    func loadIGCFile(from url: URL) {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return }

        let igc = IGCParser.parse(content)
        self.igcFile = igc
        self.fixes = igc.fixes
        self.events = EventDetector.detectFlightEvents(igc.fixes)
        self.summary = FlightSummary(igc: igc, events: events)
    }

    func filteredEvents(for filter: EventFilter) -> [FlightEvent] {
        switch filter {
        case .all:
            return events
        case .glides:
            return events.filter { $0.type == .glideStart || $0.type == .glideEnd }
        case .climbs:
            return events.filter { $0.type == .thermalEntry || $0.type == .thermalExit }
        case .sinks:
            return events.filter { $0.type == .maxSink }
        }
    }
}

/// Summary information about a flight
struct FlightSummary {
    let pilot: String?
    let date: Date?
    let gliderType: String?
    let maxAltitude: Int?
    let eventCount: Int

    init(igc: IGCFileData, events: [FlightEvent]) {
        self.pilot = igc.header.pilot
        self.date = igc.header.date
        self.gliderType = igc.header.gliderType
        self.maxAltitude = events.first(where: { $0.type == .maxAltitude }).map { Int($0.altitude) }
        self.eventCount = events.count
    }
}
