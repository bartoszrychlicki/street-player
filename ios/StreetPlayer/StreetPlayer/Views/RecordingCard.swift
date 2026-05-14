import SwiftUI

struct RecordingCard: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var store: LocalStore
    @EnvironmentObject private var recorder: LocationRecorder

    let syncMessage: String?
    @State private var isSyncing = false

    var body: some View {
        VStack(spacing: 14) {
            if let walk = store.activeWalk {
                HStack {
                    metric(title: "Time", value: formatDuration(walk.durationSeconds))
                    metric(title: "Distance", value: formatDistance(walk.distanceMeters))
                    metric(title: "New", value: "\(walk.tentativeCapturedSquareIds.count)")
                    metric(title: "GPS", value: recorder.latestAccuracy.map { "\(Int($0)) m" } ?? "--")
                }

                Button(role: .destructive) {
                    recorder.stop()
                    Task { await syncPendingWalks() }
                } label: {
                    Label("Finish walk", systemImage: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .accessibilityIdentifier("finishWalkButton")
            } else {
                Button {
                    recorder.start()
                } label: {
                    Label("Start walk", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)
                .accessibilityIdentifier("startWalkButton")
            }

            if store.savedWalks.contains(where: { $0.state == .pendingSync || $0.state == .failed }) {
                Button {
                    Task { await syncPendingWalks() }
                } label: {
                    Label(isSyncing ? "Syncing..." : "Sync pending walks", systemImage: "arrow.triangle.2.circlepath")
                }
                .disabled(isSyncing)
                .accessibilityIdentifier("syncPendingWalksButton")
            }

            if let syncMessage {
                Text(syncMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    private func metric(title: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit())
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func syncPendingWalks() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        for walk in store.savedWalks where walk.state == .pendingSync || walk.state == .failed {
            var syncing = walk
            syncing.state = .syncing
            store.updateWalk(syncing)
            do {
                let response = try await api.upload(walk: walk)
                let confirmedIds = response.newCapturedIds ?? []
                store.markConfirmed(walk.id, confirmedIds: confirmedIds)
                try await api.loadBootstrap()
                if let captured = api.bootstrap?.user.capturedSquares {
                    store.setCapturedSquares(captured)
                }
                try await api.loadWalks()
            } catch {
                store.markFailed(walk.id, error: error.localizedDescription)
            }
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    private func formatDistance(_ meters: Double) -> String {
        meters >= 1000 ? String(format: "%.2f km", meters / 1000) : "\(Int(meters)) m"
    }
}
