import CoreLocation
import Foundation

@MainActor
final class GridCaptureEstimator: ObservableObject {
    @Published private(set) var tentativeCapturedIds = Set<String>()
    @Published private(set) var districts: [GridDistrict] = []
    @Published private(set) var gridVersion: String?
    @Published private(set) var displayCells: [GridDisplayCell] = []

    private var cells: [GridCell] = []
    private let decoder = JSONDecoder()

    func configure(from bootstrap: BootstrapResponse, apiBaseURL: URL) async {
        districts = bootstrap.grid.districts
        gridVersion = bootstrap.grid.version

        var loadedCells: [GridCell] = []
        for district in bootstrap.grid.districts {
            do {
                let data = try await loadGridData(for: district, apiBaseURL: apiBaseURL)
                loadedCells.append(contentsOf: try parseCells(data: data))
            } catch {
                print("Failed to load grid \(district.id): \(error)")
            }
        }
        cells = loadedCells
        displayCells = loadedCells.map { GridDisplayCell(id: $0.id, polygon: $0.polygon) }
    }

    func reset(existingCapturedIds: Set<String>) {
        tentativeCapturedIds = existingCapturedIds
    }

    func update(with point: WalkPoint) -> Set<String> {
        let coordinate = CLLocationCoordinate2D(latitude: point.lat, longitude: point.lon)
        let searchPadding = max((point.accuracy ?? 3), 3) / 111_320

        for cell in cells {
            guard !tentativeCapturedIds.contains(cell.id) else { continue }
            guard cell.contains(coordinate, paddingDegrees: searchPadding) else { continue }
            tentativeCapturedIds.insert(cell.id)
        }

        return tentativeCapturedIds
    }

    private func cacheURL(for district: GridDistrict) throws -> URL {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("StreetPlayer/Grid", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("\(district.id)-\(gridVersion ?? "grid").geojson")
    }

    private func loadGridData(for district: GridDistrict, apiBaseURL: URL) async throws -> Data {
        let cache = try cacheURL(for: district)
        if let data = try? Data(contentsOf: cache) {
            return data
        }

        let resourceName = (district.file as NSString).deletingPathExtension
        if let bundleURL = Bundle.main.url(forResource: resourceName, withExtension: "geojson") {
            return try Data(contentsOf: bundleURL)
        }

        let url = district.url.hasPrefix("http")
            ? URL(string: district.url)!
            : URL(string: district.url, relativeTo: apiBaseURL)!.absoluteURL
        let (data, _) = try await URLSession.shared.data(from: url)
        try data.write(to: cache, options: [.atomic])
        return data
    }

    private func parseCells(data: Data) throws -> [GridCell] {
        let collection = try decoder.decode(GeoJSONFeatureCollection.self, from: data)
        return collection.features.compactMap { feature in
            guard let id = feature.idString, let ring = feature.geometry.coordinates.first else { return nil }
            return GridCell(id: id, polygon: ring.map { CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0]) })
        }
    }
}

struct GridDisplayCell: Identifiable {
    let id: String
    let polygon: [CLLocationCoordinate2D]
}

private struct GeoJSONFeatureCollection: Codable {
    let features: [GeoJSONFeature]
}

private struct GeoJSONFeature: Codable {
    let id: GeoJSONID?
    let geometry: GeoJSONGeometry

    var idString: String? {
        switch id {
        case .string(let value): return value
        case .number(let value): return String(Int(value))
        case .none: return nil
        }
    }
}

private enum GeoJSONID: Codable {
    case string(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else {
            self = .number(try container.decode(Double.self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }
}

private struct GeoJSONGeometry: Codable {
    let type: String
    let coordinates: [[[Double]]]
}

private struct GridCell {
    let id: String
    let polygon: [CLLocationCoordinate2D]
    let minLat: Double
    let maxLat: Double
    let minLon: Double
    let maxLon: Double

    init(id: String, polygon: [CLLocationCoordinate2D]) {
        self.id = id
        self.polygon = polygon
        minLat = polygon.map(\.latitude).min() ?? 0
        maxLat = polygon.map(\.latitude).max() ?? 0
        minLon = polygon.map(\.longitude).min() ?? 0
        maxLon = polygon.map(\.longitude).max() ?? 0
    }

    func contains(_ point: CLLocationCoordinate2D, paddingDegrees: Double) -> Bool {
        guard point.latitude >= minLat - paddingDegrees,
              point.latitude <= maxLat + paddingDegrees,
              point.longitude >= minLon - paddingDegrees,
              point.longitude <= maxLon + paddingDegrees else {
            return false
        }
        return pointInPolygon(point)
    }

    private func pointInPolygon(_ point: CLLocationCoordinate2D) -> Bool {
        guard polygon.count > 2 else { return false }
        var isInside = false
        var j = polygon.count - 1

        for i in 0..<polygon.count {
            let xi = polygon[i].longitude
            let yi = polygon[i].latitude
            let xj = polygon[j].longitude
            let yj = polygon[j].latitude

            let intersects = ((yi > point.latitude) != (yj > point.latitude)) &&
                (point.longitude < (xj - xi) * (point.latitude - yi) / ((yj - yi) == 0 ? 0.0000001 : (yj - yi)) + xi)
            if intersects { isInside.toggle() }
            j = i
        }

        return isInside
    }
}
