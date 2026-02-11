import Foundation

/// Parsed AirScore URL parameters
public struct AirScoreURLParams {
    public let comPk: Int
    public let tasPk: Int
    public let trackId: Int?
}

/// Parse AirScore URLs to extract competition/task/track identifiers.
/// Lives in TaskScoreLib so it's testable without app dependencies.
public enum AirScoreURLParser {

    /// Parse an AirScore tracklog URL to extract comPk, tasPk, and trackId.
    /// Supports URLs like:
    ///   https://xc.highcloud.net/tracklog_map.html?trackid=43826&comPk=466&tasPk=2030
    public static func parse(_ urlString: String) -> AirScoreURLParams? {
        guard let url = URL(string: urlString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let queryItems = components.queryItems ?? []

        guard let comPkStr = queryItems.first(where: { $0.name == "comPk" })?.value,
              let tasPkStr = queryItems.first(where: { $0.name == "tasPk" })?.value,
              let comPk = Int(comPkStr),
              let tasPk = Int(tasPkStr) else {
            return nil
        }

        let trackId: Int?
        if let trackIdStr = queryItems.first(where: {
            $0.name.lowercased() == "trackid"
        })?.value {
            trackId = Int(trackIdStr)
        } else {
            trackId = nil
        }

        return AirScoreURLParams(comPk: comPk, tasPk: tasPk, trackId: trackId)
    }
}
