import ActivityKit
import Foundation

struct WalkActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var distanceMeters: Double
        var pointCount: Int
        var gpsAccuracyMeters: Double?
    }

    var walkID: String
    var startedAt: Date
}
