import SwiftUI

/// Summary panel showing flight metadata
struct FlightInfoView: View {
    let summary: FlightSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let pilot = summary.pilot {
                Label(pilot, systemImage: "person")
                    .font(.headline)
            }

            if let date = summary.date {
                Label(date.formatted(.dateTime.day().month().year()), systemImage: "calendar")
                    .font(.caption)
            }

            if let glider = summary.gliderType {
                Label(glider, systemImage: "airplane")
                    .font(.caption)
            }

            if let maxAlt = summary.maxAltitude {
                Label("Max: \(maxAlt)m", systemImage: "arrow.up")
                    .font(.caption)
            }

            if let taskDistance = summary.taskDistance {
                Label("Task: \(taskDistance)", systemImage: "map")
                    .font(.caption)
            }

            Label("\(summary.eventCount) events", systemImage: "list.bullet")
                .font(.caption)
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
    }
}
