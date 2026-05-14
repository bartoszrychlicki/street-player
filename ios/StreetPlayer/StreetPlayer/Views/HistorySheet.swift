import SwiftUI

struct HistorySheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var store: LocalStore

    var body: some View {
        NavigationStack {
            List {
                if !store.savedWalks.isEmpty {
                    Section("On this device") {
                        ForEach(store.savedWalks) { walk in
                            walkRow(
                                title: walk.startedAt.formatted(date: .abbreviated, time: .shortened),
                                subtitle: "\(formatDuration(walk.durationSeconds)) • \(formatDistance(walk.distanceMeters))",
                                badge: walk.state.rawValue
                            )
                        }
                    }
                }

                Section("Server history") {
                    ForEach(api.walks) { walk in
                        walkRow(
                            title: displayDate(walk.endedAt),
                            subtitle: "\(formatDuration(walk.durationSeconds)) • \(formatDistance(walk.distanceMeters))",
                            badge: "+\(walk.newCapturedCount)"
                        )
                    }
                }
            }
            .navigationTitle("Walk history")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { try? await api.loadWalks() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task {
                try? await api.loadWalks()
            }
        }
    }

    private func walkRow(title: String, subtitle: String, badge: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(badge)
                .font(.caption.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(.thinMaterial, in: Capsule())
        }
    }

    private func displayDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func formatDuration(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    private func formatDistance(_ meters: Double) -> String {
        meters >= 1000 ? String(format: "%.2f km", meters / 1000) : "\(Int(meters)) m"
    }
}
