import SwiftUI

struct MapScreen: View {
    @EnvironmentObject private var auth: AuthViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var store: LocalStore
    @EnvironmentObject private var grid: GridCaptureEstimator
    @EnvironmentObject private var recorder: LocationRecorder

    @State private var showingHistory = false
    @State private var showingSettings = false
    @State private var syncMessage: String?
    @State private var recenterRequest = 0

    private var activePoints: [WalkPoint] {
        store.activeWalk?.points ?? []
    }

    var body: some View {
        ZStack {
            StreetMapView(
                points: activePoints,
                center: recorder.latestCoordinate,
                gridCells: grid.displayCells,
                capturedSquareIds: store.capturedSquareIds,
                tentativeSquareIds: grid.tentativeCapturedIds,
                recenterRequest: recenterRequest
            )
                .ignoresSafeArea()

            VStack {
                topBar
                Spacer()
                RecordingCard(syncMessage: syncMessage)
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 16)

            VStack {
                Spacer()
                HStack {
                    Spacer()
                    centerOnUserButton
                }
                .padding(.trailing, 18)
                .padding(.bottom, 190)
            }
        }
        .sheet(isPresented: $showingHistory) {
            HistorySheet()
        }
        .sheet(isPresented: $showingSettings) {
            SettingsSheet()
        }
        .task {
            await bootstrap()
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button {
                showingHistory = true
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.title3.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.blue)
            .background(.white.opacity(0.72), in: Circle())
            .accessibilityIdentifier("historyButton")
            .accessibilityLabel("History")

            Spacer()

            VStack(spacing: 2) {
                Text("Street Player")
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .accessibilityIdentifier("topBarTitle")
                if let total = api.bootstrap?.user.totalCaptured {
                    Text("\(total) squares")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)

            Spacer()

            Button {
                showingSettings = true
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.title3.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.blue)
            .background(.white.opacity(0.72), in: Circle())
            .accessibilityIdentifier("settingsButton")
            .accessibilityLabel("Profile and settings")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: 360)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(.white.opacity(0.45), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
    }

    private var centerOnUserButton: some View {
        Button {
            recorder.refreshCurrentLocation()
            recenterRequest += 1
        } label: {
            Image(systemName: "location.fill")
                .font(.title3)
                .frame(width: 48, height: 48)
        }
        .buttonStyle(.borderedProminent)
        .clipShape(Circle())
        .accessibilityLabel("Center on current location")
        .accessibilityIdentifier("centerOnUserButton")
    }

    private func bootstrap() async {
        do {
            try await api.loadBootstrap()
            if let bootstrap = api.bootstrap {
                store.setCapturedSquares(bootstrap.user.capturedSquares)
                await grid.configure(from: bootstrap, apiBaseURL: api.baseURL)
            }
            try await api.loadWalks()
            if api.isUsingLocalBootstrap {
                syncMessage = "Mobile API is not deployed yet. Walks record locally."
            } else {
                syncMessage = nil
            }
        } catch {
            syncMessage = error.localizedDescription
        }
    }
}
