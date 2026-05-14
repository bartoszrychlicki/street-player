import WidgetKit
import SwiftUI

@main
struct WalkLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        WalkLiveActivityView()
    }
}

struct WalkLiveActivityView: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WalkActivityAttributes.self) { context in
            HStack {
                VStack(alignment: .leading) {
                    Text("Street Player")
                        .font(.headline)
                    Text("\(context.state.elapsedSeconds / 60):\(String(format: "%02d", context.state.elapsedSeconds % 60))")
                        .font(.title2.monospacedDigit().bold())
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text(context.state.distanceMeters >= 1000
                         ? String(format: "%.2f km", context.state.distanceMeters / 1000)
                         : "\(Int(context.state.distanceMeters)) m")
                    Text("\(context.state.pointCount) GPS")
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("Street Player")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.pointCount) pts")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Recording \(context.state.elapsedSeconds / 60):\(String(format: "%02d", context.state.elapsedSeconds % 60))")
                }
            } compactLeading: {
                Image(systemName: "figure.walk")
            } compactTrailing: {
                Text("\(context.state.elapsedSeconds / 60)m")
            } minimal: {
                Image(systemName: "figure.walk")
            }
        }
    }
}
