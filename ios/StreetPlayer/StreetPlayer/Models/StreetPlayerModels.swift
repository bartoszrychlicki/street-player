import Foundation
import CoreLocation

struct WalkPoint: Codable, Identifiable, Equatable {
    var id = UUID()
    let lat: Double
    let lon: Double
    let timestamp: Date
    let accuracy: Double?

    init(location: CLLocation) {
        lat = location.coordinate.latitude
        lon = location.coordinate.longitude
        timestamp = location.timestamp
        accuracy = location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil
    }
}

struct LocalWalk: Codable, Identifiable, Equatable {
    enum SyncState: String, Codable {
        case recording
        case pendingSync
        case syncing
        case confirmed
        case failed
    }

    var id: String
    var startedAt: Date
    var endedAt: Date?
    var points: [WalkPoint]
    var tentativeCapturedSquareIds: [String]
    var confirmedCapturedSquareIds: [String]
    var distanceMeters: Double
    var state: SyncState
    var lastSyncError: String?

    var durationSeconds: Int {
        let end = endedAt ?? Date()
        return max(0, Int(end.timeIntervalSince(startedAt)))
    }
}

struct GridDistrict: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let file: String
    let url: String
    let featureCount: Int
}

struct BootstrapResponse: Codable {
    struct User: Codable {
        let uid: String
        let email: String?
        let username: String?
        let capturedSquares: [String]
        let totalCaptured: Int
    }

    struct Grid: Codable {
        let version: String
        let districts: [GridDistrict]
        let totalFeatureCount: Int
    }

    struct AppConfig: Codable {
        let minimumPointCount: Int
        let routeBufferMeters: Double
        let gpsAccuracyCutoffMeters: Double
        let maximumLikelyWalkingSpeedMetersPerSecond: Double
    }

    let user: User
    let grid: Grid
    let appConfig: AppConfig
}

struct WalkSummary: Codable, Identifiable, Equatable {
    let id: String
    let startedAt: String
    let endedAt: String
    let durationSeconds: Int
    let distanceMeters: Double
    let pointCount: Int
    let newCapturedCount: Int
    let totalCaptured: Int
    let correction: Int
}

struct WalkUploadResponse: Codable {
    let success: Bool
    let idempotent: Bool
    let walk: WalkSummary
    let newCapturedIds: [String]?
    let totalCaptured: Int?
}

extension BootstrapResponse {
    static let bundledFallback = BootstrapResponse(
        user: User(
            uid: "local",
            email: nil,
            username: nil,
            capturedSquares: [],
            totalCaptured: 0
        ),
        grid: Grid(
            version: "2026-02-05-grid-v1-bundled",
            districts: [
                GridDistrict(id: "oliwa", name: "Oliwa", file: "grid-oliwa.geojson", url: "grid-oliwa.geojson", featureCount: 0),
                GridDistrict(id: "vii_dwor", name: "VII Dwor", file: "grid-vii_dwor.geojson", url: "grid-vii_dwor.geojson", featureCount: 0),
                GridDistrict(id: "strzyza", name: "Strzyza", file: "grid-strzyza.geojson", url: "grid-strzyza.geojson", featureCount: 0),
                GridDistrict(id: "piecki_migowo", name: "Piecki-Migowo", file: "grid-piecki_migowo.geojson", url: "grid-piecki_migowo.geojson", featureCount: 0),
                GridDistrict(id: "wrzeszcz_gorny", name: "Wrzeszcz Gorny", file: "grid-wrzeszcz_gorny.geojson", url: "grid-wrzeszcz_gorny.geojson", featureCount: 0),
                GridDistrict(id: "sopot", name: "Sopot", file: "grid-sopot.geojson", url: "grid-sopot.geojson", featureCount: 0),
            ],
            totalFeatureCount: 0
        ),
        appConfig: AppConfig(
            minimumPointCount: 12,
            routeBufferMeters: 3,
            gpsAccuracyCutoffMeters: 45,
            maximumLikelyWalkingSpeedMetersPerSecond: 12
        )
    )
}
