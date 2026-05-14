import CoreLocation
import SwiftUI

@MainActor
final class LocationRecorder: NSObject, ObservableObject {
    enum RecorderState: Equatable {
        case idle
        case requestingPermission
        case recording
        case denied
        case failed(String)
    }

    @Published private(set) var state: RecorderState = .idle
    @Published private(set) var latestAccuracy: Double?
    @Published private(set) var latestCoordinate: CLLocationCoordinate2D?

    private let manager = CLLocationManager()
    private let liveActivity = LiveActivityController()
    private weak var store: LocalStore?
    private weak var grid: GridCaptureEstimator?
    private var lastAcceptedLocation: CLLocation?
    private var distanceMeters: Double = 0
    private var shouldStartAfterPermission = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.activityType = .fitness
        manager.distanceFilter = 3
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
    }

    func configure(store: LocalStore, grid: GridCaptureEstimator) {
        self.store = store
        self.grid = grid
    }

    func requestPermissionIfNeeded() {
        let status = manager.authorizationStatus
        if status == .notDetermined {
            state = .requestingPermission
            manager.requestAlwaysAuthorization()
        } else if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.requestAlwaysAuthorization()
        } else {
            state = .denied
        }
    }

    func refreshCurrentLocation() {
        let status = manager.authorizationStatus
        guard status == .authorizedAlways || status == .authorizedWhenInUse else {
            requestPermissionIfNeeded()
            return
        }

        manager.requestLocation()
    }

    func start() {
        guard let store, let grid else { return }
        let status = manager.authorizationStatus
        guard status == .authorizedAlways || status == .authorizedWhenInUse else {
            shouldStartAfterPermission = true
            requestPermissionIfNeeded()
            return
        }

        UIApplication.shared.isIdleTimerDisabled = true
        distanceMeters = 0
        lastAcceptedLocation = nil
        let walk = store.beginWalk()
        grid.reset(existingCapturedIds: store.capturedSquareIds)
        liveActivity.start(walk: walk)
        state = .recording
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
        UIApplication.shared.isIdleTimerDisabled = false
        state = .idle

        Task {
            await liveActivity.end()
        }
        _ = store?.finishActiveWalk()
    }

    private func updateLatestLocation(_ location: CLLocation) {
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 100 else { return }

        latestAccuracy = location.horizontalAccuracy
        latestCoordinate = location.coordinate
    }

    private func accept(location: CLLocation) {
        guard let store, let grid, var walk = store.activeWalk else { return }
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 45 else { return }

        if let previous = lastAcceptedLocation {
            let seconds = location.timestamp.timeIntervalSince(previous.timestamp)
            if seconds > 0 {
                let speed = location.distance(from: previous) / seconds
                if speed > 12 { return }
            }
            distanceMeters += location.distance(from: previous)
        }

        let point = WalkPoint(location: location)
        lastAcceptedLocation = location
        let tentative = grid.update(with: point)
        store.append(point: point, tentativeCapturedIds: tentative.subtracting(store.capturedSquareIds), distanceMeters: distanceMeters)

        if let active = store.activeWalk {
            walk = active
        }

        Task {
            await liveActivity.update(walk: walk, latestAccuracy: point.accuracy)
        }
    }
}

extension LocationRecorder: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                state = .idle
                if shouldStartAfterPermission {
                    shouldStartAfterPermission = false
                    start()
                }
            case .denied, .restricted:
                shouldStartAfterPermission = false
                state = .denied
            case .notDetermined:
                state = .idle
            @unknown default:
                state = .failed("Unknown location permission state")
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            locations.forEach {
                updateLatestLocation($0)
                accept(location: $0)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            state = .failed(error.localizedDescription)
        }
    }
}
