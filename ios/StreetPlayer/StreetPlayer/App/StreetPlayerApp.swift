import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct StreetPlayerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var auth = AuthViewModel()
    @StateObject private var store = LocalStore()
    @StateObject private var api = APIClient()
    @StateObject private var grid = GridCaptureEstimator()
    @StateObject private var recorder = LocationRecorder()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .environmentObject(store)
                .environmentObject(api)
                .environmentObject(grid)
                .environmentObject(recorder)
                .onAppear {
                    api.idTokenProvider = { try await auth.idToken() }
                    recorder.configure(store: store, grid: grid)
                    Task { await auth.start() }
                }
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
