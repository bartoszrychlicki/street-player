import Foundation

@MainActor
final class LocalStore: ObservableObject {
    @Published private(set) var activeWalk: LocalWalk?
    @Published private(set) var savedWalks: [LocalWalk] = []
    @Published var capturedSquareIds = Set<String>()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let fileURL: URL

    var pendingWalkCount: Int {
        savedWalks.filter { $0.state == .pendingSync || $0.state == .failed }.count
    }

    init() {
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("StreetPlayer", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("local-state.json")
        load()
    }

    func setCapturedSquares(_ ids: [String]) {
        capturedSquareIds = Set(ids)
        save()
    }

    func beginWalk(id: String = UUID().uuidString) -> LocalWalk {
        let walk = LocalWalk(
            id: id,
            startedAt: Date(),
            endedAt: nil,
            points: [],
            tentativeCapturedSquareIds: [],
            confirmedCapturedSquareIds: [],
            distanceMeters: 0,
            state: .recording,
            lastSyncError: nil
        )
        activeWalk = walk
        save()
        return walk
    }

    func append(point: WalkPoint, tentativeCapturedIds: Set<String>, distanceMeters: Double) {
        guard var walk = activeWalk else { return }
        walk.points.append(point)
        walk.tentativeCapturedSquareIds = Array(tentativeCapturedIds).sorted()
        walk.distanceMeters = distanceMeters
        activeWalk = walk
        save()
    }

    func finishActiveWalk() -> LocalWalk? {
        guard var walk = activeWalk else { return nil }
        walk.endedAt = Date()
        walk.state = .pendingSync
        activeWalk = nil
        savedWalks.insert(walk, at: 0)
        save()
        return walk
    }

    func updateWalk(_ walk: LocalWalk) {
        if activeWalk?.id == walk.id {
            activeWalk = walk
        } else if let index = savedWalks.firstIndex(where: { $0.id == walk.id }) {
            savedWalks[index] = walk
        } else {
            savedWalks.insert(walk, at: 0)
        }
        save()
    }

    func markConfirmed(_ walkID: String, confirmedIds: [String], totalCapturedIds: [String]? = nil) {
        guard let index = savedWalks.firstIndex(where: { $0.id == walkID }) else { return }
        savedWalks[index].state = .confirmed
        savedWalks[index].confirmedCapturedSquareIds = confirmedIds
        savedWalks[index].lastSyncError = nil
        confirmedIds.forEach { capturedSquareIds.insert($0) }
        if let totalCapturedIds {
            capturedSquareIds = Set(totalCapturedIds)
        }
        save()
    }

    func markFailed(_ walkID: String, error: String) {
        guard let index = savedWalks.firstIndex(where: { $0.id == walkID }) else { return }
        savedWalks[index].state = .failed
        savedWalks[index].lastSyncError = error
        save()
    }

    func discardPendingWalks() {
        savedWalks.removeAll { $0.state == .pendingSync || $0.state == .failed }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        do {
            let state = try decoder.decode(LocalState.self, from: data)
            activeWalk = state.activeWalk
            savedWalks = state.savedWalks
            capturedSquareIds = Set(state.capturedSquareIds)
        } catch {
            print("Failed to load local state: \(error)")
        }
    }

    private func save() {
        let state = LocalState(
            activeWalk: activeWalk,
            savedWalks: savedWalks,
            capturedSquareIds: Array(capturedSquareIds).sorted()
        )
        do {
            let data = try encoder.encode(state)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            print("Failed to save local state: \(error)")
        }
    }
}

private struct LocalState: Codable {
    let activeWalk: LocalWalk?
    let savedWalks: [LocalWalk]
    let capturedSquareIds: [String]
}
