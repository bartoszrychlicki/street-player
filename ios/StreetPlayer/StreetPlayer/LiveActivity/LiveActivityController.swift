import ActivityKit
import Foundation

@MainActor
final class LiveActivityController {
    private var activity: Activity<WalkActivityAttributes>?

    func start(walk: LocalWalk) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = WalkActivityAttributes(walkID: walk.id, startedAt: walk.startedAt)
        let state = WalkActivityAttributes.ContentState(
            elapsedSeconds: 0,
            distanceMeters: 0,
            pointCount: 0,
            gpsAccuracyMeters: nil
        )

        do {
            activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: nil),
                pushType: nil
            )
        } catch {
            print("Failed to start Live Activity: \(error)")
        }
    }

    func update(walk: LocalWalk, latestAccuracy: Double?) async {
        let state = WalkActivityAttributes.ContentState(
            elapsedSeconds: walk.durationSeconds,
            distanceMeters: walk.distanceMeters,
            pointCount: walk.points.count,
            gpsAccuracyMeters: latestAccuracy
        )
        await activity?.update(.init(state: state, staleDate: nil))
    }

    func end() async {
        await activity?.end(nil, dismissalPolicy: .immediate)
        activity = nil
    }
}
