import Foundation
import UIKit

@MainActor
final class APIClient: ObservableObject {
    enum APIError: LocalizedError {
        case missingTokenProvider
        case invalidResponse
        case server(statusCode: Int, message: String)

        var errorDescription: String? {
            switch self {
            case .missingTokenProvider:
                return "Authentication is not ready."
            case .invalidResponse:
                return "Server returned an invalid response."
            case .server(_, let message):
                return message
            }
        }
    }

    var idTokenProvider: (() async throws -> String)?
    @Published private(set) var bootstrap: BootstrapResponse?
    @Published private(set) var walks: [WalkSummary] = []
    @Published private(set) var isUsingLocalBootstrap = false

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    var baseURL: URL {
        if let override = UserDefaults.standard.string(forKey: "StreetPlayerAPIBaseURL"),
           let url = URL(string: override) {
            return url
        }
        let value = Bundle.main.object(forInfoDictionaryKey: "StreetPlayerAPIBaseURL") as? String
        return URL(string: value ?? "http://localhost:3000")!
    }

    func loadBootstrap() async throws {
        do {
            let response: BootstrapResponse = try await request(path: "/api/mobile/bootstrap")
            bootstrap = response
            isUsingLocalBootstrap = false
        } catch APIError.server(let statusCode, _) where statusCode == 404 {
            bootstrap = .bundledFallback
            isUsingLocalBootstrap = true
        }
    }

    func loadWalks() async throws {
        struct Response: Codable { let walks: [WalkSummary] }
        do {
            let response: Response = try await request(path: "/api/mobile/walks")
            walks = response.walks
        } catch APIError.server(let statusCode, _) where statusCode == 404 {
            walks = []
        }
    }

    func upload(walk: LocalWalk) async throws -> WalkUploadResponse {
        struct UploadPoint: Codable {
            let lat: Double
            let lon: Double
            let timestamp: String
            let accuracy: Double?
        }

        struct Device: Codable {
            let platform: String
            let appVersion: String
            let buildNumber: String
            let model: String
            let systemVersion: String
        }

        struct Payload: Codable {
            let clientWalkId: String
            let startedAt: String
            let endedAt: String
            let points: [UploadPoint]
            let tentativeCapturedSquareIds: [String]
            let device: Device
        }

        let formatter = ISO8601DateFormatter()
        let payload = Payload(
            clientWalkId: walk.id,
            startedAt: formatter.string(from: walk.startedAt),
            endedAt: formatter.string(from: walk.endedAt ?? Date()),
            points: walk.points.map {
                UploadPoint(
                    lat: $0.lat,
                    lon: $0.lon,
                    timestamp: formatter.string(from: $0.timestamp),
                    accuracy: $0.accuracy
                )
            },
            tentativeCapturedSquareIds: walk.tentativeCapturedSquareIds,
            device: Device(
                platform: "ios",
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0",
                buildNumber: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1",
                model: UIDevice.current.model,
                systemVersion: UIDevice.current.systemVersion
            )
        )

        return try await request(path: "/api/mobile/walks", method: "POST", body: payload)
    }

    private func request<Response: Decodable>(
        path: String,
        method: String = "GET"
    ) async throws -> Response {
        try await request(path: path, method: method, body: Optional<String>.none)
    }

    private func request<Response: Decodable, Body: Encodable>(
        path: String,
        method: String = "GET",
        body: Body?
    ) async throws -> Response {
        guard let idTokenProvider else { throw APIError.missingTokenProvider }
        let token = try await idTokenProvider()
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data)["error"]) ?? "Request failed with status \(http.statusCode)."
            throw APIError.server(statusCode: http.statusCode, message: message)
        }

        return try decoder.decode(Response.self, from: data)
    }
}
