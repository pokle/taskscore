import SwiftUI

/// Sidebar event list with filter tabs
struct EventListView: View {
    let events: [FlightEvent]
    @Binding var selectedEvent: FlightEvent?
    @Binding var filter: EventFilter

    var body: some View {
        VStack(spacing: 0) {
            // Filter tabs
            Picker("Filter", selection: $filter) {
                ForEach(EventFilter.allCases, id: \.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            // Event list
            List(events, selection: $selectedEvent) { event in
                EventRowView(event: event)
                    .tag(event)
            }
        }
    }
}

/// A single event row in the sidebar
struct EventRowView: View {
    let event: FlightEvent

    var body: some View {
        HStack(spacing: 8) {
            let style = EventDetector.getEventStyle(event.type)
            Circle()
                .fill(Color(hex: style.color) ?? .gray)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.description)
                    .font(.system(.body, design: .default))
                    .lineLimit(1)

                Text(event.time, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text("\(Int(event.altitude))m")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
