import Foundation

/// Types of flight events that can be detected
public enum FlightEventType: String, CaseIterable, Sendable {
    case takeoff
    case landing
    case thermalEntry = "thermal_entry"
    case thermalExit = "thermal_exit"
    case glideStart = "glide_start"
    case glideEnd = "glide_end"
    case turnpointEntry = "turnpoint_entry"
    case turnpointExit = "turnpoint_exit"
    case startCrossing = "start_crossing"
    case goalCrossing = "goal_crossing"
    case maxAltitude = "max_altitude"
    case minAltitude = "min_altitude"
    case maxClimb = "max_climb"
    case maxSink = "max_sink"
}

/// Track segment defined by fix array indices
public struct TrackSegment: Equatable, Hashable, Sendable {
    public let startIndex: Int
    public let endIndex: Int
}

/// A detected flight event
public struct FlightEvent: Identifiable, Hashable, Sendable {
    public let id: String
    public let type: FlightEventType
    public let time: Date
    public let latitude: Double
    public let longitude: Double
    public let altitude: Double
    public let description: String
    public var details: [String: Double]
    public var segment: TrackSegment?

    public init(id: String, type: FlightEventType, time: Date,
                latitude: Double, longitude: Double, altitude: Double,
                description: String, details: [String: Double] = [:],
                segment: TrackSegment? = nil) {
        self.id = id
        self.type = type
        self.time = time
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.description = description
        self.details = details
        self.segment = segment
    }
}

/// Detected thermal segment with statistics
public struct ThermalSegment: Sendable {
    public let startIndex: Int
    public let endIndex: Int
    public let startAltitude: Double
    public let endAltitude: Double
    public let avgClimbRate: Double
    public let duration: Double
    public let location: (lat: Double, lon: Double)
}

/// Detected glide segment with statistics
public struct GlideSegment: Sendable {
    public let startIndex: Int
    public let endIndex: Int
    public let startAltitude: Double
    public let endAltitude: Double
    public let distance: Double
    public let glideRatio: Double
    public let duration: Double
}

/// XCTask types needed by event detector
public struct XCTaskWaypoint: Sendable {
    public let name: String
    public let description: String?
    public let lat: Double
    public let lon: Double
    public let altSmoothed: Double?

    public init(name: String, description: String? = nil, lat: Double, lon: Double,
                altSmoothed: Double? = nil) {
        self.name = name
        self.description = description
        self.lat = lat
        self.lon = lon
        self.altSmoothed = altSmoothed
    }
}

public struct XCTaskTurnpoint: Sendable {
    public let type: String? // "TAKEOFF", "SSS", "ESS"
    public let radius: Double
    public let waypoint: XCTaskWaypoint

    public init(type: String? = nil, radius: Double, waypoint: XCTaskWaypoint) {
        self.type = type
        self.radius = radius
        self.waypoint = waypoint
    }
}

public struct XCTask: Sendable {
    public let taskType: String
    public let version: Int
    public let earthModel: String?
    public let turnpoints: [XCTaskTurnpoint]

    public init(taskType: String, version: Int, earthModel: String? = nil,
                turnpoints: [XCTaskTurnpoint]) {
        self.taskType = taskType
        self.version = version
        self.earthModel = earthModel
        self.turnpoints = turnpoints
    }
}

/// Style information for event display
public struct EventStyle {
    public let icon: String
    public let color: String
}
